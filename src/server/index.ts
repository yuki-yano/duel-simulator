import { Hono } from "hono"
import { cors } from "hono/cors"
import { logger } from "hono/logger"
import { createDb, schema } from "./db"
import { eq } from "drizzle-orm"
import { customAlphabet } from "nanoid"

type Bindings = {
  DB: D1Database
  BUCKET: R2Bucket
  ENVIRONMENT: string
}

// Generate UUID v4
function generateUUID(): string {
  return crypto.randomUUID()
}

// Generate 8-character ID for replays (avoiding confusing characters)
const nanoid = customAlphabet("23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz", 8)
function generateReplayId(): string {
  return nanoid()
}

const app = new Hono<{ Bindings: Bindings }>()

// Middleware
app.use("*", logger())
app.use("/*", cors())

// Health check
app.get("/api/health", (c) => {
  return c.json({
    status: "ok",
    environment: c.env.ENVIRONMENT,
    timestamp: new Date().toISOString(),
  })
})

// Save deck image with metadata
app.post("/api/deck-images", async (c) => {
  try {
    const { hash, imageData, mainDeckCount, extraDeckCount, sourceWidth, sourceHeight } = await c.req.json()
    const db = createDb(c.env.DB)

    // Save image to R2 (convert base64 to ArrayBuffer)
    const binaryString = atob(imageData.replace(/^data:image\/\w+;base64,/, ""))
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }

    await c.env.BUCKET.put(`deck-images/${hash}`, bytes.buffer, {
      httpMetadata: {
        contentType: "image/png",
        cacheControl: "public, max-age=31536000, immutable",
      },
    })

    // Save metadata to DB (using Drizzle ORM)
    await db
      .insert(schema.deckImages)
      .values({
        hash,
        aspectRatioType: "TYPE_1", // Dummy value for legacy schema
        mainDeckCount,
        extraDeckCount,
        sourceWidth,
        sourceHeight,
        createdAt: new Date().toISOString(),
      })
      .onConflictDoNothing()

    return c.json({ success: true, hash })
  } catch (error) {
    console.error("Failed to save deck image:", error)
    return c.json(
      {
        error: "Failed to save deck image",
        details: error instanceof Error ? error.message : String(error),
      },
      500,
    )
  }
})

// Save game state
app.post("/api/save-states", async (c) => {
  try {
    const {
      sessionId,
      stateJson,
      deckImageHash,
      title,
      description,
      type = "replay",
      version = "1.0",
      deckConfig,
      deckCardIds,
    } = await c.req.json()
    const db = createDb(c.env.DB)
    const id = generateReplayId() // Use 8-character ID for replays
    // Auto-generate sessionId if not provided
    const finalSessionId = sessionId ?? generateUUID()

    // Parse the state JSON and remove imageUrl from all cards
    const parsedState = JSON.parse(stateJson)

    // Use deckCardIds from request or extract from state data
    const finalDeckCardIds = deckCardIds ?? parsedState.data?.deckCardIds ?? { mainDeck: {}, extraDeck: {} }

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

    await db.insert(schema.savedStates).values({
      id,
      sessionId: finalSessionId,
      stateJson: cleanedStateJson, // Store cleaned data
      deckImageHash,
      title,
      description,
      type,
      version,
      deckConfig: JSON.stringify(deckConfig), // Store deck configuration
      deckCardIds: JSON.stringify(finalDeckCardIds), // Store deck card IDs mapping
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

    const result = await db.select().from(schema.savedStates).where(eq(schema.savedStates.id, id)).get()

    if (!result) {
      return c.json({ error: "State not found" }, 404)
    }

    return c.json(result)
  } catch {
    return c.json({ error: "Failed to get state" }, 500)
  }
})

// Get deck image metadata
app.get("/api/deck-images/:hash", async (c) => {
  try {
    const hash = c.req.param("hash")
    const db = createDb(c.env.DB)

    // Get metadata from DB
    const metadata = await db.select().from(schema.deckImages).where(eq(schema.deckImages.hash, hash)).get()

    if (!metadata) {
      return c.json({ error: "Deck image not found" }, 404)
    }

    // Get image from R2
    const object = await c.env.BUCKET.get(`deck-images/${hash}`)

    if (!object) {
      return c.json({ error: "Deck image file not found" }, 404)
    }

    // Convert ArrayBuffer to base64
    const arrayBuffer = await object.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    let binary = ""
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    const base64 = btoa(binary)
    const imageDataUrl = `data:image/png;base64,${base64}`

    return c.json({
      ...metadata,
      imageDataUrl,
    })
  } catch (error) {
    console.error("Failed to get deck image:", error)
    return c.json(
      {
        error: "Failed to get deck image",
        details: error instanceof Error ? error.message : String(error),
      },
      500,
    )
  }
})

// Get deck image file directly (for caching)
app.get("/api/deck-images/:hash/image", async (c) => {
  try {
    const hash = c.req.param("hash")

    // Get image from R2
    const object = await c.env.BUCKET.get(`deck-images/${hash}`)

    if (!object) {
      return c.json({ error: "Deck image not found" }, 404)
    }

    // Set cache headers for 1 year (images are immutable by hash)
    c.header("Cache-Control", "public, max-age=31536000, immutable")
    c.header("Content-Type", "image/png")

    // Return the image directly
    return c.body(object.body)
  } catch (error) {
    console.error("Failed to get deck image file:", error)
    return c.json(
      {
        error: "Failed to get deck image file",
        details: error instanceof Error ? error.message : String(error),
      },
      500,
    )
  }
})

export default app
