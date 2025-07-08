import { Hono } from "hono"
import { cors } from "hono/cors"
import { logger } from "hono/logger"
import { createDb, schema } from "./db"
import { eq } from "drizzle-orm"

type Bindings = {
  DB: D1Database
  BUCKET: R2Bucket
  ENVIRONMENT: string
}

// Generate UUID v4
function generateUUID(): string {
  return crypto.randomUUID()
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
    const { sessionId, stateJson, deckImageHash } = await c.req.json()
    const db = createDb(c.env.DB)
    const id = generateUUID()
    // Auto-generate sessionId if not provided
    const finalSessionId = sessionId ?? generateUUID()

    await db.insert(schema.savedStates).values({
      id,
      sessionId: finalSessionId,
      stateJson,
      deckImageHash,
      createdAt: new Date().toISOString(),
    })

    return c.json({
      success: true,
      id,
      sessionId: finalSessionId,
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

export default app
