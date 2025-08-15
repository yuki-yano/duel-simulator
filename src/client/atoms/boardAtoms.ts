// Re-export from separated modules
export * from "./types"
export * from "./core/gameState"
export * from "./core/operations"
export * from "./ui/selection"
export * from "./ui/domRefs"
export * from "./deck/deckState"
export * from "./replay/recording"
export * from "./replay/playback"
export * from "./replay/animations"
export * from "./history/historyStack"
export * from "./history/undoRedo"
export * from "./operations/movement"
export * from "./operations/rotation"
export * from "./operations/effects"
export * from "./operations/gameActions"
export { getZoneDisplayName } from "./helpers/zoneHelpers"
export { findMovedCards } from "./helpers/cardHelpers"
export { createInitialGameState, createInitialPlayerBoard, applyOperation } from "./helpers/stateHelpers"
export { addToHistory } from "./history/historyStack"

// Legacy imports (to be removed gradually)
import { atom } from "jotai"
import { v4 as uuidv4 } from "uuid"
import { nanoid } from "nanoid"
import { produce } from "immer"
import { TOKEN_IMAGE_DATA_URL } from "@/client/constants/tokenImage"
import type {
  Card,
  GameState,
  Position,
  GameOperation,
} from "../../shared/types/game"
import { ANIM, REPLAY_DELAY, INITIAL_DOM_WAIT } from "@/client/constants/animation"

// Import from separated modules
import type { Getter, Setter, HistoryEntry, CardAnimation } from "./types"
import { gameStateAtom } from "./core/gameState"
import { operationsAtom } from "./core/operations"
import { selectedCardAtom, draggedCardAtom, hoveredZoneAtom, highlightedZonesAtom } from "./ui/selection"
import { initialStateAfterDeckLoadAtom } from "./deck/deckState"
import { 
  replayRecordingAtom, 
  replayOperationsAtom, 
  replayDataAtom,
  replayStartIndexAtom,
  stopReplayRecordingAtom
} from "./replay/recording"
import {
  replayPlayingAtom,
  replayPausedAtom,
  replayCurrentIndexAtom,
  replayTotalOperationsAtom,
  stopReplayAtom
} from "./replay/playback"
import {
  cardAnimationsAtom,
  replaySpeedAtom,
  getAnimationDuration,
  getCardElementPosition,
  getCardRect
} from "./replay/animations"
import { 
  getCardById,
  findMovedCards
} from "./helpers/cardHelpers"
import {
  performCardMove,
  performCardRotation,
  performCardFlip,
  performCardHighlightToggle,
  performUpdateCounter,
  applyOperation,
  createInitialGameState
} from "./helpers/stateHelpers"
import { getOperationDescription } from "./helpers/operationHelpers"

// Animation helpers moved to replay/animations.ts
// Note: findMovedCards is now imported from ./helpers/cardHelpers
// Note: createInitialPlayerBoard and createInitialGameState are now imported from ./helpers/stateHelpers
// Note: gameStateAtom and operationsAtom are now imported from ./core modules
// Note: DOM ref atoms are now imported from ./ui/domRefs

// Note: HistoryEntry is now imported from ./types

// History for undo/redo
export const gameHistoryAtom = atom<HistoryEntry[]>([
  {
    gameState: createInitialGameState(),
    operationCount: 0,
    operations: [],
  },
])
export const gameHistoryIndexAtom = atom<number>(0)

// Note: UI state atoms are now imported from ./ui/selection

// Note: Deck atoms are now imported from ./deck/deckState
// Note: highlightedZonesAtom is imported from ./ui/selection

// Note: currentPhaseAtom is now imported from ./core/gameState

// Note: Getter and Setter types are now imported from ./types

const addToHistory = (get: Getter, set: Setter, newState: GameState) => {
  const history = get(gameHistoryAtom)
  const currentIndex = get(gameHistoryIndexAtom)
  const operations = get(operationsAtom)

  // Create new history entry
  const newEntry: HistoryEntry = {
    gameState: newState,
    operationCount: operations.length,
    operations: [...operations], // Store a copy of operations
  }

  // Remove future history if we're in the middle of the history
  const newHistory = [...history.slice(0, currentIndex + 1), newEntry]

  // Limit history size to prevent memory issues
  const limitedHistory = newHistory.slice(-50)

  set(gameHistoryAtom, limitedHistory)
  set(gameHistoryIndexAtom, limitedHistory.length - 1)
}

// Set game state with history atom
export const setGameStateWithHistoryAtom = atom(null, (get, set, newState: GameState) => {
  set(gameStateAtom, newState)
  addToHistory(get, set, newState)
})

// Reset history with new initial state
export const resetHistoryAtom = atom(null, (get, set, newState: GameState) => {
  set(gameStateAtom, newState)
  set(gameHistoryAtom, [
    {
      gameState: newState,
      operationCount: 0,
      operations: [],
    },
  ])
  set(gameHistoryIndexAtom, 0)
  set(operationsAtom, []) // Clear operations as well
})

// Undo atom
export const undoAtom = atom(null, async (get, set) => {
  const history = get(gameHistoryAtom)
  const currentIndex = get(gameHistoryIndexAtom)
  const isPlaying = get(replayPlayingAtom)

  if (currentIndex > 0) {
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

    // Update state immediately
    set(gameStateAtom, previousEntry.gameState)
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
    const isPaused = get(replayPausedAtom)
    if (removedOperations.length > 0 && (!isPlaying || isPaused)) {
      const currentSpeed = get(replaySpeedAtom)
      // Fire and forget animation
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
        await new Promise((resolve) => setTimeout(resolve, 100))
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
        await new Promise((resolve) => setTimeout(resolve, INITIAL_DOM_WAIT))

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

    // Update state immediately
    set(gameStateAtom, nextEntry.gameState)
    set(gameHistoryIndexAtom, newIndex)

    // Restore operations from history
    set(operationsAtom, [...nextEntry.operations])

    // Update replay current index if replay was stopped (for resume functionality)
    if (!isPlaying && get(replayCurrentIndexAtom) != null) {
      // Set the operation count (not history index) as replay current index
      set(replayCurrentIndexAtom, nextEntry.operationCount)
    }

    // Find operations that need to be added to replay
    const operationsToAdd = nextEntry.operations.slice(currentEntry.operationCount, nextEntry.operationCount)

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
    const isPaused = get(replayPausedAtom)
    if (operationsToAdd.length > 0 && (!isPlaying || isPaused)) {
      const currentSpeed = get(replaySpeedAtom)
      // Fire and forget animation
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

  // Enable undo when not replaying or when paused
  if (!isPlaying || isPaused) {
    return currentIndex > 0
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

  // Normal redo logic when not replaying
  if (!isPlaying && replayCurrentIndex === null) {
    return currentIndex < history.length - 1
  }

  // Disable during active replay
  return false
})

// Reset to initial state (deck loaded state)
export const resetToInitialStateAtom = atom(null, (get, set) => {
  const initialState = get(initialStateAfterDeckLoadAtom)

  if (initialState) {
    // Create a deep copy of the initial state
    const resetState = produce(initialState, () => {})

    // Reset game state and clear history
    set(resetHistoryAtom, resetState)

    // Clear any active animations or UI state
    set(selectedCardAtom, null)
    set(draggedCardAtom, null)
    set(hoveredZoneAtom, null)
    set(highlightedZonesAtom, [])
    set(cardAnimationsAtom, [])

    // Stop any active replay
    if (get(replayPlayingAtom)) {
      set(stopReplayAtom)
    }

    // Stop recording if active
    if (get(replayRecordingAtom)) {
      set(stopReplayRecordingAtom)
    }
  }
})

// Helper function to get zone display name
// getZoneDisplayName is now imported from helpers/zoneHelpers.ts

// Get operation description from game states
// Note: getOperationDescription is now imported from ./helpers/operationHelpers

// Note: getCardsInZone is now imported from ./helpers/zoneHelpers

// Note: findCardInState is now imported from ./helpers/cardHelpers

// Get undo/redo operation description
export const undoOperationDescriptionAtom = atom((get) => {
  const history = get(gameHistoryAtom)
  const currentIndex = get(gameHistoryIndexAtom)
  const operations = get(operationsAtom)

  if (currentIndex > 0) {
    const prevEntry = history[currentIndex - 1]
    const currentEntry = history[currentIndex]

    // Check if only operations changed (same gameState = effect activation)
    // Optimization: Check operation count first before expensive JSON comparison
    if (currentEntry.operationCount > prevEntry.operationCount) {
      const lastOperation = operations[currentEntry.operationCount - 1]
      if (lastOperation?.type === "activate") {
        return "効果発動"
      }
    }

    return getOperationDescription(prevEntry.gameState, currentEntry.gameState)
  }

  return null
})

export const redoOperationDescriptionAtom = atom((get) => {
  const history = get(gameHistoryAtom)
  const currentIndex = get(gameHistoryIndexAtom)
  const operations = get(operationsAtom)

  if (currentIndex < history.length - 1) {
    const currentEntry = history[currentIndex]
    const nextEntry = history[currentIndex + 1]

    // Check if only operations changed (same gameState = effect activation)
    // Optimization: Check operation count first before expensive JSON comparison
    if (nextEntry.operationCount > currentEntry.operationCount) {
      const nextOperation = operations[nextEntry.operationCount - 1]
      if (nextOperation?.type === "activate") {
        return "効果発動"
      }
    }

    return getOperationDescription(currentEntry.gameState, nextEntry.gameState)
  }

  return null
})

// Note: ReplayData interface is now imported from ./types
// Replay atoms moved to replay/recording.ts and replay/playback.ts

// Track if replay has ever been played in replay mode
export const hasEverPlayedInReplayModeAtom = atom<boolean>(false)

// Animation cancellation controller
let animationController: AbortController | null = null

// Helper function to create animations from operations
function createAnimationsFromOperations(
  operations: GameOperation[],
  prevState: GameState,
  nextState: GameState,
  isReverse: boolean = false,
  speedMultiplier: number = 1,
  get: Getter,
): CardAnimation[] {
  const animations: CardAnimation[] = []
  const animationDuration = Math.floor((ANIM.MOVE.ANIMATION * 2) / (3 * speedMultiplier))

  for (const operation of operations) {
    switch (operation.type) {
      case "move":
      case "summon":
      case "set":
      case "draw": {
        let cardImageUrl: string | undefined
        let fromRotation = 0
        let toRotation = 0

        if (isReverse) {
          // Undo animation: animate from current position (operation.to) back to original position (operation.from)
          if (operation.to) {
            const currentPlayer = prevState.players[operation.to.player]
            const currentCard = getCardById(currentPlayer, operation.cardId)
            if (currentCard) {
              cardImageUrl = currentCard.card.name === "token" ? TOKEN_IMAGE_DATA_URL : currentCard.card.imageUrl
              fromRotation = currentCard.card.rotation ?? 0
            }
          }

          if (operation.from) {
            const targetPlayer = nextState.players[operation.from.player]
            const targetCard = getCardById(targetPlayer, operation.cardId)
            if (targetCard) {
              toRotation = targetCard.card.rotation ?? 0
            }
          }
        } else {
          // Forward animation: animate from operation.from to operation.to
          const fromPlayerKey = operation.from?.player ?? operation.player
          const fromPlayer = prevState.players[fromPlayerKey]
          const fromCard = getCardById(fromPlayer, operation.cardId)
          if (fromCard) {
            cardImageUrl = fromCard.card.name === "token" ? TOKEN_IMAGE_DATA_URL : fromCard.card.imageUrl
            fromRotation = fromCard.card.rotation ?? 0
          }

          if (operation.to) {
            const toPlayer = nextState.players[operation.to.player]
            const toCard = getCardById(toPlayer, operation.cardId)
            if (toCard) {
              toRotation = toCard.card.rotation ?? 0
            }
          }
        }

        // Get card element position before state change
        const cardPos = getCardElementPosition(operation.cardId, get)
        if (cardPos && cardImageUrl !== undefined) {
          animations.push({
            id: uuidv4(),
            type: "move",
            cardId: operation.cardId,
            cardImageUrl,
            fromPosition: cardPos,
            toPosition: cardPos, // Will be updated after state change
            fromRotation,
            toRotation,
            startTime: Date.now(),
            duration: animationDuration,
          })
        }
        break
      }

      case "rotate":
        if (operation.metadata && "angle" in operation.metadata) {
          // prev / next のカード回転角を取得
          const prevPlayer = prevState.players[operation.player]
          const nextPlayer = nextState.players[operation.player]

          const prevCardRes = getCardById(prevPlayer, operation.cardId)
          const nextCardRes = getCardById(nextPlayer, operation.cardId)

          const fromRotation = prevCardRes?.card.rotation ?? 0
          const toRotation = nextCardRes?.card.rotation ?? (operation.metadata.angle as number)

          // Get card element rect (位置は prevState 時点で取得)
          const cardRect = getCardRect(operation.cardId, get)

          // Get card image URL (優先的に prev → next の順で取得)
          let cardImageUrl: string | undefined
          const cardForImage = prevCardRes?.card ?? nextCardRes?.card
          if (cardForImage) {
            cardImageUrl = cardForImage.name === "token" ? TOKEN_IMAGE_DATA_URL : cardForImage.imageUrl
          }

          animations.push({
            id: uuidv4(),
            type: "rotate",
            cardId: operation.cardId,
            cardImageUrl,
            cardRect,
            fromRotation,
            toRotation,
            startTime: Date.now(),
            duration: animationDuration / 2,
          })
        }
        break

      case "changePosition":
        if (operation.to) {
          // Get card element position
          const cardRect = getCardRect(operation.cardId, get)

          const position: Position = {
            zone: {
              player: operation.to.player,
              type: operation.to.zoneType,
              index: operation.to.zoneIndex,
              cardId: operation.cardId,
            },
            cardId: operation.cardId,
          }

          animations.push({
            id: uuidv4(),
            type: "changePosition",
            cardId: operation.cardId,
            position,
            cardRect,
            startTime: Date.now(),
            duration: animationDuration / 2,
          })
        }
        break

      case "toggleHighlight":
        if (operation.to) {
          const position: Position = {
            zone: {
              player: operation.to.player,
              type: operation.to.zoneType,
              index: operation.to.zoneIndex,
              cardId: operation.cardId,
            },
            cardId: operation.cardId,
          }

          // Card rect
          const cardRect = getCardRect(operation.cardId, get)

          // Rotation & image
          let cardRotation: number | undefined = 0
          let cardImageUrl: string | undefined
          if (operation.cardId) {
            const state = isReverse ? prevState : nextState
            const player = state.players[operation.to.player]
            const res = getCardById(player, operation.cardId)
            if (res) {
              cardRotation = res.card.rotation
              cardImageUrl = res.card.imageUrl
            }
          }

          animations.push({
            id: uuidv4(),
            type: "highlight",
            cardId: operation.cardId,
            cardImageUrl,
            position,
            cardRect,
            cardRotation,
            startTime: Date.now(),
            duration: animationDuration / 2,
          })
        }
        break

      case "activate":
        if (operation.to) {
          // Get card element position
          const cardRect = getCardRect(operation.cardId, get)

          // Get card rotation from state
          let cardRotation: number | undefined = 0
          const state = isReverse ? prevState : nextState
          const player = state.players[operation.to.player]
          const result = getCardById(player, operation.cardId)
          if (result) {
            cardRotation = result.card.rotation
          }

          const position: Position = {
            zone: {
              player: operation.to.player,
              type: operation.to.zoneType,
              index: operation.to.zoneIndex,
              cardId: operation.cardId,
            },
            cardId: operation.cardId,
          }

          let cardImageUrl: string | undefined
          if (result) {
            cardImageUrl = result.card.imageUrl
          }

          animations.push({
            id: uuidv4(),
            type: "activate",
            cardId: operation.cardId,
            cardImageUrl,
            position,
            cardRect,
            cardRotation,
            startTime: Date.now(),
            duration: animationDuration,
          })
        }
        break

      case "target":
        if (operation.to) {
          // Get card element position
          const cardRect = getCardRect(operation.cardId, get)

          // Get card rotation from state
          let cardRotation: number | undefined = 0
          const state = isReverse ? prevState : nextState
          const player = state.players[operation.to.player]
          const result = getCardById(player, operation.cardId)
          if (result) {
            cardRotation = result.card.rotation
          }

          const position: Position = {
            zone: {
              player: operation.to.player,
              type: operation.to.zoneType,
              index: operation.to.zoneIndex,
              cardId: operation.cardId,
            },
            cardId: operation.cardId,
          }

          let cardImageUrl: string | undefined
          if (result) {
            cardImageUrl = result.card.imageUrl
          }

          animations.push({
            id: uuidv4(),
            type: "target",
            cardId: operation.cardId,
            cardImageUrl,
            position,
            cardRect,
            cardRotation,
            startTime: Date.now(),
            duration: animationDuration,
          })
        }
        break
    }
  }

  return animations
}

// Helper function to play animations from operations
async function playOperationAnimations(
  get: Getter,
  set: Setter,
  operations: GameOperation[],
  fromState: GameState,
  toState: GameState,
  isReverse: boolean = false,
  speedMultiplier: number = 1,
): Promise<void> {
  // Cancel any existing animation
  if (animationController) {
    animationController.abort()
  }

  // Create new controller for this animation
  animationController = new AbortController()
  const signal = animationController.signal

  // Create animations from operations
  const animations = createAnimationsFromOperations(operations, fromState, toState, isReverse, speedMultiplier, get)

  if (animations.length === 0) return

  try {
    // Set initial animations
    set(cardAnimationsAtom, animations)

    // Apply new state
    set(gameStateAtom, toState)

    // Small delay to ensure DOM is updated
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(resolve, 50)
      signal.addEventListener("abort", () => {
        clearTimeout(timeout)
        reject(new DOMException("Animation cancelled"))
      })
    })

    // Update move animations with actual end positions
    const updatedAnimations = animations.map((anim) => {
      if (anim.type === "move" && anim.cardId !== undefined) {
        const nextPos = getCardElementPosition(anim.cardId, get)
        return nextPos ? { ...anim, toPosition: nextPos } : anim
      }
      return anim
    })

    // Update animations with correct end positions
    set(cardAnimationsAtom, updatedAnimations)

    // Wait for animation to complete
    const animationDuration = Math.floor((ANIM.MOVE.ANIMATION * 2) / (3 * speedMultiplier))
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(resolve, animationDuration)
      signal.addEventListener("abort", () => {
        clearTimeout(timeout)
        reject(new DOMException("Animation cancelled"))
      })
    })
  } catch (e) {
    if (e instanceof DOMException && e.message === "Animation cancelled") {
      // アニメーションキャンセル時に即座にオーバーレイを消すと
      // 次のアニメーションがセットされるまでの間に空白フレームが発生し
      // チラつきの原因になるため何もしない。
      // 次の playOperationAnimations 呼び出しで cardAnimationsAtom が
      // 上書きされるので自然に置き換わる。
    } else {
      throw e
    }
  } finally {
    // Clean up controller reference
    if (animationController?.signal === signal) {
      animationController = null
    }
  }
}

// Card move action
export const moveCardAtom = atom(
  null,
  (
    get,
    set,
    from: Position,
    to: Position,
    options?: {
      shiftKey?: boolean
      defenseMode?: boolean
      faceDownMode?: boolean
      stackPosition?: "top" | "bottom"
      preventSameZoneReorder?: boolean
    },
  ) => {
    const state = get(gameStateAtom)
    const newState = performCardMove(state, from, to, options)

    // Always record operations and update state, even for same-zone moves
    // This ensures undo/redo and replay work correctly
    const stateChanged = JSON.stringify(state) !== JSON.stringify(newState)

    if (stateChanged) {
      // Record operation with new structure BEFORE adding to history
      const operation: GameOperation = {
        id: uuidv4(),
        timestamp: Date.now(),
        type: "move",
        cardId: from.cardId,
        from: {
          player: from.zone.player,
          zoneType: from.zone.type,
          zoneIndex: from.zone.index,
        },
        to: {
          player: to.zone.player,
          zoneType: to.zone.type,
          zoneIndex: to.zone.index,
          insertPosition: to.zone.index, // Use the zone index as insert position
        },
        player: from.zone.player,
        metadata: options,
      }

      // Update operations BEFORE history
      set(operationsAtom, [...get(operationsAtom), operation])

      // Then update game state and add to history
      set(gameStateAtom, newState)
      addToHistory(get, set, newState)

      // Also record to replay operations if recording
      if (get(replayRecordingAtom)) {
        const currentReplayOps = get(replayOperationsAtom)
        set(replayOperationsAtom, [...currentReplayOps, operation])
      }

      // Clear selected card after move to prevent UI issues
      set(selectedCardAtom, null)
    }
  },
)

// Card rotation action
export const rotateCardAtom = atom(null, (get, set, position: Position, angle: number) => {
  const state = get(gameStateAtom)

  // Get previous rotation before updating
  let prevRotation = 0
  {
    const player = state.players[position.zone.player]
    const res = getCardById(player, position.cardId)
    if (res) prevRotation = res.card.rotation
  }

  const newState = performCardRotation(state, position, angle)

  if (newState !== state) {
    // Create operation BEFORE adding to history
    const operation: GameOperation = {
      id: uuidv4(),
      timestamp: Date.now(),
      type: "rotate",
      cardId: position.cardId,
      to: {
        player: position.zone.player,
        zoneType: position.zone.type,
        zoneIndex: position.zone.index,
      },
      player: position.zone.player,
      metadata: { angle },
    }

    // Create rotate animation BEFORE updating state to prevent flicker
    const cardRect = getCardRect(position.cardId, get)

    if (cardRect) {
      // Retrieve card image URL from current state (before update)
      const player = state.players[position.zone.player]
      const res = getCardById(player, position.cardId)

      const cardImageUrl = res ? (res.card.name === "token" ? TOKEN_IMAGE_DATA_URL : res.card.imageUrl) : undefined

      const animation: CardAnimation = {
        id: uuidv4(),
        type: "rotate",
        cardId: position.cardId,
        cardImageUrl,
        cardRect,
        fromRotation: prevRotation,
        toRotation: angle,
        startTime: Date.now(),
        duration: ANIM.ROTATION.ANIMATION,
      }

      const existingAnims = get(cardAnimationsAtom)
      set(cardAnimationsAtom, [...existingAnims, animation])
    }

    // Delay state update by 1 frame to prevent flicker
    requestAnimationFrame(() => {
      // Update operations BEFORE history
      set(operationsAtom, [...get(operationsAtom), operation])

      // Then update game state and add to history
      set(gameStateAtom, newState)
      addToHistory(get, set, newState)

      // Also record to replay operations if recording
      if (get(replayRecordingAtom)) {
        set(replayOperationsAtom, [...get(replayOperationsAtom), operation])
      }
    })
  }
})

// Card flip (face up/down) action
export const flipCardAtom = atom(null, (get, set, position: Position) => {
  const state = get(gameStateAtom)
  const newState = performCardFlip(state, position)

  if (newState !== state) {
    // Create operation BEFORE adding to history
    const operation: GameOperation = {
      id: uuidv4(),
      timestamp: Date.now(),
      type: "changePosition",
      cardId: position.cardId,
      to: {
        player: position.zone.player,
        zoneType: position.zone.type,
        zoneIndex: position.zone.index,
      },
      player: position.zone.player,
      metadata: { flip: true },
    }

    // Update operations BEFORE history
    set(operationsAtom, [...get(operationsAtom), operation])

    // Then update game state and add to history
    set(gameStateAtom, newState)
    addToHistory(get, set, newState)

    // Also record to replay operations if recording
    if (get(replayRecordingAtom)) {
      set(replayOperationsAtom, [...get(replayOperationsAtom), operation])
    }
  }
})

export const toggleCardHighlightAtom = atom(null, (get, set, position: Position) => {
  const state = get(gameStateAtom)
  const newState = performCardHighlightToggle(state, position)

  if (newState !== state) {
    // Create operation BEFORE adding to history
    const operation: GameOperation = {
      id: uuidv4(),
      timestamp: Date.now(),
      type: "toggleHighlight",
      cardId: position.cardId,
      to: {
        player: position.zone.player,
        zoneType: position.zone.type,
        zoneIndex: position.zone.index,
      },
      player: position.zone.player,
    }

    // Update operations BEFORE history
    set(operationsAtom, [...get(operationsAtom), operation])

    // Then update game state and add to history
    set(gameStateAtom, newState)
    addToHistory(get, set, newState)

    // Also record to replay operations if recording
    if (get(replayRecordingAtom)) {
      set(replayOperationsAtom, [...get(replayOperationsAtom), operation])
    }

    // Create highlight animation for immediate feedback
    const player = newState.players[position.zone.player]
    const result = getCardById(player, position.cardId)
    if (result && result.card.highlighted === true) {
      // Only create animation when turning highlight ON
      const cardRect = getCardRect(position.cardId, get)

      if (cardRect) {
        const animationId = uuidv4()
        const animation: CardAnimation = {
          id: animationId,
          type: "highlight",
          cardId: position.cardId,
          cardImageUrl: result.card.imageUrl,
          position,
          cardRect,
          cardRotation: result.card.rotation,
          startTime: Date.now(),
          duration: ANIM.HIGHLIGHT.ANIMATION,
        }

        // Add animation without checking for duplicates (like target/activate)
        const existingAnimations = get(cardAnimationsAtom)
        set(cardAnimationsAtom, [...existingAnimations, animation])
      }
    }
  }
})

export const updateCounterAtom = atom(null, (get, set, position: Position, counterValue: number) => {
  const state = get(gameStateAtom)
  const newState = performUpdateCounter(state, position, counterValue)

  if (newState !== state) {
    // Create operation BEFORE adding to history
    const operation: GameOperation = {
      id: uuidv4(),
      timestamp: Date.now(),
      type: "updateCounter",
      cardId: position.cardId,
      to: {
        player: position.zone.player,
        zoneType: position.zone.type,
        zoneIndex: position.zone.index,
      },
      player: position.zone.player,
      metadata: { counter: counterValue },
    }

    // Update operations BEFORE history
    set(operationsAtom, [...get(operationsAtom), operation])

    // Then update game state and add to history
    set(gameStateAtom, newState)
    addToHistory(get, set, newState)

    // Also record to replay operations if recording
    if (get(replayRecordingAtom)) {
      set(replayOperationsAtom, [...get(replayOperationsAtom), operation])
    }
  }
})

// Card effect activation action
export const activateEffectAtom = atom(null, (get, set, position: Position, cardElement?: HTMLElement) => {
  try {
    // Get the card at this position to get its ID
    const state = get(gameStateAtom)
    const playerBoard = state.players[position.zone.player]
    let card: Card | null = null

    // Use ID-based approach (cardId is now required)
    const cardId = position.cardId || position.zone.cardId
    if (cardId === undefined) {
      console.error("No cardId provided to activateEffectAtom")
      return
    }
    const result = getCardById(playerBoard, cardId)
    if (result !== null) {
      card = result.card
    }

    // Add card ID to position for zoom effect
    const positionWithCardId = {
      ...position,
      zone: {
        ...position.zone,
        cardId: card?.id,
      },
    }

    // Effect activation doesn't change game state, only visual effect
    const operation: GameOperation = {
      id: uuidv4(),
      timestamp: Date.now(),
      type: "activate",
      cardId: position.cardId,
      to: {
        player: position.zone.player,
        zoneType: position.zone.type,
        zoneIndex: position.zone.index,
      },
      player: position.zone.player,
    }

    set(operationsAtom, [...get(operationsAtom), operation])

    // Also record to replay operations if recording
    if (get(replayRecordingAtom)) {
      set(replayOperationsAtom, [...get(replayOperationsAtom), operation])
    }

    // Get card position if element is provided
    const cardRect = cardElement ? cardElement.getBoundingClientRect() : null

    // Trigger visual effect animation
    const animations = get(cardAnimationsAtom)
    const animationId = uuidv4()

    const newAnimation = {
      id: animationId,
      type: "activate" as const,
      cardId: card?.id,
      position: positionWithCardId,
      cardImageUrl: card?.name === "token" ? TOKEN_IMAGE_DATA_URL : card?.imageUrl,
      cardRect: cardRect
        ? {
            x: cardRect.x,
            y: cardRect.y,
            width: cardRect.width,
            height: cardRect.height,
          }
        : undefined,
      cardRotation: card?.rotation,
      startTime: Date.now(),
    }

    set(cardAnimationsAtom, [...animations, newAnimation])

    // Add to history for undo/redo support (same gameState, but new operation)
    const currentState = get(gameStateAtom)
    addToHistory(get, set, currentState)
  } catch (error) {
    console.error("Error in activateEffectAtom:", error)
    throw error
  }
})

// Target selection action (same as effect activation for now)
export const targetSelectAtom = atom(null, (get, set, position: Position, cardElement?: HTMLElement) => {
  try {
    // Get the card at this position to get its ID
    const state = get(gameStateAtom)
    const playerBoard = state.players[position.zone.player]
    let card: Card | null = null
    // Use ID-based approach (cardId is now required)
    const cardId = position.cardId || position.zone.cardId
    if (cardId === undefined) {
      console.error("No cardId provided to targetSelectAtom")
      return
    }
    const result = getCardById(playerBoard, cardId)
    if (result !== null) {
      card = result.card
    }
    // Add card ID to position for zoom effect
    const positionWithCardId = {
      ...position,
      zone: {
        ...position.zone,
        cardId: card?.id,
      },
    }
    // Target selection doesn't change game state, only visual effect
    const operation: GameOperation = {
      id: uuidv4(),
      timestamp: Date.now(),
      type: "target",
      cardId: position.cardId,
      to: {
        player: position.zone.player,
        zoneType: position.zone.type,
        zoneIndex: position.zone.index,
      },
      player: position.zone.player,
    }
    set(operationsAtom, [...get(operationsAtom), operation])
    // Also record to replay operations if recording
    if (get(replayRecordingAtom)) {
      set(replayOperationsAtom, [...get(replayOperationsAtom), operation])
    }
    // Get card position if element is provided
    const cardRect = cardElement ? cardElement.getBoundingClientRect() : null
    // Trigger visual effect animation
    const animations = get(cardAnimationsAtom)
    const animationId = uuidv4()
    const newAnimation = {
      id: animationId,
      type: "target" as const,
      cardId: card?.id,
      cardImageUrl: card?.imageUrl,
      position: positionWithCardId,
      cardRect: cardRect
        ? {
            x: cardRect.x,
            y: cardRect.y,
            width: cardRect.width,
            height: cardRect.height,
          }
        : undefined,
      cardRotation: card?.rotation,
      startTime: Date.now(),
    }
    set(cardAnimationsAtom, [...animations, newAnimation])
    // Add to history for undo/redo support (same gameState, but new operation)
    const currentState = get(gameStateAtom)
    addToHistory(get, set, currentState)
  } catch (error) {
    console.error("Error in targetSelectAtom:", error)
    throw error
  }
})

// Draw cards from deck to hand
export const drawCardAtom = atom(null, (get, set, player: "self" | "opponent", count: number = 1) => {
  const state = get(gameStateAtom)
  const playerBoard = state.players[player]

  if (playerBoard.deck.length < count) {
    console.warn("Not enough cards in deck")
    return
  }

  const drawnCards = playerBoard.deck.slice(0, count)
  const remainingDeck = playerBoard.deck.slice(count)

  // Remaining deck cards (no index property needed)
  const newDeck = [...remainingDeck]

  // Drawn cards (no zone/index properties needed)
  const drawnCardsWithZone = [...drawnCards]

  const newHand = [...playerBoard.hand, ...drawnCardsWithZone]

  const newState = {
    ...state,
    players: {
      ...state.players,
      [player]: {
        ...playerBoard,
        deck: newDeck,
        hand: newHand,
      },
    },
  }

  // Record draw operation for each card BEFORE updating history
  const operations: GameOperation[] = []
  drawnCards.forEach((card, _index) => {
    const operation: GameOperation = {
      id: uuidv4(),
      timestamp: Date.now(),
      type: "draw",
      cardId: card.id,
      from: {
        player,
        zoneType: "deck",
      },
      to: {
        player,
        zoneType: "hand",
        insertPosition: "last",
      },
      player,
    }
    operations.push(operation)
  })

  // Update operations BEFORE history
  const currentOps = get(operationsAtom)
  set(operationsAtom, [...currentOps, ...operations])

  // Then update game state and add to history
  set(gameStateAtom, newState)
  addToHistory(get, set, newState)

  // Also record to replay operations if recording
  if (get(replayRecordingAtom)) {
    const currentReplayOps = get(replayOperationsAtom)
    set(replayOperationsAtom, [...currentReplayOps, ...operations])
  }
})

// performCardMove, performCardRotation, performCardFlip, performCardHighlightToggle, performUpdateCounter
// are now imported from helpers/stateHelpers.ts

// getCardById is now imported from helpers/cardHelpers.ts

// removeCardFromZoneById is now imported from helpers/zoneHelpers.ts

// addCardToZone is now imported from helpers/zoneHelpers.ts

// updateCardInZone is now imported from helpers/zoneHelpers.ts

// Generate token card atom
export const generateTokenAtom = atom(null, (get, set, targetPlayer: "self" | "opponent" = "self") => {
  const state = get(gameStateAtom)
  const tokenCard: Card = {
    id: nanoid(),
    name: "token",
    imageUrl: TOKEN_IMAGE_DATA_URL,
    position: "attack",
    rotation: 0,
    faceDown: false,
    highlighted: false,
    type: "monster",
  }

  // Create new state with token added to free zone
  const newState = produce(state, (draft) => {
    if (!draft.players[targetPlayer].freeZone) {
      draft.players[targetPlayer].freeZone = []
    }
    draft.players[targetPlayer].freeZone.push(tokenCard)
  })

  // Create operation for history (including token card data for replay)
  const operation: GameOperation = {
    id: nanoid(),
    timestamp: Date.now(),
    type: "summon",
    cardId: tokenCard.id,
    to: {
      player: targetPlayer,
      zoneType: "freeZone",
      insertPosition: "last",
    },
    player: targetPlayer,
    metadata: {
      isToken: true,
      tokenCard: tokenCard, // Include full card data for replay
    },
  }

  // Update operations BEFORE history
  set(operationsAtom, (prev) => [...prev, operation])

  // Then update state and history
  set(gameStateAtom, newState)
  addToHistory(get, set, newState)

  // Also record to replay operations if recording
  if (get(replayRecordingAtom)) {
    set(replayOperationsAtom, (prev) => [...prev, operation])
  }

  return tokenCard
})

// Shuffle deck atom
export const shuffleDeckAtom = atom(null, (get, set, targetPlayer: "self" | "opponent" = "self") => {
  const state = get(gameStateAtom)
  const deck = state.players[targetPlayer].deck

  // Create a shuffled copy of card IDs
  const cardIds = deck.map((card) => card.id)
  const shuffledIds = [...cardIds]

  // Fisher-Yates shuffle
  for (let i = shuffledIds.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffledIds[i], shuffledIds[j]] = [shuffledIds[j], shuffledIds[i]]
  }

  // Create new state with shuffled deck
  const newState = produce(state, (draft) => {
    draft.players[targetPlayer].deck = shuffledIds.map((cardId) => {
      const card = deck.find((c) => c.id === cardId)
      if (!card) throw new Error(`Card ${cardId} not found in deck`)
      return card
    })
  })

  // Create operation for history
  const operation: GameOperation = {
    id: nanoid(),
    timestamp: Date.now(),
    type: "shuffle",
    cardId: "", // Not specific to a single card
    from: {
      player: targetPlayer,
      zoneType: "deck",
    },
    player: targetPlayer,
    metadata: {
      newOrder: shuffledIds, // Record the new order for replay
    },
  }

  // Update operations BEFORE history
  set(operationsAtom, (prev) => [...prev, operation])

  // Then update state and history
  set(gameStateAtom, newState)
  addToHistory(get, set, newState)

  // Also record to replay operations if recording
  if (get(replayRecordingAtom)) {
    set(replayOperationsAtom, (prev) => [...prev, operation])
  }
})

// Draw multiple cards atom
// Force draw flag for 5-card draw confirmation
export const forceDraw5CardsAtom = atom(false)

export const drawMultipleCardsAtom = atom(
  null,
  (get, set, count: number = 5, targetPlayer: "self" | "opponent" = "self") => {
    // Special handling for 5-card draw (reset + shuffle + draw)
    if (count === 5) {
      const state = get(gameStateAtom)
      const player = state.players[targetPlayer]
      const forceDrawFlag = get(forceDraw5CardsAtom)
      const initialState = get(initialStateAfterDeckLoadAtom)

      // Check if cards exist in zones other than hand, deck, and extra deck
      const hasCardsInOtherZones =
        player.monsterZones.some((zone) => zone.length > 0) ||
        player.spellTrapZones.some((zone) => zone.length > 0) ||
        player.extraMonsterZones.some((zone) => zone.length > 0) ||
        player.fieldZone !== null ||
        player.graveyard.length > 0 ||
        player.banished.length > 0 ||
        (player.freeZone?.length ?? 0) > 0 ||
        (player.sideFreeZone?.length ?? 0) > 0

      if (hasCardsInOtherZones && !forceDrawFlag) {
        // Return warning flag instead of performing the action
        return { needsWarning: true }
      }

      // Reset force draw flag
      if (forceDrawFlag) {
        set(forceDraw5CardsAtom, false)
      }

      // Restore original deck contents from initial state (excluding tokens)
      if (!initialState) {
        console.error("No initial state available for 5-card draw")
        return { success: false }
      }

      const initialDeck = initialState.players[targetPlayer].deck
      const initialHand = initialState.players[targetPlayer].hand
      const initialExtraDeck = initialState.players[targetPlayer].extraDeck

      // Combine initial deck and hand cards (they were all originally in the deck)
      const allMainCards = [...initialDeck, ...initialHand]
      const extraCards = [...initialExtraDeck]

      // Shuffle main deck cards
      const shuffledMainCards = [...allMainCards]
      for (let i = shuffledMainCards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[shuffledMainCards[i], shuffledMainCards[j]] = [shuffledMainCards[j], shuffledMainCards[i]]
      }

      // Create new state based on initial state
      const newState = produce(initialState, (draft) => {
        // Clear all zones first (reset to initial state)
        const targetPlayerBoard = draft.players[targetPlayer]

        // Clear all zones
        targetPlayerBoard.monsterZones = [[], [], [], [], []]
        targetPlayerBoard.spellTrapZones = [[], [], [], [], []]
        targetPlayerBoard.extraMonsterZones = [[], []]
        targetPlayerBoard.fieldZone = null
        targetPlayerBoard.graveyard = []
        targetPlayerBoard.banished = []
        targetPlayerBoard.freeZone = []
        targetPlayerBoard.sideFreeZone = []

        // Set up shuffled deck and draw 5
        targetPlayerBoard.hand = shuffledMainCards.slice(0, 5)
        targetPlayerBoard.deck = shuffledMainCards.slice(5)
        targetPlayerBoard.extraDeck = extraCards
      })

      // Reset history to make this operation non-undoable
      // This is essentially a reset operation with shuffle and draw
      set(resetHistoryAtom, newState)

      // Clear any active animations or UI state (same as resetToInitialStateAtom)
      set(selectedCardAtom, null)
      set(draggedCardAtom, null)
      set(hoveredZoneAtom, null)
      set(highlightedZonesAtom, [])
      set(cardAnimationsAtom, [])

      // Stop any active replay
      if (get(replayPlayingAtom)) {
        set(stopReplayAtom)
      }

      // Stop recording if active
      if (get(replayRecordingAtom)) {
        set(stopReplayRecordingAtom)
      }

      return { success: true }
    }

    // Standard draw logic for other counts
    for (let i = 0; i < count; i++) {
      const state = get(gameStateAtom)
      const deck = state.players[targetPlayer].deck

      if (deck.length === 0) {
        // No more cards to draw
        break
      }

      // Draw from top of deck (index 0)
      const cardToDraw = deck[0]

      // Move card from deck to hand
      const fromPosition: Position = {
        zone: {
          player: targetPlayer,
          type: "deck",
          index: 0,
        },
        cardId: cardToDraw.id,
      }

      const toPosition: Position = {
        zone: {
          player: targetPlayer,
          type: "hand",
        },
        cardId: cardToDraw.id,
      }

      // Use moveCard atom to handle the move
      set(moveCardAtom, fromPosition, toPosition)
    }

    return { success: true }
  },
)

// Export internal functions for backward compatibility
export { animationController, playOperationAnimations }
