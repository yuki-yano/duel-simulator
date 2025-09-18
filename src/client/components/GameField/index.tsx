import React, { useState, useRef, useEffect, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@client/lib/utils"
import { ChevronDown, ChevronUp, PlusCircle, MoreHorizontal, Shuffle, Layers2, ArrowUpDown } from "lucide-react"
import { useScreenSize } from "@client/hooks/useScreenSize"
import { useDeviceType } from "@client/hooks/useDeviceType"
import { useAtom, useAtomValue } from "jotai"
import { useLocation } from "react-router-dom"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@client/components/ui/dialog"
import { TooltipProvider } from "@client/components/ui/tooltip"
import { HelpButton } from "@client/components/HelpButton"
import {
  gameStateAtom,
  draggedCardAtom,
  moveCardAtom,
  undoAtom,
  redoAtom,
  canUndoAtom,
  canRedoAtom,
  undoOperationDescriptionAtom,
  redoOperationDescriptionAtom,
  operationsAtom,
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
  isDeckLoadedAtom,
  resetToInitialStateAtom,
  initialStateAfterDeckLoadAtom,
  deckMetadataAtom,
  generateTokenAtom,
  shuffleDeckAtom,
  drawMultipleCardsAtom,
  hasEverPlayedInReplayModeAtom,
  forceDraw5CardsAtom,
  hasSideDeckAtom,
} from "@/client/atoms/boardAtoms"
import { rotateCardAtom, flipCardAtom, toggleCardHighlightAtom } from "@/client/atoms/operations/rotation"
import {
  activateEffectAtom,
  targetSelectAtom,
  negateEffectAtom,
  updateCounterAtom,
} from "@/client/atoms/operations/effects"
import type { Card as GameCard, ZoneId } from "@/shared/types/game"
import { CardContextMenu } from "@/client/components/CardContextMenu"
import { CardAnimationOverlay } from "@/client/components/CardAnimationOverlay"
import { SaveReplayDialog } from "@/client/components/SaveReplayDialog"
import { ShareUrlDisplay } from "@/client/components/ShareUrlDisplay"
import { ZoneExpandModal } from "@/client/components/ZoneExpandModal"
import { ExtraDeckExpandModal } from "@/client/components/ExtraDeckExpandModal"
import { saveReplayData } from "@/client/api/gameState"
import { calculateImageHash, saveDeckImage } from "@/client/api/deck"
import type { ReplaySaveData } from "@/shared/types/game"
import { generateOGPImage } from "@/client/utils/ogpScreenshot"
import { useScreenshot } from "@/client/contexts/ScreenshotContext"
import { Zone } from "./Zone"
import { DeckZone } from "./DeckZone"
import { GraveZone } from "./GraveZone"
import { ReplayControls } from "./ReplayControls"
import { ActionButtons } from "./ActionButtons"
import { isTokenLimitReached } from "@/client/utils/tokenCard"
import { Button } from "@/client/components/ui/button"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/client/components/ui/alert-dialog"
import { GRAVE_ZONE_SIZE } from "@/client/constants/screen"

export function GameField() {
  return (
    <TooltipProvider delayDuration={100}>
      <GameFieldContent />
    </TooltipProvider>
  )
}

export function GameFieldContent() {
  const location = useLocation()
  const isReplayMode = location.pathname.startsWith("/replay/")
  const [hasEverPlayedInReplayMode, setHasEverPlayedInReplayMode] = useAtom(hasEverPlayedInReplayModeAtom)
  const { t } = useTranslation(["game", "ui"])

  const [isOpponentFieldOpen, setIsOpponentFieldOpen] = useState(false)
  const [isExtraActionsOpen, setIsExtraActionsOpen] = useState(false)
  const [mobileDefenseMode, setMobileDefenseMode] = useState(false)
  const [mobileFaceDownMode, setMobileFaceDownMode] = useState(false)
  const [mobileStackBottom, setMobileStackBottom] = useState(false)
  const [preventSameZoneReorder, setPreventSameZoneReorder] = useState(false)
  const { isMobile, isTablet, isPc } = useDeviceType()
  const isTouchDevice = isMobile || isTablet
  const { isLargeScreen, isMediumScreen, isSmallScreen } = useScreenSize()
  const [gameState] = useAtom(gameStateAtom)
  const [, moveCard] = useAtom(moveCardAtom)
  const [, generateToken] = useAtom(generateTokenAtom)
  const [, shuffleDeck] = useAtom(shuffleDeckAtom)
  const [, drawMultipleCards] = useAtom(drawMultipleCardsAtom)
  const [, setForceDraw5Cards] = useAtom(forceDraw5CardsAtom)
  const [, undo] = useAtom(undoAtom)
  const [, redo] = useAtom(redoAtom)
  const canUndo = useAtomValue(canUndoAtom)
  const canRedo = useAtomValue(canRedoAtom)
  const undoDescription = useAtomValue(undoOperationDescriptionAtom)
  const redoDescription = useAtomValue(redoOperationDescriptionAtom)
  const isDeckLoaded = useAtomValue(isDeckLoadedAtom)
  const [, rotateCard] = useAtom(rotateCardAtom)
  const [, activateEffect] = useAtom(activateEffectAtom)
  const [, targetSelect] = useAtom(targetSelectAtom)
  const [, negateEffect] = useAtom(negateEffectAtom)
  const [, flipCard] = useAtom(flipCardAtom)
  const [, toggleCardHighlight] = useAtom(toggleCardHighlightAtom)
  const [, updateCounter] = useAtom(updateCounterAtom)
  const [, resetToInitialState] = useAtom(resetToInitialStateAtom)
  const initialStateAfterDeckLoad = useAtomValue(initialStateAfterDeckLoadAtom)
  const [contextMenu, setContextMenu] = useState<{
    card: GameCard
    zone: ZoneId
    position: { x: number; y: number }
    cardElement?: HTMLElement | null
  } | null>(null)

  // Zone expand modal state - only one modal can be open at a time
  const [expandedZone, setExpandedZone] = useState<ZoneId | null>(null)
  const [modalBounds, setModalBounds] = useState<{
    top: number
    left: number
    right: number
    bottom: number
  }>({ top: 0, left: 0, right: 0, bottom: 0 })

  // Extra deck expand modal state
  const [isExtraDeckExpanded, setIsExtraDeckExpanded] = useState(false)
  const [extraDeckModalBounds, setExtraDeckModalBounds] = useState<{
    top: number
    left: number
    width: number
    bottom: number
  }>({ top: 0, left: 0, width: 0, bottom: 0 })

  // Recording confirmation dialog state
  const [showRecordingConfirmDialog, setShowRecordingConfirmDialog] = useState(false)

  // Reset confirmation dialog state
  const [showResetConfirmDialog, setShowResetConfirmDialog] = useState(false)

  // Save replay dialog state
  const [showSaveReplayDialog, setShowSaveReplayDialog] = useState(false)
  const [isSavingReplay, setIsSavingReplay] = useState(false)
  const [shareUrl, setShareUrl] = useState<string>("")
  const [shareTitle, setShareTitle] = useState<string>("")
  const [showShareUrlDialog, setShowShareUrlDialog] = useState(false)

  // Token generation error dialog state
  const [showTokenLimitDialog, setShowTokenLimitDialog] = useState(false)

  // 5-card draw warning dialog state
  const [showDrawWarningDialog, setShowDrawWarningDialog] = useState(false)

  // Screenshot context
  const { setScreenshotWidth } = useScreenshot()

  // Replay atoms
  const [isRecording] = useAtom(replayRecordingAtom)
  const [replayStartIndex] = useAtom(replayStartIndexAtom)
  const [isPlaying] = useAtom(replayPlayingAtom)
  const [isPaused] = useAtom(replayPausedAtom)
  const [currentReplayIndex] = useAtom(replayCurrentIndexAtom)
  const [replayData] = useAtom(replayDataAtom)
  const [replaySpeed, setReplaySpeed] = useAtom(replaySpeedAtom)
  const [replayStartDelay, setReplayStartDelay] = useAtom(replayStartDelayAtom)
  const operations = useAtomValue(operationsAtom)
  const [, startRecording] = useAtom(startReplayRecordingAtom)
  const [, stopRecording] = useAtom(stopReplayRecordingAtom)
  const [, playReplay] = useAtom(playReplayAtom)
  const [, togglePause] = useAtom(toggleReplayPauseAtom)
  const [, stopReplay] = useAtom(stopReplayAtom)
  const deckMetadata = useAtomValue(deckMetadataAtom)
  const hasSideDeck = useAtomValue(hasSideDeckAtom)

  // Track if replay has ever been played in replay mode
  useEffect(() => {
    if (isReplayMode && isPlaying) {
      setHasEverPlayedInReplayMode(true)
    }
  }, [isReplayMode, isPlaying, setHasEverPlayedInReplayMode])

  const playerBoard = gameState.players.self
  const opponentBoard = gameState.players.opponent

  const draggedCard = useAtomValue(draggedCardAtom)

  // Refs for dynamic height calculation
  const gridRef = useRef<HTMLDivElement>(null)

  // 操作ヒントの最小化状態
  const [isHintMinimized, setIsHintMinimized] = useState(() => {
    const saved = localStorage.getItem("duel-simulator-hint-minimized")
    return saved === "true"
  })

  const handleCardDrop = (from: ZoneId, to: ZoneId, shiftKey?: boolean) => {
    if (!draggedCard) {
      console.error("No dragged card available for drop operation")
      return
    }

    // Check if target zone has existing cards
    let hasExistingCards = false
    const targetBoard = to.player === "self" ? playerBoard : opponentBoard

    if (to.type === "monsterZone" && to.index !== undefined) {
      hasExistingCards = targetBoard.monsterZones[to.index].length > 0
    } else if (to.type === "spellTrapZone" && to.index !== undefined) {
      hasExistingCards = targetBoard.spellTrapZones[to.index].length > 0
    } else if (to.type === "extraMonsterZone" && to.index !== undefined) {
      hasExistingCards = targetBoard.extraMonsterZones[to.index].length > 0
    } else if (to.type === "freeZone") {
      hasExistingCards = (targetBoard.freeZone ?? []).length > 0
    }

    // Prepare options with separate mobile toggle states
    const options = {
      shiftKey: shiftKey === true && !hasExistingCards, // Only apply shiftKey for defense/face-down when zone is empty
      defenseMode: mobileDefenseMode,
      faceDownMode: mobileFaceDownMode,
      stackPosition: (shiftKey === true && hasExistingCards) || mobileStackBottom ? ("bottom" as const) : undefined, // Stack at bottom when shift+drop on existing cards or mobile toggle is on
      preventSameZoneReorder: !preventSameZoneReorder,
    }

    if (draggedCard.zone != null && "cardIndex" in draggedCard.zone && draggedCard.zone.cardIndex !== undefined) {
      // draggedCardのzone情報にindexを含める
      const fromWithIndex = { ...from, index: draggedCard.zone.cardIndex }
      // Include card ID for ID-based tracking
      moveCard({ zone: fromWithIndex, cardId: draggedCard.id }, { zone: to, cardId: draggedCard.id }, options)
    } else {
      // Include card ID even without index
      moveCard({ zone: from, cardId: draggedCard.id }, { zone: to, cardId: draggedCard.id }, options)
    }
  }

  const handleCardContextMenu = useCallback((e: React.MouseEvent | React.TouchEvent, card: GameCard, zone: ZoneId) => {
    e.preventDefault()
    const position =
      "touches" in e ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY }

    // Store the card element that was clicked
    const cardElement = (e.target as HTMLElement).closest('[draggable="true"]') as HTMLElement | null
    setContextMenu({ card, zone, position, cardElement })
  }, [])

  const handleContextMenuAction = useCallback(
    (action: string, card: GameCard) => {
      try {
        if (action === "rotate" && contextMenu) {
          // Toggle between normal (0) and defense position (-90)
          const newRotation = card.rotation === -90 ? 0 : -90
          // Include card ID for ID-based tracking
          rotateCard({ zone: contextMenu.zone, cardId: card.id }, newRotation)
        } else if (action === "activate" && contextMenu) {
          // Include card ID in the zone for accurate card identification
          activateEffect({ zone: contextMenu.zone, cardId: card.id }, contextMenu.cardElement ?? undefined)
        } else if (action === "target" && contextMenu) {
          // Include card ID in the zone for accurate card identification
          targetSelect({ zone: contextMenu.zone, cardId: card.id }, contextMenu.cardElement ?? undefined)
        } else if (action === "negate" && contextMenu) {
          // Include card ID in the zone for accurate card identification
          negateEffect({ zone: contextMenu.zone, cardId: card.id }, contextMenu.cardElement ?? undefined)
        } else if (action === "flip" && contextMenu) {
          // Include card ID for ID-based tracking
          flipCard({ zone: contextMenu.zone, cardId: card.id })
        } else if (action === "highlight" && contextMenu) {
          // Toggle highlight state
          toggleCardHighlight({ zone: contextMenu.zone, cardId: card.id })
        } else if (action === "addCounter" && contextMenu) {
          // Add counter
          const currentCounter = card.counter ?? 0
          updateCounter({ zone: contextMenu.zone, cardId: card.id }, currentCounter + 1)
        } else if (action === "removeCounter" && contextMenu) {
          // Remove counter
          const currentCounter = card.counter ?? 0
          if (currentCounter > 0) {
            updateCounter({ zone: contextMenu.zone, cardId: card.id }, currentCounter - 1)
          }
        }
      } catch (error) {
        // Show error on mobile for debugging
        alert(`Error in ${action}: ${error instanceof Error ? error.message : String(error)}`)
        console.error(`Error in handleContextMenuAction (${action}):`, error)
      }
    },
    [rotateCard, activateEffect, targetSelect, negateEffect, flipCard, toggleCardHighlight, updateCounter, contextMenu],
  )

  // Handle token generation
  const handleGenerateToken = useCallback(() => {
    // Check if free zone already has 5 or more cards
    if (isTokenLimitReached((playerBoard.freeZone ?? []).length)) {
      setShowTokenLimitDialog(true)
      return
    }

    // Generate token using the atom
    generateToken("self")
  }, [playerBoard.freeZone, generateToken])

  // Handle deck shuffle
  const handleShuffleDeck = useCallback(() => {
    shuffleDeck("self")
  }, [shuffleDeck])

  // Handle draw 5 cards
  const handleDraw5Cards = useCallback(() => {
    const result = drawMultipleCards(5, "self") as { needsWarning?: boolean; success?: boolean } | undefined
    // Check if warning is needed
    if (result?.needsWarning === true) {
      setShowDrawWarningDialog(true)
    }
  }, [drawMultipleCards])

  // Handle confirmed 5-card draw after warning
  const handleConfirmedDraw5Cards = useCallback(() => {
    // Set force draw flag to bypass warning check
    setForceDraw5Cards(true)
    setShowDrawWarningDialog(false)
    // Now perform the draw with the flag set
    drawMultipleCards(5, "self")
  }, [setForceDraw5Cards, drawMultipleCards])

  // Remove auto-close on drag - keep modal open

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + Z for undo
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault()
        if (canUndo) {
          void undo()
        }
      }
      // Cmd/Ctrl + Shift + Z or Cmd/Ctrl + Y for redo
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

  // Handle replay save
  const handleSaveReplay = useCallback(
    async (title: string, description?: string) => {
      if (!replayData || !deckMetadata) {
        console.error("No replay data or deck metadata available")
        return
      }

      setIsSavingReplay(true)
      try {
        // Generate OGP image
        const ogpImageBlob = await generateOGPImage(setScreenshotWidth)
        let ogpImageData: string | undefined
        if (ogpImageBlob) {
          // Convert blob to base64
          const reader = new FileReader()
          ogpImageData = await new Promise<string>((resolve) => {
            reader.onloadend = () => resolve(reader.result as string)
            reader.readAsDataURL(ogpImageBlob)
          })
        }

        // Calculate deck image hash
        const imageHash = await calculateImageHash(deckMetadata.imageDataUrl)

        // First, save the deck image to ensure it exists in the database
        await saveDeckImage({
          hash: imageHash,
          imageData: deckMetadata.imageDataUrl,
          mainDeckCount: deckMetadata.mainDeckCount,
          extraDeckCount: deckMetadata.extraDeckCount,
          sourceWidth: deckMetadata.sourceWidth,
          sourceHeight: deckMetadata.sourceHeight,
        })

        // Create ReplaySaveData
        const saveData: ReplaySaveData = {
          version: "1.0",
          type: "replay",
          data: {
            initialState: replayData.startSnapshot,
            operations: replayData.operations,
            deckImageHash: imageHash,
            deckCardIds: deckMetadata.deckCardIds,
          },
          metadata: {
            title,
            description,
            createdAt: Date.now(),
            duration: replayData.endTime !== undefined ? replayData.endTime - replayData.startTime : 0,
            operationCount: replayData.operations.length,
          },
        }

        // Save replay
        const response = await saveReplayData(
          saveData,
          imageHash,
          deckMetadata.deckConfig,
          deckMetadata.deckCardIds,
          ogpImageData,
        )

        // Show share URL dialog
        setShareUrl(response.shareUrl)
        setShareTitle(title)
        setShowSaveReplayDialog(false)
        setShowShareUrlDialog(true)
      } catch (error) {
        console.error("Failed to save replay:", error)
        const errorMessage = error instanceof Error ? error.message : String(error)
        alert(`${t("replay:errors.saveFailed")}${errorMessage ? `\n\n${errorMessage}` : ""}`)
      } finally {
        setIsSavingReplay(false)
      }
    },
    [replayData, deckMetadata, setScreenshotWidth, t],
  )

  // Function to open zone expand modal (only for self player)
  const openZoneExpandModal = useCallback((zone: ZoneId) => {
    // Calculate modal bounds based on current layout
    const calculateModalBounds = () => {
      // Get zone elements
      const handElement = document.querySelector(".hand-zone-self")
      const extraDeckElement = document.querySelector(".extra-zone-self")
      const graveElement = document.querySelector(".grave-zone-self")
      const banishElement = document.querySelector(".banish-zone-self")
      const deckElement = document.querySelector(".deck-zone-self")

      if (!handElement || !extraDeckElement || !graveElement || !banishElement || !deckElement) {
        console.error("Could not find required zone elements")
        return null
      }

      const graveRect = graveElement.getBoundingClientRect()
      const banishRect = banishElement.getBoundingClientRect()
      const deckRect = deckElement.getBoundingClientRect()

      return {
        top: Math.max(graveRect.bottom, banishRect.bottom) + window.scrollY,
        left: graveRect.left + window.scrollX,
        right: banishRect.right + window.scrollX,
        bottom: deckRect.bottom + window.scrollY,
      }
    }

    const bounds = calculateModalBounds()
    if (bounds) {
      setModalBounds(bounds)
      setExpandedZone(zone)
    }
  }, [])

  // Function to open extra deck expand modal
  const openExtraDeckExpandModal = useCallback(() => {
    // Calculate modal bounds based on current layout
    const calculateModalBounds = () => {
      // Get zone elements
      const extraDeckElement = document.querySelector(".extra-zone-self")
      const deckElement = document.querySelector(".deck-zone-self")

      if (!extraDeckElement || !deckElement) {
        console.error("Could not find required zone elements")
        return null
      }

      const extraRect = extraDeckElement.getBoundingClientRect()
      const deckRect = deckElement.getBoundingClientRect()

      return {
        top: extraRect.bottom + window.scrollY,
        left: extraRect.left + window.scrollX,
        width: extraRect.width,
        bottom: deckRect.bottom + window.scrollY,
      }
    }

    const bounds = calculateModalBounds()
    if (bounds) {
      setExtraDeckModalBounds(bounds)
      setIsExtraDeckExpanded(true)
    }
  }, [])

  return (
    <>
      <div className="game-board w-full max-w-6xl mx-auto p-2 sm:p-4">
        {/* Replay recording controls - Show in normal mode or in replay mode after first play */}
        {(!isReplayMode || hasEverPlayedInReplayMode) && (
          <ReplayControls
            isRecording={isRecording}
            isDeckLoaded={isDeckLoaded}
            replayData={replayData}
            replayStartIndex={replayStartIndex}
            operations={operations}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
            onConfirmRecording={() => setShowRecordingConfirmDialog(true)}
            isPlaying={isPlaying}
            isPaused={isPaused}
            currentReplayIndex={currentReplayIndex}
            onPlayReplay={() => {
              void playReplay()
            }}
            onTogglePause={togglePause}
            onStopReplay={stopReplay}
            replaySpeed={replaySpeed}
            replayStartDelay={replayStartDelay}
            onReplaySpeedChange={setReplaySpeed}
            onReplayStartDelayChange={setReplayStartDelay}
            onShareReplay={() => setShowSaveReplayDialog(true)}
          />
        )}

        {/* Action buttons (Undo/Redo/Reset and mobile toggles) */}
        <ActionButtons
          canUndo={canUndo}
          canRedo={canRedo}
          undoDescription={undoDescription}
          redoDescription={redoDescription}
          onUndo={undo}
          onRedo={redo}
          isDeckLoaded={isDeckLoaded}
          hasInitialState={!!initialStateAfterDeckLoad}
          onReset={() => setShowResetConfirmDialog(true)}
          isPlaying={isPlaying}
          isPaused={isPaused}
          currentReplayIndex={currentReplayIndex}
          mobileDefenseMode={mobileDefenseMode}
          mobileFaceDownMode={mobileFaceDownMode}
          mobileStackBottom={mobileStackBottom}
          onToggleDefenseMode={() => setMobileDefenseMode(!mobileDefenseMode)}
          onToggleFaceDownMode={() => setMobileFaceDownMode(!mobileFaceDownMode)}
          onToggleStackBottom={() => setMobileStackBottom(!mobileStackBottom)}
          isTouchDevice={isTouchDevice}
        />

        {/* Opponent's Area */}
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
            </div>
          )}

          {isOpponentFieldOpen && (
            <div className="space-y-2 mb-2">
              {/* Opponent's Deck */}
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

              {/* Opponent's Hand & Extra Deck */}
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
        </div>

        {/* Combined Field Layout */}
        <div className="mb-2 flex justify-center">
          <div
            ref={gridRef}
            className={cn(
              "grid gap-1 sm:gap-2 p-1 sm:p-2 mx-auto relative overflow-visible",
              isLargeScreen
                ? "grid-cols-[93px_38px_repeat(5,38px)_auto] sm:grid-cols-[93px_55px_repeat(5,55px)_auto] md:grid-cols-[93px_66px_repeat(5,66px)_auto]"
                : "grid-cols-[38px_repeat(5,38px)_auto] sm:grid-cols-[55px_repeat(5,55px)_auto] md:grid-cols-[66px_repeat(5,66px)_auto]",
            )}
          >
            {isLargeScreen && (
              <div
                className={cn(
                  "side-free-zone-self col-start-1 row-span-2",
                  isOpponentFieldOpen ? "row-start-4" : "row-start-2",
                )}
                style={{
                  marginTop: "-105px",
                  zIndex: 10,
                  position: "relative",
                }}
              >
                <GraveZone
                  type="sideFree"
                  cardCount={(playerBoard.sideFreeZone ?? []).length}
                  cards={playerBoard.sideFreeZone ?? []}
                  zone={{ player: "self", type: "sideFreeZone" }}
                  onDrop={handleCardDrop}
                  onContextMenu={handleCardContextMenu}
                  onContextMenuClose={() => setContextMenu(null)}
                  style={{
                    height: isLargeScreen
                      ? GRAVE_ZONE_SIZE.SELF.LARGE.HEIGHT
                      : isMediumScreen
                        ? GRAVE_ZONE_SIZE.SELF.MEDIUM.HEIGHT
                        : GRAVE_ZONE_SIZE.SELF.SMALL.HEIGHT,
                    width: isLargeScreen
                      ? GRAVE_ZONE_SIZE.SELF.LARGE.WIDTH
                      : isMediumScreen
                        ? GRAVE_ZONE_SIZE.SELF.MEDIUM.WIDTH
                        : GRAVE_ZONE_SIZE.SELF.SMALL.WIDTH,
                  }}
                />
              </div>
            )}
            {/* Opponent's Field (when open) */}
            {isOpponentFieldOpen && (
              <>
                {/* Row 1: Opponent's Spell/Trap Zones + Grave/Banish */}
                {
                  isLargeScreen ? <div className="col-start-2" /> : <div /> // Empty space above spell/trap zones on large screens
                }
                {[0, 1, 2, 3, 4].map((index) => (
                  <Zone
                    key={`opponent-spell-${index}`}
                    className={index === 0 ? "spell-trap-zone-opponent" : ""}
                    type="spell"
                    zone={{ player: "opponent", type: "spellTrapZone", index }}
                    cards={opponentBoard.spellTrapZones[index]}
                    onDrop={handleCardDrop}
                    onContextMenu={handleCardContextMenu}
                    onContextMenuClose={() => setContextMenu(null)}
                  />
                ))}
                <div className="row-span-2 flex gap-1 sm:gap-2" style={{ zIndex: 10, position: "relative" }}>
                  <GraveZone
                    type="grave"
                    cardCount={opponentBoard.graveyard.length}
                    cards={opponentBoard.graveyard}
                    zone={{ player: "opponent", type: "graveyard" }}
                    onDrop={handleCardDrop}
                    isOpponent={true}
                    onContextMenu={handleCardContextMenu}
                    onContextMenuClose={() => setContextMenu(null)}
                    style={{
                      height: isLargeScreen
                        ? GRAVE_ZONE_SIZE.OPPONENT.LARGE.HEIGHT
                        : isMediumScreen
                          ? GRAVE_ZONE_SIZE.OPPONENT.MEDIUM.HEIGHT
                          : isSmallScreen
                            ? GRAVE_ZONE_SIZE.OPPONENT.SMALL.HEIGHT
                            : GRAVE_ZONE_SIZE.OPPONENT.SP.HEIGHT,
                      width: isLargeScreen
                        ? GRAVE_ZONE_SIZE.OPPONENT.LARGE.WIDTH
                        : isMediumScreen
                          ? GRAVE_ZONE_SIZE.OPPONENT.MEDIUM.WIDTH
                          : isSmallScreen
                            ? GRAVE_ZONE_SIZE.OPPONENT.SMALL.WIDTH
                            : GRAVE_ZONE_SIZE.OPPONENT.SP.WIDTH,
                    }}
                  />
                  <GraveZone
                    type="banish"
                    cardCount={opponentBoard.banished.length}
                    cards={opponentBoard.banished}
                    zone={{ player: "opponent", type: "banished" }}
                    onDrop={handleCardDrop}
                    isOpponent={true}
                    onContextMenu={handleCardContextMenu}
                    onContextMenuClose={() => setContextMenu(null)}
                    style={{
                      height: isLargeScreen
                        ? GRAVE_ZONE_SIZE.OPPONENT.LARGE.HEIGHT
                        : isMediumScreen
                          ? GRAVE_ZONE_SIZE.OPPONENT.MEDIUM.HEIGHT
                          : isSmallScreen
                            ? GRAVE_ZONE_SIZE.OPPONENT.SMALL.HEIGHT
                            : GRAVE_ZONE_SIZE.OPPONENT.SP.HEIGHT,
                      width: isLargeScreen
                        ? GRAVE_ZONE_SIZE.OPPONENT.LARGE.WIDTH
                        : isMediumScreen
                          ? GRAVE_ZONE_SIZE.OPPONENT.MEDIUM.WIDTH
                          : isSmallScreen
                            ? GRAVE_ZONE_SIZE.OPPONENT.SMALL.WIDTH
                            : GRAVE_ZONE_SIZE.OPPONENT.SP.WIDTH,
                    }}
                  />
                </div>
                {/* Row 2: Opponent's Field + Monster Zones */}
                {
                  isLargeScreen && <div className="col-start-1" /> // Empty space above field zone on large screens
                }
                <Zone
                  type="field"
                  zone={{ player: "opponent", type: "fieldZone" }}
                  card={opponentBoard.fieldZone}
                  onDrop={handleCardDrop}
                  onContextMenu={handleCardContextMenu}
                  onContextMenuClose={() => setContextMenu(null)}
                />
                {[0, 1, 2, 3, 4].map((index) => (
                  <Zone
                    key={`opponent-monster-${index}`}
                    type="monster"
                    zone={{ player: "opponent", type: "monsterZone", index }}
                    cards={opponentBoard.monsterZones[index]}
                    onDrop={handleCardDrop}
                    onContextMenu={handleCardContextMenu}
                    onContextMenuClose={() => setContextMenu(null)}
                  />
                ))}
              </>
            )}
            {/* Row 3: EMZs (shared row between both players) */}
            <Zone
              className={cn(
                "emz-zone-self",
                isOpponentFieldOpen ? "row-start-3" : "row-start-1",
                isLargeScreen ? "col-start-4" : "col-start-3",
              )}
              type="emz"
              zone={{ player: "self", type: "extraMonsterZone", index: 0 }}
              cards={playerBoard.extraMonsterZones[0]}
              onDrop={handleCardDrop}
              onContextMenu={handleCardContextMenu}
              onContextMenuClose={() => setContextMenu(null)}
            />
            <Zone
              className={cn(
                isOpponentFieldOpen ? "row-start-3" : "row-start-1",
                isLargeScreen ? "col-start-6" : "col-start-5",
              )}
              type="emz"
              zone={{ player: "self", type: "extraMonsterZone", index: 1 }}
              cards={playerBoard.extraMonsterZones[1]}
              onDrop={handleCardDrop}
              onContextMenu={handleCardContextMenu}
              onContextMenuClose={() => setContextMenu(null)}
            />
            {/* Player's Field + Monster Zones */}
            <Zone
              className={cn(isOpponentFieldOpen ? "row-start-4" : "row-start-2", isLargeScreen ? "col-start-2" : "")}
              type="field"
              zone={{ player: "self", type: "fieldZone" }}
              card={playerBoard.fieldZone}
              onDrop={handleCardDrop}
              onContextMenu={handleCardContextMenu}
              onContextMenuClose={() => setContextMenu(null)}
            />
            {[0, 1, 2, 3, 4].map((index) => (
              <Zone
                key={`self-monster-${index}`}
                className={cn("", isOpponentFieldOpen ? "row-start-4" : "row-start-2")}
                type="monster"
                zone={{ player: "self", type: "monsterZone", index }}
                cards={playerBoard.monsterZones[index]}
                onDrop={handleCardDrop}
                onContextMenu={handleCardContextMenu}
                onContextMenuClose={() => setContextMenu(null)}
              />
            ))}
            {/* Player's Grave/Banish (spanning monster and spell rows) */}
            <div
              className={cn(
                "row-span-2 flex gap-1 sm:gap-2 player-grave-container",
                isOpponentFieldOpen ? "row-start-4" : "row-start-2",
              )}
            >
              <div
                className="flex gap-1 sm:gap-2"
                style={{
                  marginTop: isLargeScreen
                    ? GRAVE_ZONE_SIZE.SELF.LARGE.MARGIN_TOP
                    : isMediumScreen
                      ? GRAVE_ZONE_SIZE.SELF.MEDIUM.MARGIN_TOP
                      : isSmallScreen
                        ? GRAVE_ZONE_SIZE.SELF.SMALL.MARGIN_TOP
                        : GRAVE_ZONE_SIZE.SELF.SP.MARGIN_TOP,
                  zIndex: 10,
                  position: "relative",
                }}
              >
                <GraveZone
                  type="grave"
                  cardCount={playerBoard.graveyard.length}
                  cards={playerBoard.graveyard}
                  zone={{ player: "self", type: "graveyard" }}
                  onDrop={handleCardDrop}
                  onContextMenu={handleCardContextMenu}
                  onContextMenuClose={() => setContextMenu(null)}
                  onLabelClick={() => openZoneExpandModal({ player: "self", type: "graveyard" })}
                  isDisabled={expandedZone?.type === "graveyard"}
                  className="grave-zone-self"
                  style={{
                    height: isLargeScreen
                      ? GRAVE_ZONE_SIZE.SELF.LARGE.HEIGHT
                      : isMediumScreen
                        ? GRAVE_ZONE_SIZE.SELF.MEDIUM.HEIGHT
                        : isSmallScreen
                          ? GRAVE_ZONE_SIZE.SELF.SMALL.HEIGHT
                          : GRAVE_ZONE_SIZE.SELF.SP.HEIGHT,
                    width: isLargeScreen
                      ? GRAVE_ZONE_SIZE.SELF.LARGE.WIDTH
                      : isMediumScreen
                        ? GRAVE_ZONE_SIZE.SELF.MEDIUM.WIDTH
                        : isSmallScreen
                          ? GRAVE_ZONE_SIZE.SELF.SMALL.WIDTH
                          : GRAVE_ZONE_SIZE.SELF.SP.WIDTH,
                  }}
                />
                <GraveZone
                  type="banish"
                  cardCount={playerBoard.banished.length}
                  cards={playerBoard.banished}
                  zone={{ player: "self", type: "banished" }}
                  onDrop={handleCardDrop}
                  onContextMenu={handleCardContextMenu}
                  onContextMenuClose={() => setContextMenu(null)}
                  onLabelClick={() => openZoneExpandModal({ player: "self", type: "banished" })}
                  isDisabled={expandedZone?.type === "banished"}
                  className="banish-zone-self"
                  style={{
                    height: isLargeScreen
                      ? GRAVE_ZONE_SIZE.SELF.LARGE.HEIGHT
                      : isMediumScreen
                        ? GRAVE_ZONE_SIZE.SELF.MEDIUM.HEIGHT
                        : isSmallScreen
                          ? GRAVE_ZONE_SIZE.SELF.SMALL.HEIGHT
                          : GRAVE_ZONE_SIZE.SELF.SP.HEIGHT,
                    width: isLargeScreen
                      ? GRAVE_ZONE_SIZE.SELF.LARGE.WIDTH
                      : isMediumScreen
                        ? GRAVE_ZONE_SIZE.SELF.MEDIUM.WIDTH
                        : isSmallScreen
                          ? GRAVE_ZONE_SIZE.SELF.SMALL.WIDTH
                          : GRAVE_ZONE_SIZE.SELF.SP.WIDTH,
                  }}
                />
              </div>
            </div>
            {/* Player's Spell/Trap Zones */}
            {/* Free Zone (below field zone) */}
            <Zone
              className={cn(isOpponentFieldOpen ? "row-start-5" : "row-start-3", isLargeScreen ? "col-start-2" : "")}
              type="free"
              zone={{ player: "self", type: "freeZone" }}
              cards={playerBoard.freeZone}
              onDrop={handleCardDrop}
              onContextMenu={handleCardContextMenu}
              onContextMenuClose={() => setContextMenu(null)}
            />
            {[0, 1, 2, 3, 4].map((index) => (
              <Zone
                key={`self-spell-${index}`}
                className={cn(
                  index === 0 ? "spell-trap-zone-self" : "",
                  isOpponentFieldOpen ? "row-start-5" : "row-start-3",
                )}
                type="spell"
                zone={{ player: "self", type: "spellTrapZone", index }}
                cards={playerBoard.spellTrapZones[index]}
                onDrop={handleCardDrop}
                onContextMenu={handleCardContextMenu}
                onContextMenuClose={() => setContextMenu(null)}
              />
            ))}
          </div>
        </div>

        {/* Player's Hand & Extra Deck (Bottom) */}
        <div className="space-y-2">
          <div className="flex gap-2 items-start">
            <DeckZone
              type="hand"
              zone={{ player: "self", type: "hand" }}
              cardCount={playerBoard.hand.length}
              cards={playerBoard.hand}
              onDrop={handleCardDrop}
              onContextMenu={handleCardContextMenu}
              onContextMenuClose={() => setContextMenu(null)}
              className="hand-zone-self"
              style={{ width: "35%" }}
            />
            <DeckZone
              type="extra"
              zone={{ player: "self", type: "extraDeck" }}
              cardCount={playerBoard.extraDeck.length}
              cards={playerBoard.extraDeck}
              onDrop={handleCardDrop}
              onContextMenu={handleCardContextMenu}
              onContextMenuClose={() => setContextMenu(null)}
              className="extra-zone-self"
              style={{ width: "65%" }}
              onLabelClick={!isPc ? openExtraDeckExpandModal : undefined}
              isDisabled={isExtraDeckExpanded}
            />
          </div>
          <DeckZone
            type="deck"
            zone={{ player: "self", type: "deck" }}
            cardCount={playerBoard.deck.length}
            cards={playerBoard.deck}
            onDrop={handleCardDrop}
            onContextMenu={handleCardContextMenu}
            onContextMenuClose={() => setContextMenu(null)}
            className="deck-zone-self"
          />
          {/* Side Deck (below main deck) */}
          {(hasSideDeck || (playerBoard.sideDeck && playerBoard.sideDeck.length > 0)) && (
            <DeckZone
              type="side"
              zone={{ player: "self", type: "sideDeck" }}
              cardCount={playerBoard.sideDeck?.length ?? 0}
              cards={playerBoard.sideDeck ?? []}
              onDrop={handleCardDrop}
              onContextMenu={handleCardContextMenu}
              onContextMenuClose={() => setContextMenu(null)}
              className="side-deck-zone-self"
            />
          )}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <CardContextMenu
          card={contextMenu.card}
          zone={contextMenu.zone}
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
          onAction={handleContextMenuAction}
          isReplayActive={isPlaying}
        />
      )}

      {/* Card Animation Overlay */}
      <CardAnimationOverlay />

      {/* Help Button for Touch Devices */}
      {isTouchDevice && <HelpButton />}

      {/* Recording Confirmation Dialog */}
      <Dialog open={showRecordingConfirmDialog} onOpenChange={setShowRecordingConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>録画データの上書き確認</DialogTitle>
            <DialogDescription>
              既に録画されたリプレイデータが存在します。 新しい録画を開始すると、現在のリプレイデータは上書きされます。
              続行しますか？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <button
              onClick={() => setShowRecordingConfirmDialog(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={() => {
                setShowRecordingConfirmDialog(false)
                startRecording()
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-md transition-colors"
            >
              録画開始
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Confirmation Dialog */}
      <Dialog open={showResetConfirmDialog} onOpenChange={setShowResetConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ゲーム状態のリセット確認</DialogTitle>
            <DialogDescription>
              現在のゲーム状態をリセットして、デッキ読み込み直後の状態に戻します。 この操作は元に戻すことができません。
              続行しますか？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <button
              onClick={() => setShowResetConfirmDialog(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={() => {
                setShowResetConfirmDialog(false)
                resetToInitialState()
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-md transition-colors"
            >
              リセット
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save Replay Dialog */}
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

      {/* Share URL Dialog */}
      <ShareUrlDisplay
        isOpen={showShareUrlDialog}
        onOpenChange={setShowShareUrlDialog}
        shareUrl={shareUrl}
        shareTitle={shareTitle}
        onClose={() => setShowShareUrlDialog(false)}
      />

      {/* Zone Expand Modal */}
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

      {/* Extra Deck Expand Modal */}
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

      {/* Token Limit Error Dialog */}
      <AlertDialog open={showTokenLimitDialog} onOpenChange={setShowTokenLimitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>トークン生成エラー</AlertDialogTitle>
            <AlertDialogDescription>
              フリーゾーンには既に5枚以上のカードが存在します。 これ以上トークンを生成することはできません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button onClick={() => setShowTokenLimitDialog(false)} variant="default">
              OK
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 5-card Draw Warning Dialog */}
      <Dialog open={showDrawWarningDialog} onOpenChange={setShowDrawWarningDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>5枚ドロー確認</DialogTitle>
            <DialogDescription>
              手札・デッキ・エクストラデッキ以外のゾーンにカードが存在します。
              5枚ドローを実行すると、全てのカードがデッキに戻され、シャッフル後に5枚を引き直します。
              この操作は元に戻すことができません。 続行しますか？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <button
              onClick={() => setShowDrawWarningDialog(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={handleConfirmedDraw5Cards}
              className="px-4 py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-md transition-colors"
            >
              5枚ドロー実行
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Help Text for PC - Always show on PC devices */}
      {isPc && (
        <div className="hidden md:block fixed bottom-4 right-4 max-w-xs">
          <div className="bg-gray-800/90 text-white rounded-lg text-xs">
            <div className={cn("px-3 pt-3 flex items-center justify-between", isHintMinimized ? "pb-3" : "pb-1")}>
              <div className="font-semibold">{t("game:field.operationHints")}</div>
              <button
                onClick={() => {
                  const newState = !isHintMinimized
                  setIsHintMinimized(newState)
                  localStorage.setItem("duel-simulator-hint-minimized", String(newState))
                }}
                className="bg-gray-600 hover:bg-gray-500 text-white transition-colors p-1 rounded"
                aria-label={isHintMinimized ? "Expand" : "Minimize"}
              >
                {isHintMinimized ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>
            <div
              className={cn(
                "space-y-1 text-gray-300 px-3 transition-all duration-200",
                isHintMinimized ? "h-0 overflow-hidden pb-0" : "pb-3",
              )}
            >
              <div>
                • <span className="text-yellow-400">{t("game:field.shiftDrag")}</span>:
              </div>
              <div className="ml-4 text-xs">- {t("game:field.emptyZone")}</div>
              <div className="ml-4 text-xs">- {t("game:field.cardZone")}</div>
              <div>
                • <span className="text-blue-400">{t("game:field.dropOnCards")}</span>:
              </div>
              <div className="ml-4 text-xs">- {t("game:field.stackTop")}</div>
              <div className="ml-4 text-xs">- {t("game:field.stackBottom")}</div>
              <div>
                • <span className="text-green-400">{t("game:field.graveClickExpand")}</span>
              </div>
              <div>
                • <span className="text-gray-400">{t("game:field.rightClickMenu")}</span>
              </div>
              <div>
                • <span className="text-purple-400">{t("game:field.doubleClickEffect")}</span>
              </div>
              <div>
                • <span className="text-purple-400">{t("game:field.shiftDoubleClickTarget")}</span>
              </div>
              <div>
                • <span className="text-gray-400">{t("game:field.undoShortcut")}</span>
              </div>
              <div>
                • <span className="text-gray-400">{t("game:field.redoShortcut")}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
