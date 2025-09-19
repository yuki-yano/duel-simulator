import { useCallback } from "react"
import type { TFunction } from "i18next"
import { useAtom, useAtomValue } from "jotai"

import {
  replayRecordingAtom,
  replayStartIndexAtom,
  replayPlayingAtom,
  replayPausedAtom,
  replayCurrentIndexAtom,
  replaySpeedAtom,
  replayStartDelayAtom,
  startReplayRecordingAtom,
  stopReplayRecordingAtom,
  playReplayAtom,
  toggleReplayPauseAtom,
  stopReplayAtom,
  replayDataAtom,
  operationsAtom,
  deckMetadataAtom,
  hasSideDeckAtom,
} from "@/client/atoms/boardAtoms"
import {
  hasOpponentDeckAtom,
  opponentDeckCardsAtom,
  opponentExtraDeckCardsAtom,
  opponentSideDeckCardsAtom,
  opponentDeckMetadataAtom,
} from "@/client/atoms/opponentDeckAtom"
import { useScreenshot } from "@/client/contexts/ScreenshotContext"
import { saveReplayData } from "@/client/api/gameState"
import { calculateImageHash, saveDeckImage } from "@/client/api/deck"
import { generateOGPImage } from "@/client/utils/ogpScreenshot"
import type { ReplaySaveData } from "@/shared/types/game"
import { createOpponentDeckMapping, addOpponentDeckToMapping } from "@/client/utils/opponentDeckUtils"

interface ReplayDialogControllers {
  setIsSavingReplay: (value: boolean) => void
  setShowSaveReplayDialog: (value: boolean) => void
  setShowShareUrlDialog: (value: boolean) => void
  setShareUrl: (value: string) => void
  setShareTitle: (value: string) => void
}

export const useGameFieldReplay = (
  t: TFunction<["game", "ui", "replay"]>,
  dialogControllers: ReplayDialogControllers,
) => {
  const [isRecording] = useAtom(replayRecordingAtom)
  const [replayStartIndex] = useAtom(replayStartIndexAtom)
  const [isPlaying] = useAtom(replayPlayingAtom)
  const [isPaused] = useAtom(replayPausedAtom)
  const [currentReplayIndex] = useAtom(replayCurrentIndexAtom)
  const [replaySpeed, setReplaySpeed] = useAtom(replaySpeedAtom)
  const [replayStartDelay, setReplayStartDelay] = useAtom(replayStartDelayAtom)
  const [replayData] = useAtom(replayDataAtom)
  const operations = useAtomValue(operationsAtom)
  const [, startRecording] = useAtom(startReplayRecordingAtom)
  const [, stopRecording] = useAtom(stopReplayRecordingAtom)
  const [, playReplay] = useAtom(playReplayAtom)
  const [, togglePause] = useAtom(toggleReplayPauseAtom)
  const [, stopReplay] = useAtom(stopReplayAtom)
  const deckMetadata = useAtomValue(deckMetadataAtom)
  const hasSideDeck = useAtomValue(hasSideDeckAtom)
  const hasOpponentDeck = useAtomValue(hasOpponentDeckAtom)
  const opponentMainDeck = useAtomValue(opponentDeckCardsAtom)
  const opponentExtraDeck = useAtomValue(opponentExtraDeckCardsAtom)
  const opponentSideDeck = useAtomValue(opponentSideDeckCardsAtom)
  const opponentDeckMetadata = useAtomValue(opponentDeckMetadataAtom)

  const { setScreenshotWidth } = useScreenshot()

  const handleSaveReplay = useCallback(
    async (title: string, description?: string) => {
      if (!replayData || !deckMetadata) {
        console.error("No replay data or deck metadata available")
        return
      }

      dialogControllers.setIsSavingReplay(true)
      try {
        const ogpImageBlob = await generateOGPImage(setScreenshotWidth)
        let ogpImageData: string | undefined
        if (ogpImageBlob) {
          const reader = new FileReader()
          ogpImageData = await new Promise<string>((resolve) => {
            reader.onloadend = () => resolve(reader.result as string)
            reader.readAsDataURL(ogpImageBlob)
          })
        }

        const imageHash = await calculateImageHash(deckMetadata.imageDataUrl)

        await saveDeckImage({
          hash: imageHash,
          imageData: deckMetadata.imageDataUrl,
          mainDeckCount: deckMetadata.mainDeckCount,
          extraDeckCount: deckMetadata.extraDeckCount,
          sourceWidth: deckMetadata.sourceWidth,
          sourceHeight: deckMetadata.sourceHeight,
        })

        // 相手デッキマッピングを準備
        const extendedDeckCardIds = hasOpponentDeck
          ? addOpponentDeckToMapping(
              deckMetadata.deckCardIds,
              createOpponentDeckMapping(opponentMainDeck, opponentExtraDeck, opponentSideDeck),
            )
          : deckMetadata.deckCardIds

        const saveData: ReplaySaveData = {
          version: "1.0",
          type: "replay",
          data: {
            initialState: replayData.startSnapshot,
            operations: replayData.operations,
            deckImageHash: imageHash,
            deckCardIds: extendedDeckCardIds,
            opponentDeckImageHash: opponentDeckMetadata?.imageHash, // 相手デッキ画像ハッシュを追加
          },
          metadata: {
            title,
            description,
            createdAt: Date.now(),
            duration: replayData.endTime !== undefined ? replayData.endTime - replayData.startTime : 0,
            operationCount: replayData.operations.length,
            hasOpponentDeck: hasOpponentDeck, // 相手デッキフラグを追加
          },
        }

        const response = await saveReplayData(
          saveData,
          imageHash,
          deckMetadata.deckConfig,
          extendedDeckCardIds,
          ogpImageData,
        )

        dialogControllers.setShareUrl(response.shareUrl)
        dialogControllers.setShareTitle(title)
        dialogControllers.setShowSaveReplayDialog(false)
        dialogControllers.setShowShareUrlDialog(true)
      } catch (error) {
        console.error("Failed to save replay:", error)
        const errorMessage = error instanceof Error ? error.message : String(error)
        alert(`${t("replay:errors.saveFailed")}${errorMessage ? `\n\n${errorMessage}` : ""}`)
      } finally {
        dialogControllers.setIsSavingReplay(false)
      }
    },
    [
      deckMetadata,
      dialogControllers,
      replayData,
      setScreenshotWidth,
      t,
      hasOpponentDeck,
      opponentMainDeck,
      opponentExtraDeck,
      opponentSideDeck,
      opponentDeckMetadata,
    ],
  )

  return {
    isRecording,
    replayStartIndex,
    operations,
    isPlaying,
    isPaused,
    currentReplayIndex,
    replayData,
    replaySpeed,
    setReplaySpeed,
    replayStartDelay,
    setReplayStartDelay,
    startRecording,
    stopRecording,
    playReplay,
    togglePause,
    stopReplay,
    handleSaveReplay,
    deckMetadata,
    hasSideDeck,
  }
}

export type GameFieldReplayState = ReturnType<typeof useGameFieldReplay>
