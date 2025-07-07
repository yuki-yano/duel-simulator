import type { Config } from "drizzle-kit"

export default {
  schema: "./src/server/db/schema.ts",
  out: "./db/migrations",
  dialect: "sqlite",
} satisfies Config
