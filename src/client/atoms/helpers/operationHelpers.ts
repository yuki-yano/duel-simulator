import type { GameState, ZoneType } from "@/shared/types/game"
import { getCardsInZone, getZoneDisplayName } from "./zoneHelpers"
import { findCardInState } from "./cardHelpers"

// Get operation description for undo/redo
export function getOperationDescription(prevState: GameState, currentState: GameState): string {
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
