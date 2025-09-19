/** @jsxImportSource hono/jsx */
import { Hono } from "hono"
import { eq } from "drizzle-orm"
import { createDb, schema } from "../db"
import { Replay } from "../components/Replay"
import { Root } from "../components/Root"
import type { Bindings } from "../types/bindings"

const app = new Hono<{ Bindings: Bindings }>()

// Generate replay page with OGP meta tags
app.get("/replay/:id", async (c) => {
  try {
    const id = c.req.param("id")
    const db = createDb(c.env.DB)

    // Get replay data from DB
    const result = await db.select().from(schema.savedStates).where(eq(schema.savedStates.id, id)).get()

    if (!result) {
      // リプレイが見つからない場合は通常のHTMLを返す
      return c.html(<Root />)
    }

    // Generate OGP image URL
    const ogImageUrl =
      result.ogpImagePath != null && result.ogpImagePath !== ""
        ? `${c.req.url.replace(/\/replay\/[^/]+$/, "")}/api/ogp-images/${id}.jpg`
        : undefined

    // OGPタグ付きHTMLを生成
    return c.html(
      <Replay title={result.title} description={result.description ?? ""} url={c.req.url} imageUrl={ogImageUrl} />,
    )
  } catch (error) {
    console.error("Failed to generate replay page:", error)
    return c.html(<Root />)
  }
})

export default app
