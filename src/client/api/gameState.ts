import { saveDeckImage, calculateImageHash } from "./deck"
import type { DeckProcessMetadata, DeckConfiguration } from "@/client/components/DeckImageProcessor"
import type { ReplaySaveData, DeckCardIdsMapping } from "@/shared/types/game"

export interface SaveGameStateRequest {
  sessionId?: string
  stateJson: string
  deckImageHash: string
  title: string
  description?: string
  type?: "replay" | "snapshot"
  version?: string
}

export interface SaveGameStateResponse {
  success: boolean
  id: string
  sessionId: string
  shareUrl: string
}

// Re-export GameState from shared types
export type { GameState } from "@/shared/types/game"

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
  title: string
  description?: string
  type: string
  version: string
  deckConfig: string
  deckCardIds: string
}> {
  const response = await fetch(`/api/save-states/${id}`)

  if (!response.ok) {
    const error = (await response.json()) as { error?: string }
    throw new Error(error.error ?? "Failed to load game state")
  }

  return response.json()
}

// Save replay data
export async function saveReplayData(
  replayData: ReplaySaveData,
  deckImageHash: string,
  deckConfig: DeckConfiguration,
  deckCardIds: DeckCardIdsMapping,
): Promise<SaveGameStateResponse> {
  const response = await fetch("/api/save-states", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      stateJson: JSON.stringify(replayData),
      deckImageHash,
      title: replayData.metadata.title,
      description: replayData.metadata.description,
      type: replayData.type,
      version: replayData.version,
      deckConfig,
      deckCardIds,
    }),
  })

  if (!response.ok) {
    const error = (await response.json()) as { error?: string }
    throw new Error(error.error ?? "Failed to save replay")
  }

  return response.json()
}
