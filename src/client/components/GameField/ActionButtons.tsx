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
  const [screenshotData, setScreenshotData] = useState<{ url: string; fileName: string } | null>(null)

  const handleScreenshot = async (width: number) => {
    setIsCapturing(true)

    // 元のスタイルを保存するためのMap
    let originalStyles: Map<HTMLElement, { height: string; marginTop: string }> | null = null

    // --- Viewport 擬装でレイアウト再計算 --------------------
    const originalWidth = window.innerWidth
    const originalHeight = window.innerHeight

    // より強力なアプローチ：viewport meta tagを一時的に変更
    const viewportMeta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement
    const originalViewport = viewportMeta?.content || ""

    // 元のmatchMediaを保存
    const originalMatchMedia = window.matchMedia

    const overrideViewport = () => {
      try {
        // 1. viewport metaタグを変更
        if (viewportMeta !== null) {
          viewportMeta.content = `width=${width}, initial-scale=1.0, maximum-scale=1.0, user-scalable=no`
        }

        // 2. window.innerWidth/Heightを上書き（getter/setterを定義）
        Object.defineProperty(window, "innerWidth", {
          configurable: true,
          get: () => width,
          set: () => {},
        })
        Object.defineProperty(window, "innerHeight", {
          configurable: true,
          get: () => originalHeight,
          set: () => {},
        })

        // 3. document.documentElementのクライアント幅も変更
        Object.defineProperty(document.documentElement, "clientWidth", {
          configurable: true,
          get: () => width,
        })
        Object.defineProperty(document.documentElement, "clientHeight", {
          configurable: true,
          get: () => document.documentElement.scrollHeight,
        })

        // 4. window.matchMediaもオーバーライド
        window.matchMedia = (query: string) => {
          // メディアクエリを解析して適切な結果を返す
          const matches = (() => {
            if (query.includes("min-width: 1024px")) return width >= 1024
            if (query.includes("min-width: 768px")) return width >= 768
            if (query.includes("min-width: 640px")) return width >= 640
            return originalMatchMedia(query).matches
          })()

          return {
            matches,
            media: query,
            onchange: null,
            addEventListener: () => {},
            removeEventListener: () => {},
            addListener: () => {},
            removeListener: () => {},
            dispatchEvent: () => true,
          }
        }

        // 5. 複数のイベントを発火
        window.dispatchEvent(new Event("resize"))
        window.dispatchEvent(new Event("orientationchange"))
      } catch (e) {
        console.warn("Failed to override viewport:", e)
      }
    }

    const restoreViewport = () => {
      try {
        if (viewportMeta !== null) {
          viewportMeta.content = originalViewport
        }
        Object.defineProperty(window, "innerWidth", { configurable: true, value: originalWidth })
        Object.defineProperty(window, "innerHeight", { configurable: true, value: originalHeight })
        Object.defineProperty(document.documentElement, "clientWidth", {
          configurable: true,
          value: document.documentElement.scrollWidth,
        })
        Object.defineProperty(document.documentElement, "clientHeight", {
          configurable: true,
          value: document.documentElement.scrollHeight,
        })
        // matchMediaを元に戻す
        window.matchMedia = originalMatchMedia
        window.dispatchEvent(new Event("resize"))
        window.dispatchEvent(new Event("orientationchange"))
      } catch {
        // ignore
      }
    }

    // 1. viewport を上書き
    overrideViewport()

    // 2. React & ResizeObserver が反映するまで待機
    await new Promise((r) => setTimeout(r, 100))

    // 3. ボード要素取得（再計算後）
    const boardElement = document.querySelector(".game-board") as HTMLElement | null
    if (!boardElement) {
      console.error("ゲームボードが見つかりません")
      restoreViewport()
      setIsCapturing(false)
      return
    }

    // boardElement 内の動的要素Readiness待ち
    // 追加のレイアウト安定待機（2フレーム）
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

    // board の幅を一時的に撮影解像度に合わせる
    const originalBoardWidth = boardElement.style.width
    const originalBoardMaxWidth = boardElement.style.maxWidth
    boardElement.style.width = `${width}px`
    boardElement.style.maxWidth = `${width}px`

    // 幅変更に伴うレイアウト再計算を待機（ResizeObserver + React 再レンダリング）
    await new Promise((res) => setTimeout(res, 300))

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

    // 墓地・除外ゾーンの高さを強制的に再計算
    // PCからスマホサイズへの変換時の問題を修正
    const graveZones = boardElement.querySelectorAll<HTMLElement>(".grave-zone")
    const isSmallScreen = width < 640
    const isMediumScreen = width >= 640 && width < 768
    const isOriginalLarge = originalWidth >= 1024

    // 元のスタイルを保存
    originalStyles = new Map<HTMLElement, { height: string; marginTop: string }>()

    // 自分側の墓地・除外ゾーンのマージントップを調整
    const playerGraveContainers = boardElement.querySelectorAll<HTMLElement>(".player-grave-container > div, .side-free-zone-self")
    playerGraveContainers.forEach((container) => {
      originalStyles.set(container, {
        height: container.style.height || "",
        marginTop: container.style.marginTop || ""
      })

      // 元がPCサイズで、ターゲットがタブレット以上の場合はマージン調整を行わない
      if (isOriginalLarge && width >= 768) {
        // マージンを変更しない（現在の値を維持）
      } else {
        if (isSmallScreen) {
          container.style.marginTop = "-58px"
        } else if (isMediumScreen) {
          container.style.marginTop = "-84px"
        } else {
          container.style.marginTop = "-116px"
        }
      }
    })

    graveZones.forEach((zone) => {
      originalStyles.set(zone, {
        height: zone.style.height || "",
        marginTop: zone.style.marginTop || ""
      })

      // 自分側か相手側かを判定
      const isSelfZone = zone.classList.contains("grave-zone-self") || 
                        zone.classList.contains("banish-zone-self") ||
                        zone.classList.contains("side-free-zone-self")

      if (isSelfZone) {
        // 自分側: 3行分の高さ
        if (isSmallScreen) {
          zone.style.height = "174px" // h-14 * 3 + gap
        } else if (isMediumScreen) {
          zone.style.height = "252px" // h-20 * 3 + gap
        } else {
          zone.style.height = "348px" // h-24 * 3 + gap
        }
      } else {
        // 相手側: 2行分の高さ
        if (isSmallScreen) {
          zone.style.height = "116px" // h-14 * 2 + gap
        } else if (isMediumScreen) {
          zone.style.height = "168px" // h-20 * 2 + gap  
        } else {
          zone.style.height = "200px" // h-24 * 2 + gap
        }
      }
    })

    // 墓地・除外ゾーンの高さ変更を反映させるため追加の待機
    await new Promise((r) => setTimeout(r, 100))

    // 高さを自動計算（デッキゾーンまで含める）
    const height = boardElement.scrollHeight

    try {
      // html2canvasでキャプチャ（実際のDOMを直接キャプチャ）
      const canvas = await html2canvas(boardElement, {
        width: width,
        height: height,
        scale: 2, // 高解像度でキャプチャ
        useCORS: true, // クロスオリジン画像の対応
        allowTaint: false, // tainted canvasを防ぐ
        windowWidth: width,
        windowHeight: height,
        backgroundColor: "#ffffff", // 背景を白に設定
        logging: false, // デバッグログを無効化
        ignoreElements: (element) => {
          // スクリーンショットから除外する要素
          return (
            element.classList.contains("no-screenshot") || element.getAttribute("data-html2canvas-ignore") === "true"
          )
        },
      })

      // モーダル表示でダウンロード処理
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
    } catch (error) {
      console.error("スクリーンショットの生成に失敗しました:", error)
    } finally {
      // 後始末
      // boardElement の幅を戻す
      boardElement.style.width = originalBoardWidth
      boardElement.style.maxWidth = originalBoardMaxWidth

      // 墓地・除外ゾーンのスタイルをリセット（元のスタイルに戻す）
      if (originalStyles !== null) {
        originalStyles.forEach((style, element) => {
          if (style.height) {
            element.style.height = style.height
          } else {
            element.style.removeProperty("height")
          }
          if (style.marginTop) {
            element.style.marginTop = style.marginTop
          } else {
            element.style.removeProperty("margin-top")
          }
        })
      }

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

      restoreViewport()
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
            <DropdownMenuItem onClick={() => handleScreenshot(640)}>横幅 640px (モバイル)</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleScreenshot(768)}>横幅 768px (タブレット)</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleScreenshot(1024)}>横幅 1024px (PC)</DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                // 現在のサイズでキャプチャ
                const boardElement = document.querySelector(".game-board") as HTMLElement
                if (boardElement !== null) {
                  void handleScreenshot(boardElement.offsetWidth)
                }
              }}
            >
              現在の横幅
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
                      // iOS以外は通常のダウンロード
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
  )
}
