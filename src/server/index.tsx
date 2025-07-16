/** @jsxImportSource hono/jsx */
import { Hono } from "hono"
import { cors } from "hono/cors"
import { logger } from "hono/logger"
import { createDb, schema } from "./db"
import { eq } from "drizzle-orm"
import { customAlphabet } from "nanoid"
import { z } from "zod"
import { SaveDeckImageRequestSchema, SaveGameStateRequestSchema } from "../shared/types/api"
import { serveStatic } from "hono/cloudflare-pages"
import { ReplayHTML, DefaultHTML } from "./components/ReplayHTML"
import type { D1Database, R2Bucket } from "@cloudflare/workers-types"

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
app.use("/api/*", cors())

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
          details: error.flatten(),
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
        // Convert base64 to ArrayBuffer
        const binaryString = atob(ogpImageData.replace(/^data:image\/\w+;base64,/, ""))
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }

        // Save to R2
        ogpImagePath = `ogp-images/${id}.jpg`
        await c.env.BUCKET.put(ogpImagePath, bytes.buffer, {
          httpMetadata: {
            contentType: "image/jpeg",
            cacheControl: "public, max-age=31536000, immutable",
          },
        })
        console.log(`OGP image saved to R2: ${ogpImagePath}`)
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
          details: error.flatten(),
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

    // Set cache headers for 1 year (images are immutable by hash)
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

// Get OGP image file directly
app.get("/api/ogp-images/:id/image", async (c) => {
  try {
    const id = c.req.param("id")

    // Get image from R2
    const object = await c.env.BUCKET.get(`ogp-images/${id}.jpg`)

    if (!object) {
      return c.json({ error: "OGP image not found" }, 404)
    }

    // Set cache headers for 1 year (images are immutable)
    c.header("Cache-Control", "public, max-age=31536000, immutable")
    c.header("Content-Type", "image/jpeg")
    // CORSヘッダーを追加
    c.header("Access-Control-Allow-Origin", "*")
    c.header("Access-Control-Allow-Methods", "GET, OPTIONS")
    c.header("Access-Control-Allow-Headers", "Content-Type")

    // Return the image directly
    const arrayBuffer = await object.arrayBuffer()
    return c.body(arrayBuffer)
  } catch (error) {
    console.error("Failed to get OGP image file:", error)
    return c.json(
      {
        error: "Failed to get OGP image file",
        details: error instanceof Error ? error.message : String(error),
      },
      500,
    )
  }
})

// Serve replay pages with OGP tags
app.get("/replay/:id", async (c) => {
  try {
    const id = c.req.param("id")
    const db = createDb(c.env.DB)

    // Get replay data
    const result = await db.select().from(schema.savedStates).where(eq(schema.savedStates.id, id)).get()

    if (!result) {
      // リプレイが見つからない場合は通常のHTMLを返す
      return c.html(<DefaultHTML />)
    }

    // OGP画像のURL
    const ogImageUrl =
      result.ogpImagePath != null && result.ogpImagePath !== ""
        ? `${c.req.url.replace(/\/replay\/[^/]+$/, "")}/api/ogp-images/${id}/image`
        : undefined

    // OGPタグ付きHTMLを生成
    return c.html(
      <ReplayHTML title={result.title} description={result.description ?? ""} url={c.req.url} imageUrl={ogImageUrl} />,
    )
  } catch (error) {
    console.error("Failed to generate replay page:", error)
    return c.html(<DefaultHTML />)
  }
})

// Development: List all R2 images
app.get("/api/dev/r2-images", async (c) => {
  // ローカル開発環境では ENVIRONMENT が設定されていない可能性があるので、チェックを緩和
  const isDev = c.env.ENVIRONMENT === "development" || c.req.url.includes("localhost")
  if (!isDev) {
    return c.json({ error: "This endpoint is only available in development" }, 403)
  }

  try {
    const list = await c.env.BUCKET.list()
    const images = list.objects.map((obj) => ({
      key: obj.key,
      size: obj.size,
      uploaded: obj.uploaded,
      url: `/api/dev/r2-images/${obj.key}`,
    }))

    return c.json({
      total: images.length,
      images: images.sort((a, b) => new Date(b.uploaded).getTime() - new Date(a.uploaded).getTime()),
    })
  } catch (_error) {
    return c.json({ error: "Failed to list images" }, 500)
  }
})

// Development: Get specific R2 image
app.get("/api/dev/r2-images/:path{.+}", async (c) => {
  // ローカル開発環境では ENVIRONMENT が設定されていない可能性があるので、チェックを緩和
  const isDev = c.env.ENVIRONMENT === "development" || c.req.url.includes("localhost")
  if (!isDev) {
    return c.json({ error: "This endpoint is only available in development" }, 403)
  }

  try {
    const key = c.req.param("path") ?? ""
    console.log("Requested key:", key)

    const object = await c.env.BUCKET.get(key)

    if (!object) {
      console.log("Object not found in R2:", key)
      return c.json({ error: "Image not found", key }, 404)
    }

    const contentType = key.endsWith(".webp")
      ? "image/webp"
      : key.endsWith(".jpg") || key.endsWith(".jpeg")
        ? "image/jpeg"
        : key.endsWith(".png")
          ? "image/png"
          : "application/octet-stream"

    c.header("Content-Type", contentType)
    c.header("Cache-Control", "no-cache")

    const arrayBuffer = await object.arrayBuffer()
    return c.body(arrayBuffer)
  } catch (_error) {
    return c.json({ error: "Failed to get image" }, 500)
  }
})

// Serve static files for all other routes
app.get("/*", serveStatic())

export default app
