import React, { useRef, useState } from "react"
import { X } from "lucide-react"
import { cn } from "@client/lib/utils"
import { DraggableCard } from "@/client/components/DraggableCard"
import { useAtom, useAtomValue } from "jotai"
import { draggedCardAtom, hoveredZoneAtom } from "@/client/atoms/boardAtoms"
import { useScreenSize } from "@client/hooks/useScreenSize"
import { useDeviceType } from "@client/hooks/useDeviceType"
import { SCREEN_WIDTH } from "@client/constants/screen"
import { useTranslation } from "react-i18next"
import type { Card as GameCard, ZoneId } from "@/shared/types/game"

interface ExtraDeckExpandModalProps {
  isOpen: boolean
  onClose: () => void
  cards: GameCard[]
  onDrop: (fromZone: ZoneId, toZone: ZoneId, shiftKey?: boolean) => void
  onContextMenu: (e: React.MouseEvent | React.TouchEvent, card: GameCard, zone: ZoneId) => void
  onContextMenuClose?: () => void
  modalBounds: {
    top: number
    left: number
    width: number
    bottom: number
  }
}

export function ExtraDeckExpandModal({
  isOpen,
  onClose,
  cards,
  onDrop,
  onContextMenu,
  onContextMenuClose,
  modalBounds,
}: ExtraDeckExpandModalProps) {
  const { t } = useTranslation(["game", "ui"])
  const modalRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [hoveredZone, setHoveredZone] = useAtom(hoveredZoneAtom)
  const draggedCard = useAtomValue(draggedCardAtom)
  const { isMediumScreen, isSmallScreen } = useScreenSize()
  const { isMobile, isTablet } = useDeviceType()
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const [hoveredCardIndex, setHoveredCardIndex] = useState<number | null>(null)

  // Calculate modal dimensions
  const modalWidth = modalBounds.width
  const modalHeight = modalBounds.bottom - modalBounds.top

  // Card dimensions (same as deck zone)
  const cardHeightPx = isMediumScreen ? 96 : isSmallScreen ? 80 : 56
  const cardWidthPx = Math.round((cardHeightPx * 59) / 86)

  // Calculate layout parameters
  const padding = isSmallScreen ? 12 : 8 // Reduced padding to prevent scroll
  const headerHeight = 28
  const cardSpacing = window.innerWidth >= SCREEN_WIDTH.MEDIUM ? 15 : 10

  // Cards per row limit based on device type
  const cardsPerRowLimit = isMobile ? 8 : isTablet ? 10 : 15 // Should not reach PC limit

  // Calculate available space
  const availableWidth = modalWidth - padding * 2
  const availableHeight = modalHeight - padding * 2 - headerHeight

  // Calculate rows needed
  const rowCount = Math.ceil(cards.length / cardsPerRowLimit)

  // Distribute cards evenly across rows
  const getCardsPerRow = (rowIndex: number) => {
    if (rowCount === 1) return cards.length

    // Distribute cards as evenly as possible
    const baseCardsPerRow = Math.floor(cards.length / rowCount)
    const remainingCards = cards.length % rowCount

    // Add one extra card to the first 'remainingCards' rows
    return rowIndex < remainingCards ? baseCardsPerRow + 1 : baseCardsPerRow
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (draggedCard != null) {
      setHoveredZone({ player: "self", type: "extraDeck" })

      // Calculate drop index based on mouse position
      if (contentRef.current && cards.length > 0) {
        const rect = contentRef.current.getBoundingClientRect()
        const relativeX = e.clientX - rect.left
        const relativeY = e.clientY - rect.top

        // For empty zones, set index to 0
        if (cards.length === 0) {
          setDropIndex(0)
          return
        }

        // Calculate which row we're in
        const rowHeight = cardHeightPx + 12 // Include gap
        const currentRow = Math.min(Math.floor(relativeY / rowHeight), rowCount - 1)

        // Calculate actual cards per row for the current row
        let rowStartIdx = 0
        for (let i = 0; i < currentRow; i++) {
          rowStartIdx += getCardsPerRow(i)
        }
        const cardsInCurrentRow = getCardsPerRow(currentRow)

        if (cardsInCurrentRow === 0) {
          setDropIndex(0)
          return
        }

        // Calculate card positions for the current row
        const totalWidth = (cardsInCurrentRow - 1) * cardSpacing + cardsInCurrentRow * cardWidthPx
        const needsOverlap = totalWidth > availableWidth
        let insertIndex = rowStartIdx

        if (!needsOverlap) {
          // Cards are left-aligned with fixed spacing
          for (let i = 0; i < cardsInCurrentRow; i++) {
            const cardLeft = i * (cardWidthPx + cardSpacing)
            const cardCenter = cardLeft + cardWidthPx / 2

            if (relativeX < cardCenter) {
              insertIndex = rowStartIdx + i
              break
            } else if (i === cardsInCurrentRow - 1) {
              insertIndex = rowStartIdx + cardsInCurrentRow
            }
          }
        } else {
          // Cards are overlapping - calculate based on proportional spacing
          const maxPosition = availableWidth - cardWidthPx
          const overlapSpacing = cardsInCurrentRow > 1 ? maxPosition / (cardsInCurrentRow - 1) : 0

          for (let i = 0; i < cardsInCurrentRow; i++) {
            const cardLeft = i * overlapSpacing
            const cardCenter = cardLeft + cardWidthPx / 2

            if (relativeX < cardCenter) {
              insertIndex = rowStartIdx + i
              break
            } else if (i === cardsInCurrentRow - 1) {
              insertIndex = rowStartIdx + cardsInCurrentRow
            }
          }
        }

        setDropIndex(insertIndex)
      }
    }
  }

  const handleDragLeave = () => {
    setHoveredZone(null)
    setDropIndex(null)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (draggedCard != null && onDrop != null && draggedCard.zone != null) {
      const targetZone: ZoneId = {
        player: "self",
        type: "extraDeck",
        index: dropIndex !== null ? dropIndex : undefined,
      }
      onDrop(draggedCard.zone, targetZone, e.shiftKey)
    }
    setHoveredZone(null)
    setDropIndex(null)
  }

  if (!isOpen) return null

  const isHovered = hoveredZone != null && hoveredZone.player === "self" && hoveredZone.type === "extraDeck"

  return (
    <div
      ref={modalRef}
      className={cn(
        "absolute border-2 rounded-lg shadow-lg overflow-hidden bg-background/95 border-purple-400/50",
        isHovered && "border-2 border-blue-400/70 shadow-lg",
      )}
      style={{
        zIndex: 40,
        top: `${modalBounds.top}px`,
        left: `${modalBounds.left}px`,
        width: `${modalWidth}px`,
        height: `${modalHeight}px`,
      }}
    >
      {/* Header with close button */}
      <div className="flex items-center justify-between h-7 px-2 border-b border-border">
        <span className="text-xs font-medium">{t("zones.extraDeck")} ({cards.length})</span>
        <button onClick={onClose} className="p-0.5 rounded hover:bg-muted transition-colors" aria-label={t("ui:shareUrl.close")}>
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Cards grid */}
      <div
        ref={contentRef}
        className="p-2 overflow-hidden extra-deck-expand-modal-drop"
        style={{ height: `calc(100% - ${headerHeight}px)` }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        data-droppable="true"
      >
        <div
          className="relative flex flex-col"
          style={{
            minHeight: `${availableHeight}px`,
            gap: rowCount > 2 ? "2px" : "4px",
          }}
        >
          {Array.from({ length: rowCount }, (_, rowIndex) => {
            // Calculate start and end indices for this row
            let startIdx = 0
            for (let i = 0; i < rowIndex; i++) {
              startIdx += getCardsPerRow(i)
            }
            const cardsInThisRow = getCardsPerRow(rowIndex)
            const endIdx = startIdx + cardsInThisRow
            const rowCards = cards.slice(startIdx, endIdx)

            // Calculate card placement for each row
            const totalWidth = (cardsInThisRow - 1) * cardSpacing + cardsInThisRow * cardWidthPx
            const needsOverlap = totalWidth > availableWidth

            return (
              <div
                key={rowIndex}
                className="relative"
                style={{
                  height: `${cardHeightPx}px`,
                  width: availableWidth,
                }}
              >
                {rowCards.map((card, cardIndex) => {
                  const globalIndex = startIdx + cardIndex

                  let cardPosition
                  if (!needsOverlap) {
                    // Left-aligned with fixed spacing
                    cardPosition = cardIndex * (cardWidthPx + cardSpacing)
                  } else {
                    // Calculate overlap to fit all cards within available width
                    const maxPosition = availableWidth - cardWidthPx
                    if (cardsInThisRow > 1) {
                      const overlapSpacing = maxPosition / (cardsInThisRow - 1)
                      cardPosition = cardIndex * overlapSpacing
                    } else {
                      cardPosition = 0
                    }
                  }

                  return (
                    <div
                      key={card.id}
                      data-card-id={card.id}
                      className="absolute rounded shadow-sm transition-all"
                      style={{
                        left: `${cardPosition}px`,
                        top: 0,
                        width: `${cardWidthPx}px`,
                        height: `${cardHeightPx}px`,
                        zIndex: hoveredCardIndex === globalIndex ? 1000 : 100 + globalIndex,
                      }}
                      onMouseEnter={() => setHoveredCardIndex(globalIndex)}
                      onMouseLeave={() => setHoveredCardIndex(null)}
                    >
                      <DraggableCard
                        card={card}
                        zone={{ player: "self", type: "extraDeck" }}
                        className="w-full h-full"
                        onContextMenu={onContextMenu}
                        onContextMenuClose={onContextMenuClose}
                      />
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
