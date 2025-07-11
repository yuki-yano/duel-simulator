import { useState } from "react"
import { cn } from "@client/lib/utils"
import { Undo2, Redo2, RotateCcw, Shield, EyeOff } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@client/components/ui/tooltip"

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
  onToggleDefenseMode: () => void
  onToggleFaceDownMode: () => void

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
  onToggleDefenseMode,
  onToggleFaceDownMode,
  isTouchDevice,
}: ActionButtonsProps) {
  const [hoveredButton, setHoveredButton] = useState<"undo" | "redo" | "reset" | null>(null)

  return (
    <div className="mb-2 flex flex-col gap-2">
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
      </div>
    </div>
  )
}