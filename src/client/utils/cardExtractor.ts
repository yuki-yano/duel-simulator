import type { Card as GameCard, DeckCardIdsMapping } from "@/shared/types/game"
import type { DeckConfiguration, DeckProcessMetadata } from "@/client/components/DeckImageProcessor"

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

  if (!deckConfig || typeof deckConfig !== "object") {
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
          const cardId = deckCardIds.mainDeck[cardIndex]
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
          const cardId = deckCardIds.extraDeck[cardIndex]
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

// Helper function to get all cards from game state
function getAllCards(gameState: any): any[] {
  const cards: any[] = []

  if (gameState.players) {
    for (const player of Object.values(gameState.players)) {
      if (player && typeof player === "object") {
        const playerAny = player as any

        // Add cards from all zones
        if (playerAny.deck) cards.push(...playerAny.deck)
        if (playerAny.hand) cards.push(...playerAny.hand)
        if (playerAny.graveyard) cards.push(...playerAny.graveyard)
        if (playerAny.banished) cards.push(...playerAny.banished)
        if (playerAny.extraDeck) cards.push(...playerAny.extraDeck)
        if (playerAny.fieldZone) cards.push(playerAny.fieldZone)

        // Add cards from zone arrays
        const zoneArrays = ["monsterZones", "spellTrapZones", "extraMonsterZones"]
        for (const zoneName of zoneArrays) {
          if (playerAny[zoneName]) {
            for (const zone of playerAny[zoneName]) {
              if (Array.isArray(zone)) {
                cards.push(...zone)
              } else if (zone) {
                cards.push(zone)
              }
            }
          }
        }
      }
    }
  }

  return cards.filter((card) => card && typeof card === "object")
}

// Restore card images to game state
export function restoreCardImages(
  gameState: any, // Using any to avoid circular dependency
  cardImageMap: Map<string, string>,
): void {
  // Helper function to restore images for cards in any zone
  const restoreImagesInZone = (cards: any[]) => {
    if (!Array.isArray(cards)) return

    cards.forEach((card, arrayIndex) => {
      if (Array.isArray(card)) {
        // Handle nested arrays (like monsterZones)
        restoreImagesInZone(card)
      } else if (card && typeof card === "object" && "id" in card) {
        // Use card ID to get the image
        const imageUrl = cardImageMap.get(card.id)
        if (imageUrl) {
          card.imageUrl = imageUrl
        }
      }
    })
  }

  // Restore images for all zones
  if (gameState.players) {
    for (const player of Object.values(gameState.players)) {
      if (player && typeof player === "object") {
        // Cast player to any to access dynamic properties
        const playerAny = player as any

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
          if (playerAny[zoneName]) {
            restoreImagesInZone(playerAny[zoneName])
          }
        }

        // Handle single card zones
        if (playerAny.fieldZone && typeof playerAny.fieldZone === "object" && "id" in playerAny.fieldZone) {
          const card = playerAny.fieldZone
          if (!card.imageUrl || card.imageUrl === "") {
            const firstImage = cardImageMap.values().next().value
            if (firstImage) {
              card.imageUrl = firstImage
            }
          }
        }
      }
    }
  }
}
