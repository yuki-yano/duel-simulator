import { useEffect, useRef, useState } from "react"
import { Card } from "@/client/components/Card"
import { createWorker } from "tesseract.js"
import { useSetAtom } from "jotai"
import { extractedCardsAtom } from "@/client/atoms/boardAtoms"
import type { Card as GameCard } from "@/shared/types/game"

interface DeckImageProcessorProps {
  imageDataUrl: string
  onProcessComplete: (cards: string[], metadata: DeckProcessMetadata) => void
}

export interface DeckProcessMetadata {
  imageDataUrl: string
  aspectRatioType: "TYPE_1" | "TYPE_2" | "TYPE_3"
  mainDeckCount: number
  extraDeckCount: number
  sourceWidth: number
  sourceHeight: number
}

// Aspect ratio types based on solo-mode analysis
const ASPECT_RATIOS = {
  TYPE_1: {
    value: 1.1,
    mainRows: 4,
    exRows: 2,
    label: "タイプ1 (1.1)",
    // Ratios based on 1080×1187px reference
    startY: 119 / 1187,
    cardWidth: 106 / 1080,
    cardHeight: 154 / 1187,
    cardGap: 2 / 1080,
    startYEx: 784 / 1187,
    deckNum: {
      x: 220 / 1080, // Expanded to include full text
      y: 86 / 1187,
      width: 80 / 1080, // Wider to capture "40枚"
      height: 23 / 1187,
    },
    exDeckNum: {
      x: 280 / 1080, // Adjusted for "15枚"
      y: 748 / 1187,
      width: 80 / 1080, // Wider area
      height: 23 / 1187,
    },
  },
  TYPE_2: {
    value: 1.24,
    mainRows: 5,
    exRows: 2,
    label: "タイプ2 (1.24)",
    // Ratios based on 1080×1341px reference
    startY: 150 / 1341,
    cardWidth: 106 / 1080,
    cardHeight: 154 / 1341,
    cardGap: 2 / 1080,
    startYEx: 937 / 1341,
    deckNum: {
      x: 220 / 1080,
      y: 114 / 1341,
      width: 80 / 1080,
      height: 23 / 1341,
    },
    exDeckNum: {
      x: 280 / 1080,
      y: 901 / 1341,
      width: 80 / 1080,
      height: 23 / 1341,
    },
  },
  TYPE_3: {
    value: 1.385,
    mainRows: 6,
    exRows: 2,
    label: "タイプ3 (1.385)",
    // Ratios based on 1080×1495px reference
    startY: 181 / 1495,
    cardWidth: 106 / 1080,
    cardHeight: 154 / 1495,
    cardGap: 2 / 1080,
    startYEx: 1109 / 1495,
    deckNum: {
      x: 220 / 1080,
      y: 145 / 1495,
      width: 80 / 1080,
      height: 23 / 1495,
    },
    exDeckNum: {
      x: 280 / 1080,
      y: 1073 / 1495,
      width: 80 / 1080,
      height: 23 / 1495,
    },
  },
} as const

type AspectRatioType = keyof typeof ASPECT_RATIOS

export function DeckImageProcessor({ imageDataUrl, onProcessComplete }: DeckImageProcessorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const debugCanvasRef = useRef<HTMLCanvasElement>(null)
  const debugExCanvasRef = useRef<HTMLCanvasElement>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [detectedType, setDetectedType] = useState<AspectRatioType | null>(null)
  const [processedCards, setProcessedCards] = useState<string[]>([])
  const [deckCount, setDeckCount] = useState<{ main: number | null; extra: number | null }>({
    main: null,
    extra: null,
  })
  const [isOCRProcessing, setIsOCRProcessing] = useState(false)
  const [showDebug, setShowDebug] = useState(false)
  const setExtractedCards = useSetAtom(extractedCardsAtom)

  useEffect(() => {
    if (imageDataUrl) {
      detectAspectRatio()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageDataUrl])

  const detectAspectRatio = () => {
    const img = new Image()
    img.onload = () => {
      const aspectRatio = img.width / img.height

      // Find closest matching aspect ratio
      let closestType: AspectRatioType = "TYPE_2"
      let minDiff = Infinity

      Object.entries(ASPECT_RATIOS).forEach(([type, config]) => {
        const diff = Math.abs(aspectRatio - config.value)
        if (diff < minDiff) {
          minDiff = diff
          closestType = type as AspectRatioType
        }
      })

      setDetectedType(closestType)

      // Draw preview on canvas
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext("2d")
        if (ctx) {
          // Set canvas size to match image (scaled down for preview)
          const maxWidth = 600
          const scale = Math.min(1, maxWidth / img.width)
          canvas.width = img.width * scale
          canvas.height = img.height * scale

          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        }
      }
    }
    img.src = imageDataUrl
  }

  const performOCR = async () => {
    if (!detectedType) return

    setIsOCRProcessing(true)
    const config = ASPECT_RATIOS[detectedType]
    const img = new Image()

    img.onload = async () => {
      try {
        const worker = await createWorker("jpn") // Use Japanese for neuron format

        // Extract deck count area with larger margin
        const deckCanvas = document.createElement("canvas")
        const deckCtx = deckCanvas.getContext("2d")
        if (deckCtx) {
          // Expand the area slightly for better OCR
          const margin = 5
          const deckNumX = Math.max(0, config.deckNum.x * img.width - margin)
          const deckNumY = Math.max(0, config.deckNum.y * img.height - margin)
          const deckNumWidth = config.deckNum.width * img.width + margin * 2
          const deckNumHeight = config.deckNum.height * img.height + margin * 2

          // Create larger canvas for upscaling
          const scale = 3 // Upscale for better OCR
          deckCanvas.width = deckNumWidth * scale
          deckCanvas.height = deckNumHeight * scale

          // Enable image smoothing for better quality
          deckCtx.imageSmoothingEnabled = true
          deckCtx.imageSmoothingQuality = "high"

          // Draw with white background for better contrast
          deckCtx.fillStyle = "white"
          deckCtx.fillRect(0, 0, deckCanvas.width, deckCanvas.height)

          deckCtx.drawImage(
            img,
            deckNumX,
            deckNumY,
            deckNumWidth,
            deckNumHeight,
            0,
            0,
            deckCanvas.width,
            deckCanvas.height,
          )

          // Apply image preprocessing for better OCR
          const imageData = deckCtx.getImageData(0, 0, deckCanvas.width, deckCanvas.height)
          const data = imageData.data

          // Convert to grayscale and increase contrast
          for (let i = 0; i < data.length; i += 4) {
            const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
            // Apply threshold to make it black and white
            const value = gray > 128 ? 255 : 0
            data[i] = value
            data[i + 1] = value
            data[i + 2] = value
          }

          deckCtx.putImageData(imageData, 0, 0)

          // Show debug canvas
          if (showDebug && debugCanvasRef.current) {
            const debugCtx = debugCanvasRef.current.getContext("2d")
            if (debugCtx) {
              debugCanvasRef.current.width = deckCanvas.width
              debugCanvasRef.current.height = deckCanvas.height
              debugCtx.clearRect(0, 0, deckCanvas.width, deckCanvas.height)
              debugCtx.drawImage(deckCanvas, 0, 0)
              console.log("Main deck debug canvas size:", deckCanvas.width, "x", deckCanvas.height)
            }
          }

          const mainResult = await worker.recognize(deckCanvas)
          const mainText = mainResult.data.text.trim()
          console.log("Main deck OCR result (raw):", mainText)

          // Extract numbers from the text (handles Japanese text like "40枚")
          const mainMatch = mainText.match(/\d+/)
          let mainCount = mainMatch ? parseInt(mainMatch[0]) : NaN
          console.log("Main deck extracted number:", mainCount)

          // Validate and fix common OCR errors for main deck
          // Main deck is typically 40-60 cards
          if (mainCount >= 4 && mainCount <= 6) {
            mainCount = mainCount * 10 // 4 -> 40, 5 -> 50, 6 -> 60
          } else if (mainCount >= 35 && mainCount <= 65) {
            // Valid range, keep as is
          } else if (mainCount < 20) {
            // Suspiciously low, might be missing a digit
            console.log(`OCR detected unusually low main deck count: ${mainCount}`)
          }

          // Extract extra deck count area
          const exCanvas = document.createElement("canvas")
          const exCtx = exCanvas.getContext("2d")
          if (exCtx) {
            const exNumX = Math.max(0, config.exDeckNum.x * img.width - margin)
            const exNumY = Math.max(0, config.exDeckNum.y * img.height - margin)
            const exNumWidth = config.exDeckNum.width * img.width + margin * 2
            const exNumHeight = config.exDeckNum.height * img.height + margin * 2

            exCanvas.width = exNumWidth * scale
            exCanvas.height = exNumHeight * scale

            exCtx.imageSmoothingEnabled = true
            exCtx.imageSmoothingQuality = "high"
            exCtx.fillStyle = "white"
            exCtx.fillRect(0, 0, exCanvas.width, exCanvas.height)

            exCtx.drawImage(img, exNumX, exNumY, exNumWidth, exNumHeight, 0, 0, exCanvas.width, exCanvas.height)

            // Apply same preprocessing
            const exImageData = exCtx.getImageData(0, 0, exCanvas.width, exCanvas.height)
            const exData = exImageData.data

            for (let i = 0; i < exData.length; i += 4) {
              const gray = exData[i] * 0.299 + exData[i + 1] * 0.587 + exData[i + 2] * 0.114
              const value = gray > 128 ? 255 : 0
              exData[i] = value
              exData[i + 1] = value
              exData[i + 2] = value
            }

            exCtx.putImageData(exImageData, 0, 0)

            // Show extra deck debug canvas
            if (showDebug && debugExCanvasRef.current) {
              const debugExCtx = debugExCanvasRef.current.getContext("2d")
              if (debugExCtx) {
                debugExCanvasRef.current.width = exCanvas.width
                debugExCanvasRef.current.height = exCanvas.height
                debugExCtx.drawImage(exCanvas, 0, 0)
              }
            }

            const exResult = await worker.recognize(exCanvas)
            const exText = exResult.data.text.trim()
            console.log("Extra deck OCR result (raw):", exText)

            // Extract numbers from the text (handles Japanese text like "15枚")
            const exMatch = exText.match(/\d+/)
            const exCount = exMatch ? parseInt(exMatch[0]) : NaN
            console.log("Extra deck extracted number:", exCount)

            // Validate extra deck count (usually 0-15)
            // Only convert single digit 1 to 10 (common OCR error)
            if (exCount === 1) {
              // Check if it's likely to be 10 or 15 based on context
              // For now, we'll keep 1 as 1 and let user adjust if needed
              // exCount = 10  // Commented out - too aggressive
            }

            setDeckCount({
              main: isNaN(mainCount) ? null : Math.min(mainCount, config.mainRows * 10),
              extra: isNaN(exCount) ? null : Math.min(exCount, config.exRows * 10),
            })
          }
        }

        await worker.terminate()
      } catch (error) {
        console.error("OCR failed:", error)
        setDeckCount({ main: null, extra: null })
      }

      setIsOCRProcessing(false)
    }

    img.src = imageDataUrl
  }

  const processImage = async () => {
    if (!detectedType) return

    setIsProcessing(true)
    
    try {
      const img = new Image()
      
      // Promiseで画像の読み込みを待つ
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('画像の読み込みに失敗しました'))
        img.src = imageDataUrl
      })
      const cards: string[] = []
      const mainDeckCards: GameCard[] = []
      const extraDeckCards: GameCard[] = []
      const config = ASPECT_RATIOS[detectedType]
      const cols = 10

      // Calculate dimensions based on image size and ratios
      const cardWidth = config.cardWidth * img.width
      const cardHeight = config.cardHeight * img.height
      const cardGap = config.cardGap * img.width
      const startY = config.startY * img.height
      const startYEx = config.startYEx * img.height

      // Process main deck cards
      let mainCardCount = 0
      const maxMainCards = deckCount.main ?? config.mainRows * cols

      for (let row = 0; row < config.mainRows; row++) {
        for (let col = 0; col < cols; col++) {
          if (mainCardCount >= maxMainCards) break

          const tempCanvas = document.createElement("canvas")
          tempCanvas.width = cardWidth
          tempCanvas.height = cardHeight

          const ctx = tempCanvas.getContext("2d")
          if (ctx) {
            // Extract card from source image using ratio-based coordinates
            ctx.drawImage(
              img,
              col * (cardWidth + cardGap), // source x
              startY + row * cardHeight, // source y
              cardWidth, // source width
              cardHeight, // source height
              0, // dest x
              0, // dest y
              cardWidth, // dest width
              cardHeight, // dest height
            )

            const cardDataUrl = tempCanvas.toDataURL("image/png")
            cards.push(cardDataUrl)
            
            // Create GameCard object
            const gameCard: GameCard = {
              id: `card-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              imageUrl: cardDataUrl,
              position: 'facedown',
              rotation: 0,
              zone: { player: 'self', type: 'deck' },
              index: mainCardCount,
            }
            mainDeckCards.push(gameCard)
            mainCardCount++
          }
        }
        if (mainCardCount >= maxMainCards) break
      }

      // Process extra deck cards
      let exCardCount = 0
      // If OCR hasn't been run, default to 15 for extra deck (standard max)
      const maxExCards = deckCount.extra !== null ? deckCount.extra : 15

      for (let row = 0; row < config.exRows; row++) {
        for (let col = 0; col < cols; col++) {
          if (exCardCount >= maxExCards) break

          const tempCanvas = document.createElement("canvas")
          tempCanvas.width = cardWidth
          tempCanvas.height = cardHeight

          const ctx = tempCanvas.getContext("2d")
          if (ctx) {
            ctx.drawImage(
              img,
              col * (cardWidth + cardGap),
              startYEx + row * cardHeight,
              cardWidth,
              cardHeight,
              0,
              0,
              cardWidth,
              cardHeight,
            )

            const cardDataUrl = tempCanvas.toDataURL("image/png")
            cards.push(cardDataUrl)
            
            // Create GameCard object for extra deck
            const gameCard: GameCard = {
              id: `card-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              imageUrl: cardDataUrl,
              position: 'facedown',
              rotation: 0,
              zone: { player: 'self', type: 'extraDeck' },
              index: exCardCount,
            }
            extraDeckCards.push(gameCard)
            exCardCount++
          }
        }
        if (exCardCount >= maxExCards) break
      }

      setProcessedCards(cards)
      setIsProcessing(false)

      // Store extracted cards in Jotai atoms
      setExtractedCards({
        mainDeck: mainDeckCards,
        extraDeck: extraDeckCards,
      })

      // Create metadata for saving
      const metadata: DeckProcessMetadata = {
        imageDataUrl,
        aspectRatioType: detectedType,
        mainDeckCount: mainCardCount,
        extraDeckCount: exCardCount,
        sourceWidth: img.width,
        sourceHeight: img.height,
      }

      onProcessComplete(cards, metadata)
    } catch (error) {
      console.error('カードの切り出し処理でエラーが発生しました:', error)
      alert('カードの切り出しに失敗しました。画像を確認してください。')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Card className="p-6 space-y-4">
      <h3 className="text-lg font-semibold">デッキ読み込み</h3>

      <div className="space-y-4">
        {/* Preview Canvas */}
        <div className="border rounded-lg overflow-hidden">
          <canvas ref={canvasRef} className="w-full" />
        </div>

        {/* Aspect Ratio Detection */}
        {detectedType && (
          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-sm">
              検出されたレイアウト: <strong>{ASPECT_RATIOS[detectedType].label}</strong>
            </p>
            <p className="text-xs text-gray-600 mt-1">メインデッキ: {ASPECT_RATIOS[detectedType].mainRows}行 × 10列</p>
            <p className="text-xs text-gray-600">EXデッキ: {ASPECT_RATIOS[detectedType].exRows}行 × 10列</p>
          </div>
        )}

        {/* OCR Section */}
        {detectedType && (
          <div className="space-y-2">
            <button
              onClick={performOCR}
              disabled={isOCRProcessing}
              className={`
                w-full py-2 px-4 rounded-lg font-medium transition-colors
                ${
                  isOCRProcessing
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                    : "bg-green-500 text-white hover:bg-green-600"
                }
              `}
            >
              {isOCRProcessing ? "デッキ枚数を読み取り中..." : "デッキ枚数を自動検出"}
            </button>

            {/* Debug toggle */}
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={showDebug}
                onChange={(e) => setShowDebug(e.target.checked)}
                className="rounded"
              />
              OCRデバッグ表示
            </label>

            {/* Debug canvas */}
            {showDebug && (
              <div className="space-y-2">
                <div className="border rounded p-2 bg-gray-100">
                  <p className="text-xs text-gray-600 mb-1">メインデッキ OCR対象画像:</p>
                  <canvas
                    ref={debugCanvasRef}
                    className="border bg-white"
                    style={{ maxWidth: "100%", height: "auto" }}
                  />
                </div>
                <div className="border rounded p-2 bg-gray-100">
                  <p className="text-xs text-gray-600 mb-1">EXデッキ OCR対象画像:</p>
                  <canvas
                    ref={debugExCanvasRef}
                    className="border bg-white"
                    style={{ maxWidth: "100%", height: "auto" }}
                  />
                </div>
              </div>
            )}

            {(deckCount.main !== null || deckCount.extra !== null) && (
              <div className="bg-green-50 p-3 rounded-lg space-y-2">
                <p className="text-sm font-medium">検出されたデッキ枚数:</p>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-600 w-20">メインデッキ:</label>
                    <input
                      type="number"
                      min="0"
                      max={ASPECT_RATIOS[detectedType].mainRows * 10}
                      value={deckCount.main ?? 0}
                      onChange={(e) => setDeckCount((prev) => ({ ...prev, main: parseInt(e.target.value) || 0 }))}
                      className="w-16 px-2 py-1 text-xs border rounded"
                    />
                    <span className="text-xs text-gray-600">枚</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-600 w-20">EXデッキ:</label>
                    <input
                      type="number"
                      min="0"
                      max={ASPECT_RATIOS[detectedType].exRows * 10}
                      value={deckCount.extra ?? 0}
                      onChange={(e) => setDeckCount((prev) => ({ ...prev, extra: parseInt(e.target.value) || 0 }))}
                      className="w-16 px-2 py-1 text-xs border rounded"
                    />
                    <span className="text-xs text-gray-600">枚</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500">※ OCRの精度が低い場合は手動で調整してください</p>
              </div>
            )}
          </div>
        )}

        {/* Process Button */}
        <button
          onClick={processImage}
          disabled={!detectedType || isProcessing}
          className={`
            w-full py-2 px-4 rounded-lg font-medium transition-colors
            ${
              !detectedType || isProcessing
                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                : "bg-blue-500 text-white hover:bg-blue-600"
            }
          `}
        >
          {isProcessing
            ? "処理中..."
            : deckCount.main === null && deckCount.extra === null
              ? "カードを切り出す（OCR未実行）"
              : "カードを切り出す"}
        </button>

        {/* Processed Cards Count */}
        {processedCards.length > 0 && (
          <p className="text-sm text-green-600">{processedCards.length}枚のカードを切り出しました</p>
        )}
      </div>
    </Card>
  )
}
