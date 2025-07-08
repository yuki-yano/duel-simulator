import { atom } from "jotai"
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

// UI state atoms
export const selectedCardAtom = atom<Card | null>(null)
export const draggedCardAtom = atom<Card | null>(null)
export const hoveredZoneAtom = atom<ZoneId | null>(null)
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
    set(gameStateAtom, {
      ...state,
      phase: newPhase,
    })
  },
)

// Card move action
export const moveCardAtom = atom(null, (get, set, from: Position, to: Position) => {
  const state = get(gameStateAtom)
  const newState = performCardMove(state, from, to)

  if (newState !== state) {
    set(gameStateAtom, newState)

    // Record operation
    const operation: GameOperation = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      type: "move",
      from,
      to,
      player: from.zone.player,
    }
    set(operationsAtom, [...get(operationsAtom), operation])
  } else {
    // No-op for same zone moves without index change
  }
})

// Card rotation action
export const rotateCardAtom = atom(null, (get, set, position: Position, angle: number) => {
  const state = get(gameStateAtom)
  const newState = performCardRotation(state, position, angle)

  if (newState !== state) {
    set(gameStateAtom, newState)

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
function performCardMove(state: GameState, from: Position, to: Position): GameState {
  const fromPlayer = state.players[from.zone.player]
  const toPlayer = state.players[to.zone.player]

  // Get card
  const card = getCardAtPosition(fromPlayer, from.zone)
  if (!card) {
    return state
  }

  // Update card's zone information
  const updatedCard = {
    ...card,
    zone: to.zone,
    index: to.zone.index,
  }

  // Remove card from source location
  const newFromPlayer = removeCardFromZone(fromPlayer, from.zone)

  // Add card to new location
  const newToPlayer = addCardToZone(
    from.zone.player === to.zone.player ? newFromPlayer : toPlayer,
    to.zone,
    updatedCard,
  )

  return {
    ...state,
    players: {
      ...state.players,
      [from.zone.player]: newFromPlayer,
      [to.zone.player]: newToPlayer,
    },
  }
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
        cards.unshift(card) // Add to the top
        newZones[zone.index] = cards
        return { ...player, monsterZones: newZones }
      }
      break
    case "spellTrapZone":
      if (zone.index !== undefined) {
        const newZones = [...player.spellTrapZones]
        const cards = [...newZones[zone.index]]
        cards.unshift(card) // Add to the top
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
        cards.unshift(card) // Add to the top
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
