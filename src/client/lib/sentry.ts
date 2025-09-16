import * as Sentry from "@sentry/react"
import type { BrowserOptions } from "@sentry/react"

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN

  // 本番環境の判定:
  // MODEが"production"またはPRODフラグがtrueの場合のみ本番環境とする
  // "client"モードはビルド時に使用されるので、これも本番扱い
  const isProduction =
    import.meta.env.PROD || import.meta.env.MODE === "production" || import.meta.env.MODE === "client"

  // DSNがない、または本番環境でない場合はSentryを初期化しない
  if (dsn === undefined || dsn === null || dsn === "") {
    console.info("Sentry: Disabled (No DSN configured)")
    return
  }

  if (!isProduction) {
    console.info(
      `Sentry: Disabled (Development environment - MODE=${import.meta.env.MODE}, PROD=${import.meta.env.PROD})`,
    )
    return
  }

  // 本番環境の場合のみここに到達
  const environment = "production"
  const release = import.meta.env.VITE_APP_VERSION ?? "unknown"

  const options: BrowserOptions = {
    dsn,
    environment,
    release,
    enabled: true, // ここに到達した時点で本番環境確定なのでtrue
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        maskAllInputs: true,
        blockAllMedia: false,
      }),
    ],
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    beforeSend(event, hint) {
      // 特定のエラーをフィルタリング
      const error = hint.originalException
      if (error !== null && error !== undefined && typeof error === "object" && "message" in error) {
        const errorMessage = String(error.message)
        if (
          errorMessage.includes("ResizeObserver loop limit exceeded") ||
          errorMessage.includes("Non-Error promise rejection captured")
        ) {
          return null
        }
      }
      return event
    },
    ignoreErrors: [
      // ブラウザ拡張機能関連のエラーを無視
      "top.GLOBALS",
      "chrome-extension://",
      "moz-extension://",
      // ResizeObserver のループエラーを無視（Chrome の既知の問題）
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
    ],
  }

  Sentry.init(options)

  console.info(`Sentry: Initialized (${environment})`)
}

// ユーザー情報を設定する関数
export function setSentryUser(user: { id?: string; email?: string; username?: string } | null) {
  if (user) {
    Sentry.setUser(user)
  } else {
    Sentry.setUser(null)
  }
}

// カスタムコンテキストを設定する関数
export function setSentryContext(key: string, context: Record<string, unknown>) {
  Sentry.setContext(key, context)
}

// エラーを手動で報告する関数
export function captureException(error: unknown, context?: Record<string, unknown>) {
  if (context) {
    Sentry.withScope((scope) => {
      scope.setContext("additional", context)
      Sentry.captureException(error)
    })
  } else {
    Sentry.captureException(error)
  }
}

// メッセージを報告する関数
export function captureMessage(message: string, level: Sentry.SeverityLevel = "info") {
  Sentry.captureMessage(message, level)
}
