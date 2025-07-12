import React, { useState, useRef, useEffect, useCallback } from "react"
import { cn } from "@client/lib/utils"
import { ChevronDown, ChevronUp, PlusCircle, MoreHorizontal, Shuffle, Layers2 } from "lucide-react"
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
  rotateCardAtom,
  activateEffectAtom,
  targetSelectAtom,
  flipCardAtom,
  toggleCardHighlightAtom,
  resetToInitialStateAtom,
  initialStateAfterDeckLoadAtom,
  deckMetadataAtom,
  generateTokenAtom,
  shuffleDeckAtom,
  drawMultipleCardsAtom,
  hasEverPlayedInReplayModeAtom,
  forceDraw5CardsAtom,
} from "@/client/atoms/boardAtoms"
import type { Card as GameCard, ZoneId } from "@/shared/types/game"
import { CardContextMenu } from "@/client/components/CardContextMenu"
import { CardAnimationOverlay } from "@/client/components/CardAnimationOverlay"
import { SaveReplayDialog } from "@/client/components/SaveReplayDialog"
import { ShareUrlDisplay } from "@/client/components/ShareUrlDisplay"
import { ZoneExpandModal } from "@/client/components/ZoneExpandModal"
import { saveReplayData } from "@/client/api/gameState"
import { calculateImageHash, saveDeckImage } from "@/client/api/deck"
import type { ReplaySaveData } from "@/shared/types/game"
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

  const [isOpponentFieldOpen, setIsOpponentFieldOpen] = useState(false)
  const [isExtraActionsOpen, setIsExtraActionsOpen] = useState(false)
  const [mobileDefenseMode, setMobileDefenseMode] = useState(false)
  const [mobileFaceDownMode, setMobileFaceDownMode] = useState(false)
  const [mobileStackBottom, setMobileStackBottom] = useState(false)
  const [isTouchDevice] = useState(() => "ontouchstart" in window || navigator.maxTouchPoints > 0)
  const [isLargeScreen, setIsLargeScreen] = useState(() => window.innerWidth >= 1024)
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
  const [, flipCard] = useAtom(flipCardAtom)
  const [, toggleCardHighlight] = useAtom(toggleCardHighlightAtom)
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

  // Recording confirmation dialog state
  const [showRecordingConfirmDialog, setShowRecordingConfirmDialog] = useState(false)

  // Reset confirmation dialog state
  const [showResetConfirmDialog, setShowResetConfirmDialog] = useState(false)

  // Save replay dialog state
  const [showSaveReplayDialog, setShowSaveReplayDialog] = useState(false)
  const [_isSavingReplay, setIsSavingReplay] = useState(false)
  const [shareUrl, setShareUrl] = useState<string>("")
  const [showShareUrlDialog, setShowShareUrlDialog] = useState(false)

  // Token generation error dialog state
  const [showTokenLimitDialog, setShowTokenLimitDialog] = useState(false)

  // 5-card draw warning dialog state
  const [showDrawWarningDialog, setShowDrawWarningDialog] = useState(false)

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
  const [playerGraveHeight, setPlayerGraveHeight] = useState<number | null>(null)
  const [playerGraveMarginTop, setPlayerGraveMarginTop] = useState<number | null>(null)
  const [opponentGraveHeight, setOpponentGraveHeight] = useState<number | null>(null)

  const handleCardDrop = (from: ZoneId, to: ZoneId, shiftKey?: boolean) => {
    console.log("handleCardDrop called:", { from, to, draggedCard })
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
        } else if (action === "flip" && contextMenu) {
          // Include card ID for ID-based tracking
          flipCard({ zone: contextMenu.zone, cardId: card.id })
        } else if (action === "highlight" && contextMenu) {
          // Toggle highlight state
          toggleCardHighlight({ zone: contextMenu.zone, cardId: card.id })
        }
      } catch (error) {
        // Show error on mobile for debugging
        alert(`Error in ${action}: ${error instanceof Error ? error.message : String(error)}`)
        console.error(`Error in handleContextMenuAction (${action}):`, error)
      }
    },
    [rotateCard, activateEffect, targetSelect, flipCard, toggleCardHighlight, contextMenu],
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
          undo()
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

      try {
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
        const response = await saveReplayData(saveData, imageHash, deckMetadata.deckConfig, deckMetadata.deckCardIds)

        // Show share URL dialog
        setShareUrl(response.shareUrl)
        setShowSaveReplayDialog(false)
        setShowShareUrlDialog(true)
      } catch (error) {
        console.error("Failed to save replay:", error)
        alert("リプレイの保存に失敗しました")
      } finally {
        setIsSavingReplay(false)
      }
    },
    [replayData, deckMetadata],
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

      const _handRect = handElement.getBoundingClientRect()
      const _extraDeckRect = extraDeckElement.getBoundingClientRect()
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

  // Update isLargeScreen on window resize
  useEffect(() => {
    const handleResize = () => {
      setIsLargeScreen(window.innerWidth >= 1024)
    }
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  // Calculate grave zone positions dynamically
  useEffect(() => {
    const calculatePositions = () => {
      if (!gridRef.current) return

      // Get all zone elements
      const emzElement = gridRef.current.querySelector(".emz-zone-self")
      const spellTrapElement = gridRef.current.querySelector(".spell-trap-zone-self")
      const opponentSpellTrapElement = gridRef.current.querySelector(".spell-trap-zone-opponent")
      const opponentMonsterElement = gridRef.current.querySelector(".monster-zone-opponent")

      if (emzElement && spellTrapElement) {
        const emzRect = emzElement.getBoundingClientRect()
        const spellTrapRect = spellTrapElement.getBoundingClientRect()

        // Calculate player grave zone height
        const height = spellTrapRect.bottom - emzRect.top
        setPlayerGraveHeight(height)

        // Calculate margin top to align with EMZ top
        // Get the parent container of grave zones
        const graveContainer = gridRef.current.querySelector(".player-grave-container")
        if (graveContainer) {
          const containerRect = graveContainer.getBoundingClientRect()
          const marginTop = emzRect.top - containerRect.top
          setPlayerGraveMarginTop(marginTop)
        }
      }

      if (isOpponentFieldOpen && opponentSpellTrapElement && opponentMonsterElement) {
        const spellTrapRect = opponentSpellTrapElement.getBoundingClientRect()
        const monsterRect = opponentMonsterElement.getBoundingClientRect()

        // Calculate opponent grave zone height (2 rows: spell/trap to monster)
        const height = monsterRect.bottom - spellTrapRect.top
        setOpponentGraveHeight(height)
      }
    }

    // Initial calculation
    calculatePositions()

    // Recalculate on window resize
    window.addEventListener("resize", calculatePositions)

    // Observe grid changes
    const resizeObserver = new ResizeObserver(calculatePositions)
    if (gridRef.current) {
      resizeObserver.observe(gridRef.current)
    }

    return () => {
      window.removeEventListener("resize", calculatePositions)
      resizeObserver.disconnect()
    }
  }, [isOpponentFieldOpen])

  return (
    <>
      <div className="w-full max-w-6xl mx-auto p-2 sm:p-4">
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
          <div className="flex items-center justify-start gap-2 mb-1">
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
              <span>その他操作</span>
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
                  <span>相手フィールドを非表示</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  <span>相手フィールドの表示</span>
                </>
              )}
            </button>
          </div>
          {isExtraActionsOpen && (
            <div className="flex items-center justify-start gap-2 mb-1">
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
                <span>シャッフル</span>
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
                <span>ランダム5ドロー</span>
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
                <span>トークン生成</span>
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
            {/* Side Free Zone (1024px and above) */}
            {isLargeScreen && (
              <div
                className={cn(
                  "side-free-zone-self col-start-1 row-span-2",
                  isOpponentFieldOpen ? "row-start-4" : "row-start-2",
                )}
                style={{
                  marginTop:
                    playerGraveMarginTop != null
                      ? `${playerGraveMarginTop}px`
                      : window.innerWidth >= 768
                        ? "-116px"
                        : window.innerWidth >= 640
                          ? "-84px"
                          : "-58px",
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
                    height:
                      playerGraveHeight != null
                        ? `${playerGraveHeight}px`
                        : window.innerWidth >= 768
                          ? "348px"
                          : window.innerWidth >= 640
                            ? "252px"
                            : "174px",
                    width: "93px",
                  }}
                />
              </div>
            )}
            {/* Opponent's Field (when open) */}
            {isOpponentFieldOpen && (
              <>
                {/* Row 1: Opponent's Spell/Trap Zones + Grave/Banish */}
                <div className={isLargeScreen ? "col-start-2" : ""} /> {/* Empty space above field zone */}
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
                      height:
                        opponentGraveHeight != null
                          ? `${opponentGraveHeight}px`
                          : window.innerWidth >= 768
                            ? "200px"
                            : window.innerWidth >= 640
                              ? "168px"
                              : "116px",
                      width: window.innerWidth >= 768 ? "82px" : window.innerWidth >= 640 ? "70px" : "56px",
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
                      height:
                        opponentGraveHeight != null
                          ? `${opponentGraveHeight}px`
                          : window.innerWidth >= 768
                            ? "200px"
                            : window.innerWidth >= 640
                              ? "168px"
                              : "116px",
                      width: window.innerWidth >= 768 ? "82px" : window.innerWidth >= 640 ? "70px" : "56px",
                    }}
                  />
                </div>
                {/* Row 2: Opponent's Field + Monster Zones */}
                <Zone
                  className={cn("row-start-2", isLargeScreen ? "col-start-2" : "")}
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
                    className={cn("row-start-2", index === 0 ? "monster-zone-opponent" : "")}
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
                  marginTop:
                    playerGraveMarginTop != null
                      ? `${playerGraveMarginTop}px`
                      : window.innerWidth >= 768
                        ? "-116px"
                        : window.innerWidth >= 640
                          ? "-84px"
                          : "-58px",
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
                    height:
                      playerGraveHeight != null
                        ? `${playerGraveHeight}px`
                        : window.innerWidth >= 768
                          ? "348px"
                          : window.innerWidth >= 640
                            ? "252px"
                            : "174px",
                    width:
                      window.innerWidth >= 1024
                        ? "93px"
                        : window.innerWidth >= 768
                          ? "82px"
                          : window.innerWidth >= 640
                            ? "70px"
                            : "56px",
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
                    height:
                      playerGraveHeight != null
                        ? `${playerGraveHeight}px`
                        : window.innerWidth >= 768
                          ? "348px"
                          : window.innerWidth >= 640
                            ? "252px"
                            : "174px",
                    width:
                      window.innerWidth >= 1024
                        ? "93px"
                        : window.innerWidth >= 768
                          ? "82px"
                          : window.innerWidth >= 640
                            ? "70px"
                            : "56px",
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
        />
      )}

      {/* Share URL Dialog */}
      <ShareUrlDisplay
        isOpen={showShareUrlDialog}
        onOpenChange={setShowShareUrlDialog}
        shareUrl={shareUrl}
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

      {/* Token Limit Error Dialog */}
      <AlertDialog open={showTokenLimitDialog} onOpenChange={setShowTokenLimitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>トークン生成エラー</AlertDialogTitle>
            <AlertDialogDescription>
              フリーゾーンには既に5枚以上のカードが存在します。
              これ以上トークンを生成することはできません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              onClick={() => setShowTokenLimitDialog(false)}
              variant="default"
            >
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
              この操作は元に戻すことができません。
              続行しますか？
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

      {/* Help Text for PC/Tablet - Show on medium and larger screens for non-touch devices */}
      <div
        className={cn(
          "hidden md:block fixed bottom-4 right-4 max-w-xs",
          isTouchDevice && "md:hidden lg:hidden", // Hide on touch devices regardless of screen size
        )}
      >
        <div className="bg-gray-800/90 text-white rounded-lg p-3 text-xs">
          <div className="font-semibold mb-1">操作ヒント</div>
          <div className="space-y-1 text-gray-300">
            <div>
              • <span className="text-yellow-400">Shift + ドラッグ</span>:
            </div>
            <div className="ml-4 text-xs">- 空きゾーン: 守備表示/セット</div>
            <div className="ml-4 text-xs">- カードがあるゾーン: 下に重ねる</div>
            <div>
              • <span className="text-blue-400">カードがあるゾーンにドロップ</span>:
            </div>
            <div className="ml-4 text-xs">- 通常: 上に重ねる</div>
            <div className="ml-4 text-xs">- Shift押下: 下に重ねる</div>
            <div>
              • <span className="text-green-400">墓地/除外ラベルクリック</span>: ゾーン拡大
            </div>
            <div>
              • <span className="text-gray-400">右クリック</span>: カードメニュー
            </div>
            <div>
              • <span className="text-gray-400">Ctrl/Cmd + Z/Y</span>: 元に戻す/やり直し
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
