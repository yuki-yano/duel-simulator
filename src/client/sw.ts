/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope

const CACHE_NAME = "duel-simulator-v2"

// Tesseract.js v6のCDN URLs
const TESSERACT_CDN = "https://cdn.jsdelivr.net/npm/tesseract.js@6/dist/"
const TESSERACT_CORE_CDN = "https://cdn.jsdelivr.net/npm/tesseract.js-core@5/"

const urlsToCache = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  // Tesseract.js関連ファイルを事前キャッシュ
  `${TESSERACT_CDN}worker.min.js`,
  `${TESSERACT_CORE_CDN}tesseract-core-simd.wasm.js`,
  `${TESSERACT_CORE_CDN}tesseract-core.wasm.js`,
  // OCRで使用する言語データファイル（日本語、韓国語、英語）
  "https://tessdata.projectnaptha.com/4.0.0/jpn.traineddata.gz",
  "https://tessdata.projectnaptha.com/4.0.0/kor.traineddata.gz",
  "https://tessdata.projectnaptha.com/4.0.0/eng.traineddata.gz",
]

// インストール時にキャッシュ
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache)
    }),
  )
  // 新しいService Workerをすぐにアクティベート
  void self.skipWaiting()
})

// アクティベート時に古いキャッシュを削除
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName)
          }
        }),
      )
    }),
  )
  // すぐに全クライアントをコントロール
  void self.clients.claim()
})

// フェッチ戦略: ネットワーク優先、フォールバックでキャッシュ
self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)

  // chrome-extension等、http/https以外のスキームはキャッシュしない
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    event.respondWith(fetch(request))
    return
  }

  // APIリクエストはキャッシュしない（オフライン時は失敗させる）
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(request))
    return
  }

  // Tesseract.js関連のCDNリクエストはキャッシュ優先
  if (
    url.hostname === "cdn.jsdelivr.net" ||
    url.hostname === "tessdata.projectnaptha.com" ||
    url.hostname === "unpkg.com"
  ) {
    event.respondWith(
      caches.match(request).then((response) => {
        if (response) {
          return response
        }
        return fetch(request).then((response) => {
          // 成功したレスポンスのみキャッシュ
          if (response == null || response.status !== 200) {
            return response
          }
          const responseToCache = response.clone()
          void caches.open(CACHE_NAME).then((cache) => {
            void cache.put(request, responseToCache)
          })
          return response
        })
      }),
    )
    return
  }

  // 画像とアセットは長期キャッシュ
  if (request.destination === "image" || request.destination === "font" || request.url.includes("/assets/")) {
    event.respondWith(
      caches.match(request).then((response) => {
        if (response) {
          return response
        }
        return fetch(request).then((response) => {
          // 成功したレスポンスのみキャッシュ
          if (response == null || response.status !== 200 || response.type !== "basic") {
            return response
          }
          const responseToCache = response.clone()
          void caches.open(CACHE_NAME).then((cache) => {
            void cache.put(request, responseToCache)
          })
          return response
        })
      }),
    )
    return
  }

  // HTML、CSS、JSはネットワーク優先
  event.respondWith(
    fetch(request)
      .then((response) => {
        // 成功したレスポンスをキャッシュして返す
        if (response == null || response.status !== 200 || response.type !== "basic") {
          return response
        }
        const responseToCache = response.clone()
        void caches.open(CACHE_NAME).then((cache) => {
          void cache.put(request, responseToCache)
        })
        return response
      })
      .catch(async () => {
        // ネットワークエラー時はキャッシュから返す
        const cachedResponse = await caches.match(request)
        if (cachedResponse) {
          return cachedResponse
        }
        // ナビゲーションリクエストの場合はindex.htmlを返す（SPAのため）
        if (request.mode === "navigate") {
          const indexResponse = await caches.match("/index.html")
          if (indexResponse) {
            return indexResponse
          }
        }
        // 何も見つからない場合は、ネットワークエラーを示すレスポンスを返す
        return new Response("Network error and no cache available", {
          status: 503,
          statusText: "Service Unavailable",
        })
      }),
  )
})

export {}
