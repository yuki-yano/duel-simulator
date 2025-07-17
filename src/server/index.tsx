/** @jsxImportSource hono/jsx */
import { Hono } from "hono"
import { cors } from "hono/cors"
import { logger } from "hono/logger"
import { serveStatic } from "hono/cloudflare-pages"
import type { Bindings } from "./types/bindings"

// Import routes
import healthRoutes from "./routes/health"
import deckImagesRoutes from "./routes/deck-images"
import saveStatesRoutes from "./routes/save-states"
import ogpImagesRoutes from "./routes/ogp-images"
import replayRoutes from "./routes/replay"
import devRoutes from "./routes/dev"
import { Root } from "./components/Root"

const app = new Hono<{ Bindings: Bindings }>()

// Redirect middleware - pages.devドメインからカスタムドメインへ
app.use("*", async (c, next) => {
  const url = new URL(c.req.url)
  if (url.hostname === "duel-simulator.pages.dev") {
    return c.redirect(`https://duel-simulator.miyauchidp.dev${url.pathname}${url.search}`, 301)
  }
  await next()
})

// Middleware
app.use("*", logger())
app.use("/api/*", cors())

// Mount routes
app.route("/", healthRoutes)
app.route("/", deckImagesRoutes)
app.route("/", saveStatesRoutes)
app.route("/", ogpImagesRoutes)
app.route("/", replayRoutes)
app.route("/", devRoutes)

// Serve root HTML with OGP tags
app.get("/", (c) => {
  return c.html(<Root />)
})

// Serve static files for all other routes
app.get("/*", serveStatic())

export default app
