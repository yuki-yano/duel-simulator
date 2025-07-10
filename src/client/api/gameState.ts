import { saveDeckImage, calculateImageHash } from "./deck"
import type { DeckProcessMetadata } from "@/client/components/DeckImageProcessor"
import type { ReplaySaveData, DeckCardIdsMapping, GameState, DeckConfiguration } from "@/shared/types/game"
import { ErrorResponseSchema, SaveStateSuccessResponseSchema, SavedStateResponseSchema, SaveGameStateRequestSchema } from "@/shared/types/api"
import { z } from "zod"

export type SaveGameStateRequest = z.infer<typeof SaveGameStateRequestSchema>
export type SaveGameStateResponse = z.infer<typeof SaveStateSuccessResponseSchema>

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
    const errorData = await response.json()
    const validatedError = ErrorResponseSchema.parse(errorData)
    throw new Error(validatedError.error ?? "Failed to save game state")
  }

  const responseData = await response.json()
  return SaveStateSuccessResponseSchema.parse(responseData)
}

export type LoadGameStateResponse = z.infer<typeof SavedStateResponseSchema>

export async function loadGameState(id: string): Promise<LoadGameStateResponse> {
  const response = await fetch(`/api/save-states/${id}`)

  if (!response.ok) {
    const errorData = await response.json()
    const validatedError = ErrorResponseSchema.parse(errorData)
    throw new Error(validatedError.error ?? "Failed to load game state")
  }

  const responseData = await response.json()
  return SavedStateResponseSchema.parse(responseData)
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
    const errorData = await response.json()
    const validatedError = ErrorResponseSchema.parse(errorData)
    throw new Error(validatedError.error ?? "Failed to save replay")
  }

  const responseData = await response.json()
  return SaveStateSuccessResponseSchema.parse(responseData)
}
