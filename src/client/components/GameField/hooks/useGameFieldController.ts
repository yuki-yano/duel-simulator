import { useEffect, useRef } from "react"
import type { TFunction } from "i18next"
import { useLocation } from "react-router-dom"
import { useAtom, useAtomValue } from "jotai"

import {
  gameStateAtom,
  undoAtom,
  redoAtom,
  canUndoAtom,
  canRedoAtom,
  undoOperationDescriptionAtom,
  redoOperationDescriptionAtom,
  isDeckLoadedAtom,
  initialStateAfterDeckLoadAtom,
  hasEverPlayedInReplayModeAtom,
  resetToInitialStateAtom,
} from "@/client/atoms/boardAtoms"

import type { PlayerBoard } from "@/shared/types/game"

import { useGameFieldUiState } from "./useGameFieldUiState"
import { useGameFieldDialogState } from "./useGameFieldDialogState"
import { useGameFieldModals } from "./useGameFieldModals"
import { useGameFieldReplay } from "./useGameFieldReplay"
import { useGameFieldInteractions } from "./useGameFieldInteractions"

export const useGameFieldController = (t: TFunction<["game", "ui", "replay"]>) => {
  const location = useLocation()
  const isReplayMode = location.pathname.startsWith("/replay/")

  const [hasEverPlayedInReplayMode, setHasEverPlayedInReplayMode] = useAtom(hasEverPlayedInReplayModeAtom)

  const uiState = useGameFieldUiState()
  const dialogState = useGameFieldDialogState()
  const modalState = useGameFieldModals()

  const replayState = useGameFieldReplay(t, {
    setIsSavingReplay: dialogState.setIsSavingReplay,
    setShowSaveReplayDialog: dialogState.setShowSaveReplayDialog,
    setShowShareUrlDialog: dialogState.setShowShareUrlDialog,
    setShareUrl: dialogState.setShareUrl,
    setShareTitle: dialogState.setShareTitle,
  })

  const [gameState] = useAtom(gameStateAtom)
  const playerBoard: PlayerBoard = gameState.players.self
  const opponentBoard: PlayerBoard = gameState.players.opponent

  const interactions = useGameFieldInteractions({
    playerBoard,
    opponentBoard,
    mobileDefenseMode: uiState.mobileDefenseMode,
    mobileFaceDownMode: uiState.mobileFaceDownMode,
    mobileStackBottom: uiState.mobileStackBottom,
    preventSameZoneReorder: uiState.preventSameZoneReorder,
    setShowTokenLimitDialog: dialogState.setShowTokenLimitDialog,
    setShowDrawWarningDialog: dialogState.setShowDrawWarningDialog,
  })

  const [, undo] = useAtom(undoAtom)
  const [, redo] = useAtom(redoAtom)
  const canUndo = useAtomValue(canUndoAtom)
  const canRedo = useAtomValue(canRedoAtom)
  const undoDescription = useAtomValue(undoOperationDescriptionAtom)
  const redoDescription = useAtomValue(redoOperationDescriptionAtom)
  const isDeckLoaded = useAtomValue(isDeckLoadedAtom)
  const initialStateAfterDeckLoad = useAtomValue(initialStateAfterDeckLoadAtom)
  const [, resetToInitialState] = useAtom(resetToInitialStateAtom)

  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isReplayMode && replayState.isPlaying) {
      setHasEverPlayedInReplayMode(true)
    }
  }, [isReplayMode, replayState.isPlaying, setHasEverPlayedInReplayMode])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault()
        if (canUndo) {
          void undo()
        }
      }
      if (((e.metaKey || e.ctrlKey) && e.key === "z" && e.shiftKey) || ((e.metaKey || e.ctrlKey) && e.key === "y")) {
        e.preventDefault()
        if (canRedo) {
          void redo()
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [canUndo, canRedo, undo, redo])

  return {
    // mode
    isReplayMode,
    hasEverPlayedInReplayMode,
    setHasEverPlayedInReplayMode,

    // ui state
    ...uiState,

    // board references
    playerBoard,
    opponentBoard,
    gridRef,

    // undo/redo state
    canUndo,
    canRedo,
    undoDescription,
    redoDescription,
    isDeckLoaded,
    initialStateAfterDeckLoad,

    // dialog state
    ...dialogState,

    // modal state
    ...modalState,

    // replay state
    ...replayState,

    // interactions
    ...interactions,

    // actions
    undo,
    redo,
    resetToInitialState,
  }
}

export type GameFieldController = ReturnType<typeof useGameFieldController>
