import { Hono } from "hono"
import { getImageFromR2 } from "../utils/r2-storage"
import type { Bindings } from "../types/bindings"

const app = new Hono<{ Bindings: Bindings }>()

// Handle CORS preflight for OGP image
app.options("/api/ogp-images/:id/image", async (c) => {
  c.header("Access-Control-Allow-Origin", "*")
  c.header("Access-Control-Allow-Methods", "GET, OPTIONS")
  c.header("Access-Control-Allow-Headers", "Content-Type")
  return c.text("")
})

// Get OGP image file directly
app.get("/api/ogp-images/:id/image", async (c) => {
  try {
    const id = c.req.param("id")

    // Get image from R2
    const arrayBuffer = await getImageFromR2(c.env.BUCKET, `ogp-images/${id}.jpg`)

    if (!arrayBuffer) {
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