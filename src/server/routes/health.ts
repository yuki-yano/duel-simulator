import { Hono } from "hono"
import type { Bindings } from "../types/bindings"

const app = new Hono<{ Bindings: Bindings }>()

// Health check
app.get("/api/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  })
})

export default app