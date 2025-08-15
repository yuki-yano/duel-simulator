import type { Config } from "drizzle-kit"

export default {
  schema: "./src/server/db/schema.ts",
  out: "./db/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: ".wrangler/state/v3/d1/miniflare-D1DatabaseObject/860959c6fb0ec46f8ee1dd78926993e94d0f2e9bbdf50b5ea8997881a5b5eeb3.sqlite",
  },
} satisfies Config
