import { atom } from "jotai"
import type { WritableAtom } from "jotai"
import { produce } from "immer"
import type { Getter, Setter, HistoryEntry, CardAnimation } from "../types"
import type { GameState, GameOperation, Card } from "@/shared/types/game"
import { gameStateAtom } from "../core/gameState"
import { gameHistoryAtom, gameHistoryIndexAtom, resetHistoryAtom } from "../history/historyStack"
import { highlightedZonesAtom } from "../ui/selection"
import { replayDataAtom } from "./recording"
import {
  cardAnimationsAtom,
  replaySpeedAtom,
  replayStartDelayAtom,
  getAnimationDuration,
  getCardElementPosition,
  getCardRect,
  createMoveAnimation,
  createRotateAnimation,
  createActivateAnimation,
  createNegateAnimation,
  createTargetAnimation,
  createHighlightAnimation,
  createFlipAnimation,
} from "./animations"
import { getCardById, findMovedCards } from "../helpers/cardHelpers"
import { applyOperation } from "../helpers/stateHelpers"
import { ANIM, REPLAY_DELAY, INITIAL_DOM_WAIT } from "@/client/constants/animation"
import { TOKEN_IMAGE_DATA_URL } from "@/client/constants/tokenImage"

// Re-export imported atoms for backward compatibility
export { replayDataAtom } from "./recording"
export { replaySpeedAtom } from "./animations"

// Playback state atoms
export const replayPlayingAtom = atom<boolean>(false)
export const replayPausedAtom = atom<boolean>(false)
export const replayCurrentIndexAtom = atom<number | null>(null)
export const replayTotalOperationsAtom = atom<number>(0)

// Track if replay has ever been played in replay mode
export const hasEverPlayedInReplayModeAtom = atom<boolean>(false)

// Helper: Build full history from initial state and operations
const buildReplayHistory = (initialState: GameState, operations: GameOperation[]): HistoryEntry[] => {
  let tempState = initialState
  const fullHistory: HistoryEntry[] = [
    {
      gameState: initialState,
      operationCount: 0,
      operations: [],
    },
  ]

  // Apply all operations to build history
  for (let i = 0; i < operations.length; i++) {
    const operation = operations[i]
    tempState = applyOperation(tempState, operation)
    fullHistory.push({
      gameState: tempState,
      operationCount: i + 1,
      operations: operations.slice(0, i + 1),
    })
  }

  return fullHistory
}

// Helper: Update replay state
const updateReplayState = (
  set: <T>(atom: WritableAtom<T, [T], void>, value: T) => void,
  nextState: GameState,
  index: number,
) => {
  set(gameStateAtom, nextState)
  set(gameHistoryIndexAtom, index)
  set(replayCurrentIndexAtom, index)
}

// Helper: Handle move animation
async function handleMoveAnimation(
  currentState: GameState,
  nextState: GameState,
  operation: GameOperation,
  get: Getter,
  set: Setter,
): Promise<void> {
  // For move operations, always process the animation based on the operation itself
  // rather than relying on findMovedCards which might miss same-position changes
  if (!operation.cardId) return

  // Create animations BEFORE updating state
  const animations: CardAnimation[] = []
  const currentSpeed = get(replaySpeedAtom)
  const animationDuration = Math.floor((ANIM.MOVE.ANIMATION * 2) / (3 * currentSpeed))

  // Get card position and state before update
  const prevPos = getCardElementPosition(operation.cardId, get)

  if (prevPos) {
    // Get card from current and next state for property comparison
    let fromRotation = 0
    let toRotation = 0
    let fromFaceDown = false
    let toFaceDown = false
    let cardForAnimation: Card | null = null

    // Get card from current state
    const fromPlayer = operation.from ? currentState.players[operation.from.player] : currentState.players[operation.player]
    const fromCardResult = getCardById(fromPlayer, operation.cardId)
    if (fromCardResult) {
      cardForAnimation = fromCardResult.card
      fromRotation = fromCardResult.card.rotation ?? 0
      fromFaceDown = fromCardResult.card.faceDown === true
    }

    // Get card from next state
    const toPlayer = operation.to ? nextState.players[operation.to.player] : nextState.players[operation.player]
    const toCardResult = getCardById(toPlayer, operation.cardId)
    if (toCardResult) {
      if (!cardForAnimation) cardForAnimation = toCardResult.card
      toRotation = toCardResult.card.rotation ?? 0
      toFaceDown = toCardResult.card.faceDown === true
    }

    if (cardForAnimation) {
      animations.push(
        createMoveAnimation(
          cardForAnimation,
          prevPos,
          prevPos, // Will be updated after state change
          fromRotation,
          toRotation,
          animationDuration,
          fromFaceDown,
          toFaceDown,
        ),
      )
    }
  }

  // Start animations (cards will be hidden)
  if (animations.length > 0) {
    set(cardAnimationsAtom, animations)
  }

  // Apply next state WITHOUT adding to history (history is pre-built)
  const operationIndex = get(replayCurrentIndexAtom) ?? 0
  updateReplayState(set, nextState, operationIndex + 1)

  // Small delay to ensure DOM is updated
  await new Promise((resolve) => setTimeout(resolve, getAnimationDuration(REPLAY_DELAY, get)))

  // Update animations with actual end positions
  const updatedAnimations = animations.map((anim) => {
    const nextPos = anim.cardId !== undefined ? getCardElementPosition(anim.cardId, get) : null
    return nextPos !== null ? { ...anim, toPosition: nextPos } : anim
  })

  // Update animations with correct end positions
  set(cardAnimationsAtom, updatedAnimations)

  // Wait for animation to complete
  await new Promise((resolve) => setTimeout(resolve, Math.round(ANIM.MOVE.ANIMATION / get(replaySpeedAtom))))

  // Clear move animations after they complete
  set(cardAnimationsAtom, (anims) => anims.filter(a => a.type !== "move"))
}

// Helper: Handle rotate animation
async function handleRotateAnimation(
  currentState: GameState,
  nextState: GameState,
  operation: GameOperation,
  get: Getter,
  set: Setter,
): Promise<void> {
  if (!operation.to || !operation.metadata || !("angle" in operation.metadata)) return

  // Create rotate animation BEFORE updating state to prevent flicker
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

  if (cardRect !== undefined && cardImageUrl !== undefined && operation.cardId) {
    // Create rotation animation
    set(cardAnimationsAtom, [
      ...animations,
      createRotateAnimation(operation.cardId, cardImageUrl, cardRect, fromRotation, toRotation),
    ])
  }

  // Delay state update by 1 frame to prevent flicker
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      // Update state immediately for rotation WITHOUT adding to history
      const operationIndex = get(replayCurrentIndexAtom) ?? 0
      updateReplayState(set, nextState, operationIndex + 1)
      resolve()
    })
  })

  // Use shorter delay for rotation
  await new Promise((resolve) => setTimeout(resolve, getAnimationDuration(ANIM.ROTATION.DURATION, get)))
}

// Helper: Handle activate animation
async function handleActivateAnimation(
  currentState: GameState,
  nextState: GameState,
  operation: GameOperation,
  get: Getter,
  set: Setter,
): Promise<void> {
  if (!operation.to) return

  // Update state (no change for activate) WITHOUT adding to history
  const operationIndex = get(replayCurrentIndexAtom) ?? 0
  updateReplayState(set, nextState, operationIndex + 1)

  // Small delay to ensure DOM is updated
  await new Promise((resolve) => setTimeout(resolve, INITIAL_DOM_WAIT))

  // Clear any existing move and flip animations before creating activation animation
  // This prevents overlapping animations from previous operations
  set(cardAnimationsAtom, (anims) => anims.filter(a => a.type !== "move" && a.type !== "flip"))

  // Create activation animation
  const animation = createActivateAnimation(operation, currentState, get)
  if (animation) {
    const animations = get(cardAnimationsAtom)
    set(cardAnimationsAtom, [...animations, animation])

    // Remove animation after duration
    setTimeout(
      () => {
        set(cardAnimationsAtom, (anims) => anims.filter((a) => a.id !== animation.id))
      },
      getAnimationDuration(ANIM.EFFECT.ANIMATION, get),
    )
  }

  // Wait for activation animation
  await new Promise((resolve) => setTimeout(resolve, getAnimationDuration(ANIM.EFFECT.DURATION, get)))
}

// Helper: Handle target animation
async function handleTargetAnimation(
  currentState: GameState,
  nextState: GameState,
  operation: GameOperation,
  get: Getter,
  set: Setter,
): Promise<void> {
  if (!operation.to) return

  // Update state (no change for target) WITHOUT adding to history
  const operationIndex = get(replayCurrentIndexAtom) ?? 0
  updateReplayState(set, nextState, operationIndex + 1)

  // Small delay to ensure DOM is updated
  await new Promise((resolve) => setTimeout(resolve, INITIAL_DOM_WAIT))

  // Clear any existing flip animations before creating target animation
  set(cardAnimationsAtom, (anims) => anims.filter(a => a.type !== "flip"))

  // Create target animation
  const animation = createTargetAnimation(operation, currentState, get)
  if (animation) {
    const animations = get(cardAnimationsAtom)
    set(cardAnimationsAtom, [...animations, animation])
  }

  // Wait for target animation to complete (expand + shrink)
  await new Promise((resolve) => setTimeout(resolve, getAnimationDuration(ANIM.TARGET.ANIMATION * 2, get)))
}

// Helper: Handle negate animation
async function handleNegateAnimation(
  currentState: GameState,
  nextState: GameState,
  operation: GameOperation,
  get: Getter,
  set: Setter,
): Promise<void> {
  if (!operation.to) return

  // Update state (no change for negate) WITHOUT adding to history
  const operationIndex = get(replayCurrentIndexAtom) ?? 0
  updateReplayState(set, nextState, operationIndex + 1)

  // Small delay to ensure DOM is updated
  await new Promise((resolve) => setTimeout(resolve, INITIAL_DOM_WAIT))

  // Clear any existing flip animations before creating negate animation
  set(cardAnimationsAtom, (anims) => anims.filter(a => a.type !== "flip"))

  // Create negate animation
  const animation = createNegateAnimation(operation, currentState, get)
  if (animation) {
    const animations = get(cardAnimationsAtom)
    set(cardAnimationsAtom, [...animations, animation])

    // Remove animation after duration
    setTimeout(
      () => {
        set(cardAnimationsAtom, (anims) => anims.filter((a) => a.id !== animation.id))
      },
      getAnimationDuration(ANIM.EFFECT.ANIMATION, get),
    )
  }

  // Wait for negate animation
  await new Promise((resolve) => setTimeout(resolve, getAnimationDuration(ANIM.EFFECT.DURATION, get)))
}

// Helper: Handle highlight animation
async function handleHighlightAnimation(
  currentState: GameState,
  nextState: GameState,
  operation: GameOperation,
  get: Getter,
  set: Setter,
): Promise<void> {
  if (!operation.to) return

  // Update state WITHOUT adding to history
  const operationIndex = get(replayCurrentIndexAtom) ?? 0
  updateReplayState(set, nextState, operationIndex + 1)

  // Ensure DOM updated
  await new Promise((resolve) => setTimeout(resolve, getAnimationDuration(REPLAY_DELAY, get)))

  // Create highlight animation
  const animation = createHighlightAnimation(operation, currentState, get)
  if (animation) {
    const animations = get(cardAnimationsAtom)
    set(cardAnimationsAtom, [...animations, animation])
  }

  await new Promise((resolve) => setTimeout(resolve, getAnimationDuration(ANIM.HIGHLIGHT.ANIMATION * 2, get)))
}

// Helper: Handle flip animation
async function handleFlipAnimation(
  currentState: GameState,
  nextState: GameState,
  operation: GameOperation,
  get: Getter,
  set: Setter,
): Promise<void> {
  if (!operation.to || !operation.cardId) return

  const cardId = operation.cardId as string // TypeScript needs explicit cast

  // Get current faceDown state before update from the correct player/zone
  let fromFaceDown = false
  const currentPlayer = currentState.players[operation.to.player]

  // Get card using getCardById which handles all zone types correctly
  const currentCardRes = getCardById(currentPlayer, cardId)

  if (currentCardRes) {
    fromFaceDown = currentCardRes.card.faceDown === true
  }

  // Get next faceDown state after flip - it should be the opposite
  // Since this is a flip operation, toFaceDown should be !fromFaceDown
  const toFaceDown = !fromFaceDown

  // Create flip animation BEFORE updating state to prevent flicker
  const cardRect = getCardRect(cardId, get)

  if (cardRect && currentCardRes) {
    const cardImageUrl =
      currentCardRes.card.name === "token" ? TOKEN_IMAGE_DATA_URL : (currentCardRes.card.imageUrl ?? "")
    const cardRotation = currentCardRes.card.rotation ?? 0

    const animation = createFlipAnimation(cardId, cardImageUrl, cardRect, cardRotation, fromFaceDown, toFaceDown)

    const animations = get(cardAnimationsAtom)
    set(cardAnimationsAtom, [...animations, animation])
  }

  // Delay state update by 1 frame to prevent flicker
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      // Update state WITHOUT adding to history
      const operationIndex = get(replayCurrentIndexAtom) ?? 0
      updateReplayState(set, nextState, operationIndex + 1)
      resolve()
    })
  })

  // Wait for flip animation (use DURATION instead of ANIMATION for proper timing)
  await new Promise((resolve) => setTimeout(resolve, getAnimationDuration(ANIM.FLIP.DURATION, get)))
}

// Helper: Handle summon animation
async function handleSummonAnimation(nextState: GameState, get: Getter, set: Setter): Promise<void> {
  // Update state for summon (token generation)
  const operationIndex = get(replayCurrentIndexAtom) ?? 0
  updateReplayState(set, nextState, operationIndex + 1)

  // Small delay to ensure DOM is updated and new card is rendered
  await new Promise((resolve) => setTimeout(resolve, getAnimationDuration(REPLAY_DELAY, get)))

  // Wait for token to appear
  await new Promise((resolve) => setTimeout(resolve, Math.round(ANIM.MOVE.ANIMATION / get(replaySpeedAtom))))
}

// Helper: Handle other operations
async function handleOtherOperation(nextState: GameState, get: Getter, set: Setter): Promise<void> {
  // Other operations (no movement, no rotation, no activation) WITHOUT adding to history
  const operationIndex = get(replayCurrentIndexAtom) ?? 0
  updateReplayState(set, nextState, operationIndex + 1)

  // Wait for next step
  await new Promise((resolve) => setTimeout(resolve, Math.round(ANIM.MOVE.ANIMATION / get(replaySpeedAtom))))
}

// Main play replay atom
export const playReplayAtom = atom(null, async (get, set) => {
  const isPlaying = get(replayPlayingAtom)
  const isPaused = get(replayPausedAtom)

  // Check if already playing and not paused
  if (isPlaying && !isPaused) {
    console.warn("Replay is already playing - blocking duplicate execution")
    return
  }

  const replayData = get(replayDataAtom)
  const startDelay = get(replayStartDelayAtom) // Start delay in seconds

  if (!replayData || replayData.operations.length === 0) {
    console.warn("No replay data available")
    return
  }

  // Check if resuming from a saved position
  const currentIndex = get(replayCurrentIndexAtom)
  const historyIndex = get(gameHistoryIndexAtom)

  // Determine if this is a resume (has a saved index or is paused) or fresh start
  const isResume = (currentIndex != null && currentIndex > 0) || (isPlaying && isPaused)

  // Set playing state
  set(replayPlayingAtom, true)
  set(replayPausedAtom, false)

  // Set initial state and build history only if starting fresh
  if (!isResume) {
    set(replayCurrentIndexAtom, 0)
    set(replayTotalOperationsAtom, replayData.operations.length)

    // Build full history for redo functionality
    const initialState = produce(replayData.startSnapshot, () => {})

    // Reset history with initial state
    set(resetHistoryAtom, initialState)

    // Build complete history using helper function
    const fullHistory = buildReplayHistory(initialState, replayData.operations)

    // Set the complete history
    set(gameHistoryAtom, fullHistory)
    set(gameHistoryIndexAtom, 0) // Start at the beginning
    set(gameStateAtom, replayData.startSnapshot)
  } else {
    // Resuming - use existing history and current position
    set(replayTotalOperationsAtom, replayData.operations.length)
  }

  // Clear any existing animations and UI state
  set(cardAnimationsAtom, [])
  set(highlightedZonesAtom, [])

  // Wait for DOM to update after snapshot restore
  await new Promise((resolve) => setTimeout(resolve, INITIAL_DOM_WAIT))

  // Apply start delay if set (only for fresh start, not resume)
  if (startDelay > 0 && !isResume) {
    await new Promise((resolve) => setTimeout(resolve, startDelay * 1000))
  }

  // Determine start index
  let startIndex: number
  if (isResume) {
    // When resuming, use the operation count from current history entry
    const currentHistoryEntry = get(gameHistoryAtom)[historyIndex]
    startIndex = currentHistoryEntry?.operationCount ?? currentIndex ?? 0
    // Update the atom for consistency
    set(replayCurrentIndexAtom, startIndex)
  } else {
    // For fresh start
    startIndex = 0
  }

  // Get operations to play
  const currentHistory = get(gameHistoryAtom)
  const lastHistoryEntry = currentHistory[currentHistory.length - 1]
  const operationsToPlay = lastHistoryEntry?.operations ?? replayData.operations

  // Always recalculate from snapshot to ensure consistency
  let currentState: GameState = produce(replayData.startSnapshot, () => {})

  // If resuming, apply operations up to the start index instantly
  if (isResume && startIndex > 0) {
    // Apply operations up to startIndex to reconstruct current state
    const operationsToApply = operationsToPlay.slice(0, startIndex)

    for (const operation of operationsToApply) {
      currentState = applyOperation(currentState, operation)
    }

    // Set the recalculated state
    set(gameStateAtom, currentState)
    set(gameHistoryIndexAtom, startIndex)
  }

  // Play through each operation
  for (let i = startIndex; i < operationsToPlay.length; i++) {
    // Check if replay was paused
    if (get(replayPausedAtom)) {
      break
    }

    // Check if stopped
    if (!get(replayPlayingAtom)) break

    const operation = operationsToPlay[i]

    // Apply operation to get next state
    const nextState = applyOperation(currentState, operation)

    // Check operation type and handle accordingly
    switch (operation.type) {
      case "move":
      case "draw":
      case "set":
        // Always handle move animations for these operations
        await handleMoveAnimation(currentState, nextState, operation, get, set)
        currentState = nextState
        break

      case "summon":
        // Summon creates new cards, handle separately
        await handleSummonAnimation(nextState, get, set)
        currentState = nextState
        break

      case "rotate":
        await handleRotateAnimation(currentState, nextState, operation, get, set)
        currentState = nextState
        break

      case "activate":
        await handleActivateAnimation(currentState, nextState, operation, get, set)
        currentState = nextState
        break

      case "target":
        await handleTargetAnimation(currentState, nextState, operation, get, set)
        currentState = nextState
        break

      case "negate":
        await handleNegateAnimation(currentState, nextState, operation, get, set)
        currentState = nextState
        break

      case "toggleHighlight":
        await handleHighlightAnimation(currentState, nextState, operation, get, set)
        currentState = nextState
        break

      case "changePosition":
        // Check if this is a flip operation
        if (operation.metadata && "flip" in operation.metadata && operation.metadata.flip === true) {
          await handleFlipAnimation(currentState, nextState, operation, get, set)
        } else {
          await handleOtherOperation(nextState, get, set)
        }
        currentState = nextState
        break

      default: {
        // For any other operation types, check if cards moved
        const movedCards = findMovedCards(currentState, nextState)
        if (movedCards.length > 0) {
          await handleMoveAnimation(currentState, nextState, operation, get, set)
        } else {
          await handleOtherOperation(nextState, get, set)
        }
        currentState = nextState
      }
    }
  }

  // Wait for final animation to complete (only if not paused)
  const wasPausedDuringReplay = get(replayPausedAtom)

  if (!wasPausedDuringReplay) {
    // Use operationsToPlay instead of replayData.operations for consistency
    const finalOperation = operationsToPlay[operationsToPlay.length - 1]
    if (finalOperation !== undefined) {
      if (finalOperation.type === "move" || finalOperation.type === "draw") {
        // Wait for move/draw animation
        await new Promise((resolve) => setTimeout(resolve, Math.round(ANIM.MOVE.ANIMATION / get(replaySpeedAtom))))
      } else if (finalOperation.type === "rotate") {
        // Wait for rotation animation
        await new Promise((resolve) => setTimeout(resolve, getAnimationDuration(ANIM.ROTATION.DURATION, get)))
      } else if (finalOperation.type === "activate") {
        // Wait for activation animation
        await new Promise((resolve) => setTimeout(resolve, getAnimationDuration(ANIM.EFFECT.DURATION, get)))
      } else if (finalOperation.type === "summon") {
        // Wait for summon animation (token generation)
        await new Promise((resolve) => setTimeout(resolve, Math.round(ANIM.MOVE.ANIMATION / get(replaySpeedAtom))))
      } else if (finalOperation.type === "target") {
        // Wait for target animation (expand + shrink)
        await new Promise((resolve) => setTimeout(resolve, getAnimationDuration(ANIM.TARGET.ANIMATION * 2, get)))
      } else if (finalOperation.type === "negate") {
        // Wait for negate animation
        await new Promise((resolve) => setTimeout(resolve, getAnimationDuration(ANIM.EFFECT.DURATION, get)))
      } else if (
        finalOperation.type === "changePosition" &&
        finalOperation.metadata &&
        "flip" in finalOperation.metadata &&
        finalOperation.metadata.flip === true
      ) {
        // Wait for flip animation (use DURATION for consistency)
        await new Promise((resolve) => setTimeout(resolve, getAnimationDuration(ANIM.FLIP.DURATION, get)))
      }
    }
  }

  // End replay - check if it was paused or completed
  const wasPaused = get(replayPausedAtom)

  if (!wasPaused) {
    // Only set to false if not paused (i.e., replay completed naturally or was stopped)
    set(replayPlayingAtom, false)
    set(replayCurrentIndexAtom, null)
  }
  // If paused, keep replayPlayingAtom true and current index for resume

  // Don't reset pause state here - let toggleReplayPauseAtom handle it
  if (!wasPaused) {
    set(replayPausedAtom, false)
  }
})

// Toggle replay pause
export const toggleReplayPauseAtom = atom(null, async (get, set) => {
  const isPlaying = get(replayPlayingAtom)
  const isPaused = get(replayPausedAtom)

  if (isPlaying && !isPaused) {
    // Pause the replay - stop it completely but keep isPlaying true for UI
    set(replayPausedAtom, true)
    // Keep replayPlayingAtom true so the pause/resume button stays visible
    // Keep the current index for resume
  } else if (isPlaying && isPaused) {
    // Resume from the saved position
    set(replayPausedAtom, false)
    // playReplayAtom will handle starting from the current index
    await set(playReplayAtom)
  }
})

// Stop replay
export const stopReplayAtom = atom(null, (get, set) => {
  const _currentState = get(gameStateAtom)
  const _wasPlaying = get(replayPlayingAtom)
  const currentIndex = get(replayCurrentIndexAtom) // Get index before clearing

  set(replayPlayingAtom, false)
  set(replayPausedAtom, false)

  // Keep the currentIndex if replay was stopped midway for redo functionality
  // Only clear it if replay finished naturally (currentIndex === total operations)
  const totalOperations = get(replayTotalOperationsAtom)
  if (currentIndex !== null && currentIndex >= totalOperations) {
    set(replayCurrentIndexAtom, null)
  }
  // Otherwise keep replayCurrentIndexAtom to allow redo to continue from this point

  set(cardAnimationsAtom, [])
  set(highlightedZonesAtom, [])

  // History is now maintained during replay, so no need to rebuild it
})
