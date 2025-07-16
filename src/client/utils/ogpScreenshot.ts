import html2canvas from "html2canvas"
import { OGP_IMAGE, SCREENSHOT_SCREEN_WIDTH } from "@/client/constants/screen"

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

    // board の幅を一時的に撮影解像度に合わせる
    const _originalBoardWidth = boardElement.style.width
    const _originalBoardMaxWidth = boardElement.style.maxWidth
    boardElement.style.width = `${SCREENSHOT_SCREEN_WIDTH.PC}px`
    boardElement.style.maxWidth = `${SCREENSHOT_SCREEN_WIDTH.PC}px`

    // 幅変更に伴うレイアウト再計算を待機
    await new Promise((res) => setTimeout(res, 100))

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

    // レイアウト安定待ち
    await new Promise((r) => setTimeout(r, 100))

    // 高さを自動計算
    const boardHeight = boardElement.scrollHeight

    // 1. まずゲームボードを通常のスクリーンショットサイズでキャプチャ
    const boardCanvas = await html2canvas(boardElement, {
      y: -20,
      height: boardHeight + 20,
      scrollY: -window.scrollY - 20,
      width: SCREENSHOT_SCREEN_WIDTH.PC,
      scale: 1, // OGPにはretina不要
      useCORS: true,
      allowTaint: false,
      windowWidth: SCREENSHOT_SCREEN_WIDTH.PC,
      windowHeight: boardHeight,
      backgroundColor: "#ffffff",
      logging: false,
      ignoreElements: (element) => {
        // モーダルやオーバーレイを除外
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

    // 2. OGPサイズのキャンバスを作成
    const ogpCanvas = document.createElement("canvas")
    ogpCanvas.width = OGP_IMAGE.WIDTH
    ogpCanvas.height = OGP_IMAGE.HEIGHT
    const ctx = ogpCanvas.getContext("2d")

    if (!ctx) {
      throw new Error("Canvas context取得失敗")
    }

    // 3. 背景を白で塗りつぶす
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, OGP_IMAGE.WIDTH, OGP_IMAGE.HEIGHT)

    // 4. ゲームボードを中央に配置（縦方向も中央寄せ）
    // キャプチャした画像がOGPサイズに収まるようにスケーリング
    const scaleX = OGP_IMAGE.WIDTH / boardCanvas.width
    const scaleY = OGP_IMAGE.HEIGHT / boardCanvas.height
    const scaleFactor = Math.min(scaleX, scaleY, 1) // 拡大はしない、必要に応じて縮小のみ
    
    const scaledWidth = boardCanvas.width * scaleFactor
    const scaledHeight = boardCanvas.height * scaleFactor
    const x = (OGP_IMAGE.WIDTH - scaledWidth) / 2
    const y = (OGP_IMAGE.HEIGHT - scaledHeight) / 2

    // デバッグ情報
    console.log("OGP画像生成:", {
      boardCanvasSize: { width: boardCanvas.width, height: boardCanvas.height },
      scaleFactor,
      scaledSize: { width: scaledWidth, height: scaledHeight },
      position: { x, y }
    })

    ctx.drawImage(boardCanvas, x, y, scaledWidth, scaledHeight)

    // 5. WebP形式でBlobを生成
    return new Promise((resolve) => {
      ogpCanvas.toBlob(
        (blob) => {
          resolve(blob)
        },
        "image/webp",
        0.9
      )
    })
  } catch (error) {
    console.error("OGP画像の生成に失敗しました:", error)
    return null
  } finally {
    // 後始末
    const boardElement = document.querySelector(".game-board") as HTMLElement | null
    if (boardElement) {
      // boardElement の幅を戻す
      boardElement.style.removeProperty("width")
      boardElement.style.removeProperty("maxWidth")

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
    setScreenshotWidth(undefined)
  }
}