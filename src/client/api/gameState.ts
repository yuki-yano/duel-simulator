import type { ReplaySaveData, DeckCardIdsMapping, DeckConfiguration } from "@/shared/types/game"
import { ErrorResponseSchema, SaveStateSuccessResponseSchema, SavedStateResponseSchema } from "@/shared/types/api"
import { z } from "zod"
import { apiUrl } from "@/client/lib/api"

export type SaveGameStateResponse = z.infer<typeof SaveStateSuccessResponseSchema>

// Re-export GameState from shared types
export type { GameState } from "@/shared/types/game"

export type LoadGameStateResponse = z.infer<typeof SavedStateResponseSchema>

export async function loadGameState(id: string): Promise<LoadGameStateResponse> {
  const response = await fetch(apiUrl(`/save-states/${id}`))

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
  const response = await fetch(apiUrl("/save-states"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      stateJson: JSON.stringify(replayData),
      deckImageHash,
      title: replayData.metadata.title,
      description: replayData.metadata.description ?? "",
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
