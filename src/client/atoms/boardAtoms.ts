import { atom } from "jotai"
import type { Atom, WritableAtom } from "jotai"
import type { Card, GameState, PlayerBoard, Position, ZoneId, GameOperation, GamePhase } from "../../shared/types/game"

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

// History for undo/redo
export const gameHistoryAtom = atom<GameState[]>([createInitialGameState()])
export const gameHistoryIndexAtom = atom<number>(0)

// UI state atoms
export const selectedCardAtom = atom<Card | null>(null)
export const draggedCardAtom = atom<Card | null>(null)
export const hoveredZoneAtom = atom<ZoneId | null>(null)

// Deck loaded state
export const isDeckLoadedAtom = atom<boolean>((get) => {
  const state = get(gameStateAtom)
  // Check if any cards exist in any player's deck
  return (
    state.players.self.deck.length > 0 ||
    state.players.opponent.deck.length > 0 ||
    state.players.self.extraDeck.length > 0 ||
    state.players.opponent.extraDeck.length > 0
  )
})
export const highlightedZonesAtom = atom<ZoneId[]>([])

// Temporary storage for cards extracted from deck image
export const extractedCardsAtom = atom<{
  mainDeck: Card[]
  extraDeck: Card[]
}>({
  mainDeck: [],
  extraDeck: [],
})

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

  // Remove future history if we're in the middle of the history
  const newHistory = [...history.slice(0, currentIndex + 1), newState]

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
  set(gameHistoryAtom, [newState])
  set(gameHistoryIndexAtom, 0)
})

// Undo atom
export const undoAtom = atom(null, (get, set) => {
  const history = get(gameHistoryAtom)
  const currentIndex = get(gameHistoryIndexAtom)

  if (currentIndex > 0) {
    const newIndex = currentIndex - 1
    const previousState = history[newIndex]
    set(gameStateAtom, previousState)
    set(gameHistoryIndexAtom, newIndex)
  }
})

// Redo atom
export const redoAtom = atom(null, (get, set) => {
  const history = get(gameHistoryAtom)
  const currentIndex = get(gameHistoryIndexAtom)

  if (currentIndex < history.length - 1) {
    const newIndex = currentIndex + 1
    const nextState = history[newIndex]
    set(gameStateAtom, nextState)
    set(gameHistoryIndexAtom, newIndex)
  }
})

// Can undo/redo atoms
export const canUndoAtom = atom((get) => {
  const currentIndex = get(gameHistoryIndexAtom)
  return currentIndex > 0
})

export const canRedoAtom = atom((get) => {
  const history = get(gameHistoryAtom)
  const currentIndex = get(gameHistoryIndexAtom)
  return currentIndex < history.length - 1
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

// Replay playback atoms
export const replayPlayingAtom = atom<boolean>(false)
export const replayPausedAtom = atom<boolean>(false)
export const replayCurrentIndexAtom = atom<number | null>(null)
export const replaySpeedAtom = atom<number>(750) // Default 750ms between steps

// Start replay recording
export const startReplayRecordingAtom = atom(null, (get, set) => {
  const currentIndex = get(gameHistoryIndexAtom)
  const currentState = get(gameStateAtom)

  // Create deep copy of current state as snapshot
  const snapshot = JSON.parse(JSON.stringify(currentState)) as GameState

  // Initialize replay data
  const replayData: ReplayData = {
    startSnapshot: snapshot,
    operations: [],
    startTime: Date.now(),
  }

  set(replayRecordingAtom, true)
  set(replayStartIndexAtom, currentIndex)
  set(replayEndIndexAtom, null)
  set(replayDataAtom, replayData)
})

// Stop replay recording
export const stopReplayRecordingAtom = atom(null, (get, set) => {
  const currentIndex = get(gameHistoryIndexAtom)
  const replayData = get(replayDataAtom)

  if (replayData) {
    // Collect operations from start to end index
    const startIndex = get(replayStartIndexAtom)
    const operations = get(operationsAtom)

    if (startIndex !== null) {
      // Filter operations that occurred during recording
      const recordedOps = operations.filter((op) => {
        const opTime = op.timestamp
        return opTime >= replayData.startTime && (replayData.endTime === undefined || opTime <= replayData.endTime)
      })

      // Update replay data with operations and end time
      set(replayDataAtom, {
        ...replayData,
        operations: recordedOps,
        endTime: Date.now(),
      })
    }
  }

  set(replayRecordingAtom, false)
  set(replayEndIndexAtom, currentIndex)
})

// Helper function to find moved cards between states
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
      if (handCard) return { card: handCard, zone: { player, type: "hand", index: handCard.index } }
      // Deck
      const deckCard = board.deck.find((c) => c.id === cardId)
      if (deckCard) return { card: deckCard, zone: { player, type: "deck", index: deckCard.index } }
      // Graveyard
      const graveyardCard = board.graveyard.find((c) => c.id === cardId)
      if (graveyardCard) return { card: graveyardCard, zone: { player, type: "graveyard", index: graveyardCard.index } }
      // Banished
      const banishedCard = board.banished.find((c) => c.id === cardId)
      if (banishedCard) return { card: banishedCard, zone: { player, type: "banished", index: banishedCard.index } }
      // Extra deck
      const extraDeckCard = board.extraDeck.find((c) => c.id === cardId)
      if (extraDeckCard) return { card: extraDeckCard, zone: { player, type: "extraDeck", index: extraDeckCard.index } }
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

// Helper to apply operation to state
function applyOperation(state: GameState, operation: GameOperation): GameState {
  // Create a deep copy of the state
  const newState = JSON.parse(JSON.stringify(state)) as GameState

  switch (operation.type) {
    case "move":
      if (operation.from && operation.to) {
        // Perform the move operation
        return performCardMove(newState, operation.from, operation.to)
      }
      break
    case "rotate":
      if (operation.to && typeof operation.metadata?.angle === "number") {
        return performCardRotation(newState, operation.to, operation.metadata.angle)
      }
      break
    case "draw":
      // Draw operations are handled by move operations
      break
    case "activate":
      // Activate operations don't change state, only visual effects
      break
  }

  return newState
}

// Play replay
export const playReplayAtom = atom(null, async (get, set) => {
  const replayData = get(replayDataAtom)
  const speed = get(replaySpeedAtom)

  if (!replayData || replayData.operations.length === 0) {
    console.warn("No replay data available")
    return
  }

  // Set initial state from snapshot
  set(replayPlayingAtom, true)
  set(replayPausedAtom, false)
  set(replayCurrentIndexAtom, 0)
  set(gameStateAtom, JSON.parse(JSON.stringify(replayData.startSnapshot)) as GameState)

  // Clear any existing animations and UI state
  set(cardAnimationsAtom, [])
  set(highlightedZonesAtom, [])

  // Keep track of current state
  let currentState = JSON.parse(JSON.stringify(replayData.startSnapshot)) as GameState

  // Wait for DOM to update after snapshot restore
  await new Promise((resolve) => setTimeout(resolve, 100))

  // Play through each operation
  for (let i = 0; i < replayData.operations.length; i++) {
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
      const animationDuration = Math.floor((speed * 2) / 3) // 2/3 of replay speed

      // First, create animations with current positions
      for (const { card } of movedCards) {
        const prevPos = cardPositions.find((p) => p.cardId === card.id)?.position

        if (prevPos) {
          // Temporarily store the animation with same start/end position
          animations.push({
            id: crypto.randomUUID(),
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

      // Apply next state
      set(gameStateAtom, nextState)
      set(replayCurrentIndexAtom, i + 1)
      currentState = nextState

      // Small delay to ensure DOM is updated
      await new Promise((resolve) => setTimeout(resolve, 50))

      // Update animations with actual end positions
      const updatedAnimations = animations.map((anim) => {
        const nextPos = anim.cardId !== undefined ? getCardElementPosition(anim.cardId) : null
        return nextPos !== null ? { ...anim, toPosition: nextPos } : anim
      })

      // Update animations with correct end positions
      set(cardAnimationsAtom, updatedAnimations)

      // Wait for animation to complete before next step
      if (i < replayData.operations.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, speed))
      }
    } else {
      // No card movement, but check for rotation or activation
      if (operation.type === "rotate") {
        // Update state immediately for rotation
        set(gameStateAtom, nextState)
        set(replayCurrentIndexAtom, i + 1)
        currentState = nextState

        // Use shorter delay for rotation (300ms total, 200ms animation)
        if (i < replayData.operations.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 300))
        }
      } else if (operation.type === "activate" && operation.to) {
        // Update state (no change for activate)
        set(gameStateAtom, nextState)
        set(replayCurrentIndexAtom, i + 1)
        currentState = nextState

        // Small delay to ensure DOM is updated
        await new Promise((resolve) => setTimeout(resolve, 50))

        // Create activation animation
        const animationId = crypto.randomUUID()
        const animations = get(cardAnimationsAtom)
        
        // Try to get card element position for replay
        let cardRect: { x: number; y: number; width: number; height: number } | undefined
        if (operation.to?.zone?.cardId !== undefined) {
          const cardElement = document.querySelector(`[data-card-id="${operation.to.zone.cardId}"]`)
          if (cardElement) {
            const rect = cardElement.getBoundingClientRect()
            cardRect = {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
            }
          }
        }
        
        set(cardAnimationsAtom, [
          ...animations,
          {
            id: animationId,
            type: "activate",
            position: operation.to,
            cardRect,
            startTime: Date.now(),
          },
        ])

        // Remove animation after duration
        setTimeout(() => {
          set(cardAnimationsAtom, (anims) => anims.filter((a) => a.id !== animationId))
        }, 500)

        // Wait for activation animation
        if (i < replayData.operations.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500))
        }
      } else {
        // Other operations (no movement, no rotation, no activation)
        set(gameStateAtom, nextState)
        set(replayCurrentIndexAtom, i + 1)
        currentState = nextState

        // Wait for next step
        if (i < replayData.operations.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, speed))
        }
      }
    }
  }

  // Wait for final animation to complete
  const finalOperation = replayData.operations[replayData.operations.length - 1]
  if (finalOperation !== undefined) {
    if (finalOperation.type === "move" || finalOperation.type === "draw") {
      // Wait for move/draw animation
      await new Promise((resolve) => setTimeout(resolve, speed))
    } else if (finalOperation.type === "rotate") {
      // Wait for rotation animation
      await new Promise((resolve) => setTimeout(resolve, 300))
    } else if (finalOperation.type === "activate") {
      // Wait for activation animation
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }

  // End replay
  set(replayPlayingAtom, false)
  set(replayPausedAtom, false)
  set(replayCurrentIndexAtom, null)
  set(cardAnimationsAtom, [])
  set(highlightedZonesAtom, [])
})

// Pause/resume replay
export const toggleReplayPauseAtom = atom(null, (get, set) => {
  if (get(replayPlayingAtom)) {
    set(replayPausedAtom, !get(replayPausedAtom))
  }
})

// Stop replay
export const stopReplayAtom = atom(null, (get, set) => {
  set(replayPlayingAtom, false)
  set(replayPausedAtom, false)
  set(replayCurrentIndexAtom, null)
  set(cardAnimationsAtom, [])
  set(highlightedZonesAtom, [])
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
  startTime: number
  duration?: number
}

export const cardAnimationsAtom = atom<CardAnimation[]>([])

// Card move action
export const moveCardAtom = atom(null, (get, set, from: Position, to: Position, options?: { shiftKey?: boolean }) => {
  const state = get(gameStateAtom)
  const newState = performCardMove(state, from, to, options)

  // Always record operations and update state, even for same-zone moves
  // This ensures undo/redo and replay work correctly
  const stateChanged = JSON.stringify(state) !== JSON.stringify(newState)

  if (stateChanged) {
    set(gameStateAtom, newState)
    addToHistory(get, set, newState)

    // Record operation
    const operation: GameOperation = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      type: "move",
      from,
      to,
      player: from.zone.player,
      metadata: options,
    }
    set(operationsAtom, [...get(operationsAtom), operation])

    // Clear selected card after move to prevent UI issues
    set(selectedCardAtom, null)
  }
})

// Card rotation action
export const rotateCardAtom = atom(null, (get, set, position: Position, angle: number) => {
  const state = get(gameStateAtom)
  const newState = performCardRotation(state, position, angle)

  if (newState !== state) {
    set(gameStateAtom, newState)
    addToHistory(get, set, newState)

    const operation: GameOperation = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      type: "rotate",
      to: position,
      player: position.zone.player,
      metadata: { angle },
    }
    set(operationsAtom, [...get(operationsAtom), operation])
  }
})

// Card effect activation action
export const activateEffectAtom = atom(null, (get, set, position: Position, cardElement?: HTMLElement) => {
  // Get the card at this position to get its ID
  const state = get(gameStateAtom)
  const playerBoard = state.players[position.zone.player]
  let card: Card | null = null
  
  switch (position.zone.type) {
    case "monsterZone":
      card = playerBoard.monsterZones[position.zone.index ?? 0]?.[0] ?? null
      break
    case "spellTrapZone":
      card = playerBoard.spellTrapZones[position.zone.index ?? 0]?.[0] ?? null
      break
    case "extraMonsterZone":
      card = playerBoard.extraMonsterZones[position.zone.index ?? 0]?.[0] ?? null
      break
    case "graveyard":
      card = playerBoard.graveyard[position.zone.index ?? 0] ?? null
      break
    case "hand":
      card = playerBoard.hand[position.zone.index ?? 0] ?? null
      break
  }
  
  // Add card ID to position for zoom effect
  const positionWithCardId = {
    ...position,
    zone: {
      ...position.zone,
      cardId: card?.id,
    }
  }
  
  // Effect activation doesn't change game state, only visual effect
  const operation: GameOperation = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    type: "activate",
    to: positionWithCardId,
    player: position.zone.player,
  }
  set(operationsAtom, [...get(operationsAtom), operation])
  
  // Get card position if element is provided
  let cardRect: DOMRect | null = null
  if (cardElement) {
    cardRect = cardElement.getBoundingClientRect()
  }
  
  // Trigger visual effect animation
  const animations = get(cardAnimationsAtom)
  const animationId = crypto.randomUUID()
  set(cardAnimationsAtom, [
    ...animations,
    {
      id: animationId,
      type: "activate",
      position: positionWithCardId,
      cardRect: cardRect ? {
        x: cardRect.x,
        y: cardRect.y,
        width: cardRect.width,
        height: cardRect.height,
      } : undefined,
      startTime: Date.now(),
    },
  ])
  
  // Remove animation after duration
  setTimeout(() => {
    set(cardAnimationsAtom, (anims) => anims.filter((a) => a.id !== animationId))
  }, 500)
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

  // Update indices of remaining deck cards
  const newDeck = remainingDeck.map((card, idx) => ({ ...card, index: idx }))

  // Set new zone info and index for drawn cards
  const drawnCardsWithZone = drawnCards.map((card, idx) => ({
    ...card,
    zone: { player, type: "hand" as const },
    index: playerBoard.hand.length + idx,
  }))

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
  drawnCards.forEach((card) => {
    const operation: GameOperation = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      type: "draw",
      from: { zone: { player, type: "deck" } },
      to: { zone: { player, type: "hand" } },
      card,
      player,
    }
    set(operationsAtom, [...get(operationsAtom), operation])
  })
})

// Helper function: Execute card move
function performCardMove(state: GameState, from: Position, to: Position, options?: { shiftKey?: boolean }): GameState {
  // Deep clone the state to ensure we always create a new object
  const newState = JSON.parse(JSON.stringify(state)) as GameState

  const fromPlayer = newState.players[from.zone.player]
  const toPlayer = newState.players[to.zone.player]

  // Get card
  const card = getCardAtPosition(fromPlayer, from.zone)
  if (!card) {
    return state
  }

  // Update card's zone information
  // Reset rotation if moving to a zone that doesn't support rotation
  const supportsRotation =
    to.zone.type === "monsterZone" || to.zone.type === "spellTrapZone" || to.zone.type === "extraMonsterZone"

  // Apply rotation if Shift key was held during drop
  let rotation = card.rotation
  if (supportsRotation) {
    if (options?.shiftKey === true) {
      rotation = -90
    }
  } else {
    rotation = 0
  }

  const updatedCard = {
    ...card,
    zone: to.zone,
    index: to.zone.index,
    rotation,
  }

  // Remove card from source location
  const newFromPlayer = removeCardFromZone(fromPlayer, from.zone)

  // Add card to new location
  const newToPlayer = addCardToZone(
    from.zone.player === to.zone.player ? newFromPlayer : toPlayer,
    to.zone,
    updatedCard,
  )

  // Update the cloned state
  newState.players[from.zone.player] = newFromPlayer
  newState.players[to.zone.player] = newToPlayer

  return newState
}

// Helper function: Execute card rotation
function performCardRotation(state: GameState, position: Position, angle: number): GameState {
  const player = state.players[position.zone.player]
  const card = getCardAtPosition(player, position.zone)

  if (!card) return state

  const rotatedCard = { ...card, rotation: angle }
  const newPlayer = updateCardInZone(player, position.zone, rotatedCard)

  return {
    ...state,
    players: {
      ...state.players,
      [position.zone.player]: newPlayer,
    },
  }
}

// Helper function: Get card at specified position
function getCardAtPosition(player: PlayerBoard, zone: ZoneId): Card | null {
  switch (zone.type) {
    case "monsterZone":
      if (zone.index !== undefined) {
        const cards = player.monsterZones[zone.index]
        // If card has a specific index within the stack, use that
        const cardIndex = "cardIndex" in zone && typeof zone.cardIndex === "number" ? zone.cardIndex : 0
        return cards.length > cardIndex ? cards[cardIndex] : null
      }
      return null
    case "spellTrapZone":
      if (zone.index !== undefined) {
        const cards = player.spellTrapZones[zone.index]
        // If card has a specific index within the stack, use that
        const cardIndex = "cardIndex" in zone && typeof zone.cardIndex === "number" ? zone.cardIndex : 0
        return cards.length > cardIndex ? cards[cardIndex] : null
      }
      return null
    case "fieldZone":
      return player.fieldZone
    case "extraMonsterZone":
      if (zone.index !== undefined) {
        const cards = player.extraMonsterZones[zone.index]
        // If card has a specific index within the stack, use that
        const cardIndex = "cardIndex" in zone && typeof zone.cardIndex === "number" ? zone.cardIndex : 0
        return cards.length > cardIndex ? cards[cardIndex] : null
      }
      return null
    case "hand":
      return zone.index !== undefined ? player.hand[zone.index] : null
    case "deck":
      return zone.index !== undefined ? player.deck[zone.index] : null
    case "graveyard":
      return zone.index !== undefined ? player.graveyard[zone.index] : null
    case "banished":
      return zone.index !== undefined ? player.banished[zone.index] : null
    case "extraDeck":
      return zone.index !== undefined ? player.extraDeck[zone.index] : null
    default:
      return null
  }
}

// Helper function: Remove card from zone
function removeCardFromZone(player: PlayerBoard, zone: ZoneId): PlayerBoard {
  switch (zone.type) {
    case "monsterZone":
      if (zone.index !== undefined) {
        const newZones = [...player.monsterZones]
        const cards = [...newZones[zone.index]]
        // Remove the specific card by its index in the stack
        const cardIndex = "cardIndex" in zone && typeof zone.cardIndex === "number" ? zone.cardIndex : 0
        if (cardIndex < cards.length) {
          cards.splice(cardIndex, 1)
        }
        newZones[zone.index] = cards
        return { ...player, monsterZones: newZones }
      }
      break
    case "spellTrapZone":
      if (zone.index !== undefined) {
        const newZones = [...player.spellTrapZones]
        const cards = [...newZones[zone.index]]
        // Remove the specific card by its index in the stack
        const cardIndex = "cardIndex" in zone && typeof zone.cardIndex === "number" ? zone.cardIndex : 0
        if (cardIndex < cards.length) {
          cards.splice(cardIndex, 1)
        }
        newZones[zone.index] = cards
        return { ...player, spellTrapZones: newZones }
      }
      break
    case "fieldZone":
      return { ...player, fieldZone: null }
    case "extraMonsterZone":
      if (zone.index !== undefined) {
        const newZones = [...player.extraMonsterZones]
        const cards = [...newZones[zone.index]]
        // Remove the specific card by its index in the stack
        const cardIndex = "cardIndex" in zone && typeof zone.cardIndex === "number" ? zone.cardIndex : 0
        if (cardIndex < cards.length) {
          cards.splice(cardIndex, 1)
        }
        newZones[zone.index] = cards
        return { ...player, extraMonsterZones: newZones }
      }
      break
    case "hand":
      if (zone.index !== undefined) {
        const newHand = [...player.hand]
        newHand.splice(zone.index, 1)
        // Update indices of remaining cards
        const updatedHand = newHand.map((card, idx) => ({ ...card, index: idx }))
        return { ...player, hand: updatedHand }
      }
      break
    case "deck":
      if (zone.index !== undefined) {
        const newDeck = [...player.deck]
        newDeck.splice(zone.index, 1)
        // Update indices of remaining cards
        const updatedDeck = newDeck.map((card, idx) => ({ ...card, index: idx }))
        return { ...player, deck: updatedDeck }
      }
      break
    case "graveyard":
      if (zone.index !== undefined) {
        const newGraveyard = [...player.graveyard]
        newGraveyard.splice(zone.index, 1)
        // Update indices of remaining cards
        const updatedGraveyard = newGraveyard.map((card, idx) => ({ ...card, index: idx }))
        return { ...player, graveyard: updatedGraveyard }
      }
      break
    case "banished":
      if (zone.index !== undefined) {
        const newBanished = [...player.banished]
        newBanished.splice(zone.index, 1)
        // Update indices of remaining cards
        const updatedBanished = newBanished.map((card, idx) => ({ ...card, index: idx }))
        return { ...player, banished: updatedBanished }
      }
      break
    case "extraDeck":
      if (zone.index !== undefined) {
        const newExtraDeck = [...player.extraDeck]
        newExtraDeck.splice(zone.index, 1)
        // Update indices of remaining cards
        const updatedExtraDeck = newExtraDeck.map((card, idx) => ({ ...card, index: idx }))
        return { ...player, extraDeck: updatedExtraDeck }
      }
      break
  }
  return player
}

// Helper function: Add card to zone
function addCardToZone(player: PlayerBoard, zone: ZoneId, card: Card): PlayerBoard {
  switch (zone.type) {
    case "monsterZone":
      if (zone.index !== undefined) {
        const newZones = [...player.monsterZones]
        const cards = [...newZones[zone.index]]
        // If cardIndex is specified, insert at that position
        const insertIndex = zone.cardIndex ?? 0
        cards.splice(insertIndex, 0, card)
        newZones[zone.index] = cards
        return { ...player, monsterZones: newZones }
      }
      break
    case "spellTrapZone":
      if (zone.index !== undefined) {
        const newZones = [...player.spellTrapZones]
        const cards = [...newZones[zone.index]]
        // If cardIndex is specified, insert at that position
        const insertIndex = zone.cardIndex ?? 0
        cards.splice(insertIndex, 0, card)
        newZones[zone.index] = cards
        return { ...player, spellTrapZones: newZones }
      }
      break
    case "fieldZone":
      return { ...player, fieldZone: card }
    case "extraMonsterZone":
      if (zone.index !== undefined) {
        const newZones = [...player.extraMonsterZones]
        const cards = [...newZones[zone.index]]
        // If cardIndex is specified, insert at that position
        const insertIndex = zone.cardIndex ?? 0
        cards.splice(insertIndex, 0, card)
        newZones[zone.index] = cards
        return { ...player, extraMonsterZones: newZones }
      }
      break
    case "hand": {
      // If index is specified, insert at that position
      if (zone.index !== undefined && zone.index >= 0 && zone.index <= player.hand.length) {
        const newHand = [...player.hand]
        const newCard = { ...card, zone, index: zone.index }
        newHand.splice(zone.index, 0, newCard)
        // Update indices of all cards after insertion point
        const updatedHand = newHand.map((c, idx) => ({ ...c, index: idx }))
        return { ...player, hand: updatedHand }
      } else {
        // Otherwise append to end
        const newCard = { ...card, zone, index: player.hand.length }
        return { ...player, hand: [...player.hand, newCard] }
      }
    }
    case "deck": {
      // If index is specified, insert at that position
      if (zone.index !== undefined && zone.index >= 0 && zone.index <= player.deck.length) {
        const newDeck = [...player.deck]
        const newCard = { ...card, zone, index: zone.index }
        newDeck.splice(zone.index, 0, newCard)
        // Update indices of all cards after insertion point
        const updatedDeck = newDeck.map((c, idx) => ({ ...c, index: idx }))
        return { ...player, deck: updatedDeck }
      } else {
        // Otherwise append to end
        const newCard = { ...card, zone, index: player.deck.length }
        return { ...player, deck: [...player.deck, newCard] }
      }
    }
    case "graveyard": {
      // If index is specified, insert at that position
      if (zone.index !== undefined && zone.index >= 0 && zone.index <= player.graveyard.length) {
        const newGraveyard = [...player.graveyard]
        const newCard = { ...card, zone, index: zone.index }
        newGraveyard.splice(zone.index, 0, newCard)
        // Update indices of all cards after insertion point
        const updatedGraveyard = newGraveyard.map((c, idx) => ({ ...c, index: idx }))
        return { ...player, graveyard: updatedGraveyard }
      } else {
        // Otherwise append to end
        const newCard = { ...card, zone, index: player.graveyard.length }
        return { ...player, graveyard: [...player.graveyard, newCard] }
      }
    }
    case "banished": {
      // If index is specified, insert at that position
      if (zone.index !== undefined && zone.index >= 0 && zone.index <= player.banished.length) {
        const newBanished = [...player.banished]
        const newCard = { ...card, zone, index: zone.index }
        newBanished.splice(zone.index, 0, newCard)
        // Update indices of all cards after insertion point
        const updatedBanished = newBanished.map((c, idx) => ({ ...c, index: idx }))
        return { ...player, banished: updatedBanished }
      } else {
        // Otherwise append to end
        const newCard = { ...card, zone, index: player.banished.length }
        return { ...player, banished: [...player.banished, newCard] }
      }
    }
    case "extraDeck": {
      // If index is specified, insert at that position
      if (zone.index !== undefined && zone.index >= 0 && zone.index <= player.extraDeck.length) {
        const newExtraDeck = [...player.extraDeck]
        const newCard = { ...card, zone, index: zone.index }
        newExtraDeck.splice(zone.index, 0, newCard)
        // Update indices of all cards after insertion point
        const updatedExtraDeck = newExtraDeck.map((c, idx) => ({ ...c, index: idx }))
        return { ...player, extraDeck: updatedExtraDeck }
      } else {
        // Otherwise append to end
        const newCard = { ...card, zone, index: player.extraDeck.length }
        return { ...player, extraDeck: [...player.extraDeck, newCard] }
      }
    }
  }
  return player
}

// Helper function: Update card in zone
function updateCardInZone(player: PlayerBoard, zone: ZoneId, card: Card): PlayerBoard {
  switch (zone.type) {
    case "monsterZone":
      if (zone.index !== undefined) {
        const newZones = [...player.monsterZones]
        // Update the top card (index 0) if it exists
        if (newZones[zone.index].length > 0) {
          const cards = [...newZones[zone.index]]
          cards[0] = card
          newZones[zone.index] = cards
        }
        return { ...player, monsterZones: newZones }
      }
      break
    case "spellTrapZone":
      if (zone.index !== undefined) {
        const newZones = [...player.spellTrapZones]
        // Update the top card (index 0) if it exists
        if (newZones[zone.index].length > 0) {
          const cards = [...newZones[zone.index]]
          cards[0] = card
          newZones[zone.index] = cards
        }
        return { ...player, spellTrapZones: newZones }
      }
      break
    case "fieldZone":
      return { ...player, fieldZone: card }
    case "extraMonsterZone":
      if (zone.index !== undefined) {
        const newZones = [...player.extraMonsterZones]
        // Update the top card (index 0) if it exists
        if (newZones[zone.index].length > 0) {
          const cards = [...newZones[zone.index]]
          cards[0] = card
          newZones[zone.index] = cards
        }
        return { ...player, extraMonsterZones: newZones }
      }
      break
    // For array-based zones, update specific card by index
    case "hand":
      if (zone.index !== undefined) {
        const newHand = [...player.hand]
        newHand[zone.index] = card
        return { ...player, hand: newHand }
      }
      break
  }
  return player
}
