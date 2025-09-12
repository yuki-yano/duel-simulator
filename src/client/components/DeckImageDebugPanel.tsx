import { useState } from "react"
import { Card } from "@/client/components/ui/Card"
import type { DeckConfiguration } from "@/shared/types/game"

interface DeckImageDebugPanelProps {
  imageDataUrl: string
  deckConfig: DeckConfiguration | null
  extractedCards: {
    index: number
    x: number
    y: number
    width: number
    height: number
    imageUrl: string
    zone: "main" | "extra" | "side"
  }[]
  ocrResults: {
    main?: { text: string; originalImage: string; processedImage: string }
    extra?: { text: string; originalImage: string; processedImage: string }
    side?: { text: string; originalImage: string; processedImage: string }
  }
}

export function DeckImageDebugPanel({
  imageDataUrl,
  deckConfig,
  extractedCards,
  ocrResults,
}: DeckImageDebugPanelProps) {
  const [selectedCard, setSelectedCard] = useState<number | null>(null)
  const [showProcessedOcr, setShowProcessedOcr] = useState(true)

  return (
    <Card className="p-4 space-y-4 bg-gray-50">
      <h4 className="text-lg font-semibold">デバッグ情報</h4>

      {/* OCR結果 */}
      {Object.keys(ocrResults).length > 0 && (
        <div className="space-y-2">
          <h5 className="text-sm font-semibold">OCR解析結果</h5>
          <div className="flex items-center gap-2 mb-2">
            <label className="text-xs">
              <input
                type="checkbox"
                checked={showProcessedOcr}
                onChange={(e) => setShowProcessedOcr(e.target.checked)}
                className="mr-1"
              />
              処理済み画像を表示
            </label>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(ocrResults).map(([zone, result]) => (
              <div key={zone} className="border rounded p-2 bg-white">
                <p className="text-xs font-medium mb-1">
                  {zone === "main" ? "メインデッキ" : zone === "extra" ? "エクストラデッキ" : "サイドデッキ"}
                </p>
                <p className="text-xs text-blue-600 font-mono mb-2">認識: {result.text || "認識失敗"}</p>
                <div className="space-y-1">
                  <img
                    src={showProcessedOcr ? result.processedImage : result.originalImage}
                    alt={`${zone} OCR`}
                    className="w-full border"
                  />
                  <p className="text-xs text-gray-500">{showProcessedOcr ? "処理済み" : "元画像"}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* デッキ構成情報 */}
      {deckConfig && (
        <div className="space-y-2">
          <h5 className="text-sm font-semibold">検出されたデッキ構成</h5>
          <div className="text-xs space-y-1 bg-white p-2 rounded border">
            <p>カード幅: {deckConfig.cardWidth.toFixed(1)}px</p>
            <p>カード高さ: {deckConfig.cardHeight.toFixed(1)}px</p>
            <p>カード間隔: {deckConfig.cardGap.toFixed(1)}px</p>
            <p>左マージン: {deckConfig.leftMargin.toFixed(1)}px</p>
            {deckConfig.mainDeck && (
              <p className="text-green-600">
                メインデッキ: {deckConfig.mainDeck.count}枚 ({deckConfig.mainDeck.rows}列) Y座標:{" "}
                {deckConfig.mainDeck.yPosition.toFixed(1)}
              </p>
            )}
            {deckConfig.extraDeck && (
              <p className="text-purple-600">
                エクストラデッキ: {deckConfig.extraDeck.count}枚 ({deckConfig.extraDeck.rows}列) Y座標:{" "}
                {deckConfig.extraDeck.yPosition.toFixed(1)}
              </p>
            )}
            {deckConfig.sideDeck && (
              <p className="text-orange-600">
                サイドデッキ: {deckConfig.sideDeck.count}枚 ({deckConfig.sideDeck.rows}列) Y座標:{" "}
                {deckConfig.sideDeck.yPosition.toFixed(1)}
              </p>
            )}
          </div>
        </div>
      )}

      {/* 切り出されたカード */}
      {extractedCards.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-sm font-semibold">切り出されたカード ({extractedCards.length}枚)</h5>
          
          {/* カード座標情報 */}
          {selectedCard !== null && extractedCards[selectedCard] != null && (
            <div className="text-xs bg-white p-2 rounded border">
              <p className="font-medium mb-1">カード #{selectedCard + 1} 詳細:</p>
              <p>ゾーン: {extractedCards[selectedCard].zone}</p>
              <p>X座標: {extractedCards[selectedCard].x.toFixed(1)}px</p>
              <p>Y座標: {extractedCards[selectedCard].y.toFixed(1)}px</p>
              <p>幅: {extractedCards[selectedCard].width.toFixed(1)}px</p>
              <p>高さ: {extractedCards[selectedCard].height.toFixed(1)}px</p>
            </div>
          )}

          {/* カードサムネイル */}
          <div className="grid grid-cols-10 gap-1 p-2 bg-white rounded border max-h-96 overflow-y-auto">
            {extractedCards.map((card, index) => (
              <div
                key={index}
                className={`relative cursor-pointer transition-all ${
                  selectedCard === index ? "ring-2 ring-blue-500 scale-110 z-10" : ""
                }`}
                onClick={() => setSelectedCard(index)}
                title={`カード #${index + 1} (${card.zone})`}
              >
                <img
                  src={card.imageUrl}
                  alt={`Card ${index + 1}`}
                  className="w-full border"
                />
                <div className={`absolute top-0 left-0 text-xs px-1 text-white ${
                  card.zone === "main" ? "bg-green-600" : 
                  card.zone === "extra" ? "bg-purple-600" : "bg-orange-600"
                }`}>
                  {index + 1}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 元画像とオーバーレイ */}
      {imageDataUrl && extractedCards.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-sm font-semibold">切り出し領域オーバーレイ</h5>
          <div className="relative inline-block border bg-white">
            <img src={imageDataUrl} alt="Original" className="max-w-full" style={{ maxHeight: "400px" }} />
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ width: "100%", height: "100%" }}
              viewBox={`0 0 ${extractedCards[0]?.width ? (extractedCards[0].x + extractedCards[0].width) * 1.1 : 1000} ${
                extractedCards[extractedCards.length - 1]?.y 
                  ? (extractedCards[extractedCards.length - 1].y + extractedCards[extractedCards.length - 1].height) * 1.1
                  : 1000
              }`}
              preserveAspectRatio="xMidYMid meet"
            >
              {extractedCards.map((card, index) => (
                <g key={index}>
                  <rect
                    x={card.x}
                    y={card.y}
                    width={card.width}
                    height={card.height}
                    fill="none"
                    stroke={
                      selectedCard === index ? "blue" :
                      card.zone === "main" ? "green" :
                      card.zone === "extra" ? "purple" : "orange"
                    }
                    strokeWidth={selectedCard === index ? 3 : 1}
                    opacity={0.8}
                  />
                  <text
                    x={card.x + 2}
                    y={card.y + 12}
                    fill={
                      card.zone === "main" ? "green" :
                      card.zone === "extra" ? "purple" : "orange"
                    }
                    fontSize="10"
                    fontWeight="bold"
                  >
                    {index + 1}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        </div>
      )}
    </Card>
  )
}