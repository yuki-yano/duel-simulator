import { atom } from "jotai"
import type { Atom, WritableAtom } from "jotai"
import { v4 as uuidv4 } from "uuid"
import { nanoid } from "nanoid"
import { produce } from "immer"
import { TOKEN_IMAGE_DATA_URL } from "@/client/constants/tokenImage"
import type {
  Card,
  GameState,
  PlayerBoard,
  Position,
  ZoneId,
  ZoneType,
  GameOperation,
  GamePhase,
} from "../../shared/types/game"
import type { DeckProcessMetadata } from "@client/components/DeckImageProcessor"
import { ANIM, REPLAY_DELAY, INITIAL_DOM_WAIT } from "@/client/constants/animation"

// Get animation duration based on current speed multiplier
function getAnimationDuration(baseDuration: number, get: Getter): number {
  const speedMultiplier = get(replaySpeedAtom) // Get current speed: 0.5x, 1x, 2x, 3x
  return Math.round(baseDuration / speedMultiplier)
}

// Helper function from redoAtom (was duplicated)
// Find moved cards between states
function findMovedCards(
  prevState: GameState,
  nextState: GameState,
): Array<{
  card: Card
  fromZone: ZoneId
  toZone: ZoneId
}> {
  const movedCards: Array<{ card: Card; fromZone: ZoneId; toZone: ZoneId }> = []

  // Helper to find card in all zones
  const findCardInState = (state: GameState, cardId: string): { card: Card; zone: ZoneId } | null => {
    for (const [player, board] of Object.entries(state.players) as [keyof GameState["players"], PlayerBoard][]) {
      // Check all zones
      // Monster zones
      for (let i = 0; i < board.monsterZones.length; i++) {
        const card = board.monsterZones[i].find((c) => c.id === cardId)
        if (card) return { card, zone: { player, type: "monsterZone", index: i } }
      }
      // Spell/trap zones
      for (let i = 0; i < board.spellTrapZones.length; i++) {
        const card = board.spellTrapZones[i].find((c) => c.id === cardId)
        if (card) return { card, zone: { player, type: "spellTrapZone", index: i } }
      }
      // Extra monster zones
      for (let i = 0; i < board.extraMonsterZones.length; i++) {
        const card = board.extraMonsterZones[i].find((c) => c.id === cardId)
        if (card) return { card, zone: { player, type: "extraMonsterZone", index: i } }
      }
      // Field zone
      if (board.fieldZone?.id === cardId) {
        return { card: board.fieldZone, zone: { player, type: "fieldZone" } }
      }
      // Hand
      const handCard = board.hand.find((c) => c.id === cardId)
      if (handCard) return { card: handCard, zone: { player, type: "hand" } }
      // Deck
      const deckCard = board.deck.find((c) => c.id === cardId)
      if (deckCard) return { card: deckCard, zone: { player, type: "deck" } }
      // Graveyard
      const graveyardCard = board.graveyard.find((c) => c.id === cardId)
      if (graveyardCard) return { card: graveyardCard, zone: { player, type: "graveyard" } }
      // Banished
      const banishedCard = board.banished.find((c) => c.id === cardId)
      if (banishedCard) return { card: banishedCard, zone: { player, type: "banished" } }
      // Extra deck
      const extraDeckCard = board.extraDeck.find((c) => c.id === cardId)
      if (extraDeckCard) return { card: extraDeckCard, zone: { player, type: "extraDeck" } }
      // Free zone
      const freeZoneCard = board.freeZone?.find((c) => c.id === cardId)
      if (freeZoneCard) return { card: freeZoneCard, zone: { player, type: "freeZone" } }
      // Side free zone
      const sideFreeZoneCard = board.sideFreeZone?.find((c) => c.id === cardId)
      if (sideFreeZoneCard) return { card: sideFreeZoneCard, zone: { player, type: "sideFreeZone" } }
    }
    return null
  }

  // Get all card IDs from both states
  const allCardIds = new Set<string>()
  for (const board of Object.values(prevState.players)) {
    board.monsterZones.flat().forEach((c) => allCardIds.add(c.id))
    board.spellTrapZones.flat().forEach((c) => allCardIds.add(c.id))
    board.extraMonsterZones.flat().forEach((c) => allCardIds.add(c.id))
    if (board.fieldZone) allCardIds.add(board.fieldZone.id)
    board.hand.forEach((c) => allCardIds.add(c.id))
    board.deck.forEach((c) => allCardIds.add(c.id))
    board.graveyard.forEach((c) => allCardIds.add(c.id))
    board.banished.forEach((c) => allCardIds.add(c.id))
    board.extraDeck.forEach((c) => allCardIds.add(c.id))
    board.freeZone?.forEach((c) => allCardIds.add(c.id))
    board.sideFreeZone?.forEach((c) => allCardIds.add(c.id))
  }

  // Check each card for position changes
  for (const cardId of allCardIds) {
    const prevPosition = findCardInState(prevState, cardId)
    const nextPosition = findCardInState(nextState, cardId)

    if (prevPosition && nextPosition) {
      // Check if zone changed
      const prevZone = prevPosition.zone
      const nextZone = nextPosition.zone

      if (prevZone.player !== nextZone.player || prevZone.type !== nextZone.type || prevZone.index !== nextZone.index) {
        movedCards.push({
          card: nextPosition.card,
          fromZone: prevZone,
          toZone: nextZone,
        })
      }
    }
  }

  return movedCards
}

// Get card element position
function getCardElementPosition(cardId: string, get: Getter): { x: number; y: number } | undefined {
  const rect = getCardRect(cardId, get)
  if (!rect) return undefined

  return {
    x: rect.x,
    y: rect.y,
  }
}

// Initial player board
const createInitialPlayerBoard = (): PlayerBoard => ({
  monsterZones: Array(5)
    .fill(null)
    .map(() => []),
  spellTrapZones: Array(5)
    .fill(null)
    .map(() => []),
  fieldZone: null,
  graveyard: [],
  banished: [],
  extraDeck: [],
  deck: [],
  hand: [],
  extraMonsterZones: Array(2)
    .fill(null)
    .map(() => []),
  freeZone: [], // フィールド下のフリーゾーン
  sideFreeZone: [], // 左側のフリーゾーン（1024px以上）
  lifePoints: 8000,
})

// Initial game state
const createInitialGameState = (): GameState => ({
  players: {
    self: createInitialPlayerBoard(),
    opponent: createInitialPlayerBoard(),
  },
  turn: 1,
  phase: "main1",
  currentPlayer: "self",
})

// Main game state atom
export const gameStateAtom = atom<GameState>(createInitialGameState())

// Operation history atom
export const operationsAtom = atom<GameOperation[]>([])

// Card ref tracking - Maps card ID to DOM element refs for animations
export const cardRefsAtom = atom<Map<string, HTMLElement>>(new Map())

// Zone ref tracking - Maps zone selector to DOM element refs for modals
export const zoneRefsAtom = atom<Map<string, HTMLElement>>(new Map())

// Update card ref atom
export const updateCardRefAtom = atom(
  null,
  (get, set, cardId: string, ref: HTMLElement | null) => {
    const refs = new Map(get(cardRefsAtom))
    if (ref) {
      refs.set(cardId, ref)
    } else {
      refs.delete(cardId)
    }
    set(cardRefsAtom, refs)
  }
)

// Update zone ref atom
export const updateZoneRefAtom = atom(
  null,
  (get, set, zoneSelector: string, ref: HTMLElement | null) => {
    const refs = new Map(get(zoneRefsAtom))
    if (ref) {
      refs.set(zoneSelector, ref)
    } else {
      refs.delete(zoneSelector)
    }
    set(zoneRefsAtom, refs)
  }
)

// Get card rect from ref
function getCardRect(cardId: string, get: Getter): { x: number; y: number; width: number; height: number } | undefined {
  const refs = get(cardRefsAtom)
  const element = refs.get(cardId)
  if (!element) return undefined

  const rect = element.getBoundingClientRect()
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  }
}

// History entry for undo/redo with operation tracking
interface HistoryEntry {
  gameState: GameState
  operationCount: number // Number of operations at this state
  operations: GameOperation[] // Store operations up to this state
}

// History for undo/redo
export const gameHistoryAtom = atom<HistoryEntry[]>([
  {
    gameState: createInitialGameState(),
    operationCount: 0,
    operations: [],
  },
])
export const gameHistoryIndexAtom = atom<number>(0)

// UI state atoms
export const selectedCardAtom = atom<Card | null>(null)
export const draggedCardAtom = atom<(Card & { zone: ZoneId }) | null>(null)
export const hoveredZoneAtom = atom<ZoneId | null>(null)

// Deck loaded state
export const isDeckLoadedAtom = atom<boolean>((get) => {
  const state = get(gameStateAtom)
  const deckMetadata = get(deckMetadataAtom)

  // If deck metadata exists, deck has been loaded
  if (deckMetadata) return true

  // Otherwise check if any cards exist in any player's deck
  return (
    state.players.self.deck.length > 0 ||
    state.players.opponent.deck.length > 0 ||
    state.players.self.extraDeck.length > 0 ||
    state.players.opponent.extraDeck.length > 0
  )
})

// Initial state after deck loading (for reset functionality)
export const initialStateAfterDeckLoadAtom = atom<GameState | null>(null)
export const highlightedZonesAtom = atom<ZoneId[]>([])

// Temporary storage for cards extracted from deck image
export const extractedCardsAtom = atom<{
  mainDeck: Card[]
  extraDeck: Card[]
}>({
  mainDeck: [],
  extraDeck: [],
})

// Deck metadata for saving replays
export const deckMetadataAtom = atom<DeckProcessMetadata | null>(null)

// Current game phase atom
export const currentPhaseAtom = atom<GamePhase, [GamePhase], void>(
  (get) => get(gameStateAtom).phase,
  (get, set, newPhase: GamePhase) => {
    const state = get(gameStateAtom)
    const newState = {
      ...state,
      phase: newPhase,
    }
    set(gameStateAtom, newState)
    addToHistory(get, set, newState)
  },
)

// Helper to add state to history
type Getter = <Value>(atom: Atom<Value>) => Value
type Setter = <Value, Args extends unknown[], Result>(atom: WritableAtom<Value, Args, Result>, ...args: Args) => Result

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
        const removedOperationIds = new Set(removedOperations.map(op => op.id))
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
      playOperationAnimations(get, set, removedOperations, currentState, previousEntry.gameState, true, currentSpeed).catch(() => {
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
        await new Promise((resolve) =>
          setTimeout(resolve, Math.round(ANIM.MOVE.ANIMATION / get(replaySpeedAtom))),
        )
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

          await new Promise((resolve) =>
            setTimeout(resolve, getAnimationDuration(ANIM.ROTATION.DURATION, get)),
          )
        } else if (operation.type === "activate" && operation.to) {
          set(gameStateAtom, nextState)
          set(gameHistoryIndexAtom, i + 1)
          set(replayCurrentIndexAtom, i + 1)
          currentState = nextState

          await new Promise((resolve) =>
            setTimeout(resolve, getAnimationDuration(REPLAY_DELAY, get)),
          )

          // Create activation animation
          const animationId = uuidv4()
          const animations = get(cardAnimationsAtom)

          let cardRect: { x: number; y: number; width: number; height: number } | undefined
          cardRect = getCardRect(operation.cardId, get)

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

          await new Promise((resolve) =>
            setTimeout(resolve, getAnimationDuration(ANIM.EFFECT.DURATION, get)),
          )
        } else {
          set(gameStateAtom, nextState)
          set(gameHistoryIndexAtom, i + 1)
          set(replayCurrentIndexAtom, i + 1)
          currentState = nextState

          await new Promise((resolve) =>
            setTimeout(resolve, Math.round(ANIM.MOVE.ANIMATION / get(replaySpeedAtom))),
          )
        }
      }
    }

    // Wait for final animation
    const finalOperation = replayData.operations[replayData.operations.length - 1]
    if (finalOperation !== undefined) {
      if (finalOperation.type === "move" || finalOperation.type === "draw") {
        await new Promise((resolve) =>
          setTimeout(resolve, Math.round(ANIM.MOVE.ANIMATION / get(replaySpeedAtom))),
        )
      } else if (finalOperation.type === "rotate") {
        await new Promise((resolve) =>
          setTimeout(resolve, getAnimationDuration(ANIM.ROTATION.DURATION, get)),
        )
      } else if (finalOperation.type === "activate") {
        await new Promise((resolve) =>
          setTimeout(resolve, getAnimationDuration(ANIM.EFFECT.DURATION, get)),
        )
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
      playOperationAnimations(get, set, operationsToAdd, currentState, nextEntry.gameState, false, currentSpeed).catch(() => {
        // Ignore cancellation errors
      })
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
function getZoneDisplayName(zone: ZoneId): string {
  const playerPrefix = zone.player === "opponent" ? "相手の" : ""

  switch (zone.type) {
    case "monsterZone":
      return `${playerPrefix}モンスターゾーン${zone.index !== undefined ? zone.index + 1 : ""}`
    case "spellTrapZone":
      return `${playerPrefix}魔法・罠ゾーン${zone.index !== undefined ? zone.index + 1 : ""}`
    case "hand":
      return `${playerPrefix}手札`
    case "graveyard":
      return `${playerPrefix}墓地`
    case "banished":
      return `${playerPrefix}除外`
    case "deck":
      return `${playerPrefix}デッキ`
    case "extraDeck":
      return `${playerPrefix}エクストラデッキ`
    case "fieldZone":
      return `${playerPrefix}フィールドゾーン`
    case "extraMonsterZone":
      return `${playerPrefix}エクストラモンスターゾーン${zone.index !== undefined ? zone.index + 1 : ""}`
    case "freeZone":
      return `${playerPrefix}フリーゾーン`
    case "sideFreeZone":
      return `${playerPrefix}サイドフリーゾーン`
    default:
      return zone.type
  }
}

// Get operation description from game states
function getOperationDescription(prevState: GameState, currentState: GameState): string {
  // Find differences between states
  const allZones: Array<{ player: "self" | "opponent"; zone: ZoneType; index?: number }> = []

  // Collect all zones to check
  for (const player of ["self", "opponent"] as const) {
    allZones.push({ player, zone: "hand" })
    allZones.push({ player, zone: "deck" })
    allZones.push({ player, zone: "graveyard" })
    allZones.push({ player, zone: "banished" })
    allZones.push({ player, zone: "extraDeck" })
    allZones.push({ player, zone: "fieldZone" })
    allZones.push({ player, zone: "freeZone" })
    allZones.push({ player, zone: "sideFreeZone" })
    for (let i = 0; i < 5; i++) {
      allZones.push({ player, zone: "monsterZone", index: i })
      allZones.push({ player, zone: "spellTrapZone", index: i })
    }
    for (let i = 0; i < 2; i++) {
      allZones.push({ player, zone: "extraMonsterZone", index: i })
    }
  }

  // Check for card movements
  for (const { player, zone, index } of allZones) {
    const prevCards = getCardsInZone(prevState, player, zone, index)
    const currentCards = getCardsInZone(currentState, player, zone, index)

    // Check for new cards in current zone
    for (const card of currentCards) {
      if (!prevCards.find((c) => c.id === card.id)) {
        // This card was moved to this zone
        const fromZone = findCardInState(prevState, card.id)
        if (fromZone) {
          const from = { player: fromZone.player, type: fromZone.zone, index: fromZone.index }
          const to = { player, type: zone, index }
          return `${getZoneDisplayName(from)}から${getZoneDisplayName(to)}へ移動`
        }
      }
    }

    // Check for rotation changes
    if (zone === "monsterZone" || zone === "spellTrapZone" || zone === "extraMonsterZone") {
      const prevCard = prevCards[0]
      const currentCard = currentCards[0]
      if (
        prevCard !== undefined &&
        currentCard !== undefined &&
        prevCard.id === currentCard.id &&
        prevCard.rotation !== currentCard.rotation
      ) {
        const position = currentCard.rotation === -90 ? "守備表示" : "攻撃表示"
        return `${getZoneDisplayName({ player, type: zone, index })}のカードを${position}に変更`
      }
    }

    // Check for face down changes
    if (zone === "monsterZone" || zone === "spellTrapZone" || zone === "extraMonsterZone") {
      const prevCard = prevCards[0]
      const currentCard = currentCards[0]
      if (
        prevCard !== undefined &&
        currentCard !== undefined &&
        prevCard.id === currentCard.id &&
        prevCard.faceDown !== currentCard.faceDown
      ) {
        const state = currentCard.faceDown === true ? "裏側表示" : "表側表示"
        return `${getZoneDisplayName({ player, type: zone, index })}のカードを${state}に変更`
      }
    }
  }

  // Check for hand order changes
  const prevSelfHand = prevState.players.self.hand
  const currentSelfHand = currentState.players.self.hand
  if (prevSelfHand.length === currentSelfHand.length && prevSelfHand.length > 0) {
    const isSameCards = prevSelfHand.every((card) => currentSelfHand.find((c) => c.id === card.id))
    const isDifferentOrder = prevSelfHand.some((card, index) => currentSelfHand[index]?.id !== card.id)
    if (isSameCards && isDifferentOrder) {
      return "手札の順序変更"
    }
  }

  return "操作"
}

// Helper to get cards in a specific zone
function getCardsInZone(state: GameState, player: "self" | "opponent", zone: ZoneType, index?: number): Card[] {
  // Check if state is valid
  if (state == null || state.players == null || state.players[player] == null) {
    return []
  }

  const playerBoard = state.players[player]

  switch (zone) {
    case "monsterZone":
      return index !== undefined ? playerBoard.monsterZones[index] : []
    case "spellTrapZone":
      return index !== undefined ? playerBoard.spellTrapZones[index] : []
    case "extraMonsterZone":
      return index !== undefined ? playerBoard.extraMonsterZones[index] : []
    case "fieldZone":
      return playerBoard.fieldZone ? [playerBoard.fieldZone] : []
    case "hand":
      return playerBoard.hand
    case "deck":
      return playerBoard.deck
    case "graveyard":
      return playerBoard.graveyard
    case "banished":
      return playerBoard.banished
    case "extraDeck":
      return playerBoard.extraDeck
    case "freeZone":
      return playerBoard.freeZone ?? []
    case "sideFreeZone":
      return playerBoard.sideFreeZone ?? []
    default:
      return []
  }
}

// Helper to find card in state
function findCardInState(
  state: GameState,
  cardId: string,
): { player: "self" | "opponent"; zone: ZoneType; index?: number } | null {
  for (const [player, board] of Object.entries(state.players) as [keyof GameState["players"], PlayerBoard][]) {
    // Check all zones
    for (let i = 0; i < board.monsterZones.length; i++) {
      if (board.monsterZones[i].find((c) => c.id === cardId)) {
        return { player, zone: "monsterZone", index: i }
      }
    }
    for (let i = 0; i < board.spellTrapZones.length; i++) {
      if (board.spellTrapZones[i].find((c) => c.id === cardId)) {
        return { player, zone: "spellTrapZone", index: i }
      }
    }
    for (let i = 0; i < board.extraMonsterZones.length; i++) {
      if (board.extraMonsterZones[i].find((c) => c.id === cardId)) {
        return { player, zone: "extraMonsterZone", index: i }
      }
    }
    if (board.fieldZone?.id === cardId) {
      return { player, zone: "fieldZone" }
    }
    if (board.hand.find((c) => c.id === cardId)) {
      return { player, zone: "hand" }
    }
    if (board.deck.find((c) => c.id === cardId)) {
      return { player, zone: "deck" }
    }
    if (board.graveyard.find((c) => c.id === cardId)) {
      return { player, zone: "graveyard" }
    }
    if (board.banished.find((c) => c.id === cardId)) {
      return { player, zone: "banished" }
    }
    if (board.extraDeck.find((c) => c.id === cardId)) {
      return { player, zone: "extraDeck" }
    }
    if (board.freeZone?.find((c) => c.id === cardId)) {
      return { player, zone: "freeZone" }
    }
    if (board.sideFreeZone?.find((c) => c.id === cardId)) {
      return { player, zone: "sideFreeZone" }
    }
  }
  return null
}

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

// Replay data structure
export interface ReplayData {
  startSnapshot: GameState
  operations: GameOperation[]
  startTime: number
  endTime?: number
}

// Replay management atoms
export const replayRecordingAtom = atom<boolean>(false)
export const replayStartIndexAtom = atom<number | null>(null)
export const replayEndIndexAtom = atom<number | null>(null)
export const replayDataAtom = atom<ReplayData | null>(null)
// Separate operations list for replay recording to avoid undo/redo interference
export const replayOperationsAtom = atom<GameOperation[]>([])
// Track replay start timestamp for filtering operations
export const replayStartTimestampAtom = atom<number | null>(null)
// Track if replay has ever been played in replay mode
export const hasEverPlayedInReplayModeAtom = atom<boolean>(false)

// Replay playback atoms
export const replayPlayingAtom = atom<boolean>(false)
export const replayPausedAtom = atom<boolean>(false)
export const replayCurrentIndexAtom = atom<number | null>(null)
export const replaySpeedAtom = atom<number>(1) // Default 1x speed
export const replayStartDelayAtom = atom<number>(0.5) // Default 0.5 seconds delay
// Track the total number of operations in replay for redo after stop
export const replayTotalOperationsAtom = atom<number>(0)

// Start replay recording
export const startReplayRecordingAtom = atom(null, (get, set) => {
  const _currentIndex = get(gameHistoryIndexAtom)
  const currentState = get(gameStateAtom)
  const currentOperations = get(operationsAtom)

  // Create deep copy of current state as snapshot
  const snapshot = produce(currentState, () => {})

  // Initialize replay data
  const replayData: ReplayData = {
    startSnapshot: snapshot,
    operations: [],
    startTime: Date.now(),
  }

  set(replayRecordingAtom, true)
  set(replayStartIndexAtom, currentOperations.length) // Store operation count at start
  set(replayEndIndexAtom, null)
  set(replayDataAtom, replayData)
  set(replayOperationsAtom, []) // Clear replay operations
  set(replayStartTimestampAtom, Date.now()) // Record start timestamp
})

// Stop replay recording
export const stopReplayRecordingAtom = atom(null, (get, set) => {
  const _currentIndex = get(gameHistoryIndexAtom)
  const replayData = get(replayDataAtom)

  if (replayData) {
    // Use replay-specific operations list instead of global operations
    const replayOperations = get(replayOperationsAtom)

    // Update replay data with operations and end time
    set(replayDataAtom, {
      ...replayData,
      operations: replayOperations,
      endTime: Date.now(),
    })
  }

  set(replayRecordingAtom, false)
  set(replayEndIndexAtom, _currentIndex)
  set(replayOperationsAtom, []) // Clear replay operations
  set(replayStartTimestampAtom, null) // Clear start timestamp
})

// Helper to apply operation to state
function applyOperation(state: GameState, operation: GameOperation): GameState {
  let newState = state

  switch (operation.type) {
    case "move":
      if (operation.from && operation.to && operation.cardId) {
        // Reconstruct Position objects from the new operation structure
        const fromPosition: Position = {
          zone: {
            player: operation.from.player,
            type: operation.from.zoneType,
            index: operation.from.zoneIndex,
          },
          cardId: operation.cardId,
        }
        const toPosition: Position = {
          zone: {
            player: operation.to.player,
            type: operation.to.zoneType,
            index: operation.to.insertPosition === "last" ? undefined : operation.to.insertPosition,
          },
          cardId: operation.cardId,
        }
        // Perform the move operation with options (for shift key state)
        const options = operation.metadata as
          | { shiftKey?: boolean; defenseMode?: boolean; faceDownMode?: boolean; stackPosition?: "top" | "bottom" }
          | undefined
        newState = performCardMove(state, fromPosition, toPosition, options)
        return newState
      }
      break
    case "rotate":
      if (
        operation.to &&
        operation.metadata &&
        "angle" in operation.metadata &&
        typeof operation.metadata.angle === "number" &&
        operation.cardId
      ) {
        // Reconstruct Position object
        const position: Position = {
          zone: {
            player: operation.to.player,
            type: operation.to.zoneType,
            index: operation.to.zoneIndex,
          },
          cardId: operation.cardId,
        }
        newState = performCardRotation(state, position, operation.metadata.angle)
        return newState
      }
      break
    case "summon":
      // Handle token summon operations
      if (operation.to && operation.cardId && operation.metadata && "isToken" in operation.metadata) {
        const metadata = operation.metadata as { isToken: boolean; tokenCard?: Card }
        if (metadata.isToken && metadata.tokenCard) {
          const tokenCard = metadata.tokenCard
          newState = produce(state, (draft) => {
            const targetPlayer = draft.players[operation.to!.player]
            if (operation.to!.zoneType === "freeZone") {
              if (!targetPlayer.freeZone) targetPlayer.freeZone = []
              targetPlayer.freeZone.push(tokenCard)
            }
          })
          return newState
        }
      }
      break
    case "draw":
      // Draw operations are handled by move operations
      break
    case "activate":
      // Activate operations don't change state, only visual effects
      break
    case "target":
      // Target operations don't change state, only visual effects
      break
    case "toggleHighlight":
      if (operation.to && operation.cardId) {
        // Reconstruct Position object
        const position: Position = {
          zone: {
            player: operation.to.player,
            type: operation.to.zoneType,
            index: operation.to.zoneIndex,
          },
          cardId: operation.cardId,
        }
        newState = performCardHighlightToggle(state, position)
        return newState
      }
      break
    case "shuffle":
      if (
        operation.from &&
        operation.metadata &&
        "newOrder" in operation.metadata &&
        Array.isArray(operation.metadata.newOrder)
      ) {
        // Shuffle deck with the recorded order
        newState = produce(state, (draft) => {
          const player = draft.players[operation.from!.player]
          if (operation.from!.zoneType === "deck") {
            const newOrder = (operation.metadata as { newOrder: string[] }).newOrder
            // Reorder deck based on recorded card IDs
            player.deck = newOrder.map((cardId) => {
              const card = player.deck.find((c) => c.id === cardId)
              if (!card) throw new Error(`Card ${cardId} not found in deck`)
              return card
            })
          }
        })
        return newState
      }
      break
  }

  return newState
}

// Build full history from initial state and operations
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

// Update replay state during playback
const updateReplayState = (
  set: <T>(atom: WritableAtom<T, [T], void>, value: T) => void,
  nextState: GameState,
  index: number,
) => {
  set(gameStateAtom, nextState)
  set(gameHistoryIndexAtom, index)
  set(replayCurrentIndexAtom, index)
}

// Play replay
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

  // No need for replay ID anymore - using playing/paused state instead

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

  // 常に履歴から操作を取得する一貫したアプローチ
  // リプレイ開始時は履歴がreplayData.operationsと同じ内容を持っているはず
  // undo/redo後も履歴が最新の状態を反映している
  const currentHistory = get(gameHistoryAtom)
  const lastHistoryEntry = currentHistory[currentHistory.length - 1]

  // 履歴の最後のエントリには、現在までのすべての操作が含まれている
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
          
          // Temporarily store the animation with same start/end position
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
      updateReplayState(set, nextState, i + 1)
      currentState = nextState

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
      await new Promise((resolve) =>
        setTimeout(resolve, Math.round(ANIM.MOVE.ANIMATION / get(replaySpeedAtom))),
      )
    } else {
      // No card movement, but check for rotation or activation
      if (operation.type === "rotate" && operation.to && operation.metadata && "angle" in operation.metadata) {
        // Create rotate animation BEFORE updating state to prevent flicker
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
            // Update state immediately for rotation WITHOUT adding to history
            updateReplayState(set, nextState, i + 1)
            currentState = nextState
            resolve()
          })
        })

        // Use shorter delay for rotation
        await new Promise((resolve) =>
          setTimeout(resolve, getAnimationDuration(ANIM.ROTATION.DURATION, get)),
        )
      } else if (operation.type === "activate" && operation.to) {
        // Update state (no change for activate) WITHOUT adding to history
        updateReplayState(set, nextState, i + 1)
        currentState = nextState

        // Small delay to ensure DOM is updated
        await new Promise((resolve) => setTimeout(resolve, INITIAL_DOM_WAIT))

        // Create activation animation
        const animationId = uuidv4()
        const animations = get(cardAnimationsAtom)

        // Try to get card element position for replay
        let cardRect: { x: number; y: number; width: number; height: number } | undefined
        cardRect = getCardRect(operation.cardId, get)

        // Get card rotation from current state
        let cardRotation: number | undefined = 0
        if (operation.to != null && operation.cardId != null) {
          const player = currentState.players[operation.to.player]
          const result = getCardById(player, operation.cardId)
          if (result != null) {
            cardRotation = result.card.rotation
          }
        }

        // Create Position object if operation.to exists
        const position: Position | undefined =
          operation.to != null
            ? {
                zone: {
                  player: operation.to.player,
                  type: operation.to.zoneType,
                  index: operation.to.zoneIndex,
                  cardId: operation.cardId, // Add cardId to zone for zoom effect
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

        // Remove animation after duration
        setTimeout(
          () => {
            set(cardAnimationsAtom, (anims) => anims.filter((a) => a.id !== animationId))
          },
          getAnimationDuration(ANIM.EFFECT.ANIMATION, get),
        )

        // Wait for activation animation
        await new Promise((resolve) =>
          setTimeout(resolve, getAnimationDuration(ANIM.EFFECT.DURATION, get)),
        )
      } else if (operation.type === "summon") {
        // Update state for summon (token generation)
        updateReplayState(set, nextState, i + 1)
        currentState = nextState

        // Small delay to ensure DOM is updated and new card is rendered
        await new Promise((resolve) => setTimeout(resolve, getAnimationDuration(REPLAY_DELAY, get)))

        // Wait for token to appear
        await new Promise((resolve) =>
          setTimeout(resolve, Math.round(ANIM.MOVE.ANIMATION / get(replaySpeedAtom))),
        )
      } else if (operation.type === "target" && operation.to) {
        // Update state (no change for target) WITHOUT adding to history
        updateReplayState(set, nextState, i + 1)
        currentState = nextState

        // Small delay to ensure DOM is updated
        await new Promise((resolve) => setTimeout(resolve, INITIAL_DOM_WAIT))

        // Create target animation
        const animationId = uuidv4()
        const animations = get(cardAnimationsAtom)

        // Try to get card element position for replay
        let cardRect: { x: number; y: number; width: number; height: number } | undefined
        cardRect = getCardRect(operation.cardId, get)

        // Get card rotation from current state
        let cardRotation: number | undefined = 0
        if (operation.to != null && operation.cardId != null) {
          const player = currentState.players[operation.to.player]
          const result = getCardById(player, operation.cardId)
          if (result != null) {
            cardRotation = result.card.rotation
          }
        }

        // Get card image URL (fallback to empty string if unavailable)
        let cardImageUrl: string | undefined
        if (operation.to != null && operation.cardId != null) {
          const player = currentState.players[operation.to.player]
          const result = getCardById(player, operation.cardId)
          if (result != null) {
            cardImageUrl = result.card.imageUrl
          }
        }

        const newAnimation: CardAnimation = {
          id: animationId,
          type: "target",
          cardId: operation.cardId,
          cardImageUrl,
          position: {
            zone: {
              player: operation.to.player,
              type: operation.to.zoneType,
              index: operation.to.zoneIndex,
              cardId: operation.cardId,
            },
            cardId: operation.cardId,
          },
          cardRect,
          cardRotation,
          startTime: Date.now(),
          duration: ANIM.TARGET.ANIMATION,
        }

        set(cardAnimationsAtom, [...animations, newAnimation])

        // Wait for target animation to complete (expand + shrink)
        await new Promise((resolve) =>
          setTimeout(resolve, getAnimationDuration(ANIM.TARGET.ANIMATION * 2, get)),
        )
      } else if (operation.type === "toggleHighlight" && operation.to) {
        // Update state (no change) WITHOUT adding to history
        updateReplayState(set, nextState, i + 1)
        currentState = nextState

        // Ensure DOM updated
        await new Promise((resolve) =>
          setTimeout(resolve, getAnimationDuration(REPLAY_DELAY, get)),
        )

        const animationId = uuidv4()
        const animations = get(cardAnimationsAtom)

        // Card position
        let cardRect: { x: number; y: number; width: number; height: number } | undefined
        cardRect = getCardRect(operation.cardId, get)

        // Rotation & image
        let cardRotation: number | undefined = 0
        let cardImageUrl: string | undefined
        if (operation.cardId) {
          const player = currentState.players[operation.to.player]
          const res = getCardById(player, operation.cardId)
          if (res) {
            cardRotation = res.card.rotation
            cardImageUrl = res.card.imageUrl
          }
        }

        const highlightAnim: CardAnimation = {
          id: animationId,
          type: "highlight",
          cardId: operation.cardId,
          cardImageUrl,
          cardRect,
          cardRotation,
          startTime: Date.now(),
          duration: ANIM.HIGHLIGHT.ANIMATION,
        }

        set(cardAnimationsAtom, [...animations, highlightAnim])

        await new Promise((resolve) =>
          setTimeout(resolve, getAnimationDuration(ANIM.HIGHLIGHT.ANIMATION * 2, get)),
        )
      } else {
        // Other operations (no movement, no rotation, no activation) WITHOUT adding to history
        updateReplayState(set, nextState, i + 1)
        currentState = nextState

        // Wait for next step
        await new Promise((resolve) =>
          setTimeout(resolve, Math.round(ANIM.MOVE.ANIMATION / get(replaySpeedAtom))),
        )
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
        await new Promise((resolve) =>
          setTimeout(resolve, Math.round(ANIM.MOVE.ANIMATION / get(replaySpeedAtom))),
        )
      } else if (finalOperation.type === "rotate") {
        // Wait for rotation animation
        await new Promise((resolve) =>
          setTimeout(resolve, getAnimationDuration(ANIM.ROTATION.DURATION, get)),
        )
      } else if (finalOperation.type === "activate") {
        // Wait for activation animation
        await new Promise((resolve) =>
          setTimeout(resolve, getAnimationDuration(ANIM.EFFECT.DURATION, get)),
        )
      } else if (finalOperation.type === "summon") {
        // Wait for summon animation (token generation)
        await new Promise((resolve) =>
          setTimeout(resolve, Math.round(ANIM.MOVE.ANIMATION / get(replaySpeedAtom))),
        )
      } else if (finalOperation.type === "target") {
        // Wait for target animation (expand + shrink)
        await new Promise((resolve) =>
          setTimeout(resolve, getAnimationDuration(ANIM.TARGET.ANIMATION * 2, get)),
        )
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

  // No need to clear replay ID anymore

  // Don't reset pause state here - let toggleReplayPauseAtom handle it
  if (!wasPaused) {
    set(replayPausedAtom, false)
  }

  set(cardAnimationsAtom, [])
  set(highlightedZonesAtom, [])
})

// Pause/resume replay - Pause completely stops the replay, resume starts from beginning
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

// Animation state for card movements during replay
export interface CardAnimation {
  id: string
  type: "move" | "activate" | "target" | "rotate" | "changePosition" | "highlight"
  cardId?: string
  cardImageUrl?: string
  fromPosition?: { x: number; y: number }
  toPosition?: { x: number; y: number }
  position?: Position
  cardRect?: { x: number; y: number; width: number; height: number }
  cardRotation?: number
  // For rotate animation
  fromRotation?: number
  toRotation?: number
  // For changePosition animation
  fromCardPosition?: Position
  toCardPosition?: Position
  // For highlight animation
  fromHighlight?: boolean
  toHighlight?: boolean
  startTime: number
  duration?: number
}

export const cardAnimationsAtom = atom<CardAnimation[]>([])

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
        // Get card data from the state
        const fromState = isReverse ? nextState : prevState
        const toState = isReverse ? prevState : nextState
        
        // Find card in from state to get imageUrl and rotation
        let cardImageUrl: string | undefined
        let fromRotation = 0
        let toRotation = 0
        
        const fromPlayer = fromState.players[operation.player]
        const cardResult = getCardById(fromPlayer, operation.cardId)
        if (cardResult) {
          const card = cardResult.card
          cardImageUrl = card.name === "token" ? TOKEN_IMAGE_DATA_URL : card.imageUrl
          fromRotation = card.rotation ?? 0
        }
        
        // Get target rotation
        if (operation.to) {
          const toPlayer = toState.players[operation.to.player]
          const toCardResult = getCardById(toPlayer, operation.cardId)
          if (toCardResult) {
            toRotation = toCardResult.card.rotation ?? 0
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
          let cardRect: { x: number; y: number; width: number; height: number } | undefined
          cardRect = getCardRect(operation.cardId, get)

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
          let cardRect: { x: number; y: number; width: number; height: number } | undefined
          cardRect = getCardRect(operation.cardId, get)
          
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
          let cardRect: { x: number; y: number; width: number; height: number } | undefined
          cardRect = getCardRect(operation.cardId, get)

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
          let cardRect: { x: number; y: number; width: number; height: number } | undefined
          cardRect = getCardRect(operation.cardId, get)
          
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
          let cardRect: { x: number; y: number; width: number; height: number } | undefined
          cardRect = getCardRect(operation.cardId, get)
          
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
      signal.addEventListener('abort', () => {
        clearTimeout(timeout)
        reject(new DOMException('Animation cancelled'))
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
      signal.addEventListener('abort', () => {
        clearTimeout(timeout)
        reject(new DOMException('Animation cancelled'))
      })
    })
  } catch (e) {
    if (e instanceof DOMException && e.message === 'Animation cancelled') {
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
    options?: { shiftKey?: boolean; defenseMode?: boolean; faceDownMode?: boolean; stackPosition?: "top" | "bottom"; preventSameZoneReorder?: boolean },
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

      const cardImageUrl = res
        ? res.card.name === "token"
          ? TOKEN_IMAGE_DATA_URL
          : res.card.imageUrl
        : undefined

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
    let cardRect: DOMRect | null = null
    if (cardElement) {
      cardRect = cardElement.getBoundingClientRect()
    }

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
    let cardRect: DOMRect | null = null
    if (cardElement) {
      cardRect = cardElement.getBoundingClientRect()
    }
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

// Helper function: Execute card move
function performCardMove(
  state: GameState,
  from: Position,
  to: Position,
  options?: { shiftKey?: boolean; defenseMode?: boolean; faceDownMode?: boolean; stackPosition?: "top" | "bottom"; preventSameZoneReorder?: boolean },
): GameState {
  return produce(state, (draft) => {
    const fromPlayer = state.players[from.zone.player]
    const toPlayer = state.players[to.zone.player]

    // Get card by ID (cardId is now required)
    let card: Card | null = null
    let actualFromZone: ZoneId = from.zone

    // ID-based approach
    const result = getCardById(fromPlayer, from.cardId)
    if (result) {
      card = result.card
      actualFromZone = { ...result.zone, player: from.zone.player }
    }

    if (!card) {
      return state
    }

    // Update card's zone information
    // Reset rotation if moving to a zone that doesn't support rotation
    const supportsRotation =
      to.zone.type === "monsterZone" || to.zone.type === "spellTrapZone" || to.zone.type === "extraMonsterZone"

    // Apply rotation and face down state based on options
    let rotation = card.rotation
    let faceDown = card.faceDown

    // フリーゾーンへの移動時は守備表示・裏側表示を無効化
    if (to.zone.type === "freeZone" || to.zone.type === "sideFreeZone") {
      rotation = 0
      faceDown = false
    } else if (supportsRotation) {
      // Handle PC shift key (both defense and face down)
      if (options?.shiftKey === true) {
        // Monster zones: Face up defense position (表側守備表示)
        if (to.zone.type === "monsterZone" || to.zone.type === "extraMonsterZone") {
          rotation = -90
          faceDown = false
        }
        // Spell/Trap zones: Face down (裏側表示)
        else if (to.zone.type === "spellTrapZone") {
          rotation = 0
          faceDown = true
        }
      }
      // Handle mobile toggle buttons separately
      else if (options?.defenseMode === true || options?.faceDownMode === true) {
        // Monster zones
        if (to.zone.type === "monsterZone" || to.zone.type === "extraMonsterZone") {
          if (options.defenseMode === true) {
            rotation = -90 // Defense position
            faceDown = false // Face up
          }
          if (options.faceDownMode === true) {
            faceDown = true // Face down (keep current rotation)
          }
        }
        // Spell/Trap zones
        else if (to.zone.type === "spellTrapZone") {
          rotation = 0 // Always upright
          if (options.faceDownMode === true) {
            faceDown = true // Face down
          } else {
            faceDown = false // Face up
          }
        }
      } else if (to.zone.type === "spellTrapZone") {
        // When moving to spell/trap zone without any options, set to face up
        rotation = 0
        faceDown = false
      }
    } else {
      rotation = 0
      faceDown = false
    }

    const updatedCard = produce(card, (draft) => {
      draft.rotation = rotation
      draft.faceDown = faceDown
    })

    // Remove card from source location using card ID and index
    // Use cardIndex from 'from' parameter if available (for stacked cards), otherwise use the one from getCardById
    const cardIndex = from.zone.cardIndex ?? actualFromZone.cardIndex
    const newFromPlayer = removeCardFromZoneById(fromPlayer, actualFromZone, card.id, cardIndex)

    // Determine if this is a cross-zone move
    const isCrossZoneMove = actualFromZone.type !== to.zone.type
    
    // Check if preventSameZoneReorder is enabled and this is a same-zone move
    if (options?.preventSameZoneReorder === true && !isCrossZoneMove && actualFromZone.player === to.zone.player) {
      const hasIndex = actualFromZone.type === "monsterZone" || actualFromZone.type === "spellTrapZone" || actualFromZone.type === "extraMonsterZone"
      
      // For indexed zones, only prevent if it's the exact same slot
      if (hasIndex && actualFromZone.index === to.zone.index) {
        return state
      }
      // For non-indexed zones, prevent any reordering
      if (!hasIndex) {
        return state
      }
    }

    // For zone-specific moves, keep the index for certain zone types
    const shouldKeepIndex =
      to.zone.type === "monsterZone" || to.zone.type === "spellTrapZone" || to.zone.type === "extraMonsterZone"

    let targetZone =
      isCrossZoneMove && !shouldKeepIndex
        ? { ...to.zone, index: undefined } // Clear index for non-zone-specific cross-zone moves
        : to.zone // Keep index for same-zone moves and zone-specific moves

    // Calculate cardIndex based on stackPosition for stackable zones
    if (shouldKeepIndex && targetZone.index !== undefined) {
      const targetPlayer = to.zone.player === from.zone.player ? newFromPlayer : toPlayer
      let existingCards: Card[] = []

      // Get existing cards in the target zone
      if (to.zone.type === "monsterZone") {
        existingCards = targetPlayer.monsterZones[targetZone.index] ?? []
      } else if (to.zone.type === "spellTrapZone") {
        existingCards = targetPlayer.spellTrapZones[targetZone.index] ?? []
      } else if (to.zone.type === "extraMonsterZone") {
        existingCards = targetPlayer.extraMonsterZones[targetZone.index] ?? []
      }

      // Set cardIndex based on stackPosition
      if (options?.stackPosition === "bottom") {
        targetZone = { ...targetZone, cardIndex: existingCards.length }
      } else {
        // Default to top (index 0)
        targetZone = { ...targetZone, cardIndex: 0 }
      }
    } else if (to.zone.type === "freeZone") {
      // Also handle stackPosition for free zones
      const targetPlayer = to.zone.player === from.zone.player ? newFromPlayer : toPlayer
      const existingCards = targetPlayer.freeZone ?? []

      if (options?.stackPosition === "bottom") {
        targetZone = { ...targetZone, cardIndex: existingCards.length }
      } else {
        // Default to top (index 0)
        targetZone = { ...targetZone, cardIndex: 0 }
      }
    }

    // Check if field zone is already occupied
    if (to.zone.type === "fieldZone") {
      const targetPlayer = to.zone.player === from.zone.player ? newFromPlayer : toPlayer
      if (targetPlayer.fieldZone !== null) {
        // Field zone already occupied - cancel the move
        return state
      }
    }

    // Add card to new location
    const newToPlayer = addCardToZone(
      from.zone.player === to.zone.player ? newFromPlayer : toPlayer,
      targetZone,
      updatedCard,
    )

    // Update the draft state
    draft.players[from.zone.player] = newFromPlayer
    draft.players[to.zone.player] = newToPlayer
  })
}

// Helper function: Execute card rotation
function performCardRotation(state: GameState, position: Position, angle: number): GameState {
  const player = state.players[position.zone.player]

  // Get card by ID (cardId is now required)
  let card: Card | null = null
  let actualZone: ZoneId = position.zone

  // ID-based approach
  const result = getCardById(player, position.cardId)
  if (result) {
    card = result.card
    actualZone = { ...result.zone, player: position.zone.player }
  }

  if (!card) return state

  const rotatedCard = produce(card, (draft) => {
    draft.rotation = angle
  })
  const newPlayer = updateCardInZone(player, actualZone, rotatedCard)

  return {
    ...state,
    players: {
      ...state.players,
      [position.zone.player]: newPlayer,
    },
  }
}

// Helper function: Execute card flip (face up/down)
function performCardFlip(state: GameState, position: Position): GameState {
  const player = state.players[position.zone.player]

  // Get card by ID (cardId is now required)
  let card: Card | null = null
  let actualZone: ZoneId = position.zone

  // ID-based approach
  const result = getCardById(player, position.cardId)
  if (result) {
    card = result.card
    actualZone = { ...result.zone, player: position.zone.player }
  }

  if (!card) return state

  const flippedCard = produce(card, (draft) => {
    draft.faceDown = !(draft.faceDown === true)
  })
  const newPlayer = updateCardInZone(player, actualZone, flippedCard)

  return {
    ...state,
    players: {
      ...state.players,
      [position.zone.player]: newPlayer,
    },
  }
}

function performCardHighlightToggle(state: GameState, position: Position): GameState {
  const player = state.players[position.zone.player]

  // Get card by ID (cardId is now required)
  let card: Card | null = null
  let actualZone: ZoneId = position.zone

  // ID-based approach
  const result = getCardById(player, position.cardId)
  if (result) {
    card = result.card
    actualZone = { ...result.zone, player: position.zone.player }
  }

  if (!card) return state

  const highlightedCard = produce(card, (draft) => {
    draft.highlighted = !(draft.highlighted === true)
  })
  const newPlayer = updateCardInZone(player, actualZone, highlightedCard)

  return {
    ...state,
    players: {
      ...state.players,
      [position.zone.player]: newPlayer,
    },
  }
}

// Helper function: Get card by ID (searches all zones)
function getCardById(player: PlayerBoard, cardId: string): { card: Card; zone: ZoneId } | null {
  // Search monster zones
  for (let i = 0; i < player.monsterZones.length; i++) {
    const cards = player.monsterZones[i]
    for (let j = 0; j < cards.length; j++) {
      if (cards[j].id === cardId) {
        return {
          card: cards[j],
          zone: { player: "self", type: "monsterZone", index: i, cardIndex: j },
        }
      }
    }
  }

  // Search spell/trap zones
  for (let i = 0; i < player.spellTrapZones.length; i++) {
    const cards = player.spellTrapZones[i]
    for (let j = 0; j < cards.length; j++) {
      if (cards[j].id === cardId) {
        return {
          card: cards[j],
          zone: { player: "self", type: "spellTrapZone", index: i, cardIndex: j },
        }
      }
    }
  }

  // Search field zone
  if (player.fieldZone && player.fieldZone.id === cardId) {
    return { card: player.fieldZone, zone: { player: "self", type: "fieldZone" } }
  }

  // Search extra monster zones
  for (let i = 0; i < player.extraMonsterZones.length; i++) {
    const cards = player.extraMonsterZones[i]
    for (let j = 0; j < cards.length; j++) {
      if (cards[j].id === cardId) {
        return {
          card: cards[j],
          zone: { player: "self", type: "extraMonsterZone", index: i, cardIndex: j },
        }
      }
    }
  }

  // Search hand
  for (let i = 0; i < player.hand.length; i++) {
    if (player.hand[i].id === cardId) {
      return { card: player.hand[i], zone: { player: "self", type: "hand", index: i } }
    }
  }

  // Search deck
  for (let i = 0; i < player.deck.length; i++) {
    if (player.deck[i].id === cardId) {
      return { card: player.deck[i], zone: { player: "self", type: "deck", index: i } }
    }
  }

  // Search graveyard
  for (let i = 0; i < player.graveyard.length; i++) {
    if (player.graveyard[i].id === cardId) {
      return { card: player.graveyard[i], zone: { player: "self", type: "graveyard", index: i } }
    }
  }

  // Search banished
  for (let i = 0; i < player.banished.length; i++) {
    if (player.banished[i].id === cardId) {
      return { card: player.banished[i], zone: { player: "self", type: "banished", index: i } }
    }
  }

  // Search extra deck
  for (let i = 0; i < player.extraDeck.length; i++) {
    if (player.extraDeck[i].id === cardId) {
      return { card: player.extraDeck[i], zone: { player: "self", type: "extraDeck", index: i } }
    }
  }

  // Search free zone
  if (player.freeZone) {
    for (let i = 0; i < player.freeZone.length; i++) {
      if (player.freeZone[i].id === cardId) {
        return { card: player.freeZone[i], zone: { player: "self", type: "freeZone", index: i } }
      }
    }
  }

  // Search side free zone
  if (player.sideFreeZone) {
    for (let i = 0; i < player.sideFreeZone.length; i++) {
      if (player.sideFreeZone[i].id === cardId) {
        return { card: player.sideFreeZone[i], zone: { player: "self", type: "sideFreeZone", index: i } }
      }
    }
  }

  return null
}

// Helper function: Remove card from zone by ID
function removeCardFromZoneById(player: PlayerBoard, zone: ZoneId, cardId: string, cardIndex?: number): PlayerBoard {
  return produce(player, (draft) => {
    switch (zone.type) {
      case "monsterZone":
        if (zone.index !== undefined) {
          const cards = draft.monsterZones[zone.index]
          // If cardIndex is provided, use it directly (for stacked cards)
          if (cardIndex !== undefined && cardIndex < cards.length && cards[cardIndex].id === cardId) {
            cards.splice(cardIndex, 1)
          } else {
            // Otherwise, search by ID
            const foundIndex = cards.findIndex((c) => c.id === cardId)
            if (foundIndex !== -1) {
              cards.splice(foundIndex, 1)
            }
          }
        }
        break
      case "spellTrapZone":
        if (zone.index !== undefined) {
          const cards = draft.spellTrapZones[zone.index]
          // If cardIndex is provided, use it directly (for stacked cards)
          if (cardIndex !== undefined && cardIndex < cards.length && cards[cardIndex].id === cardId) {
            cards.splice(cardIndex, 1)
          } else {
            // Otherwise, search by ID
            const foundIndex = cards.findIndex((c) => c.id === cardId)
            if (foundIndex !== -1) {
              cards.splice(foundIndex, 1)
            }
          }
        }
        break
      case "fieldZone":
        if (draft.fieldZone?.id === cardId) {
          draft.fieldZone = null
        }
        break
      case "extraMonsterZone":
        if (zone.index !== undefined) {
          const cards = draft.extraMonsterZones[zone.index]
          // If cardIndex is provided, use it directly (for stacked cards)
          if (cardIndex !== undefined && cardIndex < cards.length && cards[cardIndex].id === cardId) {
            cards.splice(cardIndex, 1)
          } else {
            // Otherwise, search by ID
            const foundIndex = cards.findIndex((c) => c.id === cardId)
            if (foundIndex !== -1) {
              cards.splice(foundIndex, 1)
            }
          }
        }
        break
      case "hand": {
        const index = draft.hand.findIndex((c) => c.id === cardId)
        if (index !== -1) {
          draft.hand.splice(index, 1)
        }
        break
      }
      case "deck": {
        const index = draft.deck.findIndex((c) => c.id === cardId)
        if (index !== -1) {
          draft.deck.splice(index, 1)
        }
        break
      }
      case "graveyard": {
        const index = draft.graveyard.findIndex((c) => c.id === cardId)
        if (index !== -1) {
          draft.graveyard.splice(index, 1)
        }
        break
      }
      case "banished": {
        const index = draft.banished.findIndex((c) => c.id === cardId)
        if (index !== -1) {
          draft.banished.splice(index, 1)
        }
        break
      }
      case "extraDeck": {
        const index = draft.extraDeck.findIndex((c) => c.id === cardId)
        if (index !== -1) {
          draft.extraDeck.splice(index, 1)
        }
        break
      }
      case "freeZone": {
        if (draft.freeZone) {
          const index = draft.freeZone.findIndex((c) => c.id === cardId)
          if (index !== -1) {
            draft.freeZone.splice(index, 1)
          }
        }
        break
      }
      case "sideFreeZone": {
        if (draft.sideFreeZone) {
          const index = draft.sideFreeZone.findIndex((c) => c.id === cardId)
          if (index !== -1) {
            draft.sideFreeZone.splice(index, 1)
          }
        }
        break
      }
    }
  })
}

// Helper function: Add card to zone
function addCardToZone(player: PlayerBoard, zone: ZoneId, card: Card): PlayerBoard {
  return produce(player, (draft) => {
    switch (zone.type) {
      case "monsterZone": {
        if (zone.index !== undefined) {
          // Insert at specific zone
          const cards = draft.monsterZones[zone.index]
          const insertIndex = zone.cardIndex ?? 0
          cards.splice(insertIndex, 0, card)
          // Reset rotation for all cards except the top card (index 0)
          for (let i = 1; i < cards.length; i++) {
            cards[i].rotation = 0
          }
        } else {
          // Find first empty zone
          const emptyZoneIndex = draft.monsterZones.findIndex((cards) => cards.length === 0)
          if (emptyZoneIndex !== -1) {
            draft.monsterZones[emptyZoneIndex] = [card]
          } else {
            // No empty zones available - return unchanged
            return
          }
        }
        break
      }
      case "spellTrapZone": {
        if (zone.index !== undefined) {
          // Insert at specific zone
          const cards = draft.spellTrapZones[zone.index]
          const insertIndex = zone.cardIndex ?? 0
          cards.splice(insertIndex, 0, card)
          // Reset rotation for all cards except the top card (index 0)
          for (let i = 1; i < cards.length; i++) {
            cards[i].rotation = 0
          }
        } else {
          // Find first empty zone
          const emptyZoneIndex = draft.spellTrapZones.findIndex((cards) => cards.length === 0)
          if (emptyZoneIndex !== -1) {
            draft.spellTrapZones[emptyZoneIndex] = [card]
          } else {
            // No empty zones available - return unchanged
            return
          }
        }
        break
      }
      case "fieldZone":
        // Only allow placing if no card exists
        if (draft.fieldZone === null) {
          draft.fieldZone = card
        }
        // Field zone already occupied - return unchanged
        break
      case "extraMonsterZone": {
        if (zone.index !== undefined) {
          // Insert at specific zone
          const cards = draft.extraMonsterZones[zone.index]
          const insertIndex = zone.cardIndex ?? 0
          cards.splice(insertIndex, 0, card)
          // Reset rotation for all cards except the top card (index 0)
          for (let i = 1; i < cards.length; i++) {
            cards[i].rotation = 0
          }
        } else {
          // Find first empty zone
          const emptyZoneIndex = draft.extraMonsterZones.findIndex((cards) => cards.length === 0)
          if (emptyZoneIndex !== -1) {
            draft.extraMonsterZones[emptyZoneIndex] = [card]
          } else {
            // No empty zones available - return unchanged
            return
          }
        }
        break
      }
      case "hand": {
        // If index is specified, insert at that position
        if (zone.index !== undefined && zone.index >= 0 && zone.index <= draft.hand.length) {
          // Insert card at specified position
          draft.hand.splice(zone.index, 0, card)
        } else {
          // Otherwise append to end
          draft.hand.push(card)
        }
        break
      }
      case "deck": {
        // If index is specified, insert at that position
        if (zone.index !== undefined && zone.index >= 0 && zone.index <= draft.deck.length) {
          // Insert card at specified position
          draft.deck.splice(zone.index, 0, card)
        } else {
          // Otherwise append to end
          draft.deck.push(card)
        }
        break
      }
      case "graveyard": {
        // If index is specified, insert at that position
        if (zone.index !== undefined && zone.index >= 0 && zone.index <= draft.graveyard.length) {
          // Insert card at specified position
          draft.graveyard.splice(zone.index, 0, card)
        } else {
          // Otherwise append to end
          draft.graveyard.push(card)
        }
        break
      }
      case "banished": {
        // If index is specified, insert at that position
        if (zone.index !== undefined && zone.index >= 0 && zone.index <= draft.banished.length) {
          // Insert card at specified position
          draft.banished.splice(zone.index, 0, card)
        } else {
          // Otherwise append to end
          draft.banished.push(card)
        }
        break
      }
      case "extraDeck": {
        // If index is specified, insert at that position
        if (zone.index !== undefined && zone.index >= 0 && zone.index <= draft.extraDeck.length) {
          // Insert card at specified position
          draft.extraDeck.splice(zone.index, 0, card)
        } else {
          // Otherwise append to end
          draft.extraDeck.push(card)
        }
        break
      }
      case "freeZone": {
        if (!draft.freeZone) draft.freeZone = []
        // Use cardIndex for stack position, or index for legacy compatibility
        const insertIndex = zone.cardIndex ?? zone.index
        if (insertIndex !== undefined && insertIndex >= 0 && insertIndex <= draft.freeZone.length) {
          // Insert card at specified position
          draft.freeZone.splice(insertIndex, 0, card)
        } else {
          // Otherwise append to end
          draft.freeZone.push(card)
        }
        break
      }
      case "sideFreeZone": {
        if (!draft.sideFreeZone) draft.sideFreeZone = []
        // Use cardIndex for stack position, or index for legacy compatibility
        const insertIndex = zone.cardIndex ?? zone.index
        if (insertIndex !== undefined && insertIndex >= 0 && insertIndex <= draft.sideFreeZone.length) {
          // Insert card at specified position
          draft.sideFreeZone.splice(insertIndex, 0, card)
        } else {
          // Otherwise append to end
          draft.sideFreeZone.push(card)
        }
        break
      }
    }
  })
}

// Helper function: Update card in zone
function updateCardInZone(player: PlayerBoard, zone: ZoneId, card: Card): PlayerBoard {
  return produce(player, (draft) => {
    switch (zone.type) {
      case "monsterZone":
        if (zone.index !== undefined) {
          // Update the top card (index 0) if it exists
          if (draft.monsterZones[zone.index].length > 0) {
            draft.monsterZones[zone.index][0] = card
          }
        }
        break
      case "spellTrapZone":
        if (zone.index !== undefined) {
          // Update the top card (index 0) if it exists
          if (draft.spellTrapZones[zone.index].length > 0) {
            draft.spellTrapZones[zone.index][0] = card
          }
        }
        break
      case "fieldZone":
        draft.fieldZone = card
        break
      case "extraMonsterZone":
        if (zone.index !== undefined) {
          // Update the top card (index 0) if it exists
          if (draft.extraMonsterZones[zone.index].length > 0) {
            draft.extraMonsterZones[zone.index][0] = card
          }
        }
        break
      // For array-based zones, update specific card by index
      case "hand":
        if (zone.index !== undefined && zone.index < draft.hand.length) {
          draft.hand[zone.index] = card
        }
        break
      case "deck":
        if (zone.index !== undefined && zone.index < draft.deck.length) {
          draft.deck[zone.index] = card
        }
        break
      case "extraDeck":
        if (zone.index !== undefined && zone.index < draft.extraDeck.length) {
          draft.extraDeck[zone.index] = card
        }
        break
      case "graveyard":
        if (zone.index !== undefined && zone.index < draft.graveyard.length) {
          draft.graveyard[zone.index] = card
        }
        break
      case "banished":
        if (zone.index !== undefined && zone.index < draft.banished.length) {
          draft.banished[zone.index] = card
        }
        break
      case "freeZone":
        if (draft.freeZone && zone.index !== undefined && zone.index < draft.freeZone.length) {
          draft.freeZone[zone.index] = card
        }
        break
      case "sideFreeZone":
        if (draft.sideFreeZone && zone.index !== undefined && zone.index < draft.sideFreeZone.length) {
          draft.sideFreeZone[zone.index] = card
        }
        break
    }
  })
}

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
