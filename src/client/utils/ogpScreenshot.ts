import { OGP_IMAGE, SCREENSHOT_SCREEN_WIDTH } from "@/client/constants/screen"
import { captureGameBoard, canvasToBlob } from "@/client/utils/screenshotUtils"

export async function generateOGPImage(setScreenshotWidth: (width: number | undefined) => void): Promise<Blob | null> {
  try {
    // スクリーンショット幅を設定してReactの再レンダリングをトリガー
    setScreenshotWidth(SCREENSHOT_SCREEN_WIDTH.PC)

    // Reactの再レンダリングとレイアウトの安定を待つ
    await new Promise((r) => setTimeout(r, 150))
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

    // ボード要素取得
    const boardElement = document.querySelector(".game-board") as HTMLElement | null
    if (!boardElement) {
      console.error("ゲームボードが見つかりません")
      setScreenshotWidth(undefined)
      return null
    }

    // ゲームボードをキャプチャ
    const boardCanvas = await captureGameBoard(boardElement, {
      width: SCREENSHOT_SCREEN_WIDTH.PC,
      scale: 1, // OGPにはretina不要
    })

    // OGPサイズのキャンバスを作成
    const ogpCanvas = document.createElement("canvas")
    ogpCanvas.width = OGP_IMAGE.WIDTH
    ogpCanvas.height = OGP_IMAGE.HEIGHT
    const ctx = ogpCanvas.getContext("2d")

    if (!ctx) {
      throw new Error("Canvas context取得失敗")
    }

    // 背景を白で塗りつぶす
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, OGP_IMAGE.WIDTH, OGP_IMAGE.HEIGHT)

    // ゲームボードを中央に配置（縦方向も中央寄せ）
    // キャプチャした画像がOGPサイズに収まるようにスケーリング
    const scaleX = OGP_IMAGE.WIDTH / boardCanvas.width
    const scaleY = OGP_IMAGE.HEIGHT / boardCanvas.height
    const scaleFactor = Math.min(scaleX, scaleY, 1) // 拡大はしない、必要に応じて縮小のみ

    const scaledWidth = boardCanvas.width * scaleFactor
    const scaledHeight = boardCanvas.height * scaleFactor
    const x = (OGP_IMAGE.WIDTH - scaledWidth) / 2
    const y = (OGP_IMAGE.HEIGHT - scaledHeight) / 2

    ctx.drawImage(boardCanvas, x, y, scaledWidth, scaledHeight)

    // JPEG形式でBlobを生成（品質80%）
    return canvasToBlob(ogpCanvas, "image/jpeg", 0.8)
  } catch (error) {
    console.error("OGP画像の生成に失敗しました:", error)
    return null
  } finally {
    setScreenshotWidth(undefined)
  }
}
