import { createWorker, PSM, type Worker } from "tesseract.js"

// レイアウト比率定数
export const DECK_LAYOUT_RATIOS = {
  leftTextX: 0.06, // 左側テキスト（e.g. メインデッキ）のX位置 - 少し左に調整
  mainDeckTextY: 0.04, // メインデッキテキストのY位置
  extraDeckTextY: 0.13, // エクストラデッキテキストのY位置
  sideDeckTextY: 0.212, // サイドデッキテキストのY位置
  textWidth: 0.18, // OCR領域の幅 - 拡大して数字全体を捕捉
  textHeight: 0.05, // OCR領域の高さ - 少し拡大
  cardsStartX: 0.22, // カード領域開始X位置
  cardsStartY: 0.02, // カード領域開始Y位置
  cardSpacing: 0.075, // カード間の間隔
  extraSideOffsetY: 0.112, // エクストラ・サイドデッキのYオフセット
}

// デッキ構成情報
export interface DeckSection {
  type: "main" | "extra" | "side"
  count: number
  startX: number
  startY: number
  endX: number
  endY: number
}

// OCRワーカーの管理
let sharedWorker: Worker | null = null
let currentWorkerLanguage: string | null = null

// Tesseract workerの初期化
export async function initializeOCRWorker(language: string): Promise<Worker> {
  // 言語が変更されていない場合は既存のworkerを再利用
  if (sharedWorker && currentWorkerLanguage === language) {
    console.log("Reusing existing OCR worker for language:", language)
    return sharedWorker
  }

  // 既存のworkerがある場合は終了
  if (sharedWorker) {
    console.log("Terminating existing OCR worker")
    await sharedWorker.terminate()
    sharedWorker = null
  }

  // 現在の言語設定に基づいてOCR言語と文字ホワイトリストを決定
  let ocrLanguages: string[]
  let charWhitelist: string

  switch (language) {
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

  sharedWorker = worker
  currentWorkerLanguage = language
  return sharedWorker
}

// OCRワーカーのクリーンアップ
export async function cleanupOCRWorker(): Promise<void> {
  if (sharedWorker) {
    await sharedWorker.terminate()
    sharedWorker = null
    currentWorkerLanguage = null
  }
}

// 領域からテキストを抽出する関数
export async function extractTextFromRegion(
  img: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  language: string,
  debugKey?: "main" | "extra" | "side",
): Promise<string> {
  console.log(`extractTextFromRegion ${debugKey}:`, {
    imgSize: { width: img.width, height: img.height },
    region: { x, y, width, height },
  })

  // 最小サイズの確保
  const minRegionWidth = 50
  const minRegionHeight = 20
  width = Math.max(width, minRegionWidth)
  height = Math.max(height, minRegionHeight)

  const regionCanvas = document.createElement("canvas")
  const scale = 6 // OCR精度向上のため拡大
  regionCanvas.width = width * scale
  regionCanvas.height = height * scale

  const ctx = regionCanvas.getContext("2d")
  if (!ctx) return ""

  // 座標のバリデーション
  const validX = Math.max(0, Math.min(x, img.width - 1))
  const validY = Math.max(0, Math.min(y, img.height - 1))
  const validWidth = Math.min(width, img.width - validX)
  const validHeight = Math.min(height, img.height - validY)

  console.log(`Drawing region ${debugKey}:`, {
    original: { x, y, width, height },
    validated: { x: validX, y: validY, width: validWidth, height: validHeight },
    canvas: { width: regionCanvas.width, height: regionCanvas.height },
  })

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(img, validX, validY, validWidth, validHeight, 0, 0, regionCanvas.width, regionCanvas.height)

  // 画像前処理（二値化）
  const imageData = ctx.getImageData(0, 0, regionCanvas.width, regionCanvas.height)
  const data = imageData.data

  // 背景色を検出
  const colorCounts = new Map<string, number>()
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114)
    const key = Math.round(gray / 10) * 10
    colorCounts.set(key.toString(), (colorCounts.get(key.toString()) ?? 0) + 1)
  }

  let bgColor = 255
  let maxCount = 0
  for (const [color, count] of colorCounts) {
    if (count > maxCount) {
      maxCount = count
      bgColor = parseInt(color)
    }
  }

  const threshold = bgColor > 128 ? bgColor - 40 : bgColor + 40

  // 二値化処理
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
    let value: number
    if (bgColor < 128) {
      value = gray > threshold ? 255 : 0
    } else {
      value = gray < threshold ? 0 : 255
    }
    data[i] = value
    data[i + 1] = value
    data[i + 2] = value
  }

  ctx.putImageData(imageData, 0, 0)

  // OCR実行
  const worker = await initializeOCRWorker(language)
  const result = await worker.recognize(regionCanvas)

  // デバッグログ（開発環境のみ）
  if (import.meta.env.DEV && debugKey) {
    console.log(`OCR result for ${debugKey}:`, {
      text: result.data.text,
      confidence: result.data.confidence,
      region: { x, y, width, height },
      canvasSize: { width: regionCanvas.width, height: regionCanvas.height },
      scale: scale,
    })
  }

  return result.data.text
}

// デッキ構造を解析する関数
export async function analyzeDeckStructure(imageUrl: string, language: string): Promise<DeckSection[]> {
  return new Promise((resolve, reject) => {
    const img = new Image()

    // DataURLの検証
    if (!imageUrl || !imageUrl.startsWith("data:")) {
      console.error("Invalid image URL format:", imageUrl?.substring(0, 100))
      reject(new Error("不正な画像URL形式です"))
      return
    }

    img.onerror = () => {
      console.error("Failed to load image for OCR")
      reject(new Error("画像の読み込みに失敗しました"))
    }

    img.onload = async () => {
      // 画像サイズの検証
      if (img.width === 0 || img.height === 0) {
        console.error("Invalid image dimensions:", img.width, img.height)
        resolve([])
        return
      }

      const deckSections: DeckSection[] = []

      // テキスト位置の計算
      // 最小幅を確保（OCRエラー防止）
      const minWidth = 100
      const textX = Math.max(img.width * DECK_LAYOUT_RATIOS.leftTextX, 50)
      const textWidth = Math.max(img.width * DECK_LAYOUT_RATIOS.textWidth, minWidth)
      // textHeightは画像の幅を基準にする（カードと同じアスペクト比を保つため）
      const textHeight = Math.max(img.width * DECK_LAYOUT_RATIOS.textHeight, 30)

      console.log("Image dimensions:", { width: img.width, height: img.height })
      console.log("Text region calculation:", { textX, textWidth, textHeight })

      // メインデッキの枚数を検出
      const mainDeckY = img.width * DECK_LAYOUT_RATIOS.mainDeckTextY
      let mainDeckText = await extractTextFromRegion(img, textX, mainDeckY, textWidth, textHeight, language, "main")

      // 再試行（位置を微調整）
      if (!mainDeckText.match(/\d+/)) {
        mainDeckText = await extractTextFromRegion(
          img,
          textX - img.width * 0.02,
          mainDeckY - img.width * 0.01,
          textWidth + img.width * 0.04,
          textHeight + img.width * 0.01,
          language,
          "main",
        )
      }

      // 枚数を抽出
      let mainDeckMatch = mainDeckText.match(/:\s*(\d+)/)
      if (!mainDeckMatch) {
        mainDeckMatch = mainDeckText.match(/(\d+)\s*(?:枚|cards?|장|개)/i)
      }

      const mainDeckCount = mainDeckMatch ? parseInt(mainDeckMatch[1]) : 0

      if (mainDeckCount > 0) {
        const cardsPerRow = 10
        const rows = Math.ceil(mainDeckCount / cardsPerRow)
        deckSections.push({
          type: "main",
          count: mainDeckCount,
          startX: img.width * DECK_LAYOUT_RATIOS.cardsStartX,
          startY: img.width * DECK_LAYOUT_RATIOS.cardsStartY,
          endX:
            img.width *
            (DECK_LAYOUT_RATIOS.cardsStartX + DECK_LAYOUT_RATIOS.cardSpacing * Math.min(mainDeckCount, cardsPerRow)),
          endY: img.width * (DECK_LAYOUT_RATIOS.cardsStartY + DECK_LAYOUT_RATIOS.cardSpacing * rows),
        })
      }

      // エクストラデッキの枚数を検出
      const extraDeckY = img.width * DECK_LAYOUT_RATIOS.extraDeckTextY
      const extraDeckText = await extractTextFromRegion(
        img,
        textX,
        extraDeckY,
        textWidth,
        textHeight,
        language,
        "extra",
      )
      let extraDeckMatch = extraDeckText.match(/:\s*(\d+)/)
      if (!extraDeckMatch) {
        extraDeckMatch = extraDeckText.match(/(\d+)\s*(?:枚|cards?|장|개)/i)
      }
      const extraDeckCount = extraDeckMatch ? parseInt(extraDeckMatch[1]) : 0

      if (extraDeckCount > 0) {
        deckSections.push({
          type: "extra",
          count: extraDeckCount,
          startX: img.width * DECK_LAYOUT_RATIOS.cardsStartX,
          startY: img.width * (DECK_LAYOUT_RATIOS.cardsStartY + DECK_LAYOUT_RATIOS.extraSideOffsetY),
          endX: img.width * (DECK_LAYOUT_RATIOS.cardsStartX + DECK_LAYOUT_RATIOS.cardSpacing * extraDeckCount),
          endY:
            img.width *
            (DECK_LAYOUT_RATIOS.cardsStartY + DECK_LAYOUT_RATIOS.extraSideOffsetY + DECK_LAYOUT_RATIOS.cardSpacing),
        })
      }

      // サイドデッキの枚数を検出
      const sideDeckY = img.width * DECK_LAYOUT_RATIOS.sideDeckTextY
      const sideDeckText = await extractTextFromRegion(img, textX, sideDeckY, textWidth, textHeight, language, "side")
      let sideDeckMatch = sideDeckText.match(/:\s*(\d+)/)
      if (!sideDeckMatch) {
        sideDeckMatch = sideDeckText.match(/(\d+)\s*(?:枚|cards?|장|개)/i)
      }
      const sideDeckCount = sideDeckMatch ? parseInt(sideDeckMatch[1]) : 0

      if (sideDeckCount > 0) {
        deckSections.push({
          type: "side",
          count: sideDeckCount,
          startX: img.width * DECK_LAYOUT_RATIOS.cardsStartX,
          startY: img.width * (DECK_LAYOUT_RATIOS.cardsStartY + DECK_LAYOUT_RATIOS.extraSideOffsetY * 2),
          endX: img.width * (DECK_LAYOUT_RATIOS.cardsStartX + DECK_LAYOUT_RATIOS.cardSpacing * sideDeckCount),
          endY:
            img.width *
            (DECK_LAYOUT_RATIOS.cardsStartY + DECK_LAYOUT_RATIOS.extraSideOffsetY * 2 + DECK_LAYOUT_RATIOS.cardSpacing),
        })
      }

      console.log("Final deckSections:", deckSections)
      resolve(deckSections)
    }

    // 画像のソースを設定
    console.log("Setting image src, URL length:", imageUrl.length)
    img.src = imageUrl
  })
}

// カード画像を抽出する関数
export function extractCardImages(
  imageUrl: string,
  deckSections: DeckSection[],
): Promise<Array<{ imageUrl: string; type: "main" | "extra" | "side"; index: number }>> {
  return new Promise((resolve, reject) => {
    const img = new Image()

    img.onerror = () => {
      console.error("Failed to load image for card extraction")
      reject(new Error("画像の読み込みに失敗しました"))
    }

    img.onload = () => {
      // 画像サイズの検証
      if (img.width === 0 || img.height === 0) {
        console.error("Invalid image dimensions for card extraction:", img.width, img.height)
        resolve([])
        return
      }

      const cards: Array<{ imageUrl: string; type: "main" | "extra" | "side"; index: number }> = []
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        resolve([])
        return
      }

      // カードサイズ（59x86のアスペクト比）
      const cardWidth = img.width * 0.06
      const cardHeight = cardWidth * (86 / 59)
      const horizontalSpacing = img.width * 0.075
      const verticalSpacing = img.width * 0.075 // 垂直方向も幅基準で統一

      for (const section of deckSections) {
        const cardsPerRow = 10
        for (let i = 0; i < section.count; i++) {
          const col = i % cardsPerRow
          const row = Math.floor(i / cardsPerRow)
          const x = section.startX + col * horizontalSpacing
          const y = section.startY + row * verticalSpacing

          // カード画像を切り出し
          canvas.width = cardWidth
          canvas.height = cardHeight
          ctx.drawImage(img, x, y, cardWidth, cardHeight, 0, 0, cardWidth, cardHeight)

          cards.push({
            imageUrl: canvas.toDataURL("image/png"),
            type: section.type,
            index: i,
          })
        }
      }

      resolve(cards)
    }
    img.src = imageUrl
  })
}
