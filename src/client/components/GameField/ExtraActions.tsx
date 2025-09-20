import { useTranslation } from "react-i18next"
import { MoreHorizontal, Shuffle, Layers2, PlusCircle, ArrowUpDown } from "lucide-react"

import { cn } from "@client/lib/utils"

import type { GameFieldController } from "./hooks/useGameFieldController"

type ExtraActionsProps = {
  controller: GameFieldController
}

export function ExtraActions({ controller }: ExtraActionsProps) {
  const { t } = useTranslation(["game"])
  const {
    isExtraActionsOpen,
    setIsExtraActionsOpen,
    handleShuffleDeck,
    handleDraw5Cards,
    handleGenerateToken,
    preventSameZoneReorder,
    setPreventSameZoneReorder,
    isDeckLoaded,
    isPlaying,
  } = controller

  return (
    <>
      <div className="flex items-center justify-start gap-2 mb-1" data-html2canvas-ignore="true">
        <button
          onClick={() => setIsExtraActionsOpen(!isExtraActionsOpen)}
          className={cn(
            "flex items-center gap-1 px-3 py-1.5 rounded-md transition-colors text-xs sm:text-sm font-medium",
            isExtraActionsOpen
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/90",
          )}
          aria-label={isExtraActionsOpen ? "Hide extra actions" : "Show extra actions"}
        >
          <MoreHorizontal className="w-4 h-4" />
          <span>{t("game:field.otherOperations")}</span>
        </button>
      </div>

      {isExtraActionsOpen && (
        <div className="flex flex-wrap items-center justify-start gap-2 mb-1" data-html2canvas-ignore="true">
          <button
            onClick={handleShuffleDeck}
            disabled={!isDeckLoaded || isPlaying}
            className={cn(
              "flex items-center gap-1 px-3 py-1.5 rounded-md transition-colors text-xs sm:text-sm font-medium",
              isDeckLoaded && !isPlaying
                ? "bg-secondary text-secondary-foreground hover:bg-secondary/90"
                : "bg-muted text-muted-foreground cursor-not-allowed",
            )}
            aria-label="Shuffle deck"
          >
            <Shuffle className="w-4 h-4" />
            <span>{t("game:field.shuffle")}</span>
          </button>
          <button
            onClick={handleDraw5Cards}
            disabled={!isDeckLoaded || isPlaying}
            className={cn(
              "flex items-center gap-1 px-3 py-1.5 rounded-md transition-colors text-xs sm:text-sm font-medium",
              isDeckLoaded && !isPlaying
                ? "bg-secondary text-secondary-foreground hover:bg-secondary/90"
                : "bg-muted text-muted-foreground cursor-not-allowed",
            )}
            aria-label="Random 5 draw"
          >
            <Layers2 className="w-4 h-4" />
            <span>{t("game:field.fiveDraw")}</span>
          </button>
          <button
            onClick={handleGenerateToken}
            disabled={!isDeckLoaded || isPlaying}
            className={cn(
              "flex items-center gap-1 px-3 py-1.5 rounded-md transition-colors text-xs sm:text-sm font-medium",
              isDeckLoaded && !isPlaying
                ? "bg-secondary text-secondary-foreground hover:bg-secondary/90"
                : "bg-muted text-muted-foreground cursor-not-allowed",
            )}
            aria-label="Generate token"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{t("game:field.generateToken")}</span>
          </button>
          <button
            onClick={() => setPreventSameZoneReorder(!preventSameZoneReorder)}
            disabled={!isDeckLoaded || isPlaying}
            className={cn(
              "flex items-center gap-1 px-3 py-1.5 rounded-md transition-colors text-xs sm:text-sm font-medium",
              preventSameZoneReorder
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : isDeckLoaded && !isPlaying
                  ? "bg-secondary text-secondary-foreground hover:bg-secondary/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed",
            )}
            aria-label="Toggle zone reordering"
          >
            <ArrowUpDown className="w-4 h-4" />
            <span>{!preventSameZoneReorder ? t("game:field.reorderDisable") : t("game:field.reorderEnable")}</span>
          </button>
        </div>
      )}
    </>
  )
}
