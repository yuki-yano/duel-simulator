import React, { useState, useRef, useEffect, useCallback } from "react"
import { cn } from "@client/lib/utils"
import { useAtom, useAtomValue } from "jotai"
import { hoveredZoneAtom, draggedCardAtom } from "@/client/atoms/boardAtoms"
import type { ZoneId } from "@/shared/types/game"
import { DraggableCard } from "@/client/components/DraggableCard"
import { useScreenSize } from "@client/hooks/useScreenSize"
import type { GraveZoneProps } from "./types"

export function GraveZone({
  type,
  cardCount,
  className,
  style,
  cards = [],
  zone,
  onDrop,
  isOpponent = false,
  onContextMenu,
  onContextMenuClose,
  onLabelClick,
  isDisabled = false,
}: GraveZoneProps) {
  const [hoveredZone, setHoveredZone] = useAtom(hoveredZoneAtom)
  const draggedCard = useAtomValue(draggedCardAtom)
  const { isMediumScreen, isSmallScreen } = useScreenSize()
  const containerRef = useRef<HTMLDivElement>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  // Initialize with estimated height based on rows to prevent animation
  const getInitialHeight = useCallback(() => {
    if (isOpponent) {
      // 2 rows for opponent
      if (isMediumScreen) return 200 // md: h-24 * 2 + gap
      if (isSmallScreen) return 168 // sm: h-20 * 2 + gap
      return 116 // mobile: h-14 * 2 + gap
    } else {
      // 3 rows for player
      if (isMediumScreen) return 300 // md: h-24 * 3 + gap
      if (isSmallScreen) return 252 // sm: h-20 * 3 + gap
      return 174 // mobile: h-14 * 3 + gap
    }
  }, [isOpponent, isMediumScreen, isSmallScreen])
  const [containerHeight, setContainerHeight] = useState(getInitialHeight())
  const [hoveredCardIndex, setHoveredCardIndex] = useState<number | null>(null)

  const maxDisplay = 20
  const displayCount = Math.min(cardCount, maxDisplay)
  const displayCards = cards.length > 0 ? cards.slice(0, displayCount) : []

  // Reverse display order for grave zone to show newest cards on top
  const orderedDisplayCards = type === "grave" ? [...displayCards].reverse() : displayCards

  // Card dimensions based on height (maintaining 59:86 ratio)
  const cardHeightPx = isMediumScreen ? 96 : isSmallScreen ? 80 : 56 // md:h-24 (96px), sm:h-20 (80px), h-14 (56px)
  const cardWidthPx = Math.round((cardHeightPx * 59) / 86)
  const spacing = 4 // gap between cards when not overlapping

  // Calculate available height for cards
  // Container has padding applied via className, so we need to subtract it
  // Also reserve space for the label at the bottom (20px)
  const containerPaddingY = isMediumScreen ? 8 : isSmallScreen ? 6 : 4 // py-2, py-1.5, py-1 in pixels
  const labelHeight = 20 // Height reserved for label
  const availableHeight = containerHeight - containerPaddingY * 2 - labelHeight

  // Check if cards need to overlap
  const totalHeightNeeded = orderedDisplayCards.length * cardHeightPx + (orderedDisplayCards.length - 1) * spacing
  const needsOverlap = totalHeightNeeded > availableHeight

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (draggedCard != null && zone != null) {
      setHoveredZone(zone)

      // Calculate drop index based on mouse position
      if (containerRef.current && orderedDisplayCards.length > 0) {
        const rect = containerRef.current.getBoundingClientRect()
        const relativeY = e.clientY - rect.top

        if (needsOverlap && containerHeight > 0) {
          // Cards are overlapping - calculate based on overlap position
          const usableHeight = availableHeight - 4 // bottomMargin
          const maxPosition = usableHeight - cardHeightPx
          const effectiveCardHeight =
            orderedDisplayCards.length > 1 ? maxPosition / (orderedDisplayCards.length - 1) : 0

          let insertIndex = orderedDisplayCards.length // Default to end

          for (let i = 0; i < orderedDisplayCards.length; i++) {
            // Calculate position from bottom to top
            const reversedIndex = orderedDisplayCards.length - 1 - i
            const cardTop = containerPaddingY + reversedIndex * effectiveCardHeight
            const cardCenter = cardTop + cardHeightPx / 2

            if (relativeY < cardCenter) {
              insertIndex = i
              break
            }
          }

          // Convert display index to actual index (accounting for reverse order in grave)
          if (type === "grave") {
            insertIndex = orderedDisplayCards.length - insertIndex
          }

          setDropIndex(insertIndex)
        } else {
          // Cards are not overlapping - simple calculation
          const cardWithGap = cardHeightPx + 4 // gap between cards
          let insertIndex = Math.floor((relativeY - containerPaddingY) / cardWithGap)
          insertIndex = Math.max(0, Math.min(insertIndex, orderedDisplayCards.length))

          // Convert display index to actual index (accounting for reverse order in grave)
          if (type === "grave") {
            insertIndex = orderedDisplayCards.length - insertIndex
          }

          setDropIndex(insertIndex)
        }
      }
    }
  }

  const handleDragLeave = () => {
    setHoveredZone(null)
    setDropIndex(null)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (draggedCard != null && onDrop != null && draggedCard.zone != null && zone != null) {
      // Check if the source is from graveyard/banished
      const isFromGraveOrBanished = draggedCard.zone.type === "graveyard" || draggedCard.zone.type === "banished"

      // Only use dropIndex if moving within graveyard/banished zones
      const targetZone: ZoneId = {
        ...zone,
        // If from other zones, always add to end (no index)
        // If from grave/banished, allow position-based insertion
        index: isFromGraveOrBanished && dropIndex !== null ? dropIndex : undefined,
      }
      onDrop(draggedCard.zone, targetZone, e.shiftKey)
    }
    setHoveredZone(null)
    setDropIndex(null)
  }

  useEffect(() => {
    const updateHeight = () => {
      // If the container ref exists and className includes 'h-full', use container's actual height
      if (containerRef.current != null && className?.includes("h-full") === true) {
        const actualHeight = containerRef.current.offsetHeight
        setContainerHeight(actualHeight)
      } else if (style?.height != null && typeof style.height === "string") {
        // If height is explicitly set in style, use that
        const heightValue = parseInt(style.height.replace("px", ""), 10)
        if (!isNaN(heightValue)) {
          setContainerHeight(heightValue)
        } else {
          setContainerHeight(getInitialHeight())
        }
      } else {
        // Otherwise use fixed height based on window size
        setContainerHeight(getInitialHeight())
      }
    }

    // Use requestAnimationFrame to ensure immediate update
    requestAnimationFrame(updateHeight)

    // Listen to window resize
    window.addEventListener("resize", updateHeight)

    // Also update when the component is mounted/updated
    const observer = new ResizeObserver(updateHeight)
    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    return () => {
      window.removeEventListener("resize", updateHeight)
      observer.disconnect()
    }
  }, [className, style?.height, isOpponent, getInitialHeight])

  const typeStyles = {
    grave: "bg-red-500/5 border-red-500/30 hover:border-red-500/50",
    banish: "bg-slate-500/5 border-slate-500/30 hover:border-slate-500/50",
    sideFree: "bg-slate-600/5 border-slate-600/30 hover:border-slate-600/50",
  }

  const isHovered =
    hoveredZone != null && zone != null && hoveredZone.player === zone.player && hoveredZone.type === zone.type

  return (
    <div
      ref={containerRef}
      className={cn(
        "grave-zone relative rounded-md border-2 border-dashed h-full flex flex-col transition-colors overflow-visible",
        typeStyles[type],
        isHovered && "border-2 border-blue-400/70",
        isDisabled && "opacity-50",
        isMediumScreen ? "px-2 pt-2 pb-6" : isSmallScreen ? "px-1.5 pt-1.5 pb-5" : "px-1 pt-1 pb-5",
        className,
      )}
      style={style}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {orderedDisplayCards.length > 0 && (
        <div className="flex-1 flex flex-col items-center justify-start overflow-visible h-full">
          {needsOverlap && containerHeight > 0 ? (
            <div
              className="relative overflow-visible flex justify-center"
              style={{ height: availableHeight, width: "100%" }}
            >
              <div className="relative" style={{ width: cardWidthPx }}>
                {orderedDisplayCards.map((card, index) => {
                  // Calculate overlap to fit all cards in available space
                  // Small bottom margin to prevent cards from touching the edge
                  const bottomMargin = 4
                  const usableHeight = availableHeight - bottomMargin
                  const maxPosition = usableHeight - cardHeightPx
                  const effectiveCardHeight =
                    orderedDisplayCards.length > 1 ? maxPosition / (orderedDisplayCards.length - 1) : 0

                  // Position cards from bottom to top (reverse the position)
                  const reversedIndex = orderedDisplayCards.length - 1 - index
                  const cardPosition = Math.min(reversedIndex * effectiveCardHeight, maxPosition)

                  // カードにzone情報が正しく設定されていることを確認

                  return (
                    <div
                      key={card.id}
                      data-card-id={card.id}
                      className="absolute h-14 sm:h-20 md:h-24 aspect-[59/86] rounded shadow-sm"
                      style={{
                        top: `${Math.round(cardPosition)}px`,
                        // Newer cards (lower index) should appear on top
                        zIndex: hoveredCardIndex === index ? 100 : orderedDisplayCards.length - index,
                        transition: "none",
                      }}
                      onMouseEnter={() => setHoveredCardIndex(index)}
                      onMouseLeave={() => setHoveredCardIndex(null)}
                    >
                      <DraggableCard
                        card={card}
                        zone={zone}
                        className="w-full h-full"
                        hoverDirection="left"
                        onContextMenu={onContextMenu}
                        onContextMenuClose={onContextMenuClose}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="flex flex-col-reverse items-center gap-1 h-full justify-end">
              {orderedDisplayCards.map((card, index) => {
                return (
                  <div
                    key={card.id}
                    data-card-id={card.id}
                    className="h-14 sm:h-20 md:h-24 aspect-[59/86] rounded shadow-sm"
                    style={{
                      // Newer cards (lower index) should appear on top
                      zIndex: hoveredCardIndex === index ? 100 : orderedDisplayCards.length - index,
                    }}
                    onMouseEnter={() => setHoveredCardIndex(index)}
                    onMouseLeave={() => setHoveredCardIndex(null)}
                  >
                    <DraggableCard
                      card={card}
                      zone={zone}
                      className="w-full h-full"
                      hoverDirection="left"
                      onContextMenu={onContextMenu}
                      onContextMenuClose={onContextMenuClose}
                    />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
      {/* Label at the bottom */}
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 h-5 flex items-center justify-center",
          onLabelClick && !isDisabled && "cursor-pointer hover:bg-muted/50 transition-colors",
        )}
        onClick={
          onLabelClick && !isDisabled
            ? (e) => {
                e.stopPropagation()
                onLabelClick()
              }
            : undefined
        }
      >
        <span className="text-[10px] sm:text-xs font-medium text-muted-foreground">
          {type === "grave" ? "墓地" : type === "banish" ? "除外" : "フリー"} ({cardCount})
        </span>
      </div>
    </div>
  )
}
