import type { DeckCardIdsMapping } from "@/shared/types/game"
import type { DeckProcessMetadata } from "@/client/components/DeckImageProcessor"

// Position ratios based on image width
const LAYOUT_RATIOS = {
  mainDeckTextY: 0.071,
  textToCardsGap: 0.035,
  sectionGap: 0.004,
  cardAspectRatio: 1.4665,
  rowGap: 0,
  firstRowOffset: 0.002,
  cardHorizontalMargin: 0.002,
  leftTextX: 0.02,
  textWidth: 0.35,
  textHeight: 0.035,
}

// Extract cards from a deck image and create a mapping
export async function extractCardsFromDeckImage(
  deckMetadata: DeckProcessMetadata & { imageUrl?: string },
  deckCardIds: DeckCardIdsMapping,
): Promise<Map<string, string>> {
  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error("Failed to load deck image"))
    // Use imageUrl if provided (for replay), otherwise use imageDataUrl (for initial deck loading)
    img.src = deckMetadata.imageUrl ?? deckMetadata.imageDataUrl
  })

  const cardImageMap = new Map<string, string>()
  const { deckConfig } = deckMetadata

  if (deckConfig == null || typeof deckConfig !== "object") {
    console.error("Invalid deckConfig:", deckConfig)
    return cardImageMap
  }

  const { cardWidth, cardHeight, cardGap, leftMargin } = deckConfig

  const cardsPerRow = 10

  // Process main deck
  if (deckConfig.mainDeck) {
    const { yPosition, count, rows } = deckConfig.mainDeck

    const startY = yPosition + img.width * LAYOUT_RATIOS.textToCardsGap + img.width * LAYOUT_RATIOS.firstRowOffset

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cardsPerRow; col++) {
        const cardIndex = row * cardsPerRow + col
        if (cardIndex >= count) break

        try {
          const cardDataUrl = extractCardImage(img, {
            x: leftMargin + col * (cardWidth + cardGap),
            y: startY + row * (cardHeight + img.width * LAYOUT_RATIOS.rowGap),
            width: cardWidth,
            height: cardHeight,
            horizontalMargin: img.width * LAYOUT_RATIOS.cardHorizontalMargin,
          })

          // Use actual card ID from mapping
          const cardId = deckCardIds.mainDeck[cardIndex.toString()]
          if (cardId) {
            cardImageMap.set(cardId, cardDataUrl)
          }
        } catch (err) {
          console.error(`Failed to extract main deck card ${cardIndex}:`, err)
        }
      }
    }
  }

  // Process extra deck
  if (deckConfig.extraDeck) {
    const { yPosition, count, rows } = deckConfig.extraDeck

    const startY = yPosition + img.width * LAYOUT_RATIOS.textToCardsGap + img.width * LAYOUT_RATIOS.firstRowOffset

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cardsPerRow; col++) {
        const cardIndex = row * cardsPerRow + col
        if (cardIndex >= count) break

        try {
          const cardDataUrl = extractCardImage(img, {
            x: leftMargin + col * (cardWidth + cardGap),
            y: startY + row * (cardHeight + img.width * LAYOUT_RATIOS.rowGap),
            width: cardWidth,
            height: cardHeight,
            horizontalMargin: img.width * LAYOUT_RATIOS.cardHorizontalMargin,
          })

          // Use actual card ID from mapping
          const cardId = deckCardIds.extraDeck[cardIndex.toString()]
          if (cardId) {
            cardImageMap.set(cardId, cardDataUrl)
          }
        } catch (err) {
          console.error(`Failed to extract extra deck card ${cardIndex}:`, err)
        }
      }
    }
  }

  return cardImageMap
}

// Extract a single card image from the deck
function extractCardImage(
  img: HTMLImageElement,
  params: {
    x: number
    y: number
    width: number
    height: number
    horizontalMargin: number
  },
): string {
  const { x, y, width, height, horizontalMargin } = params

  const tempCanvas = document.createElement("canvas")
  tempCanvas.width = width
  tempCanvas.height = height

  const ctx = tempCanvas.getContext("2d")
  if (!ctx) {
    throw new Error("Failed to get canvas context")
  }

  ctx.drawImage(img, x - horizontalMargin, y, width + horizontalMargin * 2, height, 0, 0, width, height)

  return tempCanvas.toDataURL("image/png")
}

// Restore card images to game state
export function restoreCardImages(
  gameState: unknown, // Using unknown instead of any
  cardImageMap: Map<string, string>,
): void {
  // Helper function to restore images for cards in any zone
  const restoreImagesInZone = (cards: unknown[]) => {
    if (!Array.isArray(cards)) return

    cards.forEach((card, _arrayIndex) => {
      if (Array.isArray(card)) {
        // Handle nested arrays (like monsterZones)
        restoreImagesInZone(card)
      } else if (card != null && typeof card === "object" && "id" in card) {
        // Use card ID to get the image
        const cardObj = card as { id: string; imageUrl?: string }
        const imageUrl = cardImageMap.get(cardObj.id)
        if (imageUrl != null) {
          cardObj.imageUrl = imageUrl
        }
      }
    })
  }

  // Restore images for all zones
  const state = gameState as { players?: Record<string, unknown> }
  if (state.players != null) {
    for (const player of Object.values(state.players)) {
      if (player != null && typeof player === "object") {
        // Cast player to Record to access dynamic properties
        const playerAny = player as Record<string, unknown>

        // Check all possible zones
        const zones = [
          "monsterZones",
          "spellTrapZones",
          "graveyard",
          "banished",
          "extraDeck",
          "deck",
          "hand",
          "extraMonsterZones",
        ]

        for (const zoneName of zones) {
          if (playerAny[zoneName] != null && Array.isArray(playerAny[zoneName])) {
            restoreImagesInZone(playerAny[zoneName] as unknown[])
          }
        }

        // Handle single card zones
        if (playerAny.fieldZone != null && typeof playerAny.fieldZone === "object" && "id" in playerAny.fieldZone) {
          const card = playerAny.fieldZone as { id: string; imageUrl?: string }
          if (card.imageUrl == null || card.imageUrl === "") {
            const firstImage = cardImageMap.values().next().value
            if (firstImage != null) {
              card.imageUrl = firstImage
            }
          }
        }
      }
    }
  }
}
