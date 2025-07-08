import { saveDeckImage, calculateImageHash } from "./deck"
import type { DeckProcessMetadata } from "@/client/components/DeckImageProcessor"

export interface SaveGameStateRequest {
  sessionId?: string
  stateJson: string
  deckImageHash: string
}

export interface SaveGameStateResponse {
  success: boolean
  id: string
  sessionId: string
}

export interface GameState {
  // TODO: Define actual game state structure
  cards: string[]
  field: Record<string, unknown>
  turn: number
}

export async function saveGameState(
  gameState: GameState,
  deckMetadata: DeckProcessMetadata | null,
): Promise<SaveGameStateResponse> {
  if (!deckMetadata) {
    throw new Error("No deck metadata available")
  }

  // Calculate hash for the deck image
  const imageHash = await calculateImageHash(deckMetadata.imageDataUrl)

  // First, save the deck image if it doesn't exist
  try {
    await saveDeckImage({
      hash: imageHash,
      imageData: deckMetadata.imageDataUrl,
      mainDeckCount: deckMetadata.mainDeckCount,
      extraDeckCount: deckMetadata.extraDeckCount,
      sourceWidth: deckMetadata.sourceWidth,
      sourceHeight: deckMetadata.sourceHeight,
    })
  } catch (error) {
    // Ignore error if image already exists
    console.log("Deck image might already exist:", error)
  }

  // Then save the game state
  const response = await fetch("/api/save-states", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      stateJson: JSON.stringify(gameState),
      deckImageHash: imageHash,
    }),
  })

  if (!response.ok) {
    const error = (await response.json()) as { error?: string }
    throw new Error(error.error ?? "Failed to save game state")
  }

  return response.json()
}

export async function loadGameState(id: string): Promise<{
  id: string
  sessionId: string
  stateJson: string
  deckImageHash: string
  createdAt: string
}> {
  const response = await fetch(`/api/save-states/${id}`)

  if (!response.ok) {
    const error = (await response.json()) as { error?: string }
    throw new Error(error.error ?? "Failed to load game state")
  }

  return response.json()
}
