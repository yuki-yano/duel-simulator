import React from "react"
import ReactDOM from "react-dom/client"
import { Provider } from "jotai"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import { ScreenshotProvider } from "./contexts/ScreenshotContext"
import App from "./App"
import Replay from "./pages/Replay"
import DeckImageReplacer from "./pages/DeckImageReplacer"
import "./index.css"

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
  </React.StrictMode>,
)
