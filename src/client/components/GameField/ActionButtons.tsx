import { useState } from "react"
import { useTranslation } from "react-i18next"
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
import { useScreenshot } from "@client/contexts/ScreenshotContext"
import { SCREENSHOT_SCREEN_WIDTH } from "@/client/constants/screen"
import { captureGameBoard, canvasToBlob } from "@/client/utils/screenshotUtils"
import { Z_INDEX } from "@/client/constants/zIndex"
import { DELAYS } from "@/client/constants/delays"
import { FILE_SIZE_LIMITS } from "@/client/constants/limits"

type ActionButtonsProps = {
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
  const { t } = useTranslation("ui")
  if (!isVisible) return null

  return (
    <div
      className="fixed inset-0 bg-white flex items-center justify-center screenshot-overlay"
      style={{ pointerEvents: "all", zIndex: Z_INDEX.SCREENSHOT_OVERLAY }}
      data-html2canvas-ignore="true"
    >
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-blue-500" />
        <p className="text-lg font-medium text-gray-700">{t("screenshot.generating")}</p>
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
  const { t } = useTranslation(["common", "game", "ui"])
  const [hoveredButton, setHoveredButton] = useState<"undo" | "redo" | "reset" | null>(null)
  const [isCapturing, setIsCapturing] = useState(false)
  const [screenshotData, setScreenshotData] = useState<{ url: string; fileName: string } | null>(null)
  const { setScreenshotWidth } = useScreenshot()

  const handleScreenshot = async (width: number) => {
    setIsCapturing(true)

    // オーバーレイの表示を待つ
    await new Promise((r) => setTimeout(r, DELAYS.DOM_UPDATE_SHORT))

    // スクリーンショット幅を設定してReactの再レンダリングをトリガー
    setScreenshotWidth(width)

    // Reactの再レンダリングとレイアウトの安定を待つ
    await new Promise((r) => setTimeout(r, DELAYS.DOM_UPDATE_LONG))
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

    // ボード要素取得
    const boardElement = document.querySelector(".game-board") as HTMLElement | null
    if (!boardElement) {
      console.error("ゲームボードが見つかりません")
      setScreenshotWidth(undefined)
      setIsCapturing(false)
      return
    }

    try {
      // ゲームボードをキャプチャ
      const canvas = await captureGameBoard(boardElement, {
        width: width,
        scale: 2,
      })

      // PNG形式でBlobを生成
      const blob = await canvasToBlob(canvas, "image/png", 1.0)

      if (blob) {
        const url = URL.createObjectURL(blob)
        const fileName = `duel-simulator-w${width}-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.png`

        // データURLに変換（10MB以下の場合）
        if (blob.size < FILE_SIZE_LIMITS.MAX_BLOB_SIZE) {
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
          setTimeout(() => URL.revokeObjectURL(url), DELAYS.DOM_UPDATE)
        }
      }
    } catch (error) {
      console.error("スクリーンショットの生成に失敗しました:", error)
    } finally {
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
                <span>{isCapturing ? t("ui:screenshot.generating") : t("ui:screenshot.title")}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleScreenshot(SCREENSHOT_SCREEN_WIDTH.SP)}>
                {t("ui:screenshot.mobile")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleScreenshot(SCREENSHOT_SCREEN_WIDTH.TABLET)}>
                {t("ui:screenshot.tablet")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleScreenshot(SCREENSHOT_SCREEN_WIDTH.PC)}>
                {t("ui:screenshot.pc")}
              </DropdownMenuItem>
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
                <span>{t("common:button.undo")}</span>
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
                <span>{t("common:button.redo")}</span>
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
            <span>{t("common:button.reset")}</span>
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
            <span>
              {t("game:mobile.defensePosition")}
              {mobileDefenseMode ? " ON" : ""}
            </span>
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
            <span>
              {t("game:mobile.faceDown")}
              {mobileFaceDownMode ? " ON" : ""}
            </span>
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
            <span>{mobileStackBottom ? t("game:mobile.stackAtBottom") : t("game:mobile.stackAtTop")}</span>
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
              <DialogTitle>{t("ui:screenshot.title")}</DialogTitle>
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
                          const doc = newWindow.document

                          // タイトルを設定
                          doc.title = screenshotData.fileName

                          // <head> に必要な要素を挿入
                          doc.head.innerHTML = `
                            <meta name="viewport" content="width=device-width, initial-scale=1.0">
                            <style>
                              body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f3f4f6; }
                              img { max-width: 100%; height: auto; }
                              .message { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: #1f2937; color: white; padding: 10px 20px; border-radius: 8px; font-family: system-ui, -apple-system, sans-serif; }
                            </style>
                          `

                          // <body> コンテンツを挿入
                          doc.body.innerHTML = `
                            <div class="message">画像を長押しして保存してください</div>
                            <img src="${screenshotData.url}" alt="Screenshot">
                          `
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
                      ? t("common:dialog.openImage")
                      : t("common:dialog.saveImage")}
                  </Button>
                  <Button variant="secondary" onClick={() => setScreenshotData(null)}>
                    {t("common:button.close")}
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
