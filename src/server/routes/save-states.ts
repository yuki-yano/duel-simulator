import { Hono } from "hono"
import { z } from "zod"
import { eq } from "drizzle-orm"
import { createDb, schema } from "../db"
import { SaveGameStateRequestSchema } from "../../shared/types/api"
import { generateUUID, generateReplayId } from "../utils/id-generator"
import { saveBase64ToR2 } from "../utils/r2-storage"
import type { Bindings } from "../types/bindings"

const app = new Hono<{ Bindings: Bindings }>()

// Save game state
app.post("/api/save-states", async (c) => {
  try {
    // リクエストボディのバリデーション
    const body = await c.req.json()
    const validated = SaveGameStateRequestSchema.parse(body)
    const {
      sessionId,
      stateJson,
      deckImageHash,
      title,
      description,
      type,
      version,
      deckConfig,
      deckCardIds,
      ogpImageData,
    } = validated
    const db = createDb(c.env.DB)
    const id = generateReplayId() // Use 8-character ID for replays
    // Auto-generate sessionId if not provided
    const finalSessionId = sessionId ?? generateUUID()

    // Parse the state JSON and remove imageUrl from all cards
    const parsedState = JSON.parse(stateJson)

    // deckCardIds is already a JSON string from client, no need to process

    // Function to clean imageUrl from cards
    const cleanImageUrls = (obj: unknown): unknown => {
      if (Array.isArray(obj)) {
        return obj.map(cleanImageUrls)
      }
      if (obj != null && typeof obj === "object") {
        const cleaned = { ...obj } as Record<string, unknown>
        // Remove imageUrl if it exists
        if ("imageUrl" in cleaned && typeof cleaned.imageUrl === "string" && cleaned.imageUrl.startsWith("data:")) {
          delete cleaned.imageUrl
        }
        // Recursively clean nested objects
        for (const key in cleaned) {
          cleaned[key] = cleanImageUrls(cleaned[key])
        }
        return cleaned
      }
      return obj
    }

    const cleanedState = cleanImageUrls(parsedState)
    const cleanedStateJson = JSON.stringify(cleanedState)

    // Validate required fields
    if (title == null || title === "") {
      throw new Error("Title is required")
    }
    if (deckConfig == null) {
      throw new Error("Deck configuration is required")
    }

    // Save OGP image to R2 if provided
    let ogpImagePath: string | undefined
    if (ogpImageData != null && ogpImageData !== "") {
      try {
        // Save to R2
        ogpImagePath = `ogp-images/${id}.jpg`
        await saveBase64ToR2(c.env.BUCKET, ogpImagePath, ogpImageData, {
          contentType: "image/jpeg",
          cacheControl: "public, max-age=31536000, immutable",
        })
      } catch (error) {
        console.error("Failed to save OGP image:", error)
        // Continue without OGP image
      }
    }

    await db.insert(schema.savedStates).values({
      id,
      sessionId: finalSessionId,
      stateJson: cleanedStateJson, // Store cleaned data
      deckImageHash,
      title,
      description,
      type,
      version,
      deckConfig: JSON.stringify(deckConfig), // Serialize object to JSON string
      deckCardIds: JSON.stringify(deckCardIds), // Serialize object to JSON string
      ogpImagePath,
      createdAt: new Date().toISOString(),
    })

    // Generate share URL
    // In development, use the frontend URL (Vite port)
    const origin =
      c.env.ENVIRONMENT === "development" ? "http://localhost:5173" : c.req.url.replace(/\/api\/save-states$/, "")
    const shareUrl = `${origin}/replay/${id}`

    return c.json({
      success: true,
      id,
      sessionId: finalSessionId,
      shareUrl,
    })
  } catch (error) {
    console.error("Failed to save state:", error)

    // Zodバリデーションエラーの場合は400を返す
    if (error instanceof z.ZodError) {
      return c.json(
        {
          error: "Validation error",
          details: error.issues,
        },
        400,
      )
    }

    return c.json(
      {
        error: "Failed to save state",
        details: error instanceof Error ? error.message : String(error),
      },
      500,
    )
  }
})

// Get save state
app.get("/api/save-states/:id", async (c) => {
  try {
    const id = c.req.param("id")
    const db = createDb(c.env.DB)

    const state = await db.select().from(schema.savedStates).where(eq(schema.savedStates.id, id)).get()

    if (!state) {
      return c.json({ error: "Save state not found" }, 404)
    }

    return c.json(state)
  } catch (error) {
    console.error("Failed to get state:", error)
    return c.json({ error: "Failed to get state" }, 500)
  }
})

export default app
