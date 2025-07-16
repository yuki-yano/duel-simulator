import { Hono } from "hono"
import { z } from "zod"
import { eq } from "drizzle-orm"
import { createDb, schema } from "../db"
import { SaveDeckImageRequestSchema } from "../../shared/types/api"
import type { Bindings } from "../types/bindings"

const app = new Hono<{ Bindings: Bindings }>()

// Save deck image with metadata
app.post("/api/deck-images", async (c) => {
  try {
    // リクエストボディのバリデーション
    const body = await c.req.json()
    const validated = SaveDeckImageRequestSchema.parse(body)
    const { hash, imageData, mainDeckCount, extraDeckCount, sourceWidth, sourceHeight } = validated
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
        error: "Failed to save deck image",
        details: error instanceof Error ? error.message : String(error),
      },
      500,
    )
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

// Handle CORS preflight for deck image
app.options("/api/deck-images/:hash/image", async (c) => {
  c.header("Access-Control-Allow-Origin", "*")
  c.header("Access-Control-Allow-Methods", "GET, OPTIONS")
  c.header("Access-Control-Allow-Headers", "Content-Type")
  return c.text("")
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

    // Set cache headers for 1 year (images are immutable)
    c.header("Cache-Control", "public, max-age=31536000, immutable")
    c.header("Content-Type", "image/png")
    // CORSヘッダーを追加
    c.header("Access-Control-Allow-Origin", "*")
    c.header("Access-Control-Allow-Methods", "GET, OPTIONS")
    c.header("Access-Control-Allow-Headers", "Content-Type")

    // Return the image directly
    const arrayBuffer = await object.arrayBuffer()
    return c.body(arrayBuffer)
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