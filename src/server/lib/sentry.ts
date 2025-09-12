import { Toucan } from "toucan-js"
import type { Context } from "hono"

export function initSentry(c: Context, request: Request) {
  const sentryDsn = c.env?.SENTRY_DSN_BACKEND
  
  if (sentryDsn === undefined || sentryDsn === null || sentryDsn === "") {
    return null
  }

  const sentry = new Toucan({
    dsn: sentryDsn,
    context: c.executionCtx,
    request,
    environment: c.env?.ENVIRONMENT ?? "development",
    release: c.env?.APP_VERSION ?? "unknown",
    requestDataOptions: {
      allowedHeaders: ["user-agent", "cf-ray", "cf-connecting-ip"],
      allowedSearchParams: /(.*)/,
    },
    transportOptions: {
      headers: {
        "X-Sentry-Rate-Limit-Remaining": "true",
      },
    },
  })

  // Cloudflare特有の情報を追加
  sentry.setContext("cloudflare", {
    ray: request.headers.get("cf-ray"),
    colo: c.env?.CF_COLO,
    country: request.headers.get("cf-ipcountry"),
  })

  return sentry
}

// エラーハンドリングミドルウェア
export function sentryMiddleware() {
  return async (c: Context, next: () => Promise<void>) => {
    const sentry = initSentry(c, c.req.raw)
    
    try {
      await next()
    } catch (error) {
      if (sentry) {
        sentry.captureException(error)
        
        // Cloudflare WorkersのwaitUntilを使用してエラー送信を待機
        c.executionCtx.waitUntil(
          (async () => {
            try {
              await sentry.captureException(error)
            } catch (sentryError) {
              console.error("Failed to send error to Sentry:", sentryError)
            }
          })()
        )
      }
      
      // エラーを再度投げて通常のエラーハンドリングを継続
      throw error
    } finally {
      // レスポンスステータスが4xx/5xxの場合もトラッキング
      if (c.res !== undefined && c.res.status >= 400 && sentry !== null) {
        const message = `HTTP ${c.res.status}: ${c.req.path}`
        sentry.captureMessage(message, c.res.status >= 500 ? "error" : "warning")
      }
    }
  }
}