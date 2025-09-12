import type { D1Database, R2Bucket } from "@cloudflare/workers-types"

export type Bindings = {
  DB: D1Database
  BUCKET: R2Bucket
  ENVIRONMENT?: string
  SENTRY_DSN_BACKEND?: string
  APP_VERSION?: string
  CF_VERSION_METADATA?: {
    id: string
    tag: string
    timestamp: string
  }
}
