import { useState } from "react"

export const useGameFieldDialogState = () => {
  const [showRecordingConfirmDialog, setShowRecordingConfirmDialog] = useState(false)
  const [showResetConfirmDialog, setShowResetConfirmDialog] = useState(false)
  const [showSaveReplayDialog, setShowSaveReplayDialog] = useState(false)
  const [isSavingReplay, setIsSavingReplay] = useState(false)
  const [shareUrl, setShareUrl] = useState("")
  const [shareTitle, setShareTitle] = useState("")
  const [showShareUrlDialog, setShowShareUrlDialog] = useState(false)
  const [showTokenLimitDialog, setShowTokenLimitDialog] = useState(false)
  const [showDrawWarningDialog, setShowDrawWarningDialog] = useState(false)

  return {
    showRecordingConfirmDialog,
    setShowRecordingConfirmDialog,
    showResetConfirmDialog,
    setShowResetConfirmDialog,
    showSaveReplayDialog,
    setShowSaveReplayDialog,
    isSavingReplay,
    setIsSavingReplay,
    shareUrl,
    setShareUrl,
    shareTitle,
    setShareTitle,
    showShareUrlDialog,
    setShowShareUrlDialog,
    showTokenLimitDialog,
    setShowTokenLimitDialog,
    showDrawWarningDialog,
    setShowDrawWarningDialog,
  }
}

export type GameFieldDialogState = ReturnType<typeof useGameFieldDialogState>
