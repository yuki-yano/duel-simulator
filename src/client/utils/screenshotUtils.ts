import html2canvas from "html2canvas"
import { preprocessScreenshot } from "./canvasUtils"

export interface ScreenshotOptions {
  width: number
  scale?: number
  imageFormat?: "image/png" | "image/jpeg"
  imageQuality?: number
  topPadding?: number
  bottomPadding?: number
}

/**
 * ラベルの位置を調整（スクリーンショット前の準備）
 * @param boardElement - ゲームボード要素
 */
export function adjustLabelsForScreenshot(boardElement: HTMLElement): void {
  // ラベル(墓地・除外・手札など)を少し上に移動
  const labelSpans = boardElement.querySelectorAll("span")
  labelSpans.forEach((el) => {
    const element = el as HTMLElement
    // top-? クラスが付与されている絶対配置ラベルを対象とする
    if (element.classList.contains("absolute")) {
      const computedTop = parseFloat(getComputedStyle(element).top)
      if (!Number.isNaN(computedTop)) {
        element.style.top = `${computedTop - 6}px`
      } else {
        // fallback: transform
        element.style.transform = `translateY(-6px)`
      }
    }
  })

  // 墓地・除外・フリーゾーンなど bottom-0 ラベルを上へ
  const bottomLabels = boardElement.querySelectorAll("div.absolute.bottom-0")
  bottomLabels.forEach((el) => {
    const element = el as HTMLElement
    element.style.transform = (element.style.transform ?? "") + ` translateY(-6px)`
  })
}

/**
 * ラベルの位置をリセット（スクリーンショット後の復元）
 * @param boardElement - ゲームボード要素
 */
export function resetLabelsAfterScreenshot(boardElement: HTMLElement): void {
  // ラベルのスタイルをリセット
  const labelSpans = boardElement.querySelectorAll("span")
  labelSpans.forEach((el) => {
    const element = el as HTMLElement
    if (element.classList.contains("absolute")) {
      element.style.removeProperty("top")
      element.style.removeProperty("transform")
    }
  })

  // bottom-0 ラベルのスタイルもリセット
  const bottomLabels = boardElement.querySelectorAll("div.absolute.bottom-0")
  bottomLabels.forEach((el) => {
    const element = el as HTMLElement
    element.style.removeProperty("transform")
  })
}

/**
 * ゲームボードをキャプチャして前処理済みのCanvasを返す
 * @param boardElement - ゲームボード要素
 * @param options - スクリーンショットオプション
 * @returns 前処理済みのCanvas
 */
export async function captureGameBoard(
  boardElement: HTMLElement,
  options: ScreenshotOptions,
): Promise<HTMLCanvasElement> {
  const { width, scale = 1, topPadding = 20, bottomPadding = 20 } = options

  // board の幅を一時的に撮影解像度に合わせる
  const originalBoardWidth = boardElement.style.width
  const originalBoardMaxWidth = boardElement.style.maxWidth
  boardElement.style.width = `${width}px`
  boardElement.style.maxWidth = `${width}px`

  // 幅変更に伴うレイアウト再計算を待機
  await new Promise((res) => setTimeout(res, 100))

  // ラベルの位置調整
  adjustLabelsForScreenshot(boardElement)

  // レイアウト安定待ち
  await new Promise((r) => setTimeout(r, 100))

  // 高さを自動計算
  const boardHeight = boardElement.scrollHeight

  try {
    // html2canvasでキャプチャ
    const rawCanvas = await html2canvas(boardElement, {
      y: 0,
      height: boardHeight,
      scrollY: -window.scrollY,
      width: width,
      scale: scale,
      useCORS: true,
      allowTaint: false,
      windowWidth: width,
      windowHeight: boardHeight,
      backgroundColor: "#ffffff",
      logging: false,
      ignoreElements: (element) => {
        return (
          element.classList.contains("no-screenshot") ||
          element.classList.contains("screenshot-overlay") ||
          element.getAttribute("data-html2canvas-ignore") === "true" ||
          // Radix UIのダイアログを除外
          element.getAttribute("data-radix-portal") !== null ||
          element.classList.contains("radix-portal") ||
          // 保存中のローディング表示を除外
          element.classList.contains("animate-spin")
        )
      },
    })

    // 上下の余白処理
    return preprocessScreenshot(rawCanvas, topPadding, bottomPadding)
  } finally {
    // 後始末
    boardElement.style.width = originalBoardWidth
    boardElement.style.maxWidth = originalBoardMaxWidth
    resetLabelsAfterScreenshot(boardElement)
  }
}

/**
 * CanvasをBlobに変換
 * @param canvas - 変換対象のCanvas
 * @param format - 画像形式
 * @param quality - 画像品質（0-1）
 * @returns Blob
 */
export function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: "image/png" | "image/jpeg" = "image/png",
  quality: number = 0.9,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        resolve(blob)
      },
      format,
      quality,
    )
  })
}
