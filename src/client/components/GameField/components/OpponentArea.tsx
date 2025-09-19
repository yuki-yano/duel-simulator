import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ChevronDown, ChevronUp, PlusCircle, MoreHorizontal, Shuffle, Layers2, ArrowUpDown, Upload } from "lucide-react"

import { cn } from "@client/lib/utils"
import { OpponentDeckModal } from "@/client/components/OpponentDeckModal"

import { DeckZone } from "../DeckZone"
import type { GameFieldController } from "../hooks/useGameFieldController"

export function OpponentArea({ controller }: { controller: GameFieldController }) {
  const { t } = useTranslation(["game"])
  const [isOpponentDeckModalOpen, setIsOpponentDeckModalOpen] = useState(false)
  const {
    isExtraActionsOpen,
    setIsExtraActionsOpen,
    isOpponentFieldOpen,
    setIsOpponentFieldOpen,
    handleShuffleDeck,
    handleDraw5Cards,
    handleGenerateToken,
    preventSameZoneReorder,
    setPreventSameZoneReorder,
    isDeckLoaded,
    isPlaying,
    opponentBoard,
    handleCardDrop,
    handleCardContextMenu,
    setContextMenu,
  } = controller

  return (
    <div className="mb-2">
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
        <button
          onClick={() => setIsOpponentFieldOpen(!isOpponentFieldOpen)}
          className={cn(
            "flex items-center gap-1 px-3 py-1.5 rounded-md transition-colors text-xs sm:text-sm font-medium",
            "bg-secondary text-secondary-foreground hover:bg-secondary/90",
          )}
          aria-label={isOpponentFieldOpen ? "Hide opponent field" : "Show opponent field"}
        >
          {isOpponentFieldOpen ? (
            <>
              <ChevronUp className="w-4 h-4" />
              <span>{t("game:field.opponentFieldHide")}</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              <span>{t("game:field.opponentFieldShow")}</span>
            </>
          )}
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
          <button
            onClick={() => setIsOpponentDeckModalOpen(true)}
            disabled={!isDeckLoaded || isPlaying}
            className={cn(
              "flex items-center gap-1 px-3 py-1.5 rounded-md transition-colors text-xs sm:text-sm font-medium",
              isDeckLoaded && !isPlaying
                ? "bg-secondary text-secondary-foreground hover:bg-secondary/90"
                : "bg-muted text-muted-foreground cursor-not-allowed",
            )}
            aria-label="Load opponent deck"
          >
            <Upload className="w-4 h-4" />
            <span>{t("game:field.loadOpponentDeck")}</span>
          </button>
        </div>
      )}

      {isOpponentFieldOpen && (
        <div className="space-y-2 mb-2">
          <DeckZone
            type="deck"
            zone={{ player: "opponent", type: "deck" }}
            isOpponent={true}
            cardCount={opponentBoard.deck.length}
            cards={opponentBoard.deck}
            onDrop={handleCardDrop}
            onContextMenu={handleCardContextMenu}
            onContextMenuClose={() => setContextMenu(null)}
          />

          <div className="flex gap-2 items-start">
            <DeckZone
              type="hand"
              zone={{ player: "opponent", type: "hand" }}
              isOpponent={true}
              cardCount={opponentBoard.hand.length}
              cards={opponentBoard.hand}
              onDrop={handleCardDrop}
              onContextMenu={handleCardContextMenu}
              onContextMenuClose={() => setContextMenu(null)}
              style={{ width: "35%" }}
            />
            <DeckZone
              type="extra"
              zone={{ player: "opponent", type: "extraDeck" }}
              isOpponent={true}
              cardCount={opponentBoard.extraDeck.length}
              cards={opponentBoard.extraDeck}
              onDrop={handleCardDrop}
              onContextMenu={handleCardContextMenu}
              onContextMenuClose={() => setContextMenu(null)}
              style={{ width: "65%" }}
            />
          </div>
        </div>
      )}

      {/* 相手デッキ読み込みモーダル */}
      <OpponentDeckModal
        isOpen={isOpponentDeckModalOpen}
        onClose={() => setIsOpponentDeckModalOpen(false)}
        onLoadSuccess={() => setIsOpponentFieldOpen(true)} // 読み込み成功時に相手フィールドを表示
      />
    </div>
  )
}
