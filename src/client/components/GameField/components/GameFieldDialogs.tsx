import { useTranslation } from "react-i18next"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@client/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@client/components/ui/alert-dialog"
import { Button } from "@client/components/ui/button"

import { SaveReplayDialog } from "@client/components/SaveReplayDialog"
import { ShareUrlDisplay } from "@client/components/ShareUrlDisplay"
import { ZoneExpandModal } from "@client/components/ZoneExpandModal"
import { ExtraDeckExpandModal } from "@client/components/ExtraDeckExpandModal"

import type { GameFieldController } from "../hooks/useGameFieldController"

export function GameFieldDialogs({ controller }: { controller: GameFieldController }) {
  const { t } = useTranslation(["ui", "replay"])
  const {
    showRecordingConfirmDialog,
    setShowRecordingConfirmDialog,
    startRecording,
    showResetConfirmDialog,
    setShowResetConfirmDialog,
    showSaveReplayDialog,
    setShowSaveReplayDialog,
    isSavingReplay,
    replayData,
    handleSaveReplay,
    showShareUrlDialog,
    setShowShareUrlDialog,
    shareUrl,
    shareTitle,
    showTokenLimitDialog,
    setShowTokenLimitDialog,
    showDrawWarningDialog,
    setShowDrawWarningDialog,
    handleConfirmedDraw5Cards,
    resetToInitialState,
    expandedZone,
    setExpandedZone,
    modalBounds,
    handleCardDrop,
    handleCardContextMenu,
    setContextMenu,
    playerBoard,
    isExtraDeckExpanded,
    setIsExtraDeckExpanded,
    extraDeckModalBounds,
  } = controller

  return (
    <>
      <Dialog open={showRecordingConfirmDialog} onOpenChange={setShowRecordingConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("ui:dialogs.recordingConfirm.title")}</DialogTitle>
            <DialogDescription>{t("ui:dialogs.recordingConfirm.description")}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <button
              onClick={() => setShowRecordingConfirmDialog(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              {t("ui:dialogs.recordingConfirm.cancel")}
            </button>
            <button
              onClick={() => {
                setShowRecordingConfirmDialog(false)
                startRecording()
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-md transition-colors"
            >
              {t("ui:dialogs.recordingConfirm.start")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showResetConfirmDialog} onOpenChange={setShowResetConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("ui:dialogs.resetConfirm.title")}</DialogTitle>
            <DialogDescription>{t("ui:dialogs.resetConfirm.description")}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <button
              onClick={() => setShowResetConfirmDialog(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              {t("ui:dialogs.resetConfirm.cancel")}
            </button>
            <button
              onClick={() => {
                setShowResetConfirmDialog(false)
                resetToInitialState()
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-md transition-colors"
            >
              {t("ui:dialogs.resetConfirm.reset")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {replayData && (
        <SaveReplayDialog
          isOpen={showSaveReplayDialog}
          onOpenChange={setShowSaveReplayDialog}
          replayData={replayData}
          onSave={handleSaveReplay}
          onCancel={() => setShowSaveReplayDialog(false)}
          isLoading={isSavingReplay}
        />
      )}

      <ShareUrlDisplay
        isOpen={showShareUrlDialog}
        onOpenChange={setShowShareUrlDialog}
        shareUrl={shareUrl}
        shareTitle={shareTitle}
        onClose={() => setShowShareUrlDialog(false)}
      />

      {expandedZone && (
        <ZoneExpandModal
          isOpen={true}
          onClose={() => setExpandedZone(null)}
          zone={expandedZone}
          cards={expandedZone.type === "graveyard" ? playerBoard.graveyard : playerBoard.banished}
          onDrop={handleCardDrop}
          onContextMenu={handleCardContextMenu}
          onContextMenuClose={() => setContextMenu(null)}
          modalBounds={modalBounds}
        />
      )}

      {isExtraDeckExpanded && (
        <ExtraDeckExpandModal
          isOpen={true}
          onClose={() => setIsExtraDeckExpanded(false)}
          cards={playerBoard.extraDeck}
          onDrop={handleCardDrop}
          onContextMenu={handleCardContextMenu}
          onContextMenuClose={() => setContextMenu(null)}
          modalBounds={extraDeckModalBounds}
        />
      )}

      <AlertDialog open={showTokenLimitDialog} onOpenChange={setShowTokenLimitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("ui:dialogs.tokenLimitError.title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("ui:dialogs.tokenLimitError.description")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button onClick={() => setShowTokenLimitDialog(false)} variant="default">
              {t("ui:dialogs.tokenLimitError.ok")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showDrawWarningDialog} onOpenChange={setShowDrawWarningDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("ui:dialogs.drawWarning.title")}</DialogTitle>
            <DialogDescription>{t("ui:dialogs.drawWarning.description")}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <button
              onClick={() => setShowDrawWarningDialog(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              {t("ui:dialogs.drawWarning.cancel")}
            </button>
            <button
              onClick={handleConfirmedDraw5Cards}
              className="px-4 py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-md transition-colors"
            >
              {t("ui:dialogs.drawWarning.execute")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
