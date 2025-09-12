import type { Card, GameState, PlayerBoard, ZoneId, ZoneType } from "@/shared/types/game"
import type { MovedCard } from "../types"

// Find card in game state
export function findCardInState(
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

// Get card by ID from player board
export function getCardById(player: PlayerBoard, cardId: string): { card: Card; zone: ZoneId } | null {
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

// Find moved cards between states
export function findMovedCards(prevState: GameState, nextState: GameState): MovedCard[] {
  const movedCards: MovedCard[] = []

  // Helper to find card in all zones
  const findCardInStateWithZone = (state: GameState, cardId: string): { card: Card; zone: ZoneId } | null => {
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

  // Check each card for movement
  for (const cardId of allCardIds) {
    const prevLocation = findCardInStateWithZone(prevState, cardId)
    const nextLocation = findCardInStateWithZone(nextState, cardId)

    if (prevLocation && nextLocation) {
      // Check if card moved
      if (
        prevLocation.zone.player !== nextLocation.zone.player ||
        prevLocation.zone.type !== nextLocation.zone.type ||
        prevLocation.zone.index !== nextLocation.zone.index
      ) {
        movedCards.push({
          card: nextLocation.card,
          fromZone: prevLocation.zone,
          toZone: nextLocation.zone,
        })
      }
    }
  }

  return movedCards
}
