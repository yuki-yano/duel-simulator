import type { D1Database, R2Bucket } from "@cloudflare/workers-types"

export type Bindings = {
  DB: D1Database
  BUCKET: R2Bucket
  ENVIRONMENT: string
}
