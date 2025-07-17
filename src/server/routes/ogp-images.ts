import { Hono } from "hono"
import { getImageFromR2 } from "../utils/r2-storage"
import type { Bindings } from "../types/bindings"

const app = new Hono<{ Bindings: Bindings }>()

// Handle CORS preflight for OGP image
app.options("/api/ogp-images/:filename", async (c) => {
  c.header("Access-Control-Allow-Origin", "*")
  c.header("Access-Control-Allow-Methods", "GET, OPTIONS")
  c.header("Access-Control-Allow-Headers", "Content-Type")
  return c.text("")
})

// Get OGP image file directly
app.get("/api/ogp-images/:filename", async (c) => {
  try {
    const filename = c.req.param("filename")

    // Extract ID from filename (should end with .jpg)
    if (!filename.endsWith(".jpg")) {
      return c.json({ error: "Invalid filename format" }, 400)
    }

    const id = filename.slice(0, -4) // Remove .jpg extension

    // Get image from R2
    const arrayBuffer = await getImageFromR2(c.env.BUCKET, `ogp-images/${id}.jpg`)

    if (!arrayBuffer) {
      return c.json({ error: "OGP image not found" }, 404)
    }

    // Set cache headers for 1 year (images are immutable)
    c.header("Cache-Control", "public, max-age=31536000, immutable")
    c.header("Content-Type", "image/jpeg")
    c.header("Content-Length", arrayBuffer.byteLength.toString())
    // CORSヘッダーを追加
    c.header("Access-Control-Allow-Origin", "*")
    c.header("Access-Control-Allow-Methods", "GET, OPTIONS")
    c.header("Access-Control-Allow-Headers", "Content-Type")

    // Return the image directly
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

export default app
