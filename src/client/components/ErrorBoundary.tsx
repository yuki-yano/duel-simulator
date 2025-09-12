import * as Sentry from "@sentry/react"
import { useRouteError } from "react-router-dom"

// React Router用のエラーバウンダリ
export function RouterErrorBoundary() {
  const error = useRouteError()
  
  Sentry.captureException(error)
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
        <h1 className="text-2xl font-bold text-red-600 mb-4">エラーが発生しました</h1>
        <p className="text-gray-700 mb-4">
          申し訳ございません。予期しないエラーが発生しました。
        </p>
        <details className="mb-4">
          <summary className="cursor-pointer text-sm text-gray-500">エラー詳細</summary>
          <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
            {error instanceof Error ? error.stack : String(error)}
          </pre>
        </details>
        <button
          onClick={() => window.location.href = "/"}
          className="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
        >
          ホームに戻る
        </button>
      </div>
    </div>
  )
}

// Sentry提供のErrorBoundaryコンポーネント
export const ErrorBoundary = Sentry.ErrorBoundary