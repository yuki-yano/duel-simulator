import type { Card } from "@/shared/types/game"

/**
 * 相手デッキのカードIDマッピングを生成
 */
export function createOpponentDeckMapping(
  mainDeck: Card[],
  extraDeck: Card[],
  sideDeck: Card[],
): {
  opponentMainDeck: Record<string, string>
  opponentExtraDeck: Record<string, string>
  opponentSideDeck: Record<string, string>
} {
  const opponentMainMapping: Record<string, string> = {}
  mainDeck.forEach((card, index) => {
    opponentMainMapping[index.toString()] = card.id
  })

  const opponentExtraMapping: Record<string, string> = {}
  extraDeck.forEach((card, index) => {
    opponentExtraMapping[index.toString()] = card.id
  })

  const opponentSideMapping: Record<string, string> = {}
  sideDeck.forEach((card, index) => {
    opponentSideMapping[index.toString()] = card.id
  })

  return {
    opponentMainDeck: opponentMainMapping,
    opponentExtraDeck: opponentExtraMapping,
    opponentSideDeck: opponentSideMapping,
  }
}

/**
 * 相手デッキマッピングをDeckCardIdsMappingに追加
 */
export function addOpponentDeckToMapping<T extends Record<string, unknown>>(
  deckCardIds: T,
  opponentMapping: ReturnType<typeof createOpponentDeckMapping>,
): T & ReturnType<typeof createOpponentDeckMapping> {
  return {
    ...deckCardIds,
    ...opponentMapping,
  }
}
