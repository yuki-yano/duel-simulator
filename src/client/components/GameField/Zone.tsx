import React from "react"
import { cn } from "@client/lib/utils"
import { useAtom, useAtomValue } from "jotai"
import { hoveredZoneAtom, draggedCardAtom } from "@/client/atoms/boardAtoms"
import { DraggableCard } from "@/client/components/DraggableCard"
import { useScreenSize } from "@client/hooks/useScreenSize"
import type { ZoneProps } from "./types"

export function Zone({
  className,
  label,
  children,
  type,
  isOpponent = false,
  zone,
  card,
  cards,
  onDrop,
  onContextMenu,
  onContextMenuClose,
}: ZoneProps) {
  const [hoveredZone, setHoveredZone] = useAtom(hoveredZoneAtom)
  const draggedCard = useAtomValue(draggedCardAtom)
  const { isLargeScreen, isMediumScreen, isSmallScreen } = useScreenSize()
  const typeStyles = {
    monster: "bg-blue-500/5 border-blue-500/30 hover:border-blue-500/50",
    spell: "bg-green-500/5 border-green-500/30 hover:border-green-500/50",
    field: "bg-amber-500/5 border-amber-500/30 hover:border-amber-500/50",
    extra: "bg-purple-500/5 border-purple-500/30 hover:border-purple-500/50",
    deck: "bg-gray-500/5 border-gray-500/30 hover:border-gray-500/50",
    emz: "bg-indigo-500/5 border-indigo-500/30 hover:border-indigo-500/50",
    hand: isOpponent ? "bg-gray-700/10 border-gray-700/30" : "bg-blue-500/5 border-blue-500/30",
    free: "bg-gray-600/5 border-gray-600/30 hover:border-gray-600/50",
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (zone != null && draggedCard != null) {
      // Don't highlight field zone if it already has a card
      if (type === "field" && card != null) {
        return
      }
      setHoveredZone(zone)
    }
  }

  const handleDragLeave = () => {
    setHoveredZone(null)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (zone != null && draggedCard != null && onDrop != null && draggedCard.zone != null) {
      onDrop(draggedCard.zone, zone, e.shiftKey)
    }
    setHoveredZone(null)
  }

  const isHovered =
    hoveredZone != null &&
    zone != null &&
    hoveredZone.player === zone.player &&
    hoveredZone.type === zone.type &&
    hoveredZone.index === zone.index

  return (
    <div
      className={cn(
        "zone relative h-14 sm:h-20 md:h-24 w-[38px] sm:w-[55px] md:w-[66px] rounded-md border-2 border-dashed flex items-center justify-center transition-colors overflow-visible",
        typeStyles[type],
        isHovered && "border-4 border-blue-500 bg-blue-500/20",
        className,
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {label != null && label !== "" && (
        <span className="absolute top-0.5 left-0.5 text-[8px] sm:text-[10px] md:text-xs text-muted-foreground font-medium">
          {label}
        </span>
      )}
      {/* Display cards - either single card or multiple cards */}
      {cards && cards.length > 0 ? (
        <div className="relative w-full h-full overflow-visible">
          {cards.map((c, index) => {
            // Calculate offset based on screen size
            let offsetPx: number
            let cardWidth: string
            let cardHeight: string

            if (isLargeScreen) {
              offsetPx = 13 // Tablet and Desktop: 13px offset
              cardHeight = "96px" // md:h-24
              cardWidth = `${Math.round((96 * 59) / 86)}px` // Maintain aspect ratio
            } else if (isMediumScreen) {
              offsetPx = 10 // Small tablet: 10px offset
              cardHeight = "80px" // sm:h-20
              cardWidth = `${Math.round((80 * 59) / 86)}px` // Maintain aspect ratio
            } else if (isSmallScreen) {
              offsetPx = 8 // Mobile: 8px offset
              cardHeight = "56px" // h-14
              cardWidth = `${Math.round((56 * 59) / 86)}px` // Maintain aspect ratio
            } else {
              offsetPx = 8 // Mobile: 8px offset
              cardHeight = "56px" // h-14
              cardWidth = `${Math.round((56 * 59) / 86)}px` // Maintain aspect ratio
            }

            return (
              <div
                key={c.id}
                data-card-id={c.id}
                className="absolute"
                style={{
                  left: `${index * offsetPx}px`,
                  top: `${index * offsetPx}px`,
                  width: cardWidth,
                  height: cardHeight,
                  zIndex: cards.length - index,
                }}
              >
                <DraggableCard
                  card={c}
                  zone={zone}
                  stackIndex={index}
                  className="w-full h-full"
                  hoverDirection={index === 0 ? "up" : "right"}
                  onContextMenu={onContextMenu}
                  onContextMenuClose={onContextMenuClose}
                />
              </div>
            )
          })}
          {/* Card count indicator for multiple cards */}
          {cards.length > 1 && (
            <div className="absolute bottom-0 right-0 bg-background/90 text-foreground text-[8px] sm:text-[10px] px-1 rounded-tl-md font-bold z-50">
              {cards.length}
            </div>
          )}
        </div>
      ) : card ? (
        <DraggableCard
          card={card}
          zone={zone}
          className="w-full h-full"
          onContextMenu={onContextMenu}
          onContextMenuClose={onContextMenuClose}
        />
      ) : null}
      {children}
    </div>
  )
}
