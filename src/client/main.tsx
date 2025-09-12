import React from "react"
import ReactDOM from "react-dom/client"
import { Provider } from "jotai"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import { ScreenshotProvider } from "./contexts/ScreenshotContext"
import App from "./App"
import Replay from "./pages/Replay"
import DeckImageReplacer from "./pages/DeckImageReplacer"
import { initSentry } from "./lib/sentry"
import { ErrorBoundary } from "./components/ErrorBoundary"
import "./index.css"

// Sentry初期化（最初に実行）
initSentry()

// Service Worker登録
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("Service Worker registered:", registration)
      })
      .catch((error) => {
        console.error("Service Worker registration failed:", error)
      })
  })
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary
      fallback={({ error, resetError }) => (
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
            <div className="flex gap-2">
              <button
                onClick={() => window.location.href = "/"}
                className="flex-1 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
              >
                ホームに戻る
              </button>
              <button
                onClick={resetError}
                className="flex-1 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 transition-colors"
              >
                再試行
              </button>
            </div>
          </div>
        </div>
      )}
      showDialog={false}
    >
      <Provider>
        <ScreenshotProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<App />} />
              <Route path="/replay/:id" element={<Replay />} />
              <Route path="/deck-image-replacer" element={<DeckImageReplacer />} />
            </Routes>
          </BrowserRouter>
        </ScreenshotProvider>
      </Provider>
    </ErrorBoundary>
  </React.StrictMode>,
)
