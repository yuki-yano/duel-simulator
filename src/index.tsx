import { Hono } from "hono"
import { cors } from "hono/cors"
import { logger } from "hono/logger"
import { createDb, schema } from "./server/db"
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

// Serve index.html
app.get("/", async (c) => {
  const html = `<!DOCTYPE html>
<html lang="ja">
  <head>
    <title>Yu-Gi-Oh! Duel Simulator</title>
    <meta charset="utf-8" />
    <meta content="width=device-width, initial-scale=1" name="viewport" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes"
    />
    <meta content="Yu-Gi-Oh! Duel Simulator" property="og:title" />
    <meta content="website" property="og:type" />
    <meta content="ja_JP" property="og:locale" />
    ${import.meta.env.PROD ? `
    <script src="/static/main.js" type="module"></script>
    <link rel="stylesheet" href="/static/main.css" />
    ` : `
    <script src="/src/client/main.tsx" type="module"></script>
    `}
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`

  return c.html(html)
})

// Health check
app.get("/api/health", (c) => {
  return c.json({
    status: "ok",
    environment: c.env.ENVIRONMENT,
    timestamp: new Date().toISOString(),
  })
})

// Create a new game state
app.post("/api/game-states", async (c) => {
  try {
    const body = await c.req.json()
    const db = createDb(c.env.DB)
    const id = generateUUID()

    await db.insert(schema.savedStates).values({
      id,
      sessionId: id, // Using id as sessionId for now
      stateJson: JSON.stringify(body),
      deckImageHash: body.deckImageHash || "default", // Add proper handling later
      createdAt: new Date().toISOString(),
    })

    return c.json({
      id,
      message: "Game state created successfully",
    })
  } catch (error) {
    console.error("Error creating game state:", error)
    return c.json(
      {
        error: "Failed to create game state",
      },
      500
    )
  }
})

// Get a game state by ID
app.get("/api/game-states/:id", async (c) => {
  try {
    const id = c.req.param("id")
    const db = createDb(c.env.DB)

    const result = await db
      .select()
      .from(schema.savedStates)
      .where(eq(schema.savedStates.id, id))
      .limit(1)

    if (result.length === 0) {
      return c.json({ error: "Game state not found" }, 404)
    }

    const gameState = result[0]
    return c.json({
      id: gameState.id,
      state: JSON.parse(gameState.stateJson),
      createdAt: gameState.createdAt,
      sessionId: gameState.sessionId,
    })
  } catch (error) {
    console.error("Error fetching game state:", error)
    return c.json(
      {
        error: "Failed to fetch game state",
      },
      500
    )
  }
})

// Update a game state
app.put("/api/game-states/:id", async (c) => {
  try {
    const id = c.req.param("id")
    const body = await c.req.json()
    const db = createDb(c.env.DB)

    await db
      .update(schema.savedStates)
      .set({
        stateJson: JSON.stringify(body),
      })
      .where(eq(schema.savedStates.id, id))

    return c.json({
      id,
      message: "Game state updated successfully",
    })
  } catch (error) {
    console.error("Error updating game state:", error)
    return c.json(
      {
        error: "Failed to update game state",
      },
      500
    )
  }
})

// Upload an image to R2
app.post("/api/images/upload", async (c) => {
  try {
    const formData = await c.req.formData()
    const file = formData.get("file") as File
    if (!file) {
      return c.json({ error: "No file provided" }, 400)
    }

    const fileName = `${generateUUID()}_${file.name}`
    const arrayBuffer = await file.arrayBuffer()

    await c.env.BUCKET.put(fileName, arrayBuffer, {
      httpMetadata: {
        contentType: file.type,
      },
    })

    const url = `/api/images/${fileName}`

    return c.json({
      url,
      fileName,
      message: "Image uploaded successfully",
    })
  } catch (error) {
    console.error("Error uploading image:", error)
    return c.json(
      {
        error: "Failed to upload image",
      },
      500
    )
  }
})

// Get an image from R2
app.get("/api/images/:fileName", async (c) => {
  try {
    const fileName = c.req.param("fileName")
    const object = await c.env.BUCKET.get(fileName)

    if (!object) {
      return c.json({ error: "Image not found" }, 404)
    }

    const headers = new Headers()
    object.writeHttpMetadata(headers)
    headers.set("Cache-Control", "public, max-age=86400")

    return new Response(object.body, { headers })
  } catch (error) {
    console.error("Error fetching image:", error)
    return c.json(
      {
        error: "Failed to fetch image",
      },
      500
    )
  }
})

export default app