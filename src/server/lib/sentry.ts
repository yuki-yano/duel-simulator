import { captureException, captureMessage, withScope } from "@sentry/cloudflare"
import type { Context } from "hono"

// Sentryミドルウェア（Cloudflare Pages Functionsの_middleware.jsで初期化されるため、ここでは使用のみ）
export function sentryMiddleware() {
  return async (c: Context, next: () => Promise<void>) => {
    try {
      await next()
    } catch (error) {
      // エラーをキャプチャ
      captureException(error)

      // Cloudflare WorkersのwaitUntilを使用してエラー送信を待機
      c.executionCtx.waitUntil(
        Promise.resolve(), // Sentryは内部的に非同期送信を処理
      )

      // エラーを再度投げて通常のエラーハンドリングを継続
      throw error
    } finally {
      // レスポンスステータスが4xx/5xxの場合もトラッキング
      if (c.res !== undefined && c.res.status >= 400) {
        const message = `HTTP ${c.res.status}: ${c.req.path}`
        captureMessage(message, c.res.status >= 500 ? "error" : "warning")
      }
    }
  }
}

// カスタムエラーレポート用のヘルパー関数
export function reportError(error: unknown, context?: Record<string, unknown>) {
  if (context) {
    withScope((scope) => {
      scope.setContext("additional", context)
      captureException(error)
    })
  } else {
    captureException(error)
  }
}

// カスタムメッセージレポート用のヘルパー関数
export function reportMessage(message: string, level: "info" | "warning" | "error" = "info") {
  captureMessage(message, level)
}
