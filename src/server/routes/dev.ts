import { Hono } from "hono"
import { getImageFromR2, getContentTypeFromFilename } from "../utils/r2-storage"
import type { Bindings } from "../types/bindings"

const app = new Hono<{ Bindings: Bindings }>()

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

    const arrayBuffer = await getImageFromR2(c.env.BUCKET, key)

    if (!arrayBuffer) {
      console.log("Object not found in R2:", key)
      return c.json({ error: "Image not found", key }, 404)
    }

    const contentType = getContentTypeFromFilename(key)

    c.header("Content-Type", contentType)
    c.header("Cache-Control", "no-cache")

    return c.body(arrayBuffer)
  } catch (_error) {
    return c.json({ error: "Failed to get image" }, 500)
  }
})

export default app
