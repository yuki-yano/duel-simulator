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
import html2canvas from "html2canvas"

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

  const handleScreenshot = async (width: number, height: number) => {
    setIsCapturing(true)
    try {
      const boardElement = document.querySelector(".game-board")
      if (!boardElement) {
        console.error("ゲームボードが見つかりません")
        return
      }

      // 動的要素のレンダリングを待つ
      // 1. CSSトランジションとアニメーションの完了を待つ（最大500ms）
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // 2. 画像の読み込み完了を待つ
      const images = boardElement.querySelectorAll("img")
      const imagePromises = Array.from(images).map(img => {
        if (img.complete) return Promise.resolve()
        return new Promise(resolve => {
          img.addEventListener("load", resolve, { once: true })
          img.addEventListener("error", resolve, { once: true })
          // タイムアウト設定（3秒）
          setTimeout(() => resolve(undefined), 3000)
        })
      })
      await Promise.all(imagePromises)

      // 3. フォントの読み込み完了を待つ
      if ("fonts" in document) {
        await document.fonts.ready
      }

      // 4. 手札・デッキ・墓地などの重なりが安定するまで待つ
      // 複数フレーム待機して、レイアウトが完全に安定したことを確認
      for (let i = 0; i < 3; i++) {
        await new Promise(resolve => requestAnimationFrame(resolve))
      }
      
      // 5. 最終的な待機（念のため）
      await new Promise(resolve => setTimeout(resolve, 200))

      // html2canvasでキャプチャ
      const canvas = await html2canvas(boardElement as HTMLElement, {
        width: width,
        height: height,
        scale: 2, // 高解像度でキャプチャ
        useCORS: true, // クロスオリジン画像の対応
        allowTaint: false, // tainted canvasを防ぐ
        windowWidth: width,
        windowHeight: height,
        backgroundColor: "#ffffff", // 背景を白に設定
        logging: false, // デバッグログを無効化
        onclone: (clonedDoc) => {
          // クローンされたドキュメントでの最終調整
          const clonedBoard = clonedDoc.querySelector(".game-board") as HTMLElement
          if (clonedBoard !== null) {
            // 必要に応じてスタイル調整
            clonedBoard.style.width = `${width}px`
            clonedBoard.style.height = `${height}px`
          }
        },
        ignoreElements: (element) => {
          // スクリーンショットから除外する要素
          return (
            element.classList.contains("no-screenshot") ||
            element.getAttribute("data-html2canvas-ignore") === "true"
          )
        },
      })

      // ダウンロード
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob)
          const a = document.createElement("a")
          a.href = url
          a.download = `duel-simulator-${width}x${height}-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.png`
          a.click()
          URL.revokeObjectURL(url)
        }
      })
    } catch (error) {
      console.error("スクリーンショットの生成に失敗しました:", error)
    } finally {
      setIsCapturing(false)
    }
  }

  return (
    <div className="mb-2 flex flex-col gap-2" data-html2canvas-ignore="true">
      {/* Screenshot button row */}
      <div className="flex flex-row justify-start gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              disabled={!isDeckLoaded || isCapturing}
              className={cn(
                "flex items-center gap-1 px-3 py-1.5 rounded-md transition-colors text-xs sm:text-sm font-medium",
                isDeckLoaded && !isCapturing
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
            <DropdownMenuItem onClick={() => handleScreenshot(640, 480)}>
              640×480 (モバイル縦)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleScreenshot(1024, 768)}>
              1024×768 (タブレット)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleScreenshot(1280, 720)}>
              1280×720 (HD)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleScreenshot(1920, 1080)}>
              1920×1080 (Full HD)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              // 現在のサイズでキャプチャ
              const boardElement = document.querySelector(".game-board") as HTMLElement
              if (boardElement !== null) {
                void handleScreenshot(boardElement.offsetWidth, boardElement.offsetHeight)
              }
            }}>
              現在のサイズ
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
    </div>
  )
}
