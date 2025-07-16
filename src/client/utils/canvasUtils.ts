/**
 * キャンバスの下部の空白を検出してトリミングする
 * @param canvas - 処理対象のキャンバス
 * @param bottomPadding - 下部に追加する余白（デフォルト: 20px）
 * @param backgroundColor - 背景色（デフォルト: 白）
 * @param threshold - 空白判定の閾値（0-255、デフォルト: 250）
 * @returns トリミングされた新しいキャンバス
 */
export function trimBottomWhitespace(
  canvas: HTMLCanvasElement,
  bottomPadding: number = 20,
  backgroundColor: { r: number; g: number; b: number } = { r: 255, g: 255, b: 255 },
  threshold: number = 250,
): HTMLCanvasElement {
  const ctx = canvas.getContext("2d")
  if (!ctx) {
    throw new Error("Canvas context not available")
  }

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const pixels = imageData.data
  const width = canvas.width
  const height = canvas.height

  // 下から上に向かって、コンテンツがある行を探す
  let bottomContentY = height - 1

  for (let y = height - 1; y >= 0; y--) {
    let hasContent = false

    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      const r = pixels[idx]
      const g = pixels[idx + 1]
      const b = pixels[idx + 2]
      const a = pixels[idx + 3]

      // 背景色でないピクセルがあるかチェック
      if (
        a > 0 &&
        (Math.abs(r - backgroundColor.r) > 255 - threshold ||
          Math.abs(g - backgroundColor.g) > 255 - threshold ||
          Math.abs(b - backgroundColor.b) > 255 - threshold)
      ) {
        hasContent = true
        break
      }
    }

    if (hasContent) {
      bottomContentY = y
      break
    }
  }

  // コンテンツが見つからない場合は元のキャンバスを返す
  if (bottomContentY === height - 1) {
    return canvas
  }

  // 新しいキャンバスを作成（コンテンツの高さ + 余白）
  const contentHeight = bottomContentY + 1
  const newCanvas = document.createElement("canvas")
  newCanvas.width = width
  newCanvas.height = contentHeight + bottomPadding // 指定された余白を追加

  const newCtx = newCanvas.getContext("2d")
  if (!newCtx) {
    throw new Error("New canvas context not available")
  }

  // 背景を白で塗りつぶす
  newCtx.fillStyle = "#ffffff"
  newCtx.fillRect(0, 0, newCanvas.width, newCanvas.height)

  // 元の画像をコピー（コンテンツ部分のみ）
  newCtx.drawImage(canvas, 0, 0, width, contentHeight, 0, 0, width, contentHeight)

  return newCanvas
}

/**
 * キャンバスの上部に余白を追加する
 * @param canvas - 処理対象のキャンバス
 * @param topPadding - 上部に追加する余白（デフォルト: 20px）
 * @returns 上部余白が追加された新しいキャンバス
 */
export function addTopPadding(canvas: HTMLCanvasElement, topPadding: number = 20): HTMLCanvasElement {
  const newCanvas = document.createElement("canvas")
  newCanvas.width = canvas.width
  newCanvas.height = canvas.height + topPadding

  const ctx = newCanvas.getContext("2d")
  if (!ctx) {
    throw new Error("Canvas context not available")
  }

  // 背景を白で塗りつぶす
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, newCanvas.width, newCanvas.height)

  // 元の画像を上部余白分下にコピー
  ctx.drawImage(canvas, 0, topPadding)

  return newCanvas
}

/**
 * スクリーンショット用の前処理を行う
 * @param canvas - html2canvasで生成されたキャンバス
 * @param topPadding - 上部に追加する余白（デフォルト: 20px）
 * @param bottomPadding - 下部に追加する余白（デフォルト: 20px）
 * @returns 前処理済みのキャンバス
 */
export function preprocessScreenshot(
  canvas: HTMLCanvasElement,
  topPadding: number = 20,
  bottomPadding: number = 20,
): HTMLCanvasElement {
  // まず上部余白を追加
  const canvasWithTopPadding = addTopPadding(canvas, topPadding)
  // 次に下の余白をトリミングして、指定された余白を追加
  return trimBottomWhitespace(canvasWithTopPadding, bottomPadding)
}
