import { atom } from "jotai"
import type { GameOperation } from "../../../shared/types/game"
import { gameStateAtom } from "../core/gameState"
import { operationsAtom } from "../core/operations"
import { gameHistoryAtom, gameHistoryIndexAtom } from "./historyStack"
import { v4 as uuidv4 } from "uuid"
import { ANIM, REPLAY_DELAY } from "../constants"
import { TOKEN_IMAGE_DATA_URL } from "@/client/constants/tokenImage"
import { DELAYS } from "@/client/constants/delays"
import { applyOperation } from "../helpers/stateHelpers"
import { deckLoadHistoryIndexAtom } from "../deck/deckState"
import { findMovedCards } from "../helpers/cardHelpers"
import { getCardById } from "../helpers/cardHelpers"
import { getOperationDescription } from "../helpers/operationHelpers"
import i18n from "@client/i18n"

import {
  replayPlayingAtom,
  replayPausedAtom,
  replayDataAtom,
  replayCurrentIndexAtom,
  replayTotalOperationsAtom,
  replaySpeedAtom,
} from "../replay/playback"
import { replayRecordingAtom, replayOperationsAtom, replayStartIndexAtom } from "../replay/recording"
import {
  cardAnimationsAtom,
  getCardElementPosition,
  getAnimationDuration,
  getCardRect,
  animationController,
  playOperationAnimations,
} from "../replay/animations"
import { highlightedZonesAtom } from "../ui/selection"
import type { CardAnimation, Position } from "../types"

// Undo atom
export const undoAtom = atom(null, async (get, set) => {
  const history = get(gameHistoryAtom)
  const currentIndex = get(gameHistoryIndexAtom)
  const isPlaying = get(replayPlayingAtom)
  const deckLoadIndex = get(deckLoadHistoryIndexAtom)

  // Don't allow undo before deck load
  if (currentIndex > deckLoadIndex) {
    const newIndex = currentIndex - 1
    const previousEntry = history[newIndex]
    const currentEntry = history[currentIndex] // Get current entry before updating index
    const currentState = get(gameStateAtom)

    // Cancel any existing animation
    if (animationController) {
      animationController.abort()
      set(cardAnimationsAtom, [])
    }

    // Get operations that will be removed BEFORE updating operationsAtom
    const currentOperations = get(operationsAtom)
    const removedOperations: GameOperation[] = []
    // Find operations that will be removed by this undo
    // We need to remove operations between the target state and current state
    for (let i = previousEntry.operationCount; i < currentEntry.operationCount; i++) {
      const op = currentOperations[i]
      if (op != null) {
        removedOperations.push(op)
      }
    }

    // Check if any operation needs animation
    const isPaused = get(replayPausedAtom)
    const hasAnimatableOperations = removedOperations.length > 0 && (!isPlaying || isPaused)

    // If animations will be played, don't update state yet (animations will handle it)
    if (!hasAnimatableOperations) {
      // Update state immediately only when no animations
      set(gameStateAtom, previousEntry.gameState)
    }

    set(gameHistoryIndexAtom, newIndex)

    // Restore operations from history
    set(operationsAtom, [...previousEntry.operations])

    // Update replay current index if replay was stopped (for resume functionality)
    if (!isPlaying && get(replayCurrentIndexAtom) != null) {
      // Set the operation count (not history index) as replay current index
      set(replayCurrentIndexAtom, previousEntry.operationCount)
    }

    // Also trim replay operations if recording
    if (get(replayRecordingAtom)) {
      const replayOps = get(replayOperationsAtom)

      if (removedOperations.length > 0) {
        // Filter out the removed operations from replay operations
        const removedOperationIds = new Set(removedOperations.map((op) => op.id))
        const trimmedReplayOps = replayOps.filter((op) => !removedOperationIds.has(op.id))
        set(replayOperationsAtom, trimmedReplayOps)
      } else if (newIndex === 0 && replayOps.length > 0) {
        // Special case: undoing to initial state (index 0)
        // Remove the last operation from replay operations
        const lastOp = currentOperations[currentOperations.length - 1]
        if (lastOp != null) {
          const trimmedReplayOps = replayOps.filter((op) => op.id !== lastOp.id)
          set(replayOperationsAtom, trimmedReplayOps)
        } else {
          // Fallback: remove the last operation from replay list
          const trimmedReplayOps = replayOps.slice(0, -1)
          set(replayOperationsAtom, trimmedReplayOps)
        }
      }
    }

    // Play animations for removed operations (in reverse)
    if (hasAnimatableOperations) {
      const currentSpeed = get(replaySpeedAtom)
      // Fire and forget animation (animation will update state)
      playOperationAnimations(
        get,
        set,
        removedOperations,
        currentState,
        previousEntry.gameState,
        true,
        currentSpeed,
      ).catch(() => {
        // Ignore cancellation errors
      })
    }
  }
})

// Redo atom
export const redoAtom = atom(null, async (get, set) => {
  const history = get(gameHistoryAtom)
  const currentIndex = get(gameHistoryIndexAtom)
  const isPlaying = get(replayPlayingAtom)
  const replayData = get(replayDataAtom)
  const replayCurrentIndex = get(replayCurrentIndexAtom)
  const totalOperations = get(replayTotalOperationsAtom)

  // Handle redo for stopped replay - continue replay from where it stopped
  if (!isPlaying && replayCurrentIndex !== null && replayCurrentIndex < totalOperations && replayData) {
    // Resume replay from current position
    set(replayPlayingAtom, true)
    set(replayPausedAtom, false)

    // Keep track of current state
    let currentState = get(gameStateAtom)

    // Play remaining operations
    for (let i = replayCurrentIndex; i < replayData.operations.length; i++) {
      // Check if paused or stopped
      if (!get(replayPlayingAtom)) break

      // Wait while paused
      while (get(replayPausedAtom) && get(replayPlayingAtom)) {
        await new Promise((resolve) => setTimeout(resolve, DELAYS.DOM_UPDATE))
      }

      if (!get(replayPlayingAtom)) break

      const operation = replayData.operations[i]

      // Apply operation to get next state
      const nextState = applyOperation(currentState, operation)

      // Find moved cards
      const movedCards = findMovedCards(currentState, nextState)

      if (movedCards.length > 0) {
        // Get positions before state update
        const cardPositions = movedCards.map(({ card }) => ({
          cardId: card.id,
          position: getCardElementPosition(card.id, get),
        }))

        // Create animations for moved cards BEFORE updating state
        const animations: CardAnimation[] = []
        const currentSpeed = get(replaySpeedAtom)
        const animationDuration = Math.floor((ANIM.MOVE.ANIMATION * 2) / (3 * currentSpeed))

        // First, create animations with current positions
        for (const { card, fromZone } of movedCards) {
          const prevPos = cardPositions.find((p) => p.cardId === card.id)?.position

          if (prevPos) {
            // Get rotation info from current and next state
            let fromRotation = 0
            let toRotation = 0

            // Get from rotation
            const fromPlayer = currentState.players[fromZone.player]
            const fromCardResult = getCardById(fromPlayer, card.id)
            if (fromCardResult) {
              fromRotation = fromCardResult.card.rotation ?? 0
            }

            // Get to rotation from next state
            const nextPlayer = nextState.players[operation.to?.player ?? operation.player]
            const toCardResult = getCardById(nextPlayer, card.id)
            if (toCardResult) {
              toRotation = toCardResult.card.rotation ?? 0
            }

            animations.push({
              id: uuidv4(),
              type: "move",
              cardId: card.id,
              cardImageUrl: card.name === "token" ? TOKEN_IMAGE_DATA_URL : card.imageUrl,
              fromPosition: prevPos,
              toPosition: prevPos, // Will be updated after state change
              fromRotation,
              toRotation,
              startTime: Date.now(),
              duration: animationDuration,
            })
          }
        }

        // Start animations (cards will be hidden)
        if (animations.length > 0) {
          set(cardAnimationsAtom, animations)
        }

        // Apply next state WITHOUT adding to history (history is pre-built)
        set(gameStateAtom, nextState)
        set(gameHistoryIndexAtom, i + 1)
        set(replayCurrentIndexAtom, i + 1)
        currentState = nextState

        // Small delay to ensure DOM is updated
        await new Promise((resolve) => setTimeout(resolve, DELAYS.INITIAL_DOM_WAIT))

        // Update animations with actual end positions
        const updatedAnimations = animations.map((anim) => {
          const nextPos = anim.cardId !== undefined ? getCardElementPosition(anim.cardId, get) : null
          return nextPos !== null ? { ...anim, toPosition: nextPos } : anim
        })

        // Update animations with correct end positions
        set(cardAnimationsAtom, updatedAnimations)

        // Wait for animation to complete
        await new Promise((resolve) => setTimeout(resolve, Math.round(ANIM.MOVE.ANIMATION / get(replaySpeedAtom))))
      } else {
        // Handle non-movement operations
        if (operation.type === "rotate" && operation.to && operation.metadata && "angle" in operation.metadata) {
          // Create rotate animation BEFORE updating state
          const animationId = uuidv4()
          const animations = get(cardAnimationsAtom)

          // Get current rotation from current state (before update)
          let fromRotation = 0
          if (operation.cardId) {
            const currentPlayer = currentState.players[operation.player]
            const currentCardRes = getCardById(currentPlayer, operation.cardId)
            if (currentCardRes) {
              fromRotation = currentCardRes.card.rotation ?? 0
            }
          }

          const toRotation = operation.metadata.angle as number

          // Get card rect and image URL
          const cardRect = getCardRect(operation.cardId, get)
          let cardImageUrl: string | undefined
          if (operation.cardId) {
            const player = currentState.players[operation.player]
            const cardRes = getCardById(player, operation.cardId)
            if (cardRes) {
              cardImageUrl = cardRes.card.imageUrl
            }
          }

          if (cardRect !== undefined && cardImageUrl !== undefined) {
            // Create rotation animation
            set(cardAnimationsAtom, [
              ...animations,
              {
                id: animationId,
                type: "rotate",
                cardId: operation.cardId,
                cardImageUrl,
                cardRect,
                fromRotation,
                toRotation,
                startTime: Date.now(),
                duration: ANIM.ROTATION.ANIMATION,
              },
            ])
          }

          // Delay state update by 1 frame to prevent flicker
          await new Promise<void>((resolve) => {
            requestAnimationFrame(() => {
              set(gameStateAtom, nextState)
              set(gameHistoryIndexAtom, i + 1)
              set(replayCurrentIndexAtom, i + 1)
              currentState = nextState
              resolve()
            })
          })

          await new Promise((resolve) => setTimeout(resolve, getAnimationDuration(ANIM.ROTATION.DURATION, get)))
        } else if (operation.type === "activate" && operation.to) {
          set(gameStateAtom, nextState)
          set(gameHistoryIndexAtom, i + 1)
          set(replayCurrentIndexAtom, i + 1)
          currentState = nextState

          await new Promise((resolve) => setTimeout(resolve, getAnimationDuration(REPLAY_DELAY, get)))

          // Create activation animation
          const animationId = uuidv4()
          const animations = get(cardAnimationsAtom)

          const cardRect = getCardRect(operation.cardId, get)

          let cardRotation: number | undefined = 0
          if (operation.to != null && operation.cardId != null) {
            const player = currentState.players[operation.to.player]
            const result = getCardById(player, operation.cardId)
            if (result != null) {
              cardRotation = result.card.rotation
            }
          }

          const position: Position | undefined =
            operation.to != null
              ? {
                  zone: {
                    player: operation.to.player,
                    type: operation.to.zoneType,
                    index: operation.to.zoneIndex,
                    cardId: operation.cardId,
                  },
                  cardId: operation.cardId,
                }
              : undefined

          // Get card image URL (fallback for token)
          let cardImageUrl: string | undefined
          if (operation.cardId) {
            const player = currentState.players[operation.to.player]
            const res = getCardById(player, operation.cardId)
            if (res) {
              cardImageUrl = res.card.name === "token" ? TOKEN_IMAGE_DATA_URL : res.card.imageUrl
            }
          }

          set(cardAnimationsAtom, [
            ...animations,
            {
              id: animationId,
              type: "activate",
              cardId: operation.cardId,
              cardImageUrl,
              position,
              cardRect,
              cardRotation,
              startTime: Date.now(),
            },
          ])

          setTimeout(
            () => {
              set(cardAnimationsAtom, (anims) => anims.filter((a) => a.id !== animationId))
            },
            getAnimationDuration(ANIM.EFFECT.ANIMATION, get),
          )

          await new Promise((resolve) => setTimeout(resolve, getAnimationDuration(ANIM.EFFECT.DURATION, get)))
        } else {
          set(gameStateAtom, nextState)
          set(gameHistoryIndexAtom, i + 1)
          set(replayCurrentIndexAtom, i + 1)
          currentState = nextState

          await new Promise((resolve) => setTimeout(resolve, Math.round(ANIM.MOVE.ANIMATION / get(replaySpeedAtom))))
        }
      }
    }

    // Wait for final animation
    const finalOperation = replayData.operations[replayData.operations.length - 1]
    if (finalOperation !== undefined) {
      if (finalOperation.type === "move" || finalOperation.type === "draw") {
        await new Promise((resolve) => setTimeout(resolve, Math.round(ANIM.MOVE.ANIMATION / get(replaySpeedAtom))))
      } else if (finalOperation.type === "rotate") {
        await new Promise((resolve) => setTimeout(resolve, getAnimationDuration(ANIM.ROTATION.DURATION, get)))
      } else if (finalOperation.type === "activate") {
        await new Promise((resolve) => setTimeout(resolve, getAnimationDuration(ANIM.EFFECT.DURATION, get)))
      }
    }

    // End replay
    set(replayPlayingAtom, false)
    set(replayPausedAtom, false)
    set(replayCurrentIndexAtom, null)
    set(cardAnimationsAtom, [])
    set(highlightedZonesAtom, [])
    return
  }

  // Normal redo during pause or non-replay
  if (currentIndex < history.length - 1) {
    const newIndex = currentIndex + 1
    const nextEntry = history[newIndex]
    const currentEntry = history[currentIndex]
    const currentState = get(gameStateAtom)

    // Cancel any existing animation
    if (animationController) {
      animationController.abort()
      set(cardAnimationsAtom, [])
    }

    // Find operations that need to be added to replay
    const operationsToAdd = nextEntry.operations.slice(currentEntry.operationCount, nextEntry.operationCount)

    // Check if any operation needs animation
    const isPaused = get(replayPausedAtom)
    const hasAnimatableOperations = operationsToAdd.length > 0 && (!isPlaying || isPaused)

    // If animations will be played, don't update state yet (animations will handle it)
    if (!hasAnimatableOperations) {
      // Update state immediately only when no animations
      set(gameStateAtom, nextEntry.gameState)
    }

    set(gameHistoryIndexAtom, newIndex)

    // Restore operations from history
    set(operationsAtom, [...nextEntry.operations])

    // Update replay current index if replay was stopped (for resume functionality)
    if (!isPlaying && get(replayCurrentIndexAtom) != null) {
      // Set the operation count (not history index) as replay current index
      set(replayCurrentIndexAtom, nextEntry.operationCount)
    }

    // Also add to replay operations if recording
    if (get(replayRecordingAtom)) {
      const replayStartOperationCount = get(replayStartIndexAtom) ?? 0
      const replayOps = get(replayOperationsAtom)

      // Only add operations that occurred after replay recording started
      const newOperations = operationsToAdd.filter((_, index) => {
        const operationIndex = currentEntry.operationCount + index
        return operationIndex >= replayStartOperationCount
      })

      if (newOperations.length > 0) {
        set(replayOperationsAtom, [...replayOps, ...newOperations])
      }
    }

    // Play animations for added operations
    if (hasAnimatableOperations) {
      const currentSpeed = get(replaySpeedAtom)
      // Fire and forget animation (animation will update state)
      playOperationAnimations(get, set, operationsToAdd, currentState, nextEntry.gameState, false, currentSpeed).catch(
        () => {
          // Ignore cancellation errors
        },
      )
    }
  }
})

// Can undo/redo atoms
export const canUndoAtom = atom((get) => {
  const currentIndex = get(gameHistoryIndexAtom)
  const isPlaying = get(replayPlayingAtom)
  const isPaused = get(replayPausedAtom)
  const deckLoadIndex = get(deckLoadHistoryIndexAtom)

  // Enable undo when not replaying or when paused, but not before deck load
  if (!isPlaying || isPaused) {
    return currentIndex > deckLoadIndex
  }

  // Disable during active replay
  return false
})

export const canRedoAtom = atom((get) => {
  const history = get(gameHistoryAtom)
  const currentIndex = get(gameHistoryIndexAtom)
  const isPlaying = get(replayPlayingAtom)
  const isPaused = get(replayPausedAtom)
  const replayCurrentIndex = get(replayCurrentIndexAtom)
  const totalOperations = get(replayTotalOperationsAtom)

  // Enable redo when paused
  if (isPlaying && isPaused) {
    return currentIndex < history.length - 1
  }

  // After replay is stopped, enable redo if there are more operations
  if (!isPlaying && replayCurrentIndex !== null && replayCurrentIndex < totalOperations) {
    return currentIndex < history.length - 1
  }

  // Normal redo
  if (!isPlaying) {
    return currentIndex < history.length - 1
  }

  // Disable during active replay
  return false
})

// Get undo/redo operation description
export const undoOperationDescriptionAtom = atom((get) => {
  // Only show Japanese descriptions when language is Japanese
  const currentLanguage = i18n.language
  if (currentLanguage !== "ja") {
    return null
  }

  const history = get(gameHistoryAtom)
  const currentIndex = get(gameHistoryIndexAtom)
  const operations = get(operationsAtom)

  if (currentIndex > 0) {
    const prevEntry = history[currentIndex - 1]
    const currentEntry = history[currentIndex]

    // Check if only operations changed (same gameState = effect activation or negate)
    // Optimization: Check operation count first before expensive JSON comparison
    if (currentEntry.operationCount > prevEntry.operationCount) {
      const lastOperation = operations[currentEntry.operationCount - 1]
      if (lastOperation?.type === "activate") {
        return "効果発動"
      }
      if (lastOperation?.type === "negate") {
        return "無効化"
      }
    }

    return getOperationDescription(prevEntry.gameState, currentEntry.gameState)
  }

  return null
})

export const redoOperationDescriptionAtom = atom((get) => {
  // Only show Japanese descriptions when language is Japanese
  const currentLanguage = i18n.language
  if (currentLanguage !== "ja") {
    return null
  }

  const history = get(gameHistoryAtom)
  const currentIndex = get(gameHistoryIndexAtom)
  const operations = get(operationsAtom)

  if (currentIndex < history.length - 1) {
    const currentEntry = history[currentIndex]
    const nextEntry = history[currentIndex + 1]

    // Check if only operations changed (same gameState = effect activation or negate)
    // Optimization: Check operation count first before expensive JSON comparison
    if (nextEntry.operationCount > currentEntry.operationCount) {
      const nextOperation = operations[nextEntry.operationCount - 1]
      if (nextOperation?.type === "activate") {
        return "効果発動"
      }
      if (nextOperation?.type === "negate") {
        return "無効化"
      }
    }

    return getOperationDescription(currentEntry.gameState, nextEntry.gameState)
  }

  return null
})
