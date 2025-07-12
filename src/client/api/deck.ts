export interface SaveDeckImageRequest {
  hash: string
  imageData: string
  mainDeckCount: number
  extraDeckCount: number
  sourceWidth: number
  sourceHeight: number
}

export interface DeckImageResponse {
  hash: string
  mainDeckCount: number
  extraDeckCount: number
  sourceWidth: number
  sourceHeight: number
  createdAt: string
  imageDataUrl: string
  imageUrl?: string
}

import { ErrorResponseSchema } from "@/shared/types/api"
import { apiUrl } from "@/client/lib/api"
import { sha256 } from "js-sha256"

export async function saveDeckImage(data: SaveDeckImageRequest): Promise<{ success: boolean; hash: string }> {
  const response = await fetch(apiUrl("/deck-images"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const errorData = await response.json()
    const validatedError = ErrorResponseSchema.parse(errorData)
    throw new Error(validatedError.error ?? "Failed to save deck image")
  }

  return response.json()
}

export async function getDeckImage(hash: string): Promise<DeckImageResponse> {
  const response = await fetch(apiUrl(`/deck-images/${hash}`))

  if (!response.ok) {
    const errorData = await response.json()
    const validatedError = ErrorResponseSchema.parse(errorData)
    throw new Error(validatedError.error ?? "Failed to get deck image")
  }

  return response.json()
}

// Calculate hash for deck image
export async function calculateImageHash(imageData: string): Promise<string> {
  // js-sha256を使用してSHA-256ハッシュを計算
  return sha256(imageData)
}

// Get direct image URL for caching
export function getDeckImageUrl(hash: string): string {
  return apiUrl(`/deck-images/${hash}/image`)
}
