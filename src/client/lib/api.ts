// APIのベースURLを動的に決定
export function getApiBaseUrl(): string {
  const hostname = window.location.hostname
  const port = window.location.port

  // 本番環境
  if (hostname === "duel-simulator.pages.dev" || (hostname === "localhost" && port === "")) {
    return ""
  }

  // 開発環境 - localhostの場合
  if (hostname === "localhost") {
    return "http://localhost:8787"
  }

  // 開発環境 - IPアドレスの場合（スマホアクセス）
  return `http://${hostname}:8787`
}

// APIエンドポイントを構築
export function apiUrl(path: string): string {
  const baseUrl = getApiBaseUrl()
  return `${baseUrl}/api${path.startsWith("/") ? path : `/${path}`}`
}
