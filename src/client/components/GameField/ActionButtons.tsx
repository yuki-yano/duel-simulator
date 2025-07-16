import { useState } from "react"
import { cn } from "@client/lib/utils"
import { Undo2, Redo2, RotateCcw, Shield, EyeOff, Layers, Camera } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@client/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@client/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@client/components/ui/dialog"
import { Button } from "@client/components/ui/button"
import html2canvas from "html2canvas"
import { useScreenshot } from "@client/contexts/ScreenshotContext"
import { SCREENSHOT_SCREEN_WIDTH } from "@/client/constants/screen"

interface ActionButtonsProps {
  // Undo/Redo state
  canUndo: boolean
  canRedo: boolean
  undoDescription: string | null
  redoDescription: string | null
  onUndo: () => void
  onRedo: () => void

  // Reset state
  isDeckLoaded: boolean
  hasInitialState: boolean
  onReset: () => void

  // Playback state
  isPlaying: boolean
  isPaused: boolean
  currentReplayIndex: number | null

  // Mobile mode toggles
  mobileDefenseMode: boolean
  mobileFaceDownMode: boolean
  mobileStackBottom: boolean
  onToggleDefenseMode: () => void
  onToggleFaceDownMode: () => void
  onToggleStackBottom: () => void

  // Touch device detection
  isTouchDevice: boolean
}

// スクリーンショット用のローディングオーバーレイコンポーネント
function ScreenshotOverlay({ isVisible }: { isVisible: boolean }) {
  if (!isVisible) return null

  return (
    <div
      className="fixed inset-0 bg-white z-[19999] flex items-center justify-center screenshot-overlay"
      style={{ pointerEvents: "all" }}
      data-html2canvas-ignore="true"
    >
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-blue-500" />
        <p className="text-lg font-medium text-gray-700">スクリーンショットを生成中...</p>
      </div>
    </div>
  )
}

export function ActionButtons({
  canUndo,
  canRedo,
  undoDescription,
  redoDescription,
  onUndo,
  onRedo,
  isDeckLoaded,
  hasInitialState,
  onReset,
  isPlaying,
  isPaused,
  currentReplayIndex,
  mobileDefenseMode,
  mobileFaceDownMode,
  mobileStackBottom,
  onToggleDefenseMode,
  onToggleFaceDownMode,
  onToggleStackBottom,
  isTouchDevice,
}: ActionButtonsProps) {
  const [hoveredButton, setHoveredButton] = useState<"undo" | "redo" | "reset" | null>(null)
  const [isCapturing, setIsCapturing] = useState(false)
  const [screenshotData, setScreenshotData] = useState<{ url: string; fileName: string } | null>(null)
  const { setScreenshotWidth } = useScreenshot()

  const handleScreenshot = async (width: number) => {
    setIsCapturing(true)

    // オーバーレイの表示を待つ
    await new Promise((r) => setTimeout(r, 50))

    // スクリーンショット幅を設定してReactの再レンダリングをトリガー
    setScreenshotWidth(width)

    // Reactの再レンダリングとレイアウトの安定を待つ
    await new Promise((r) => setTimeout(r, 150))
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

    // ボード要素取得
    const boardElement = document.querySelector(".game-board") as HTMLElement | null
    if (!boardElement) {
      console.error("ゲームボードが見つかりません")
      setScreenshotWidth(undefined)
      setIsCapturing(false)
      return
    }

    // board の幅を一時的に撮影解像度に合わせる
    const originalBoardWidth = boardElement.style.width
    const originalBoardMaxWidth = boardElement.style.maxWidth
    boardElement.style.width = `${width}px`
    boardElement.style.maxWidth = `${width}px`

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

    // 高さを自動計算（デッキゾーンまで含める）
    const height = boardElement.scrollHeight

    try {
      const canvas = await html2canvas(boardElement, {
        y: -20,
        height: height + 20,
        scrollY: -window.scrollY - 20,
        width: width,
        scale: 2,
        useCORS: true,
        allowTaint: false,
        windowWidth: width,
        windowHeight: height,
        backgroundColor: "#ffffff",
        logging: false,
        ignoreElements: (element) => {
          return (
            element.classList.contains("no-screenshot") || 
            element.classList.contains("screenshot-overlay") ||
            element.getAttribute("data-html2canvas-ignore") === "true"
          )
        },
      })

      // 下部の余白をカットする処理
      const ctx = canvas.getContext("2d")
      if (ctx) {
        // 下から上に向かってスキャンして、最後の非白色ピクセルを探す
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData.data
        let bottomY = canvas.height

        // 下から上にスキャン
        outer: for (let y = canvas.height - 1; y >= 0; y--) {
          for (let x = 0; x < canvas.width; x++) {
            const idx = (y * canvas.width + x) * 4
            const r = data[idx]
            const g = data[idx + 1]
            const b = data[idx + 2]
            const a = data[idx + 3]
            
            // 白色でないピクセル（または透明でないピクセル）を見つけたら
            if (a > 0 && (r !== 255 || g !== 255 || b !== 255)) {
              bottomY = y + 1
              break outer
            }
          }
        }

        // 余白を考慮（コンテンツの下に20px程度の余白を残す）
        const finalHeight = Math.min(bottomY + 40, canvas.height) // 40pxの余白

        // 新しいキャンバスを作成して必要な部分だけをコピー
        const trimmedCanvas = document.createElement("canvas")
        trimmedCanvas.width = canvas.width
        trimmedCanvas.height = finalHeight
        const trimmedCtx = trimmedCanvas.getContext("2d")
        
        if (trimmedCtx) {
          // 背景を白で塗りつぶす
          trimmedCtx.fillStyle = "#ffffff"
          trimmedCtx.fillRect(0, 0, trimmedCanvas.width, trimmedCanvas.height)
          
          // 元のキャンバスから必要な部分をコピー
          trimmedCtx.drawImage(canvas, 0, 0, canvas.width, finalHeight, 0, 0, canvas.width, finalHeight)
          
          // トリミングされたキャンバスを使用
          trimmedCanvas.toBlob((blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob)
              const fileName = `duel-simulator-w${width}-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.png`

              // データURLに変換（10MB以下の場合）
              if (blob.size < 10 * 1024 * 1024) {
                const reader = new FileReader()
                reader.onloadend = () => {
                  const dataUrl = reader.result as string
                  setScreenshotData({ url: dataUrl, fileName })
                }
                reader.readAsDataURL(blob)
              } else {
                // 10MB以上の場合は直接ダウンロード
                const a = document.createElement("a")
                a.href = url
                a.download = fileName
                a.click()
                setTimeout(() => URL.revokeObjectURL(url), 100)
              }
            }
          })
        }
      } else {
        // コンテキストが取得できない場合は元のキャンバスを使用
        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob)
            const fileName = `duel-simulator-w${width}-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.png`

            // データURLに変換（10MB以下の場合）
            if (blob.size < 10 * 1024 * 1024) {
              const reader = new FileReader()
              reader.onloadend = () => {
                const dataUrl = reader.result as string
                setScreenshotData({ url: dataUrl, fileName })
              }
              reader.readAsDataURL(blob)
            } else {
              // 10MB以上の場合は直接ダウンロード
              const a = document.createElement("a")
              a.href = url
              a.download = fileName
              a.click()
              setTimeout(() => URL.revokeObjectURL(url), 100)
            }
          }
        })
      }
    } catch (error) {
      console.error("スクリーンショットの生成に失敗しました:", error)
    } finally {
      // 後始末
      // boardElement の幅を戻す
      boardElement.style.width = originalBoardWidth
      boardElement.style.maxWidth = originalBoardMaxWidth

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

      // スクリーンショットモードを解除
      setScreenshotWidth(undefined)
      setIsCapturing(false)
    }
  }

  return (
    <>
      <ScreenshotOverlay isVisible={isCapturing} />
      <div className="mb-2 flex flex-col gap-2" data-html2canvas-ignore="true">
      {/* Screenshot button row */}
      <div className="flex flex-row justify-start gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              disabled={!isDeckLoaded || isCapturing || (isPlaying && !isPaused)}
              className={cn(
                "flex items-center gap-1 px-3 py-1.5 rounded-md transition-colors text-xs sm:text-sm font-medium",
                isDeckLoaded && !isCapturing && (!isPlaying || isPaused)
                  ? "bg-green-500 text-white hover:bg-green-600"
                  : "bg-muted text-muted-foreground cursor-not-allowed",
              )}
              aria-label="Screenshot"
            >
              <Camera className="w-4 h-4" />
              <span>{isCapturing ? "生成中..." : "スクリーンショット"}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => handleScreenshot(SCREENSHOT_SCREEN_WIDTH.SP)}>スマホ</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleScreenshot(SCREENSHOT_SCREEN_WIDTH.TABLET)}>
              タブレット
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleScreenshot(SCREENSHOT_SCREEN_WIDTH.PC)}>PC</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {/* Undo/Redo/Reset button row */}
      <div className="flex flex-row justify-start gap-2">
        <Tooltip
          open={
            undoDescription !== null &&
            canUndo &&
            (!isPlaying || isPaused) &&
            hoveredButton === "undo" &&
            !isTouchDevice
          }
        >
          <TooltipTrigger asChild>
            <button
              onClick={() => onUndo()}
              onMouseEnter={() => setHoveredButton("undo")}
              onMouseLeave={() => setHoveredButton(null)}
              disabled={!canUndo || (isPlaying && !isPaused) || !isDeckLoaded}
              className={cn(
                "flex items-center gap-1 px-3 py-1.5 rounded-md transition-colors text-xs sm:text-sm font-medium",
                canUndo && (!isPlaying || isPaused) && isDeckLoaded
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed",
              )}
              aria-label="Undo"
            >
              <Undo2 className="w-4 h-4" />
              <span>元に戻す</span>
            </button>
          </TooltipTrigger>
          {undoDescription !== null && (
            <TooltipContent>
              <p>{undoDescription}</p>
            </TooltipContent>
          )}
        </Tooltip>
        <Tooltip
          open={
            redoDescription !== null &&
            canRedo &&
            (!isPlaying || isPaused || currentReplayIndex !== null) &&
            hoveredButton === "redo" &&
            !isTouchDevice
          }
        >
          <TooltipTrigger asChild>
            <button
              onClick={() => onRedo()}
              onMouseEnter={() => setHoveredButton("redo")}
              onMouseLeave={() => setHoveredButton(null)}
              disabled={!canRedo || (isPlaying && !isPaused) || !isDeckLoaded}
              className={cn(
                "flex items-center gap-1 px-3 py-1.5 rounded-md transition-colors text-xs sm:text-sm font-medium",
                canRedo && (!isPlaying || isPaused || currentReplayIndex !== null) && isDeckLoaded
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed",
              )}
              aria-label="Redo"
            >
              <Redo2 className="w-4 h-4" />
              <span>やり直す</span>
            </button>
          </TooltipTrigger>
          {redoDescription !== null && (
            <TooltipContent>
              <p>{redoDescription}</p>
            </TooltipContent>
          )}
        </Tooltip>
        <button
          onClick={() => {
            if (hasInitialState) {
              onReset()
            }
          }}
          onMouseEnter={() => setHoveredButton("reset")}
          onMouseLeave={() => setHoveredButton(null)}
          disabled={!isDeckLoaded || !hasInitialState || (isPlaying && !isPaused)}
          className={cn(
            "flex items-center gap-1 px-3 py-1.5 rounded-md transition-colors text-xs sm:text-sm font-medium",
            isDeckLoaded && hasInitialState && (!isPlaying || isPaused)
              ? "bg-amber-500 text-white hover:bg-amber-600"
              : "bg-muted text-muted-foreground cursor-not-allowed",
          )}
          aria-label="Reset"
        >
          <RotateCcw className="w-4 h-4" />
          <span>リセット</span>
        </button>
      </div>

      {/* Mobile quick action buttons - only show on small screens */}
      <div className="flex sm:hidden flex-row justify-start gap-2">
        <button
          onClick={() => onToggleDefenseMode()}
          disabled={!isDeckLoaded || isPlaying}
          className={cn(
            "flex items-center gap-1 px-3 py-1.5 rounded-md transition-colors text-xs font-medium",
            mobileDefenseMode
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : isDeckLoaded && !isPlaying
                ? "bg-secondary text-secondary-foreground hover:bg-secondary/90"
                : "bg-muted text-muted-foreground cursor-not-allowed",
          )}
          aria-label="Toggle defense mode"
        >
          <Shield className="w-4 h-4" />
          <span>守備表示{mobileDefenseMode ? " ON" : ""}</span>
        </button>
        <button
          onClick={() => onToggleFaceDownMode()}
          disabled={!isDeckLoaded || isPlaying}
          className={cn(
            "flex items-center gap-1 px-3 py-1.5 rounded-md transition-colors text-xs font-medium",
            mobileFaceDownMode
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : isDeckLoaded && !isPlaying
                ? "bg-secondary text-secondary-foreground hover:bg-secondary/90"
                : "bg-muted text-muted-foreground cursor-not-allowed",
          )}
          aria-label="Toggle face down mode"
        >
          <EyeOff className="w-4 h-4" />
          <span>裏側表示{mobileFaceDownMode ? " ON" : ""}</span>
        </button>
        <button
          onClick={() => onToggleStackBottom()}
          disabled={!isDeckLoaded || isPlaying}
          className={cn(
            "flex items-center gap-1 px-3 py-1.5 rounded-md transition-colors text-xs font-medium",
            mobileStackBottom
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : isDeckLoaded && !isPlaying
                ? "bg-secondary text-secondary-foreground hover:bg-secondary/90"
                : "bg-muted text-muted-foreground cursor-not-allowed",
          )}
          aria-label="Toggle stack position"
        >
          <Layers className="w-4 h-4" />
          <span>{mobileStackBottom ? "下に重ねる" : "上に重ねる"}</span>
        </button>
      </div>

      {/* Screenshot Dialog */}
      <Dialog
        open={screenshotData !== null}
        onOpenChange={(open) => {
          if (!open) setScreenshotData(null)
        }}
      >
        <DialogContent className="max-w-[90vw] max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>スクリーンショット</DialogTitle>
          </DialogHeader>
          {screenshotData && (
            <>
              <div className="flex justify-center my-4">
                <img
                  src={screenshotData.url}
                  alt="Screenshot"
                  className="max-w-full max-h-[60vh] object-contain rounded shadow-lg"
                />
              </div>
              <DialogFooter className="gap-2">
                <Button
                  variant="default"
                  onClick={() => {
                    // iOSの場合は長押し保存を促す
                    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window)

                    if (isIOS) {
                      // iOSでは画像を新しいタブで開く（長押しで保存可能）
                      const newWindow = window.open()
                      if (newWindow) {
                        newWindow.document.write(`
                          <html>
                            <head>
                              <title>${screenshotData.fileName}</title>
                              <meta name="viewport" content="width=device-width, initial-scale=1.0">
                              <style>
                                body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f3f4f6; }
                                img { max-width: 100%; height: auto; }
                                .message { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: #1f2937; color: white; padding: 10px 20px; border-radius: 8px; font-family: system-ui, -apple-system, sans-serif; }
                              </style>
                            </head>
                            <body>
                              <div class="message">画像を長押しして保存してください</div>
                              <img src="${screenshotData.url}" alt="Screenshot">
                            </body>
                          </html>
                        `)
                        newWindow.document.close()
                      }
                    } else {
                      const a = document.createElement("a")
                      a.href = screenshotData.url
                      a.download = screenshotData.fileName
                      document.body.appendChild(a)
                      a.click()
                      document.body.removeChild(a)
                      setScreenshotData(null)
                    }
                  }}
                >
                  {/iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window)
                    ? "画像を開く"
                    : "画像を保存"}
                </Button>
                <Button variant="secondary" onClick={() => setScreenshotData(null)}>
                  閉じる
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
    </>
  )
}
