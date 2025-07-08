export interface SaveDeckImageRequest {
  hash: string
  imageData: string
  aspectRatioType: "TYPE_1" | "TYPE_2" | "TYPE_3"
  mainDeckCount: number
  extraDeckCount: number
  sourceWidth: number
  sourceHeight: number
}

export interface DeckImageResponse {
  hash: string
  aspectRatioType: "TYPE_1" | "TYPE_2" | "TYPE_3"
  mainDeckCount: number
  extraDeckCount: number
  sourceWidth: number
  sourceHeight: number
  createdAt: string
  imageDataUrl: string
}

export async function saveDeckImage(data: SaveDeckImageRequest): Promise<{ success: boolean; hash: string }> {
  const response = await fetch("/api/deck-images", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const error = await response.json() as { error?: string }
    throw new Error(error.error ?? "Failed to save deck image")
  }

  return response.json()
}

export async function getDeckImage(hash: string): Promise<DeckImageResponse> {
  const response = await fetch(`/api/deck-images/${hash}`)

  if (!response.ok) {
    const error = await response.json() as { error?: string }
    throw new Error(error.error ?? "Failed to get deck image")
  }

  return response.json()
}

// Calculate hash for deck image
export async function calculateImageHash(imageData: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(imageData)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
  return hashHex
}
