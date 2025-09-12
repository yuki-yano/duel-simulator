/** @jsxImportSource hono/jsx */
import { Hono } from "hono"
import { cors } from "hono/cors"
import { logger } from "hono/logger"
import { serveStatic } from "hono/cloudflare-pages"
import * as Sentry from "@sentry/cloudflare"
import type { Bindings } from "./types/bindings"

// Import routes
import healthRoutes from "./routes/health"
import deckImagesRoutes from "./routes/deck-images"
import saveStatesRoutes from "./routes/save-states"
import ogpImagesRoutes from "./routes/ogp-images"
import replayRoutes from "./routes/replay"
import devRoutes from "./routes/dev"
import testRoutes from "./routes/test"
import { Root } from "./components/Root"

const app = new Hono<{ Bindings: Bindings }>()
  // Add an onError hook to report unhandled exceptions to Sentry
  .onError((err, c) => {
    // Report all unhandled errors to Sentry
    Sentry.captureException(err)

    // Return appropriate response
    console.error("Error caught by onError hook:", err)
    return c.json({ error: "Internal server error" }, 500)
  })

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
app.route("/", testRoutes)

// Serve root HTML with OGP tags
app.get("/", (c) => {
  return c.html(<Root />)
})

// Serve static files for all other routes
app.get("/*", serveStatic())

// Cloudflare Workers形式でエクスポート - Sentry.withSentryでラップ
export default Sentry.withSentry(
  (env: Bindings) => ({
    dsn: env.SENTRY_DSN_BACKEND,
    environment: env.ENVIRONMENT ?? "development",
    release: env.CF_VERSION_METADATA?.id ?? env.APP_VERSION ?? "unknown",
    tracesSampleRate: env.ENVIRONMENT === "production" ? 0.1 : 1.0,
    sendDefaultPii: false,
    enableLogs: true,
  }),
  app,
)
