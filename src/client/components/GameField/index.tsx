import { useEffect, useRef } from "react"
import { TooltipProvider } from "@client/components/ui/tooltip"
import { useTranslation } from "react-i18next"
import { DELAYS } from "@/client/constants/delays"

import { CardContextMenu } from "@/client/components/CardContextMenu"
import { CardAnimationOverlay } from "@/client/components/CardAnimationOverlay"
import { HelpButton } from "@/client/components/HelpButton"

import { GameFieldHeader } from "./components/GameFieldHeader"
import { OpponentArea } from "./components/OpponentArea"
import { FieldGrid } from "./components/FieldGrid"
import { PlayerArea } from "./components/PlayerArea"
import { PcHintPanel } from "./components/PcHintPanel"
import { GameFieldDialogs } from "./components/GameFieldDialogs"
import { useGameFieldController } from "./hooks/useGameFieldController"

export function GameField() {
  return (
    <TooltipProvider delayDuration={DELAYS.TOOLTIP_DELAY}>
      <GameFieldContent />
    </TooltipProvider>
  )
}

export function GameFieldContent() {
  const { t } = useTranslation(["game", "ui", "replay"])
  const controller = useGameFieldController(t)
  const { isReplayMode, isPlaying, replayData, isOpponentFieldOpen, setIsOpponentFieldOpen } = controller

  const prevIsPlayingRef = useRef(isPlaying)
  const prevHasReplayDataRef = useRef(replayData != null)
  const autoOpenedRef = useRef(false)

  useEffect(() => {
    const opponentState = replayData?.startSnapshot?.players?.opponent
    const opponentHasLoadedDeck =
      (opponentState?.deck?.length ?? 0) > 0 ||
      (opponentState?.extraDeck?.length ?? 0) > 0 ||
      (opponentState?.sideDeck?.length ?? 0) > 0

    const startedPlaying = isPlaying && !prevIsPlayingRef.current
    const replayDataJustPrepared = !prevHasReplayDataRef.current && replayData != null

    if (
      isReplayMode &&
      opponentHasLoadedDeck &&
      !autoOpenedRef.current &&
      !isOpponentFieldOpen &&
      (startedPlaying || replayDataJustPrepared)
    ) {
      setIsOpponentFieldOpen(true)
      autoOpenedRef.current = true
    }

    prevIsPlayingRef.current = isPlaying
    prevHasReplayDataRef.current = replayData != null
  }, [isReplayMode, isPlaying, replayData, isOpponentFieldOpen, setIsOpponentFieldOpen])

  return (
    <>
      <div className="game-board w-full max-w-6xl mx-auto p-2 sm:p-4">
        <GameFieldHeader controller={controller} />
        <OpponentArea controller={controller} />
        <FieldGrid controller={controller} />
        <PlayerArea controller={controller} />
      </div>

      {controller.contextMenu && (
        <CardContextMenu
          card={controller.contextMenu.card}
          zone={controller.contextMenu.zone}
          position={controller.contextMenu.position}
          onClose={() => controller.setContextMenu(null)}
          onAction={controller.handleContextMenuAction}
          isReplayActive={controller.isPlaying}
        />
      )}

      <CardAnimationOverlay />

      {controller.isTouchDevice && <HelpButton />}

      <GameFieldDialogs controller={controller} />

      {controller.isPc && <PcHintPanel controller={controller} />}
    </>
  )
}
