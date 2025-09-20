import React, { useState, useRef, useEffect } from "react"
import { cn } from "@client/lib/utils"
import { CARD_SIZE, calculateCardWidth } from "@/client/constants/card"
import { UI_CONSTRAINTS } from "@/client/constants/limits"
import { useAtom, useAtomValue } from "jotai"
import { hoveredZoneAtom, draggedCardAtom } from "@/client/atoms/boardAtoms"
import type { Card as GameCard, ZoneId } from "@/shared/types/game"
import { DraggableCard } from "@/client/components/DraggableCard"
import { useScreenSize } from "@client/hooks/useScreenSize"
import { SCREEN_WIDTH } from "@client/constants/screen"
import { useTranslation } from "react-i18next"
import type { DeckZoneProps } from "./types"

export function DeckZone({
  type,
  cardCount = 40,
  orientation = "horizontal",
  cards = [],
  zone,
  onDrop,
  isOpponent = false,
  onContextMenu,
  onContextMenuClose,
  className,
  style,
  onLabelClick,
  isDisabled = false,
}: DeckZoneProps) {
  const { t } = useTranslation("game")
  const [hoveredZone, setHoveredZone] = useAtom(hoveredZoneAtom)
  const draggedCard = useAtomValue(draggedCardAtom)
  const { isLargeScreen, isMediumScreen, isSmallScreen } = useScreenSize()
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [hoveredCardIndex, setHoveredCardIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  // Calculate cards per row limit based on screen size
  const getCardsPerRowLimit = () => {
    if (!isSmallScreen) return 20 // Mobile: max 20 cards per row
    if (!isLargeScreen) return 27 // Tablet: max 27 cards per row
    return 29 // Desktop: max 29 cards per row (30+ cards will use 2 rows)
  }

  const cardsPerRowLimit = getCardsPerRowLimit()

  // Show all cards for deck
  const maxDisplay = orientation === "horizontal" ? 60 : 30
  const displayCount = Math.min(cardCount, maxDisplay)
  const displayCards =
    cards.length > 0 ? cards.slice(0, displayCount) : Array.from({ length: displayCount }, (_, i) => i)

  // Calculate rows dynamically based on cards per row limit
  let rowCount = 1
  if (orientation === "horizontal" && displayCards.length > cardsPerRowLimit) {
    rowCount = Math.ceil(displayCards.length / cardsPerRowLimit)
  }

  // Distribute cards evenly across rows
  const getCardsPerRow = (rowIndex: number) => {
    if (rowCount === 1) return displayCards.length

    // Distribute cards as evenly as possible
    const baseCardsPerRow = Math.floor(displayCards.length / rowCount)
    const remainingCards = displayCards.length % rowCount

    // Add one extra card to the first 'remainingCards' rows
    return rowIndex < remainingCards ? baseCardsPerRow + 1 : baseCardsPerRow
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (draggedCard) {
      setHoveredZone({
        player: isOpponent ? "opponent" : "self",
        type: type === "deck" ? "deck" : type === "extra" ? "extraDeck" : type === "side" ? "sideDeck" : "hand",
      })

      // Calculate drop index based on mouse position
      if (containerRef.current && orientation === "horizontal" && cards.length > 0) {
        const rect = containerRef.current.getBoundingClientRect()
        const relativeX = e.clientX - rect.left

        // Get card dimensions
        const cardHeightPx = isMediumScreen
          ? CARD_SIZE.MEDIUM.HEIGHT
          : isSmallScreen
            ? CARD_SIZE.SMALL.HEIGHT
            : CARD_SIZE.DEFAULT.HEIGHT
        const cardWidthPx = calculateCardWidth(cardHeightPx)
        const padding = isSmallScreen ? 16 : 8
        const availableWidth = containerWidth - padding * 2

        // Calculate which row we're in
        const relativeY = e.clientY - rect.top
        const rowHeight = rect.height / rowCount
        const currentRow = Math.min(Math.floor(relativeY / rowHeight), rowCount - 1)

        // Calculate actual cards per row for the current row with even distribution
        let rowStartIdx = 0
        for (let i = 0; i < currentRow; i++) {
          rowStartIdx += getCardsPerRow(i)
        }
        const cardsInCurrentRow = getCardsPerRow(currentRow)
        const rowCards = displayCards.slice(rowStartIdx, rowStartIdx + cardsInCurrentRow)
        const rowCardCount = rowCards.length

        if (rowCardCount === 0) {
          setDropIndex(0)
          return
        }

        // Calculate card positions for the current row
        const cardSpacing = window.innerWidth >= SCREEN_WIDTH.MEDIUM ? 15 : 10
        const totalWidth = (rowCardCount - 1) * cardSpacing + rowCardCount * cardWidthPx
        const needsOverlap = totalWidth > availableWidth
        let insertIndex = rowStartIdx

        if (!needsOverlap) {
          // Cards are left-aligned with fixed spacing
          for (let i = 0; i < rowCardCount; i++) {
            const cardLeft = i * (cardWidthPx + cardSpacing)
            const cardCenter = cardLeft + cardWidthPx / 2

            if (relativeX < cardCenter) {
              insertIndex = rowStartIdx + i
              break
            } else if (i === rowCardCount - 1) {
              insertIndex = rowStartIdx + rowCardCount
            }
          }
        } else {
          // Cards are overlapping - calculate based on proportional spacing
          const maxPosition = availableWidth - cardWidthPx
          const overlapSpacing = rowCardCount > 1 ? maxPosition / (rowCardCount - 1) : 0

          for (let i = 0; i < rowCardCount; i++) {
            const cardLeft = i * overlapSpacing
            const cardCenter = cardLeft + cardWidthPx / 2

            if (relativeX < cardCenter) {
              insertIndex = rowStartIdx + i
              break
            } else if (i === rowCardCount - 1) {
              insertIndex = rowStartIdx + rowCardCount
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
    if (draggedCard != null && onDrop != null && draggedCard.zone != null) {
      const targetZone: ZoneId = {
        player: isOpponent ? "opponent" : "self",
        type: type === "deck" ? "deck" : type === "extra" ? "extraDeck" : type === "side" ? "sideDeck" : "hand",
        index: dropIndex !== null ? dropIndex : undefined,
      }
      onDrop(draggedCard.zone, targetZone, e.shiftKey)
    }
    setHoveredZone(null)
    setDropIndex(null)
  }

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth)
      }
    }

    updateWidth()
    const resizeObserver = new ResizeObserver(updateWidth)

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    window.addEventListener("resize", updateWidth)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener("resize", updateWidth)
    }
  }, [])

  const zoneStyles = {
    deck: "bg-gray-500/10 border-gray-500/30",
    extra: "bg-purple-500/10 border-purple-500/30",
    hand: "bg-blue-500/10 border-blue-500/30",
    side: "bg-amber-500/10 border-amber-500/30",
    gy: "bg-red-500/10 border-red-500/30",
    banished: "bg-slate-500/10 border-slate-500/30",
  }

  const cardStyles = {
    deck: "from-gray-500/30 to-gray-600/30",
    extra: "from-purple-500/30 to-purple-600/30",
    hand: "from-blue-500/30 to-blue-600/30",
    side: "from-amber-500/30 to-amber-600/30",
    gy: "from-red-500/30 to-red-600/30",
    banished: "from-slate-500/30 to-slate-600/30",
  }

  if (orientation === "horizontal") {
    // Card dimensions for horizontal layout (maintaining aspect ratio)
    const cardHeightPx = isMediumScreen
      ? CARD_SIZE.MEDIUM.HEIGHT
      : isSmallScreen
        ? CARD_SIZE.SMALL.HEIGHT
        : CARD_SIZE.DEFAULT.HEIGHT // md:h-24, sm:h-20, h-14
    const cardWidthPx = Math.round((cardHeightPx * 59) / 86)
    const padding = isSmallScreen ? 16 : 8 // Container padding (smaller on mobile)

    // Calculate available width for cards
    const availableWidth = containerWidth - padding * 2

    const isHovered =
      hoveredZone != null &&
      hoveredZone.player === "self" &&
      hoveredZone.type ===
        (type === "deck" ? "deck" : type === "extra" ? "extraDeck" : type === "side" ? "sideDeck" : "hand")

    // Adjust container height based on number of rows
    const getContainerHeight = () => {
      if (rowCount === 1) {
        return "h-24 sm:h-32 md:h-36"
      } else if (rowCount === 2) {
        return "h-[168px] sm:h-[212px] md:h-[232px]"
      } else if (rowCount === 3) {
        return "h-[244px] sm:h-[308px] md:h-[344px]"
      } else {
        // For 4+ rows, calculate dynamically with tighter spacing
        const cardHeight = isMediumScreen ? 96 : isSmallScreen ? 80 : 56
        const gap = 4 // gap between rows
        const paddingY = isSmallScreen ? 12 : 8 // total vertical padding
        const totalHeight = cardHeight * rowCount + gap * (rowCount - 1) + paddingY
        return `h-[${totalHeight}px]`
      }
    }
    const containerHeight = getContainerHeight()

    return (
      <div
        ref={containerRef}
        className={cn(
          "deck-zone relative w-full rounded-lg border-2 border-dashed overflow-visible",
          rowCount === 1 ? "p-1 pb-1.5 sm:p-2 sm:pb-2 md:pb-3" : rowCount === 2 ? "p-1 sm:p-1.5" : "p-0.5 sm:p-1",
          containerHeight,
          zoneStyles[type],
          isHovered && "border-4 border-blue-500 bg-blue-500/20",
          isDisabled && "opacity-50",
          className,
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={style}
      >
        <span
          className={cn(
            "absolute top-1 left-1 text-[10px] sm:text-xs font-medium text-muted-foreground z-10",
            onLabelClick &&
              !isDisabled &&
              type === "extra" &&
              "cursor-pointer hover:bg-muted/50 rounded px-1 transition-colors",
          )}
          onClick={
            onLabelClick && !isDisabled && type === "extra"
              ? (e) => {
                  e.stopPropagation()
                  onLabelClick()
                }
              : undefined
          }
        >
          {type === "deck"
            ? t("zones.deck")
            : type === "extra"
              ? t("zones.extraDeck")
              : type === "side"
                ? t("zones.sideDeck")
                : t("zones.hand")}{" "}
          ({cardCount})
        </span>
        {cardCount > 0 ? (
          <div
            className={cn("relative h-full w-full flex items-center justify-start overflow-visible", "mt-1 sm:mt-2")}
          >
            {containerWidth > 0 ? (
              <div
                className={cn(
                  "relative h-full flex flex-col justify-center overflow-visible",
                  rowCount === 1 ? "py-0.5 sm:py-1" : "py-0.5",
                  rowCount > 2 ? "gap-0.5" : "gap-1",
                )}
                style={{ width: availableWidth }}
              >
                {Array.from({ length: rowCount }, (_, rowIndex) => {
                  // Calculate start and end indices for even distribution
                  let startIdx = 0
                  for (let i = 0; i < rowIndex; i++) {
                    startIdx += getCardsPerRow(i)
                  }
                  const cardsInThisRow = getCardsPerRow(rowIndex)
                  const endIdx = startIdx + cardsInThisRow
                  const rowCards = displayCards.slice(startIdx, endIdx)
                  const rowCardCount = rowCards.length

                  // Calculate card placement for each row
                  const cardSpacing = isMediumScreen ? 15 : 10 // Fixed spacing between cards
                  const totalWidth = (rowCardCount - 1) * cardSpacing + rowCardCount * cardWidthPx
                  const needsOverlap = totalWidth > availableWidth

                  return (
                    <div key={rowIndex} className="relative h-14 sm:h-20 md:h-24" style={{ width: availableWidth }}>
                      {rowCards.map((item, cardIndex) => {
                        const globalIndex = startIdx + cardIndex
                        const isCard = typeof item === "object" && item !== null

                        let cardPosition
                        if (!needsOverlap) {
                          // Left-aligned with fixed spacing
                          cardPosition = cardIndex * (cardWidthPx + cardSpacing)
                        } else {
                          // Calculate overlap to fit all cards within available width
                          const maxPosition = availableWidth - cardWidthPx
                          if (rowCardCount > 1) {
                            const overlapSpacing = maxPosition / (rowCardCount - 1)
                            cardPosition = cardIndex * overlapSpacing
                          } else {
                            cardPosition = 0
                          }
                        }

                        if (isCard) {
                          const card = item as GameCard

                          return (
                            <div
                              key={card.id}
                              data-card-id={card.id}
                              className="absolute h-14 sm:h-20 md:h-24 aspect-[59/86] rounded shadow-sm transition-all"
                              style={{
                                left: `${cardPosition}px`,
                                zIndex: hoveredCardIndex === globalIndex ? 100 : displayCards.length - globalIndex,
                              }}
                              onMouseEnter={() => setHoveredCardIndex(globalIndex)}
                              onMouseLeave={() => setHoveredCardIndex(null)}
                            >
                              <DraggableCard
                                card={card}
                                zone={zone}
                                className="w-full h-full"
                                onContextMenu={onContextMenu}
                                onContextMenuClose={onContextMenuClose}
                                isDisabled={isDisabled}
                              />
                            </div>
                          )
                        }

                        return (
                          <div
                            key={globalIndex}
                            className={cn(
                              "absolute h-14 sm:h-20 md:h-24 aspect-[59/86] rounded bg-gradient-to-b shadow-sm",
                              cardStyles[type],
                            )}
                            style={{
                              left: `${cardPosition}px`,
                              zIndex: hoveredCardIndex === globalIndex ? 100 : displayCards.length - globalIndex,
                            }}
                            onMouseEnter={() => setHoveredCardIndex(globalIndex)}
                            onMouseLeave={() => setHoveredCardIndex(null)}
                          />
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex items-center gap-1 py-0.5 sm:py-1">
                {displayCards.slice(0, 5).map((item, index) => {
                  const isCard = typeof item === "object" && item !== null
                  return isCard ? (
                    <div
                      key={(item as GameCard).id}
                      data-card-id={(item as GameCard).id}
                      className="h-14 sm:h-20 md:h-24 aspect-[59/86] rounded shadow-sm"
                    >
                      <DraggableCard
                        card={item as GameCard}
                        zone={zone}
                        className="w-full h-full"
                        onContextMenu={onContextMenu}
                        onContextMenuClose={onContextMenuClose}
                        isDisabled={isDisabled}
                      />
                    </div>
                  ) : (
                    <div
                      key={index}
                      className={cn(
                        "h-14 sm:h-20 md:h-24 aspect-[59/86] rounded bg-gradient-to-b shadow-sm",
                        cardStyles[type],
                      )}
                    />
                  )
                })}
              </div>
            )}
          </div>
        ) : null}
      </div>
    )
  } else {
    // Vertical orientation for GY/Banished
    const actualType = type === "deck" ? "gy" : "banished"
    return (
      <div
        className={cn(
          "relative w-16 sm:w-20 md:w-24 h-full min-h-[200px] rounded-lg border-2 border-dashed p-2 flex flex-col",
          zoneStyles[actualType],
        )}
      >
        {cardCount > 0 ? (
          <>
            <div className="flex-1 relative">
              <div
                className="relative w-10 sm:w-14 md:w-18"
                style={{
                  height: `${Math.max(
                    UI_CONSTRAINTS.MIN_DECK_ZONE_HEIGHT_BASE,
                    cards.length * UI_CONSTRAINTS.DECK_ZONE_CARD_SPACING + UI_CONSTRAINTS.MIN_DECK_ZONE_HEIGHT_OFFSET,
                  )}px`,
                }}
              >
                {cards.map((card, index) => (
                  <div
                    key={card.id}
                    className={cn(
                      "absolute w-10 sm:w-14 md:w-18 h-14 sm:h-18 md:h-20 rounded bg-gradient-to-b shadow-sm",
                      cardStyles[actualType],
                    )}
                    style={{
                      top: `${index * 3}px`,
                      zIndex: cards.length - index,
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="mt-auto pt-2">
              <span className="text-xs sm:text-sm font-medium text-muted-foreground block text-center">
                {type === "deck" ? "GY" : "Banished"} ({cardCount})
              </span>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <span className="text-xs sm:text-sm text-muted-foreground -rotate-90">
              {type === "deck" ? "GY" : "Banished"} (0)
            </span>
          </div>
        )}
      </div>
    )
  }
}
