import { useEffect, useRef, useState, useCallback } from "react"
import { useTranslation } from "react-i18next"
import i18n from "@client/i18n"
import { Card } from "@/client/components/ui/Card"
import { createWorker, PSM } from "tesseract.js"
import { produce } from "immer"
import { useSetAtom } from "jotai"
import { extractedCardsAtom } from "@/client/atoms/boardAtoms"
import { ErrorDialog } from "@/client/components/ErrorDialog"
import { DeckImageDebugPanel } from "@/client/components/DeckImageDebugPanel"
import type { Card as GameCard, DeckCardIdsMapping, DeckConfiguration, DeckSection } from "@/shared/types/game"

type DeckImageProcessorProps = {
  imageDataUrl: string
  onProcessComplete: (cards: string[], metadata: DeckProcessMetadata) => void
  isReplayMode?: boolean
  onReplayStart?: () => void
  onError?: () => void
}

export type DeckProcessMetadata = {
  imageDataUrl: string
  imageUrl?: string
  deckConfig: DeckConfiguration
  mainDeckCount: number
  extraDeckCount: number
  sideDeckCount?: number
  sourceWidth: number
  sourceHeight: number
  deckCardIds: DeckCardIdsMapping
}

// Position ratios based on image width
const LAYOUT_RATIOS = {
  mainDeckTextY: 0.071, // Main deck text is below the deck name (7% of width from top)
  textToCardsGap: 0.035, // Gap between text and cards (increased to account for text height)
  sectionGap: 0.006, // Gap between sections (further reduced for extra deck positioning)
  cardAspectRatio: 1.4665, // Card height/width ratio (increased to compensate for no row gap)
  rowGap: 0, // No gap between card rows (solo-mode approach)
  firstRowOffset: 0.002, // Additional offset for the first row of cards
  cardHorizontalMargin: 0.002, // Horizontal margin for card capture (increased)
  leftTextX: 0.02, // Text starts at 2% from left
  textWidth: 0.35, // Text area width is 35% of image width
  textHeight: 0.035, // Text area height is 3.5% of image width
}

export function DeckImageProcessor({
  imageDataUrl,
  onProcessComplete,
  isReplayMode = false,
  onReplayStart,
  onError,
}: DeckImageProcessorProps) {
  const { t } = useTranslation(["ui", "common"])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const debugCanvasRef = useRef<HTMLCanvasElement>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [deckConfig, setDeckConfig] = useState<DeckConfiguration | null>(null)
  const [processedCards, setProcessedCards] = useState<string[]>([])

  // デバッグ機能を開発環境のローカルでのみ有効化
  const isDev = import.meta.env.DEV && window.location.hostname === "localhost"
  const [showDebug, setShowDebug] = useState(isDev)

  const [ocrDebugCanvases, setOcrDebugCanvases] = useState<{ main?: string; extra?: string; side?: string }>({})
  const [ocrProcessedCanvases, setOcrProcessedCanvases] = useState<{ main?: string; extra?: string; side?: string }>({})
  const [ocrTexts, setOcrTexts] = useState<{ main?: string; extra?: string; side?: string }>({}) // OCRで認識したテキストを保存
  const [debugExtractedCards, setDebugExtractedCards] = useState<
    Array<{
      index: number
      x: number
      y: number
      width: number
      height: number
      imageUrl: string
      zone: "main" | "extra" | "side"
    }>
  >([]) // デバッグ用のカード情報
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)
  const setExtractedCards = useSetAtom(extractedCardsAtom)
  const [errorDialog, setErrorDialog] = useState<{ open: boolean; message: string }>({ open: false, message: "" })

  // 解析済みフラグを追加して重複実行を防ぐ
  const analyzedRef = useRef(false)
  // Tesseract workerのインスタンスを保持
  const workerRef = useRef<Awaited<ReturnType<typeof createWorker>> | null>(null)
  // 現在初期化されているworkerの言語を追跡
  const currentWorkerLanguage = useRef<string | null>(null)

  // Workerの初期化関数
  const initializeWorker = useCallback(async () => {
    const currentLanguage = i18n.language

    // 言語が変更されていない場合は既存のworkerを再利用
    if (workerRef.current && currentWorkerLanguage.current === currentLanguage) {
      return workerRef.current
    }

    // 既存のworkerがある場合は終了
    if (workerRef.current) {
      await workerRef.current.terminate()
      workerRef.current = null
    }

    // 現在の言語設定に基づいてOCR言語と文字ホワイトリストを決定
    let ocrLanguages: string[]
    let charWhitelist: string

    switch (currentLanguage) {
      case "ja":
        ocrLanguages = ["jpn"]
        charWhitelist = ":0123456789枚"
        break
      case "ko":
        ocrLanguages = ["kor"]
        charWhitelist = ":0123456789장개"
        break
      case "zh":
        ocrLanguages = ["eng"]
        charWhitelist = ":0123456789cards"
        break
      case "en":
      default:
        ocrLanguages = ["jpn"]
        charWhitelist = ":0123456789枚"
        break
    }

    const worker = await createWorker(ocrLanguages)

    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SINGLE_LINE,
      tessedit_ocr_engine_mode: "2",
      tessedit_char_whitelist: charWhitelist,
      tessedit_min_confidence: "50",
      tessedit_enable_image_preprocessing: "1",
      tessedit_denoise_image: "1",
      tessedit_create_hocr: "0",
      tessedit_create_pdf: "0",
      classify_integer_matcher_multiplier: "10",
      debug_file: "",
    })

    workerRef.current = worker
    currentWorkerLanguage.current = currentLanguage
    return workerRef.current
  }, [])

  // コンポーネントのクリーンアップ時にworkerを終了
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        void workerRef.current.terminate()
        workerRef.current = null
        currentWorkerLanguage.current = null
      }
    }
  }, [])

  // 言語変更時にworkerを再初期化
  useEffect(() => {
    const currentLanguage = i18n.language
    if (currentWorkerLanguage.current !== null && currentWorkerLanguage.current !== currentLanguage) {
      // 既存のworkerを終了して再初期化を促す
      if (workerRef.current) {
        void workerRef.current.terminate()
        workerRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.language])

  const drawPreview = useCallback(() => {
    const img = new Image()
    img.onload = () => {
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext("2d")
        if (ctx) {
          const maxWidth = 600
          const scale = Math.min(1, maxWidth / img.width)
          canvas.width = img.width * scale
          canvas.height = img.height * scale
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

          // Convert canvas to image URL for preview
          setPreviewImageUrl(canvas.toDataURL("image/png"))
        }
      }
    }
    img.src = imageDataUrl
  }, [imageDataUrl])

  const extractTextFromRegion = useCallback(
    async (
      img: HTMLImageElement,
      x: number,
      y: number,
      width: number,
      height: number,
      debugKey?: "main" | "extra" | "side",
    ): Promise<string> => {
      // Create a canvas for the specific region
      const regionCanvas = document.createElement("canvas")
      const scale = 6 // さらに拡大してOCR精度を向上（4→6）
      regionCanvas.width = width * scale
      regionCanvas.height = height * scale

      const ctx = regionCanvas.getContext("2d")
      if (!ctx) return ""

      // Enable better image interpolation
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = "high"

      // Draw the specific region with scaling
      ctx.drawImage(img, x, y, width, height, 0, 0, regionCanvas.width, regionCanvas.height)

      // Apply preprocessing for better OCR
      const imageData = ctx.getImageData(0, 0, regionCanvas.width, regionCanvas.height)
      const data = imageData.data

      // First pass: Detect background color (most common color)
      const colorCounts = new Map<string, number>()
      for (let i = 0; i < data.length; i += 4) {
        const gray = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114)
        const key = Math.round(gray / 10) * 10 // Group similar colors
        colorCounts.set(key.toString(), (colorCounts.get(key.toString()) ?? 0) + 1)
      }

      // Find the most common color (likely background)
      let bgColor = 255
      let maxCount = 0
      for (const [color, count] of colorCounts) {
        if (count > maxCount) {
          maxCount = count
          bgColor = parseInt(color)
        }
      }

      // Simple adaptive thresholding based on background
      const threshold = bgColor > 128 ? bgColor - 40 : bgColor + 40

      // Apply binary threshold
      for (let i = 0; i < data.length; i += 4) {
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114

        // Invert if dark background
        let value: number
        if (bgColor < 128) {
          // Dark background, light text
          value = gray > threshold ? 255 : 0
        } else {
          // Light background, dark text
          value = gray < threshold ? 0 : 255
        }

        data[i] = value
        data[i + 1] = value
        data[i + 2] = value
      }

      ctx.putImageData(imageData, 0, 0)

      // Store processed image for debug
      const processedDataUrl = regionCanvas.toDataURL()

      // Save processed canvas for debug display if debugKey provided
      if (debugKey && showDebug) {
        setOcrProcessedCanvases((prev) =>
          produce(prev, (draft) => {
            draft[debugKey] = processedDataUrl
          }),
        )
      }

      // Perform OCR on this region using shared worker
      const worker = await initializeWorker()
      const result = await worker.recognize(regionCanvas)

      const text = result.data.text

      // デバッグログ（開発環境のみ）
      if (import.meta.env.DEV && window.location.hostname === "localhost" && debugKey) {
        console.log(`OCR result for ${debugKey}:`, text)
      }

      return text
    },
    [showDebug, setOcrProcessedCanvases, initializeWorker],
  )

  const analyzeDeckStructure = useCallback(async () => {
    // 既に解析済みの場合はスキップ
    if (analyzedRef.current) return

    // 解析開始前にフラグを立てて、重複実行を防ぐ
    analyzedRef.current = true

    setIsAnalyzing(true)
    setOcrDebugCanvases({}) // Clear previous debug canvases
    setOcrProcessedCanvases({}) // Clear previous processed canvases
    const img = new Image()

    img.onload = async () => {
      try {
        const deckSections: DeckSection[] = []

        // Calculate positions based on image width
        const textX = img.width * LAYOUT_RATIOS.leftTextX
        const textWidth = img.width * LAYOUT_RATIOS.textWidth
        const textHeight = img.width * LAYOUT_RATIOS.textHeight

        // Try to find main deck text - try multiple positions
        const mainDeckY = img.width * LAYOUT_RATIOS.mainDeckTextY
        let mainDeckText = await extractTextFromRegion(img, textX, mainDeckY, textWidth, textHeight, "main")

        // Debug: Main deck OCR (attempt 1)

        // If first attempt fails, try slightly different position
        if (!mainDeckText.match(/\d+/)) {
          mainDeckText = await extractTextFromRegion(
            img,
            textX - img.width * 0.02, // Slightly more to the left
            mainDeckY - img.width * 0.01, // Slightly higher
            textWidth + img.width * 0.04, // Wider area
            textHeight + img.width * 0.01, // Taller area
          )
          // Debug: Main deck OCR (attempt 2)
        }

        // Save debug canvas
        if (showDebug) {
          const debugCanvas = document.createElement("canvas")
          debugCanvas.width = textWidth
          debugCanvas.height = textHeight
          const debugCtx = debugCanvas.getContext("2d")
          if (debugCtx) {
            debugCtx.drawImage(img, textX, mainDeckY, textWidth, textHeight, 0, 0, textWidth, textHeight)
            setOcrDebugCanvases((prev) =>
              produce(prev, (draft) => {
                draft.main = debugCanvas.toDataURL()
              }),
            )
          }
        }

        // OCRテキストを保存
        setOcrTexts((prev) => ({ ...prev, main: mainDeckText }))

        // OCR結果をそのまま使用
        const processedText = mainDeckText

        // More flexible regex patterns - 多言語対応
        // パターン1: コロン(:)の後の数字を優先的に検索
        // パターン2: 日本語: 枚
        // パターン3: 英語: cards/card
        // パターン4: 韓国語: 장(枚)/개(個)
        let mainDeckMatch = processedText.match(/:\s*(\d+)/) // コロンの後の数字を優先
        if (!mainDeckMatch) {
          mainDeckMatch = processedText.match(/(\d+)\s*(?:枚|cards?|장|개)/i)
        }
        if (!mainDeckMatch) {
          // Try to find just numbers
          mainDeckMatch = processedText.match(/(\d+)/)
        }

        // デバッグ: OCR認識結果をログ出力（開発環境のみ）
        if (isDev) {
          console.log("Main deck OCR result:", {
            originalText: mainDeckText,
            processedText: processedText,
            match: mainDeckMatch ? mainDeckMatch[0] : null,
            extractedNumber: mainDeckMatch ? mainDeckMatch[1] : null,
          })
        }

        if (mainDeckMatch) {
          const count = parseInt(mainDeckMatch[1])
          const rows = Math.ceil(count / 10)
          deckSections.push({
            label: "main",
            count,
            yPosition: mainDeckY,
            rows,
          })
        }

        // Calculate card dimensions
        const cardsPerRow = 10
        const totalGapRatio = 0.02
        const leftMarginRatio = 0.002 // Reduced left margin to start capturing more to the left
        const rightMarginRatio = 0.002 // Reduced right margin to capture more to the right
        const cardAreaWidth = img.width * (1 - totalGapRatio - leftMarginRatio - rightMarginRatio)
        const cardWidth = cardAreaWidth / cardsPerRow
        const cardHeight = cardWidth * LAYOUT_RATIOS.cardAspectRatio
        const cardGap = (img.width * totalGapRatio) / (cardsPerRow - 1)

        // Try to find extra deck text
        if (deckSections.length > 0) {
          const mainSection = deckSections[0]
          // Calculate extra deck position - include tiny row gaps
          const mainDeckHeight =
            img.width * LAYOUT_RATIOS.firstRowOffset +
            mainSection.rows * cardHeight +
            (mainSection.rows - 1) * img.width * LAYOUT_RATIOS.rowGap
          const extraDeckY =
            mainDeckY + img.width * LAYOUT_RATIOS.textToCardsGap + mainDeckHeight + img.width * LAYOUT_RATIOS.sectionGap

          const extraDeckText = await extractTextFromRegion(img, textX, extraDeckY, textWidth, textHeight, "extra")

          // Debug: Extra deck OCR

          // OCRテキストを保存
          setOcrTexts((prev) => ({ ...prev, extra: extraDeckText }))

          // OCR結果をそのまま使用
          const processedExtraText = extraDeckText

          // 多言語対応の正規表現パターン（コロンパターンを優先）
          let extraDeckMatch = processedExtraText.match(/:\s*(\d+)/) // コロンの後の数字を優先
          if (!extraDeckMatch) {
            extraDeckMatch = processedExtraText.match(/(\d+)\s*(?:枚|cards?|장|개)/i)
          }

          // デバッグ: OCR認識結果をログ出力（開発環境のみ）
          if (isDev) {
            console.log("Extra deck OCR result:", {
              originalText: extraDeckText,
              processedText: processedExtraText,
              match: extraDeckMatch ? extraDeckMatch[0] : null,
              extractedNumber: extraDeckMatch ? extraDeckMatch[1] : null,
              extraDeckY: extraDeckY,
            })
          }

          if (extraDeckMatch) {
            const count = parseInt(extraDeckMatch[1])
            const rows = Math.ceil(count / 10)
            deckSections.push({
              label: "extra",
              count,
              yPosition: extraDeckY,
              rows,
            })

            // Try to find side deck text (after extra deck)
            const extraSection = { rows, count }
            const extraDeckHeight =
              img.width * LAYOUT_RATIOS.firstRowOffset +
              extraSection.rows * cardHeight +
              (extraSection.rows - 1) * img.width * LAYOUT_RATIOS.rowGap
            const sideDeckY =
              extraDeckY +
              img.width * LAYOUT_RATIOS.textToCardsGap +
              extraDeckHeight +
              img.width * LAYOUT_RATIOS.sectionGap

            const sideDeckText = await extractTextFromRegion(img, textX, sideDeckY, textWidth, textHeight, "side")

            // OCRテキストを保存
            setOcrTexts((prev) => ({ ...prev, side: sideDeckText }))

            // OCR結果をそのまま使用
            const processedSideText = sideDeckText

            // 多言語対応の正規表現パターン（コロンパターンを優先）
            let sideDeckMatch = processedSideText.match(/:\s*(\d+)/) // コロンの後の数字を優先
            if (!sideDeckMatch) {
              sideDeckMatch = processedSideText.match(/(\d+)\s*(?:枚|cards?|장|개)/i)
            }

            // デバッグ: OCR認識結果をログ出力（開発環境のみ）
            if (isDev) {
              console.log("Side deck OCR result:", {
                originalText: sideDeckText,
                processedText: processedSideText,
                match: sideDeckMatch ? sideDeckMatch[0] : null,
                extractedNumber: sideDeckMatch ? sideDeckMatch[1] : null,
                sideDeckY: sideDeckY,
              })
            }

            if (sideDeckMatch) {
              const count = parseInt(sideDeckMatch[1])
              const rows = Math.ceil(count / 10)
              deckSections.push({
                label: "side",
                count,
                yPosition: sideDeckY,
                rows,
              })
            }
          }
        }

        // Check if no deck sections found
        if (deckSections.length === 0) {
          console.warn("No deck sections found in OCR.")
          setIsAnalyzing(false)
          setErrorDialog({ open: true, message: t("deck.structureDetectionFailed") })
          return
        }

        // Create deck configuration
        const config: DeckConfiguration = {
          mainDeck: null,
          extraDeck: null,
          sideDeck: null,
          cardWidth,
          cardHeight,
          cardGap,
          leftMargin: img.width * leftMarginRatio,
        }

        // Assign sections to deck types
        for (const section of deckSections) {
          switch (section.label) {
            case "main":
              config.mainDeck = section
              break
            case "extra":
              config.extraDeck = section
              break
            case "side":
              config.sideDeck = section
              break
          }
        }

        setDeckConfig(config)
        analyzedRef.current = true // 解析完了フラグを設定

        // Show debug information
        if (showDebug && debugCanvasRef.current) {
          const debugCtx = debugCanvasRef.current.getContext("2d")
          if (debugCtx) {
            debugCanvasRef.current.width = img.width
            debugCanvasRef.current.height = img.height
            debugCtx.drawImage(img, 0, 0)

            // Draw detected sections
            debugCtx.strokeStyle = "red"
            debugCtx.lineWidth = 3
            debugCtx.font = "30px Arial"
            debugCtx.fillStyle = "red"

            for (const section of deckSections) {
              const startY =
                section.yPosition + img.width * LAYOUT_RATIOS.textToCardsGap + img.width * LAYOUT_RATIOS.firstRowOffset
              const height = section.rows * cardHeight + (section.rows - 1) * img.width * LAYOUT_RATIOS.rowGap

              debugCtx.strokeRect(config.leftMargin, startY, img.width - config.leftMargin * 2, height)
              debugCtx.fillText(`${section.label}: ${section.count} cards`, config.leftMargin, startY - 10)
            }
          }
        }
      } catch (error) {
        console.error("Failed to analyze deck structure:", error)
        setErrorDialog({ open: true, message: t("deck.analysisError") })
        // エラー時は解析済みフラグをリセット
        analyzedRef.current = false
      }

      setIsAnalyzing(false)
    }

    img.src = imageDataUrl
  }, [imageDataUrl, showDebug, extractTextFromRegion, t, isDev])

  useEffect(() => {
    if (imageDataUrl) {
      // 新しい画像が選択されたときにフラグとworkerをリセット
      analyzedRef.current = false

      // 前のworkerがある場合は終了
      if (workerRef.current) {
        void workerRef.current.terminate()
        workerRef.current = null
      }

      drawPreview()
      // 画像が読み込まれたら自動的にデッキ構造を解析
      void analyzeDeckStructure()
    }
  }, [imageDataUrl, drawPreview, analyzeDeckStructure])

  const processImage = async () => {
    // In replay mode, skip actual processing and just trigger replay start
    if (isReplayMode && onReplayStart) {
      onReplayStart()
      return
    }

    if (!deckConfig) {
      setErrorDialog({ open: true, message: t("deck.analyzeFirst") })
      return
    }

    setIsProcessing(true)

    try {
      const img = new Image()

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error(t("deck.imageLoadError")))
        img.src = imageDataUrl
      })

      const cards: string[] = []
      const mainDeckCards: GameCard[] = []
      const extraDeckCards: GameCard[] = []
      const sideDeckCards: GameCard[] = []
      const debugCards: typeof debugExtractedCards = [] // デバッグ用カード情報

      // カードIDマッピング用
      const deckCardIds: DeckCardIdsMapping = {
        mainDeck: {},
        extraDeck: {},
      }

      const { cardWidth, cardHeight, cardGap, leftMargin } = deckConfig
      const cardsPerRow = 10

      // Process main deck
      if (deckConfig.mainDeck) {
        const { yPosition, count, rows } = deckConfig.mainDeck
        const startY = yPosition + img.width * LAYOUT_RATIOS.textToCardsGap + img.width * LAYOUT_RATIOS.firstRowOffset

        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cardsPerRow; col++) {
            const cardIndex = row * cardsPerRow + col
            if (cardIndex >= count) break

            const tempCanvas = document.createElement("canvas")
            tempCanvas.width = cardWidth
            tempCanvas.height = cardHeight

            const ctx = tempCanvas.getContext("2d")
            if (ctx) {
              const x = leftMargin + col * (cardWidth + cardGap)
              const y = startY + row * (cardHeight + img.width * LAYOUT_RATIOS.rowGap)
              const horizontalMargin = img.width * LAYOUT_RATIOS.cardHorizontalMargin

              ctx.drawImage(
                img,
                x - horizontalMargin,
                y,
                cardWidth + horizontalMargin * 2,
                cardHeight,
                0,
                0,
                cardWidth,
                cardHeight,
              )

              const cardDataUrl = tempCanvas.toDataURL("image/png")
              cards.push(cardDataUrl)

              const cardId = `card-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
              const gameCard: GameCard = {
                id: cardId,
                imageUrl: cardDataUrl,
                position: "facedown",
                rotation: 0,
              }
              mainDeckCards.push(gameCard)

              // デバッグ用カード情報を追加
              debugCards.push({
                index: cardIndex,
                x: x - horizontalMargin,
                y: y,
                width: cardWidth + horizontalMargin * 2,
                height: cardHeight,
                imageUrl: cardDataUrl,
                zone: "main",
              })

              // カードIDマッピングに追加
              deckCardIds.mainDeck[cardIndex] = cardId
            }
          }
        }
      }

      // Process extra deck
      if (deckConfig.extraDeck) {
        const { yPosition, count, rows } = deckConfig.extraDeck
        const startY = yPosition + img.width * LAYOUT_RATIOS.textToCardsGap + img.width * LAYOUT_RATIOS.firstRowOffset

        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cardsPerRow; col++) {
            const cardIndex = row * cardsPerRow + col
            if (cardIndex >= count) break

            const tempCanvas = document.createElement("canvas")
            tempCanvas.width = cardWidth
            tempCanvas.height = cardHeight

            const ctx = tempCanvas.getContext("2d")
            if (ctx) {
              const x = leftMargin + col * (cardWidth + cardGap)
              const y = startY + row * (cardHeight + img.width * LAYOUT_RATIOS.rowGap)
              const horizontalMargin = img.width * LAYOUT_RATIOS.cardHorizontalMargin

              ctx.drawImage(
                img,
                x - horizontalMargin,
                y,
                cardWidth + horizontalMargin * 2,
                cardHeight,
                0,
                0,
                cardWidth,
                cardHeight,
              )

              const cardDataUrl = tempCanvas.toDataURL("image/png")
              cards.push(cardDataUrl)

              const cardId = `card-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
              const gameCard: GameCard = {
                id: cardId,
                imageUrl: cardDataUrl,
                position: "facedown",
                rotation: 0,
              }
              extraDeckCards.push(gameCard)

              // デバッグ用カード情報を追加
              debugCards.push({
                index: cardIndex + (deckConfig.mainDeck?.count ?? 0), // 通し番号
                x: x - horizontalMargin,
                y: y,
                width: cardWidth + horizontalMargin * 2,
                height: cardHeight,
                imageUrl: cardDataUrl,
                zone: "extra",
              })

              // カードIDマッピングに追加
              deckCardIds.extraDeck[cardIndex] = cardId
            }
          }
        }
      }

      // Process side deck if present
      if (deckConfig.sideDeck) {
        const { yPosition, count, rows } = deckConfig.sideDeck
        const startY = yPosition + img.width * LAYOUT_RATIOS.textToCardsGap + img.width * LAYOUT_RATIOS.firstRowOffset

        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cardsPerRow; col++) {
            const cardIndex = row * cardsPerRow + col
            if (cardIndex >= count) break

            const tempCanvas = document.createElement("canvas")
            tempCanvas.width = cardWidth
            tempCanvas.height = cardHeight

            const ctx = tempCanvas.getContext("2d")
            if (ctx) {
              const x = leftMargin + col * (cardWidth + cardGap)
              const y = startY + row * (cardHeight + img.width * LAYOUT_RATIOS.rowGap)
              const horizontalMargin = img.width * LAYOUT_RATIOS.cardHorizontalMargin

              ctx.drawImage(
                img,
                x - horizontalMargin,
                y,
                cardWidth + horizontalMargin * 2,
                cardHeight,
                0,
                0,
                cardWidth,
                cardHeight,
              )

              const cardDataUrl = tempCanvas.toDataURL("image/png")
              cards.push(cardDataUrl)

              // Side deck cards can be stored as a separate collection
              // or marked with a special flag
              const cardId = `card-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
              sideDeckCards.push({
                id: cardId,
                imageUrl: cardDataUrl,
                position: "facedown",
                rotation: 0,
              })

              // デバッグ用カード情報を追加
              debugCards.push({
                index: cardIndex + (deckConfig.mainDeck?.count ?? 0) + (deckConfig.extraDeck?.count ?? 0), // 通し番号
                x: x - horizontalMargin,
                y: y,
                width: cardWidth + horizontalMargin * 2,
                height: cardHeight,
                imageUrl: cardDataUrl,
                zone: "side",
              })
            }
          }
        }
      }

      setProcessedCards(cards)
      setDebugExtractedCards(debugCards) // デバッグ用カード情報を保存

      // Store extracted cards
      setExtractedCards({
        mainDeck: mainDeckCards,
        extraDeck: extraDeckCards,
        sideDeck: sideDeckCards,
      })

      // Create metadata
      const metadata: DeckProcessMetadata = {
        imageDataUrl,
        deckConfig,
        mainDeckCount: mainDeckCards.length,
        extraDeckCount: extraDeckCards.length,
        sideDeckCount: sideDeckCards.length,
        sourceWidth: img.width,
        sourceHeight: img.height,
        deckCardIds,
      }

      onProcessComplete(cards, metadata)

      // If in replay mode, trigger onReplayStart immediately
      // (the actual 2-second delay is handled in the parent component)
      if (isReplayMode && onReplayStart) {
        onReplayStart()
      }
    } catch (error) {
      console.error("カードの切り出し処理でエラーが発生しました:", error)
      setErrorDialog({ open: true, message: t("deck.extractionError") })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* デバッグトグル - 開発環境のみ表示 */}
      {isDev && (
        <div className="flex items-center gap-2 px-6 pt-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showDebug}
              onChange={(e) => setShowDebug(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm font-medium">デバッグ情報を表示</span>
          </label>
        </div>
      )}

      <Card className="p-6 space-y-4">
        <h3 className="text-lg font-semibold">{t("deck.loading")}</h3>

        <div className="space-y-4">
          {/* Preview Canvas - hidden but kept for processing */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Preview Image */}
          {previewImageUrl !== null && (
            <div className="border rounded-lg overflow-hidden">
              <img
                src={previewImageUrl}
                alt={t("deck.preview")}
                className="w-full"
                style={{
                  WebkitTouchCallout: "default",
                  WebkitUserSelect: "auto",
                  userSelect: "auto",
                }}
              />
            </div>
          )}

          {/* Debug Canvas - Hidden */}
          {showDebug && (
            <>
              <div className="border rounded-lg overflow-hidden bg-gray-100 p-2">
                <p className="text-xs text-gray-600 mb-1">検出されたデッキ領域:</p>
                <canvas ref={debugCanvasRef} className="w-full" style={{ maxHeight: "400px", objectFit: "contain" }} />
              </div>

              {/* OCR Debug Images */}
              {(ocrDebugCanvases.main != null || ocrDebugCanvases.extra != null || ocrDebugCanvases.side != null) && (
                <div className="border rounded-lg bg-gray-100 p-2 space-y-2">
                  <p className="text-xs text-gray-600">OCR対象領域:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {ocrDebugCanvases.main != null && (
                      <div>
                        <p className="text-xs text-gray-500">メインデッキ (元画像):</p>
                        <img src={ocrDebugCanvases.main} alt="Main deck OCR area" className="border" />
                      </div>
                    )}
                    {ocrProcessedCanvases.main != null && (
                      <div>
                        <p className="text-xs text-gray-500">メインデッキ (処理済み):</p>
                        <img src={ocrProcessedCanvases.main} alt="Main deck processed" className="border" />
                      </div>
                    )}
                    {ocrDebugCanvases.extra != null && (
                      <div>
                        <p className="text-xs text-gray-500">エクストラデッキ (元画像):</p>
                        <img src={ocrDebugCanvases.extra} alt="Extra deck OCR area" className="border" />
                      </div>
                    )}
                    {ocrProcessedCanvases.extra != null && (
                      <div>
                        <p className="text-xs text-gray-500">エクストラデッキ (処理済み):</p>
                        <img src={ocrProcessedCanvases.extra} alt="Extra deck processed" className="border" />
                      </div>
                    )}
                    {ocrDebugCanvases.side != null && (
                      <div>
                        <p className="text-xs text-gray-500">サイドデッキ (元画像):</p>
                        <img src={ocrDebugCanvases.side} alt="Side deck OCR area" className="border" />
                      </div>
                    )}
                    {ocrProcessedCanvases.side != null && (
                      <div>
                        <p className="text-xs text-gray-500">サイドデッキ (処理済み):</p>
                        <img src={ocrProcessedCanvases.side} alt="Side deck processed" className="border" />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Analyzing status */}
          {isAnalyzing && (
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-sm text-blue-700">{t("deck.analyzingStructure")}</p>
            </div>
          )}

          {/* Deck Configuration Display */}
          {deckConfig && (
            <div className="bg-blue-50 p-3 rounded-lg space-y-2">
              <p className="text-sm font-medium">{t("deck.detectedConfig")}</p>
              {deckConfig.mainDeck && (
                <p className="text-xs">
                  {t("deck.mainDeckCountWithRows", {
                    count: deckConfig.mainDeck.count,
                    rows: deckConfig.mainDeck.rows,
                  })}
                </p>
              )}
              {deckConfig.extraDeck && (
                <p className="text-xs">
                  {t("deck.extraDeckCountWithRows", {
                    count: deckConfig.extraDeck.count,
                    rows: deckConfig.extraDeck.rows,
                  })}
                </p>
              )}
              {deckConfig.sideDeck && (
                <p className="text-xs">
                  {t("deck.sideDeckCountWithRows", {
                    count: deckConfig.sideDeck.count,
                    rows: deckConfig.sideDeck.rows,
                  })}
                </p>
              )}
            </div>
          )}

          {/* Process Button */}
          <button
            onClick={processImage}
            disabled={!deckConfig || isProcessing || processedCards.length > 0}
            className={`
            w-full py-2 px-4 rounded-lg font-medium transition-colors
            ${
              !deckConfig || isProcessing || processedCards.length > 0
                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                : "bg-blue-500 text-white hover:bg-blue-600"
            }
          `}
          >
            {isProcessing
              ? t("deck.processing")
              : processedCards.length > 0
                ? t("deck.processed")
                : isReplayMode
                  ? t("deck.startReplay")
                  : t("deck.extractCards")}
          </button>

          {/* Processed Cards Count */}
          {processedCards.length > 0 && (
            <p className="text-sm text-green-600">{t("deck.cardsExtracted", { count: processedCards.length })}</p>
          )}
        </div>

        {/* Error Dialog */}
        <ErrorDialog
          open={errorDialog.open}
          onOpenChange={(open) => {
            if (!open) {
              setErrorDialog({ open: false, message: "" })
              onError?.()
            }
          }}
          title={t("common.error")}
          message={errorDialog.message}
          actionLabel={t("common.ok")}
          actionHref="#"
        />
      </Card>

      {/* デバッグパネル - 開発環境のみ */}
      {isDev && showDebug && (
        <DeckImageDebugPanel
          imageDataUrl={imageDataUrl}
          deckConfig={deckConfig}
          extractedCards={debugExtractedCards}
          ocrResults={{
            ...(ocrTexts.main != null && ocrDebugCanvases.main != null && ocrProcessedCanvases.main != null
              ? {
                  main: {
                    text: ocrTexts.main,
                    originalImage: ocrDebugCanvases.main,
                    processedImage: ocrProcessedCanvases.main,
                  },
                }
              : {}),
            ...(ocrTexts.extra != null && ocrDebugCanvases.extra != null && ocrProcessedCanvases.extra != null
              ? {
                  extra: {
                    text: ocrTexts.extra,
                    originalImage: ocrDebugCanvases.extra,
                    processedImage: ocrProcessedCanvases.extra,
                  },
                }
              : {}),
            ...(ocrTexts.side != null && ocrDebugCanvases.side != null && ocrProcessedCanvases.side != null
              ? {
                  side: {
                    text: ocrTexts.side,
                    originalImage: ocrDebugCanvases.side,
                    processedImage: ocrProcessedCanvases.side,
                  },
                }
              : {}),
          }}
        />
      )}
    </div>
  )
}
