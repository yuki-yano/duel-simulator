import React, { useRef, useEffect, useState } from "react"
import { X } from "lucide-react"
import { cn } from "@client/lib/utils"
import { DraggableCard } from "@/client/components/DraggableCard"
import { useAtom, useAtomValue } from "jotai"
import { draggedCardAtom, hoveredZoneAtom } from "@/client/atoms/boardAtoms"
import type { Card as GameCard, ZoneId } from "@/shared/types/game"

interface ZoneExpandModalProps {
  isOpen: boolean
  onClose: () => void
  zone: ZoneId
  cards: GameCard[]
  onDrop: (fromZone: ZoneId, toZone: ZoneId, shiftKey?: boolean) => void
  onContextMenu: (e: React.MouseEvent | React.TouchEvent, card: GameCard, zone: ZoneId) => void
  onContextMenuClose?: () => void
  modalBounds: {
    top: number
    left: number
    right: number
    bottom: number
  }
}

export function ZoneExpandModal({
  isOpen,
  onClose,
  zone,
  cards,
  onDrop,
  onContextMenu,
  onContextMenuClose,
  modalBounds,
}: ZoneExpandModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [hoveredZone, setHoveredZone] = useAtom(hoveredZoneAtom)
  const draggedCard = useAtomValue(draggedCardAtom)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const [hoveredCardIndex, setHoveredCardIndex] = useState<number | null>(null)

  // Calculate modal dimensions
  const modalWidth = modalBounds.right - modalBounds.left
  const modalHeight = modalBounds.bottom - modalBounds.top

  // Card dimensions (same as graveyard)
  const cardHeightPx =
    window.innerWidth >= 1024 ? 112 : window.innerWidth >= 768 ? 96 : window.innerWidth >= 640 ? 80 : 56
  const cardWidthPx = Math.round((cardHeightPx * 59) / 86)

  // Calculate layout for 2 columns
  const padding = window.innerWidth >= 640 ? 16 : 12
  const columnGap = window.innerWidth >= 640 ? 12 : 8
  const rowGap = 8
  const headerHeight = 28 // Height for close button (reduced)

  // Calculate available space
  const availableWidth = modalWidth - padding * 2
  const availableHeight = modalHeight - padding * 2 - headerHeight

  // Calculate cards per column
  const cardsPerRow = 2
  const columnWidth = (availableWidth - columnGap) / cardsPerRow

  // Check if we need overlap
  const needsHorizontalOverlap = cardWidthPx > columnWidth
  const actualCardWidth = needsHorizontalOverlap ? columnWidth : cardWidthPx

  // Calculate rows needed
  const totalRows = Math.ceil(cards.length / cardsPerRow)
  const rowHeight = cardHeightPx + rowGap
  const totalHeightNeeded = totalRows * cardHeightPx + (totalRows - 1) * rowGap
  const needsVerticalOverlap = totalHeightNeeded > availableHeight

  // Calculate actual row height with overlap if needed
  const actualRowHeight = needsVerticalOverlap && totalRows > 1 
    ? (availableHeight - cardHeightPx) / (totalRows - 1)
    : rowHeight

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (draggedCard != null && zone != null) {
      setHoveredZone(zone)

      // Calculate drop index based on mouse position
      if (contentRef.current) {
        const rect = contentRef.current.getBoundingClientRect()
        const relativeX = e.clientX - rect.left
        const relativeY = e.clientY - rect.top

        // For empty zones, set index to 0
        if (cards.length === 0) {
          setDropIndex(0)
          return
        }

        // Determine which column
        const column = Math.floor(relativeX / (availableWidth / cardsPerRow))
        const clampedColumn = Math.max(0, Math.min(column, cardsPerRow - 1))

        // Determine which row
        let row: number
        if (needsVerticalOverlap && totalRows > 1) {
          row = Math.floor(relativeY / actualRowHeight)
        } else {
          row = Math.floor(relativeY / rowHeight)
        }
        const clampedRow = Math.max(0, Math.min(row, totalRows - 1))

        // Calculate index
        const index = clampedRow * cardsPerRow + clampedColumn
        const clampedIndex = Math.min(index, cards.length)

        setDropIndex(clampedIndex)
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
    if (draggedCard != null && onDrop != null && draggedCard.zone != null && zone != null) {
      // For graveyard/banished zones, always allow position-based insertion
      const targetZone: ZoneId = {
        ...zone,
        index: dropIndex !== null ? dropIndex : 0,
      }
      onDrop(draggedCard.zone, targetZone, e.shiftKey)
    }
    setHoveredZone(null)
    setDropIndex(null)
  }

  // Remove automatic close functionality - only close with X button

  if (!isOpen) return null

  const isHovered =
    hoveredZone != null && zone != null && hoveredZone.player === zone.player && hoveredZone.type === zone.type

  // Get background color based on zone type (subtle transparency)
  const bgColor = "bg-background/95"
  const borderColor = zone.type === "graveyard" ? "border-red-400/50" : "border-slate-400/50"

  return (
    <div
      ref={modalRef}
      className={cn(
        "absolute border-2 rounded-lg shadow-lg overflow-hidden",
        bgColor,
        borderColor,
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
        <span className="text-xs font-medium">
          {zone.type === "graveyard" ? "墓地" : "除外"} ({cards.length})
        </span>
        <button
          onClick={onClose}
          className="p-0.5 rounded hover:bg-muted transition-colors"
          aria-label="閉じる"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Cards grid */}
      <div
        ref={contentRef}
        className="p-3 overflow-auto zone-expand-modal-drop"
        style={{ height: `calc(100% - ${headerHeight}px)` }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        data-droppable="true"
      >
        <div 
          className="relative" 
          style={{ minHeight: `${availableHeight}px` }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          data-droppable="true"
        >
          {cards.map((card, index) => {
            const row = Math.floor(index / cardsPerRow)
            const col = index % cardsPerRow

            // Calculate position
            const left = col * (columnWidth + (needsHorizontalOverlap ? -cardWidthPx + columnWidth : 0))
            const top = needsVerticalOverlap && totalRows > 1
              ? row * actualRowHeight
              : row * rowHeight

            return (
              <div
                key={card.id}
                data-card-id={card.id}
                className="absolute rounded shadow-sm transition-all"
                style={{
                  left: `${left}px`,
                  top: `${top}px`,
                  width: `${actualCardWidth}px`,
                  height: `${cardHeightPx}px`,
                  zIndex: hoveredCardIndex === index ? 1000 : 100 + cards.length - index,
                }}
                onMouseEnter={() => setHoveredCardIndex(index)}
                onMouseLeave={() => setHoveredCardIndex(null)}
              >
                <DraggableCard
                  card={card}
                  zone={zone}
                  className="w-full h-full"
                  onContextMenu={onContextMenu}
                  onContextMenuClose={onContextMenuClose}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}