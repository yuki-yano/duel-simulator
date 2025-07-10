import { atom } from "jotai"
import type { Atom, WritableAtom } from "jotai"
import { v4 as uuidv4 } from "uuid"
import { produce } from "immer"
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

// Animation duration constants (in milliseconds)
const ANIMATION_DURATIONS = {
  EFFECT_ACTIVATION: 300,
  CARD_ROTATION: 200,
  REPLAY_DELAY: 50,
  EFFECT_ACTIVATION_WAIT: 300, // Wait time after effect activation in replay
  ROTATION_WAIT: 300, // Wait time after rotation in replay
  BASE_MOVE_DURATION: 750, // Base duration for move animations at 1x speed
} as const

// Get animation duration based on speed multiplier
function getAnimationDuration(baseDuration: number, speedMultiplier: number): number {
  // speedMultiplier: 0.5x, 1x, 2x, 3x
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
function getCardElementPosition(cardId: string): { x: number; y: number } | null {
  const element = document.querySelector(`[data-card-id="${cardId}"]`)
  if (!element) return null

  const rect = element.getBoundingClientRect()
  return {
    x: rect.left,
    y: rect.top,
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
export const undoAtom = atom(null, (get, set) => {
  const history = get(gameHistoryAtom)
  const currentIndex = get(gameHistoryIndexAtom)
  const isPlaying = get(replayPlayingAtom)

  if (currentIndex > 0) {
    const newIndex = currentIndex - 1
    const previousEntry = history[newIndex]

    // Update game state
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
      // Calculate how many operations to trim from replay operations
      const currentEntry = history[currentIndex]
      const operationsToRemove = currentEntry.operationCount - previousEntry.operationCount

      const replayOps = get(replayOperationsAtom)

      // Remove the last N operations from replay operations
      const trimmedReplayOps = replayOps.slice(0, replayOps.length - operationsToRemove)
      set(replayOperationsAtom, trimmedReplayOps)
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
  const speedMultiplier = get(replaySpeedAtom)

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
          position: getCardElementPosition(card.id),
        }))

        // Create animations for moved cards BEFORE updating state
        const animations: CardAnimation[] = []
        const animationDuration = Math.floor((ANIMATION_DURATIONS.BASE_MOVE_DURATION * 2) / (3 * speedMultiplier))

        // First, create animations with current positions
        for (const { card } of movedCards) {
          const prevPos = cardPositions.find((p) => p.cardId === card.id)?.position

          if (prevPos) {
            animations.push({
              id: uuidv4(),
              type: "move",
              cardId: card.id,
              cardImageUrl: card.imageUrl,
              fromPosition: prevPos,
              toPosition: prevPos, // Will be updated after state change
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
        await new Promise((resolve) =>
          setTimeout(resolve, getAnimationDuration(ANIMATION_DURATIONS.REPLAY_DELAY, speedMultiplier)),
        )

        // Update animations with actual end positions
        const updatedAnimations = animations.map((anim) => {
          const nextPos = anim.cardId !== undefined ? getCardElementPosition(anim.cardId) : null
          return nextPos !== null ? { ...anim, toPosition: nextPos } : anim
        })

        // Update animations with correct end positions
        set(cardAnimationsAtom, updatedAnimations)

        // Wait for animation to complete
        await new Promise((resolve) =>
          setTimeout(resolve, Math.round(ANIMATION_DURATIONS.BASE_MOVE_DURATION / speedMultiplier)),
        )
      } else {
        // Handle non-movement operations
        if (operation.type === "rotate") {
          set(gameStateAtom, nextState)
          set(gameHistoryIndexAtom, i + 1)
          set(replayCurrentIndexAtom, i + 1)
          currentState = nextState

          await new Promise((resolve) =>
            setTimeout(resolve, getAnimationDuration(ANIMATION_DURATIONS.ROTATION_WAIT, speedMultiplier)),
          )
        } else if (operation.type === "activate" && operation.to) {
          set(gameStateAtom, nextState)
          set(gameHistoryIndexAtom, i + 1)
          set(replayCurrentIndexAtom, i + 1)
          currentState = nextState

          await new Promise((resolve) =>
            setTimeout(resolve, getAnimationDuration(ANIMATION_DURATIONS.REPLAY_DELAY, speedMultiplier)),
          )

          // Create activation animation
          const animationId = uuidv4()
          const animations = get(cardAnimationsAtom)

          let cardRect: { x: number; y: number; width: number; height: number } | undefined
          const cardElement = document.querySelector(`[data-card-id="${operation.cardId}"]`)
          if (cardElement) {
            const rect = cardElement.getBoundingClientRect()
            cardRect = {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
            }
          }

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

          set(cardAnimationsAtom, [
            ...animations,
            {
              id: animationId,
              type: "activate",
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
            getAnimationDuration(ANIMATION_DURATIONS.EFFECT_ACTIVATION, speedMultiplier),
          )

          await new Promise((resolve) =>
            setTimeout(resolve, getAnimationDuration(ANIMATION_DURATIONS.EFFECT_ACTIVATION_WAIT, speedMultiplier)),
          )
        } else {
          set(gameStateAtom, nextState)
          set(gameHistoryIndexAtom, i + 1)
          set(replayCurrentIndexAtom, i + 1)
          currentState = nextState

          await new Promise((resolve) =>
            setTimeout(resolve, Math.round(ANIMATION_DURATIONS.BASE_MOVE_DURATION / speedMultiplier)),
          )
        }
      }
    }

    // Wait for final animation
    const finalOperation = replayData.operations[replayData.operations.length - 1]
    if (finalOperation !== undefined) {
      if (finalOperation.type === "move" || finalOperation.type === "draw") {
        await new Promise((resolve) =>
          setTimeout(resolve, Math.round(ANIMATION_DURATIONS.BASE_MOVE_DURATION / speedMultiplier)),
        )
      } else if (finalOperation.type === "rotate") {
        await new Promise((resolve) =>
          setTimeout(resolve, getAnimationDuration(ANIMATION_DURATIONS.ROTATION_WAIT, speedMultiplier)),
        )
      } else if (finalOperation.type === "activate") {
        await new Promise((resolve) =>
          setTimeout(resolve, getAnimationDuration(ANIMATION_DURATIONS.EFFECT_ACTIVATION_WAIT, speedMultiplier)),
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

    // Update game state
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

// Replay playback atoms
export const replayPlayingAtom = atom<boolean>(false)
export const replayPausedAtom = atom<boolean>(false)
export const replayCurrentIndexAtom = atom<number | null>(null)
export const replaySpeedAtom = atom<number>(1) // Default 1x speed
export const replayStartDelayAtom = atom<number>(0) // Default 0 seconds delay
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
          | { shiftKey?: boolean; defenseMode?: boolean; faceDownMode?: boolean }
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
    case "draw":
      // Draw operations are handled by move operations
      break
    case "activate":
      // Activate operations don't change state, only visual effects
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
  index: number
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
  const speedMultiplier = get(replaySpeedAtom) // Direct speed multiplier: 0.5x, 1x, 2x, 3x
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
  await new Promise((resolve) => setTimeout(resolve, 100))

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
        position: getCardElementPosition(card.id),
      }))

      // Create animations for moved cards BEFORE updating state
      const animations: CardAnimation[] = []
      const animationDuration = Math.floor((ANIMATION_DURATIONS.BASE_MOVE_DURATION * 2) / (3 * speedMultiplier)) // 2/3 of base duration adjusted by speed

      // First, create animations with current positions
      for (const { card } of movedCards) {
        const prevPos = cardPositions.find((p) => p.cardId === card.id)?.position

        if (prevPos) {
          // Temporarily store the animation with same start/end position
          animations.push({
            id: uuidv4(),
            type: "move",
            cardId: card.id,
            cardImageUrl: card.imageUrl,
            fromPosition: prevPos,
            toPosition: prevPos, // Will be updated after state change
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
      await new Promise((resolve) =>
        setTimeout(resolve, getAnimationDuration(ANIMATION_DURATIONS.REPLAY_DELAY, speedMultiplier)),
      )

      // Update animations with actual end positions
      const updatedAnimations = animations.map((anim) => {
        const nextPos = anim.cardId !== undefined ? getCardElementPosition(anim.cardId) : null
        return nextPos !== null ? { ...anim, toPosition: nextPos } : anim
      })

      // Update animations with correct end positions
      set(cardAnimationsAtom, updatedAnimations)

      // Wait for animation to complete
      await new Promise((resolve) =>
        setTimeout(resolve, Math.round(ANIMATION_DURATIONS.BASE_MOVE_DURATION / speedMultiplier)),
      )
    } else {
      // No card movement, but check for rotation or activation
      if (operation.type === "rotate") {
        // Update state immediately for rotation WITHOUT adding to history
        updateReplayState(set, nextState, i + 1)
        currentState = nextState

        // Use shorter delay for rotation
        await new Promise((resolve) =>
          setTimeout(resolve, getAnimationDuration(ANIMATION_DURATIONS.ROTATION_WAIT, speedMultiplier)),
        )
      } else if (operation.type === "activate" && operation.to) {
        // Update state (no change for activate) WITHOUT adding to history
        updateReplayState(set, nextState, i + 1)
        currentState = nextState

        // Small delay to ensure DOM is updated
        await new Promise((resolve) =>
          setTimeout(resolve, getAnimationDuration(ANIMATION_DURATIONS.REPLAY_DELAY, speedMultiplier)),
        )

        // Create activation animation
        const animationId = uuidv4()
        const animations = get(cardAnimationsAtom)

        // Try to get card element position for replay
        let cardRect: { x: number; y: number; width: number; height: number } | undefined
        const cardElement = document.querySelector(`[data-card-id="${operation.cardId}"]`)
        if (cardElement) {
          const rect = cardElement.getBoundingClientRect()
          cardRect = {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          }
        }

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

        set(cardAnimationsAtom, [
          ...animations,
          {
            id: animationId,
            type: "activate",
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
          getAnimationDuration(ANIMATION_DURATIONS.EFFECT_ACTIVATION, speedMultiplier),
        )

        // Wait for activation animation
        await new Promise((resolve) =>
          setTimeout(resolve, getAnimationDuration(ANIMATION_DURATIONS.EFFECT_ACTIVATION_WAIT, speedMultiplier)),
        )
      } else {
        // Other operations (no movement, no rotation, no activation) WITHOUT adding to history
        updateReplayState(set, nextState, i + 1)
        currentState = nextState

        // Wait for next step
        await new Promise((resolve) =>
          setTimeout(resolve, Math.round(ANIMATION_DURATIONS.BASE_MOVE_DURATION / speedMultiplier)),
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
          setTimeout(resolve, Math.round(ANIMATION_DURATIONS.BASE_MOVE_DURATION / speedMultiplier)),
        )
      } else if (finalOperation.type === "rotate") {
        // Wait for rotation animation
        await new Promise((resolve) =>
          setTimeout(resolve, getAnimationDuration(ANIMATION_DURATIONS.ROTATION_WAIT, speedMultiplier)),
        )
      } else if (finalOperation.type === "activate") {
        // Wait for activation animation
        await new Promise((resolve) =>
          setTimeout(resolve, getAnimationDuration(ANIMATION_DURATIONS.EFFECT_ACTIVATION_WAIT, speedMultiplier)),
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
  type: "move" | "activate"
  cardId?: string
  cardImageUrl?: string
  fromPosition?: { x: number; y: number }
  toPosition?: { x: number; y: number }
  position?: Position
  cardRect?: { x: number; y: number; width: number; height: number }
  cardRotation?: number
  startTime: number
  duration?: number
}

export const cardAnimationsAtom = atom<CardAnimation[]>([])

// Card move action
export const moveCardAtom = atom(
  null,
  (
    get,
    set,
    from: Position,
    to: Position,
    options?: { shiftKey?: boolean; defenseMode?: boolean; faceDownMode?: boolean },
  ) => {
    const state = get(gameStateAtom)
    const newState = performCardMove(state, from, to, options)

    // Always record operations and update state, even for same-zone moves
    // This ensures undo/redo and replay work correctly
    const stateChanged = JSON.stringify(state) !== JSON.stringify(newState)

    if (stateChanged) {
      set(gameStateAtom, newState)
      addToHistory(get, set, newState)

      // Record operation with new structure
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
      set(operationsAtom, [...get(operationsAtom), operation])

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
  const newState = performCardRotation(state, position, angle)

  if (newState !== state) {
    set(gameStateAtom, newState)
    addToHistory(get, set, newState)

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
    set(operationsAtom, [...get(operationsAtom), operation])

    // Also record to replay operations if recording
    if (get(replayRecordingAtom)) {
      set(replayOperationsAtom, [...get(replayOperationsAtom), operation])
    }
  }
})

// Card flip (face up/down) action
export const flipCardAtom = atom(null, (get, set, position: Position) => {
  const state = get(gameStateAtom)
  const newState = performCardFlip(state, position)

  if (newState !== state) {
    set(gameStateAtom, newState)
    addToHistory(get, set, newState)

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
    set(operationsAtom, [...get(operationsAtom), operation])

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
    set(gameStateAtom, newState)
    addToHistory(get, set, newState)

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
    set(operationsAtom, [...get(operationsAtom), operation])

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

    // Remove animation after duration
    setTimeout(() => {
      set(cardAnimationsAtom, (anims) => anims.filter((a) => a.id !== animationId))
    }, ANIMATION_DURATIONS.EFFECT_ACTIVATION)

    // Add to history for undo/redo support (same gameState, but new operation)
    const currentState = get(gameStateAtom)
    addToHistory(get, set, currentState)
  } catch (error) {
    console.error("Error in activateEffectAtom:", error)
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

  set(gameStateAtom, newState)
  addToHistory(get, set, newState)

  // Record draw operation for each card
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
    set(operationsAtom, [...get(operationsAtom), operation])

    // Also record to replay operations if recording
    if (get(replayRecordingAtom)) {
      set(replayOperationsAtom, [...get(replayOperationsAtom), operation])
    }
  })
})

// Helper function: Execute card move
function performCardMove(
  state: GameState,
  from: Position,
  to: Position,
  options?: { shiftKey?: boolean; defenseMode?: boolean; faceDownMode?: boolean },
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

    if (supportsRotation) {
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

    // Remove card from source location using card ID
    const newFromPlayer = removeCardFromZoneById(fromPlayer, actualFromZone, card.id)

    // Determine if this is a cross-zone move
    const isCrossZoneMove = actualFromZone.type !== to.zone.type

    // For zone-specific moves, keep the index for certain zone types
    const shouldKeepIndex =
      to.zone.type === "monsterZone" || to.zone.type === "spellTrapZone" || to.zone.type === "extraMonsterZone"

    const targetZone =
      isCrossZoneMove && !shouldKeepIndex
        ? { ...to.zone, index: undefined } // Clear index for non-zone-specific cross-zone moves
        : to.zone // Keep index for same-zone moves and zone-specific moves

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

  return null
}

// Helper function: Remove card from zone by ID
function removeCardFromZoneById(player: PlayerBoard, zone: ZoneId, cardId: string): PlayerBoard {
  return produce(player, (draft) => {
    switch (zone.type) {
      case "monsterZone":
        if (zone.index !== undefined) {
          const cards = draft.monsterZones[zone.index]
          const cardIndex = cards.findIndex((c) => c.id === cardId)
          if (cardIndex !== -1) {
            cards.splice(cardIndex, 1)
          }
        }
        break
      case "spellTrapZone":
        if (zone.index !== undefined) {
          const cards = draft.spellTrapZones[zone.index]
          const cardIndex = cards.findIndex((c) => c.id === cardId)
          if (cardIndex !== -1) {
            cards.splice(cardIndex, 1)
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
          const cardIndex = cards.findIndex((c) => c.id === cardId)
          if (cardIndex !== -1) {
            cards.splice(cardIndex, 1)
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
    }
  })
}
