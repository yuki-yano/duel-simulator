import { useState, useEffect } from "react"
import { apiUrl } from "@/client/lib/api"

interface R2Image {
  key: string
  size: number
  uploaded: string
  url: string
}

export function DevR2Images() {
  const [images, setImages] = useState<R2Image[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchImages() {
      try {
        const response = await fetch(apiUrl("/dev/r2-images"))
        if (!response.ok) {
          throw new Error("Failed to fetch images")
        }
        const data = (await response.json()) as { total: number; images: R2Image[] }
        setImages(data.images)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error")
      } finally {
        setLoading(false)
      }
    }

    void fetchImages()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-blue-500" />
      </div>
    )
  }

  if (error !== null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-500">エラー: {error}</div>
      </div>
    )
  }

  const deckImages = images.filter((img) => img.key.startsWith("deck-images/"))
  const ogpImages = images.filter((img) => img.key.startsWith("ogp-images/"))

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">R2 Images (Development)</h1>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">OGP画像 ({ogpImages.length}個)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ogpImages.map((image) => (
            <div key={image.key} className="border rounded-lg p-4">
              <img src={image.url} alt={image.key} className="w-full h-48 object-contain mb-2 bg-gray-100" />
              <div className="text-sm">
                <p className="font-mono truncate">{image.key}</p>
                <p className="text-gray-500">{(image.size / 1024).toFixed(1)} KB</p>
                <p className="text-gray-500">{new Date(image.uploaded).toLocaleString("ja-JP")}</p>
                <a href={image.url} download className="text-blue-500 hover:underline">
                  ダウンロード
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">デッキ画像 ({deckImages.length}個)</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {deckImages.map((image) => (
            <div key={image.key} className="border rounded-lg p-4">
              <img src={image.url} alt={image.key} className="w-full h-32 object-contain mb-2 bg-gray-100" />
              <div className="text-sm">
                <p className="font-mono truncate">{image.key}</p>
                <p className="text-gray-500">{(image.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
