import { Hono } from "hono"
import type { Bindings } from "../types/bindings"

const app = new Hono<{ Bindings: Bindings }>()

// Sentryのテストエンドポイント
app.get("/api/test/sentry-error", (c) => {
  console.log("Testing Sentry error - ENV:", {
    dsn: c.env.SENTRY_DSN_BACKEND !== undefined && c.env.SENTRY_DSN_BACKEND !== null && c.env.SENTRY_DSN_BACKEND !== "",
    env: c.env.ENVIRONMENT,
  })
  throw new Error("Sentry test error from production")
})

app.get("/api/test/sentry-message", async (c) => {
  const { captureMessage } = await import("@sentry/cloudflare")
  captureMessage("Test message from production", "info")
  return c.json({ message: "Sentry test message sent" })
})

app.get("/api/test/env", (c) => {
  return c.json({
    hasSentryDsn:
      c.env.SENTRY_DSN_BACKEND !== undefined && c.env.SENTRY_DSN_BACKEND !== null && c.env.SENTRY_DSN_BACKEND !== "",
    environment: c.env.ENVIRONMENT ?? "not set",
    appVersion: c.env.APP_VERSION ?? "not set",
  })
})

export default app
