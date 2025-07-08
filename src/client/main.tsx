import React from "react"
import ReactDOM from "react-dom/client"
import { Provider } from "jotai"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import App from "./App"
import Replay from "./pages/Replay"
import "./index.css"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Provider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/replay/:id" element={<Replay />} />
        </Routes>
      </BrowserRouter>
    </Provider>
  </React.StrictMode>,
)
