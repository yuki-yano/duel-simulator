import { produce } from "immer"
import type { Card, GameState, PlayerBoard, ZoneId, ZoneType } from "@/shared/types/game"

// Add card to a specific zone
export function addCardToZone(player: PlayerBoard, zone: ZoneId, card: Card): PlayerBoard {
  return produce(player, (draft) => {
    switch (zone.type) {
      case "monsterZone": {
        if (zone.index !== undefined) {
          // Insert at specific zone
          const cards = draft.monsterZones[zone.index]
          const insertIndex = zone.cardIndex ?? 0
          cards.splice(insertIndex, 0, card)
          // Reset rotation and counter for all cards except the top card (index 0)
          for (let i = 1; i < cards.length; i++) {
            cards[i] = { ...cards[i], rotation: 0, counter: undefined }
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
          // Reset rotation and counter for all cards except the top card (index 0)
          for (let i = 1; i < cards.length; i++) {
            cards[i] = { ...cards[i], rotation: 0, counter: undefined }
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
          // Reset rotation and counter for all cards except the top card (index 0)
          for (let i = 1; i < cards.length; i++) {
            cards[i] = { ...cards[i], rotation: 0, counter: undefined }
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
        // Reset counter when moving to hand
        const cardWithResetCounter = produce(card, (draftCard) => {
          draftCard.counter = undefined
        })
        // If index is specified, insert at that position
        if (zone.index !== undefined && zone.index >= 0 && zone.index <= draft.hand.length) {
          // Insert card at specified position
          draft.hand.splice(zone.index, 0, cardWithResetCounter)
        } else {
          // Otherwise append to end
          draft.hand.push(cardWithResetCounter)
        }
        break
      }
      case "deck": {
        // Reset counter when moving to deck
        const cardWithResetCounter = produce(card, (draftCard) => {
          draftCard.counter = undefined
        })
        // If index is specified, insert at that position
        if (zone.index !== undefined && zone.index >= 0 && zone.index <= draft.deck.length) {
          // Insert card at specified position
          draft.deck.splice(zone.index, 0, cardWithResetCounter)
        } else {
          // Otherwise insert at beginning (top of deck)
          draft.deck.unshift(cardWithResetCounter)
        }
        break
      }
      case "graveyard": {
        // Reset counter when moving to graveyard
        const cardWithResetCounter = produce(card, (draftCard) => {
          draftCard.counter = undefined
        })
        // If index is specified, insert at that position
        if (zone.index !== undefined && zone.index >= 0 && zone.index <= draft.graveyard.length) {
          // Insert card at specified position
          draft.graveyard.splice(zone.index, 0, cardWithResetCounter)
        } else {
          // Otherwise append to end (bottom of graveyard)
          draft.graveyard.push(cardWithResetCounter)
        }
        break
      }
      case "banished": {
        // Reset counter when moving to banished
        const cardWithResetCounter = produce(card, (draftCard) => {
          draftCard.counter = undefined
        })
        // If index is specified, insert at that position
        if (zone.index !== undefined && zone.index >= 0 && zone.index <= draft.banished.length) {
          // Insert card at specified position
          draft.banished.splice(zone.index, 0, cardWithResetCounter)
        } else {
          // Otherwise append to end
          draft.banished.push(cardWithResetCounter)
        }
        break
      }
      case "extraDeck": {
        // Reset counter when moving to extra deck
        const cardWithResetCounter = produce(card, (draftCard) => {
          draftCard.counter = undefined
        })
        // If index is specified, insert at that position
        if (zone.index !== undefined && zone.index >= 0 && zone.index <= draft.extraDeck.length) {
          // Insert card at specified position
          draft.extraDeck.splice(zone.index, 0, cardWithResetCounter)
        } else {
          // Otherwise append to end
          draft.extraDeck.push(cardWithResetCounter)
        }
        break
      }
      case "freeZone": {
        if (!draft.freeZone) draft.freeZone = []
        // Reset counter, rotation, and faceDown when moving to free zone
        const cardWithResetProperties = produce(card, (draftCard) => {
          draftCard.counter = undefined
          draftCard.rotation = 0
          draftCard.faceDown = false
        })
        // Use cardIndex for stack position, or index for legacy compatibility
        const insertIndex = zone.cardIndex ?? zone.index
        if (insertIndex !== undefined && insertIndex >= 0 && insertIndex <= draft.freeZone.length) {
          // Insert card at specified position
          draft.freeZone.splice(insertIndex, 0, cardWithResetProperties)
        } else {
          // Otherwise append to end
          draft.freeZone.push(cardWithResetProperties)
        }
        break
      }
      case "sideFreeZone": {
        if (!draft.sideFreeZone) draft.sideFreeZone = []
        // Reset counter, rotation, and faceDown when moving to side free zone
        const cardWithResetProperties = produce(card, (draftCard) => {
          draftCard.counter = undefined
          draftCard.rotation = 0
          draftCard.faceDown = false
        })
        // Use cardIndex for stack position, or index for legacy compatibility
        const insertIndex = zone.cardIndex ?? zone.index
        if (insertIndex !== undefined && insertIndex >= 0 && insertIndex <= draft.sideFreeZone.length) {
          // Insert card at specified position
          draft.sideFreeZone.splice(insertIndex, 0, cardWithResetProperties)
        } else {
          // Otherwise append to end
          draft.sideFreeZone.push(cardWithResetProperties)
        }
        break
      }
      case "sideDeck": {
        if (!draft.sideDeck) draft.sideDeck = []
        // Reset counter when moving to side deck
        const cardWithResetCounter = produce(card, (draftCard) => {
          draftCard.counter = undefined
        })
        // If index is specified, insert at that position
        if (zone.index !== undefined && zone.index >= 0 && zone.index <= draft.sideDeck.length) {
          // Insert card at specified position
          draft.sideDeck.splice(zone.index, 0, cardWithResetCounter)
        } else {
          // Otherwise append to end
          draft.sideDeck.push(cardWithResetCounter)
        }
        break
      }
    }
  })
}

// Remove card from zone by ID
export function removeCardFromZoneById(
  player: PlayerBoard,
  zone: ZoneId,
  cardId: string,
  cardIndex?: number,
): PlayerBoard {
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
      case "sideDeck": {
        if (draft.sideDeck) {
          const index = draft.sideDeck.findIndex((c) => c.id === cardId)
          if (index !== -1) {
            draft.sideDeck.splice(index, 1)
          }
        }
        break
      }
    }
  })
}

// Get cards in a specific zone
export function getCardsInZone(state: GameState, player: "self" | "opponent", zone: ZoneType, index?: number): Card[] {
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
    case "sideDeck":
      return playerBoard.sideDeck ?? []
    default:
      return []
  }
}

// Get display name for zone
export function getZoneDisplayName(zone: ZoneId): string {
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
    case "sideDeck":
      return `${playerPrefix}サイドデッキ`
    default:
      return zone.type
  }
}

// Update card in zone
export function updateCardInZone(player: PlayerBoard, zone: ZoneId, card: Card): PlayerBoard {
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
        if (draft.fieldZone) {
          draft.fieldZone = card
        }
        break
      case "extraMonsterZone":
        if (zone.index !== undefined) {
          // Update the top card (index 0) if it exists
          if (draft.extraMonsterZones[zone.index].length > 0) {
            draft.extraMonsterZones[zone.index][0] = card
          }
        }
        break
      case "hand": {
        const index = draft.hand.findIndex((c) => c.id === card.id)
        if (index !== -1) {
          draft.hand[index] = card
        }
        break
      }
      case "deck": {
        const index = draft.deck.findIndex((c) => c.id === card.id)
        if (index !== -1) {
          draft.deck[index] = card
        }
        break
      }
      case "graveyard": {
        const index = draft.graveyard.findIndex((c) => c.id === card.id)
        if (index !== -1) {
          draft.graveyard[index] = card
        }
        break
      }
      case "banished": {
        const index = draft.banished.findIndex((c) => c.id === card.id)
        if (index !== -1) {
          draft.banished[index] = card
        }
        break
      }
      case "extraDeck": {
        const index = draft.extraDeck.findIndex((c) => c.id === card.id)
        if (index !== -1) {
          draft.extraDeck[index] = card
        }
        break
      }
      case "freeZone": {
        if (draft.freeZone) {
          const index = draft.freeZone.findIndex((c) => c.id === card.id)
          if (index !== -1) {
            draft.freeZone[index] = card
          }
        }
        break
      }
      case "sideFreeZone": {
        if (draft.sideFreeZone) {
          const index = draft.sideFreeZone.findIndex((c) => c.id === card.id)
          if (index !== -1) {
            draft.sideFreeZone[index] = card
          }
        }
        break
      }
    }
  })
}
