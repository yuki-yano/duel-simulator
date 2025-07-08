import React, { useState, useRef, useEffect } from "react"
import { cn } from "@client/lib/utils"
import { ChevronDown, ChevronUp } from "lucide-react"
import { useAtom, useAtomValue } from "jotai"
import { gameStateAtom, hoveredZoneAtom, draggedCardAtom, moveCardAtom } from "@/client/atoms/boardAtoms"
import type { Card as GameCard, ZoneId } from "@/shared/types/game"
import { DraggableCard } from "@/client/components/DraggableCard"

interface ZoneProps {
  className?: string
  label?: string
  children?: React.ReactNode
  type?: "monster" | "spell" | "field" | "extra" | "deck" | "emz" | "hand"
  isOpponent?: boolean
  cardCount?: number
  zone?: ZoneId
  card?: GameCard | null
  cards?: GameCard[]
  onDrop?: (fromZone: ZoneId, toZone: ZoneId) => void
}

interface GraveZoneProps {
  type: "grave" | "banish"
  cardCount: number
  label?: string
  className?: string
  style?: React.CSSProperties
  cards?: GameCard[]
  zone?: ZoneId
  onDrop?: (fromZone: ZoneId, toZone: ZoneId) => void
  isOpponent?: boolean
}

function Zone({ className, label, children, type = "monster", isOpponent = false, zone, card, cards, onDrop }: ZoneProps) {
  const [hoveredZone, setHoveredZone] = useAtom(hoveredZoneAtom)
  const draggedCard = useAtomValue(draggedCardAtom)
  const typeStyles = {
    monster: "bg-blue-500/5 border-blue-500/30 hover:border-blue-500/50",
    spell: "bg-green-500/5 border-green-500/30 hover:border-green-500/50",
    field: "bg-amber-500/5 border-amber-500/30 hover:border-amber-500/50",
    extra: "bg-purple-500/5 border-purple-500/30 hover:border-purple-500/50",
    deck: "bg-gray-500/5 border-gray-500/30 hover:border-gray-500/50",
    emz: "bg-indigo-500/5 border-indigo-500/30 hover:border-indigo-500/50",
    hand: isOpponent ? "bg-gray-700/10 border-gray-700/30" : "bg-blue-500/5 border-blue-500/30",
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (zone && draggedCard) {
      setHoveredZone(zone)
    }
  }

  const handleDragLeave = () => {
    setHoveredZone(null)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (zone && draggedCard && onDrop && draggedCard.zone) {
      onDrop(draggedCard.zone, zone)
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
        "relative h-14 sm:h-20 md:h-24 lg:h-28 aspect-[59/86] rounded-md border-2 border-dashed flex items-center justify-center transition-colors overflow-visible",
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
        <div className="relative w-full h-full" style={{
          // Add padding to accommodate stacked cards
          paddingRight: cards.length > 1 ? `${(cards.length - 1) * (window.innerWidth >= 1024 ? 16 : window.innerWidth >= 768 ? 13 : window.innerWidth >= 640 ? 10 : 8)}px` : 0,
          paddingBottom: cards.length > 1 ? `${(cards.length - 1) * (window.innerWidth >= 1024 ? 16 : window.innerWidth >= 768 ? 13 : window.innerWidth >= 640 ? 10 : 8)}px` : 0,
        }}>
          {cards.map((c, index) => {
            // Calculate offset based on screen size
            let offsetPx: number
            if (window.innerWidth >= 1024) {
              offsetPx = 16 // Desktop: 16px offset (about 15% of card height)
            } else if (window.innerWidth >= 768) {
              offsetPx = 13 // Tablet: 13px offset
            } else if (window.innerWidth >= 640) {
              offsetPx = 10 // Small tablet: 10px offset
            } else {
              offsetPx = 8 // Mobile: 8px offset
            }
            
            return (
              <div
                key={c.id}
                className="absolute"
                style={{
                  left: `${index * offsetPx}px`,
                  top: `${index * offsetPx}px`,
                  width: "100%",
                  height: "100%",
                  zIndex: cards.length - index,
                }}
              >
                <DraggableCard
                  card={c}
                  stackIndex={index}
                  className="w-full h-full"
                  hoverDirection={index === 0 ? "up" : "right"}
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
        <DraggableCard card={card} className="w-full h-full" />
      ) : null}
      {children}
    </div>
  )
}

interface DeckZoneProps {
  type: "deck" | "extra" | "hand"
  isOpponent?: boolean
  cardCount?: number
  orientation?: "horizontal" | "vertical"
  cards?: GameCard[]
  onDrop?: (fromZone: ZoneId, toZone: ZoneId) => void
}

function DeckZone({
  type,
  cardCount = 40,
  orientation = "horizontal",
  cards = [],
  onDrop,
  isOpponent = false,
}: DeckZoneProps) {
  const [hoveredZone, setHoveredZone] = useAtom(hoveredZoneAtom)
  const draggedCard = useAtomValue(draggedCardAtom)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [hoveredCardIndex, setHoveredCardIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  // Calculate cards per row limit based on screen size
  const getCardsPerRowLimit = () => {
    if (window.innerWidth < 640) return 20 // Mobile: max 20 cards per row
    if (window.innerWidth <= 1024) return 27 // Tablet: max 27 cards per row
    return 40 // Desktop: max 40 cards per row
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
        type: type === "deck" ? "deck" : type === "extra" ? "extraDeck" : "hand",
      })

      // Calculate drop index based on mouse position
      if (containerRef.current && orientation === "horizontal" && cards.length > 0) {
        const rect = containerRef.current.getBoundingClientRect()
        const relativeX = e.clientX - rect.left

        // Get card dimensions
        const cardHeightPx =
          window.innerWidth >= 1024 ? 112 : window.innerWidth >= 768 ? 96 : window.innerWidth >= 640 ? 80 : 56
        const cardWidthPx = Math.round((cardHeightPx * 59) / 86)
        const padding = window.innerWidth >= 640 ? 16 : 8
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
        const cardSpacing = window.innerWidth >= 768 ? 15 : 10
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
    if (draggedCard && onDrop && draggedCard.zone) {
      const targetZone: ZoneId = {
        player: isOpponent ? "opponent" : "self",
        type: type === "deck" ? "deck" : type === "extra" ? "extraDeck" : "hand",
        index: dropIndex !== null ? dropIndex : undefined,
      }
      onDrop(draggedCard.zone, targetZone)
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
    gy: "bg-red-500/10 border-red-500/30",
    banished: "bg-slate-500/10 border-slate-500/30",
  }

  const cardStyles = {
    deck: "from-gray-500/30 to-gray-600/30",
    extra: "from-purple-500/30 to-purple-600/30",
    hand: "from-blue-500/30 to-blue-600/30",
    gy: "from-red-500/30 to-red-600/30",
    banished: "from-slate-500/30 to-slate-600/30",
  }

  if (orientation === "horizontal") {
    // Card dimensions for horizontal layout (maintaining aspect ratio)
    const cardHeightPx =
      window.innerWidth >= 1024 ? 112 : window.innerWidth >= 768 ? 96 : window.innerWidth >= 640 ? 80 : 56 // lg:h-28 (112px), md:h-24 (96px), sm:h-20 (80px), h-14 (56px)
    const cardWidthPx = Math.round((cardHeightPx * 59) / 86)
    const padding = window.innerWidth >= 640 ? 16 : 8 // Container padding (smaller on mobile)

    // Calculate available width for cards
    const availableWidth = containerWidth - padding * 2

    const isHovered =
      hoveredZone != null &&
      hoveredZone.player === "self" &&
      hoveredZone.type === (type === "deck" ? "deck" : type === "extra" ? "extraDeck" : "hand")

    // Adjust container height based on number of rows
    const getContainerHeight = () => {
      if (rowCount === 1) {
        return "h-24 sm:h-32 md:h-36 lg:h-36"
      } else if (rowCount === 2) {
        return "h-[168px] sm:h-[212px] md:h-[232px] lg:h-[272px]"
      } else if (rowCount === 3) {
        return "h-[244px] sm:h-[308px] md:h-[344px]"
      } else {
        // For 4+ rows, calculate dynamically with tighter spacing
        const cardHeight = window.innerWidth >= 1024 ? 112 : window.innerWidth >= 768 ? 96 : window.innerWidth >= 640 ? 80 : 56
        const gap = 4 // gap between rows
        const paddingY = window.innerWidth >= 640 ? 12 : 8 // total vertical padding
        const totalHeight = cardHeight * rowCount + gap * (rowCount - 1) + paddingY
        return `h-[${totalHeight}px]`
      }
    }
    const containerHeight = getContainerHeight()

    return (
      <div
        ref={containerRef}
        className={cn(
          "relative w-full rounded-lg border-2 border-dashed overflow-visible",
          rowCount === 1 ? "p-1 pb-1.5 sm:p-2 sm:pb-2 md:pb-3" : rowCount === 2 ? "p-1 sm:p-1.5" : "p-0.5 sm:p-1",
          containerHeight,
          zoneStyles[type],
          isHovered && "border-4 border-blue-500 bg-blue-500/20",
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <span className="absolute top-1 left-1 text-[10px] sm:text-xs font-medium text-muted-foreground z-10">
          {type === "deck" ? "デッキ" : type === "extra" ? "EXデッキ" : "手札"} ({cardCount})
        </span>
        {cardCount > 0 ? (
          <div
            className={cn(
              "relative h-full w-full flex items-center justify-start overflow-visible",
              "mt-1 sm:mt-2",
            )}
          >
            {containerWidth > 0 ? (
              <div
                className={cn(
                  "relative h-full flex flex-col justify-center overflow-visible",
                  rowCount === 1 ? "py-0.5 sm:py-1" : "py-0.5",
                  rowCount > 2 ? "gap-0.5" : "gap-1"
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
                  const cardSpacing = window.innerWidth >= 768 ? 15 : 10 // Fixed spacing between cards
                  const totalWidth = (rowCardCount - 1) * cardSpacing + rowCardCount * cardWidthPx
                  const needsOverlap = totalWidth > availableWidth

                  return (
                    <div
                      key={rowIndex}
                      className="relative h-14 sm:h-20 md:h-24 lg:h-28"
                      style={{ width: availableWidth }}
                    >
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
                              className="absolute h-14 sm:h-20 md:h-24 lg:h-28 aspect-[59/86] rounded shadow-sm transition-all"
                              style={{
                                left: `${cardPosition}px`,
                                zIndex: hoveredCardIndex === globalIndex ? 100 : displayCards.length - globalIndex,
                              }}
                              onMouseEnter={() => setHoveredCardIndex(globalIndex)}
                              onMouseLeave={() => setHoveredCardIndex(null)}
                            >
                              <DraggableCard card={card} className="w-full h-full" />
                            </div>
                          )
                        }

                        return (
                          <div
                            key={globalIndex}
                            className={cn(
                              "absolute h-14 sm:h-20 md:h-24 lg:h-28 aspect-[59/86] rounded bg-gradient-to-b shadow-sm",
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
                      className="h-14 sm:h-20 md:h-24 lg:h-28 aspect-[59/86] rounded shadow-sm"
                    >
                      <DraggableCard card={item as GameCard} className="w-full h-full" />
                    </div>
                  ) : (
                    <div
                      key={index}
                      className={cn(
                        "h-14 sm:h-20 md:h-24 lg:h-28 aspect-[59/86] rounded bg-gradient-to-b shadow-sm",
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
                style={{ height: `${Math.max(80, cards.length * 3 + 60)}px` }}
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

function GraveZone({
  type,
  cardCount,
  className,
  style,
  cards = [],
  zone,
  onDrop,
  isOpponent = false,
}: GraveZoneProps) {
  const [hoveredZone, setHoveredZone] = useAtom(hoveredZoneAtom)
  const draggedCard = useAtomValue(draggedCardAtom)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  // Initialize with estimated height based on rows to prevent animation
  const getInitialHeight = () => {
    if (isOpponent) {
      // 2 rows for opponent
      if (window.innerWidth >= 1024) return 232 // lg: h-28 * 2 + gap
      if (window.innerWidth >= 768) return 200 // md: h-24 * 2 + gap
      if (window.innerWidth >= 640) return 168 // sm: h-20 * 2 + gap
      return 116 // mobile: h-14 * 2 + gap
    } else {
      // 3 rows for player
      if (window.innerWidth >= 768) return 348 // md: h-28 * 3 + gap
      if (window.innerWidth >= 640) return 252 // sm: h-20 * 3 + gap
      return 174 // mobile: h-14 * 3 + gap
    }
  }
  const [containerHeight, setContainerHeight] = useState(getInitialHeight())
  const [hoveredCardIndex, setHoveredCardIndex] = useState<number | null>(null)

  const maxDisplay = 20
  const displayCount = Math.min(cardCount, maxDisplay)
  const displayCards = cards.length > 0 ? cards.slice(0, displayCount) : []

  // Reverse display order for grave zone to show newest cards on top
  const orderedDisplayCards = type === "grave" ? [...displayCards].reverse() : displayCards

  // Card dimensions based on height (maintaining 59:86 ratio)
  const cardHeightPx =
    window.innerWidth >= 1024 ? 112 : window.innerWidth >= 768 ? 96 : window.innerWidth >= 640 ? 80 : 56 // lg:h-28 (112px), md:h-24 (96px), sm:h-20 (80px), h-14 (56px)
  const cardWidthPx = Math.round((cardHeightPx * 59) / 86)
  const spacing = 4 // gap between cards when not overlapping

  // Calculate available height for cards
  // Container has padding applied via className, so we need to subtract it
  // Also reserve space for the label at the bottom (20px)
  const containerPaddingY =
    window.innerWidth >= 1024 ? 8 : window.innerWidth >= 768 ? 8 : window.innerWidth >= 640 ? 6 : 4 // py-2, py-1.5, py-1 in pixels
  const labelHeight = 20 // Height reserved for label
  const availableHeight = containerHeight - containerPaddingY * 2 - labelHeight

  // Check if cards need to overlap
  const totalHeightNeeded = orderedDisplayCards.length * cardHeightPx + (orderedDisplayCards.length - 1) * spacing
  const needsOverlap = totalHeightNeeded > availableHeight

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (draggedCard && zone) {
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
            const cardTop = containerPaddingY + i * effectiveCardHeight
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
    if (draggedCard && onDrop && draggedCard.zone && zone) {
      const targetZone: ZoneId = {
        ...zone,
        index: dropIndex !== null ? dropIndex : undefined,
      }
      onDrop(draggedCard.zone, targetZone)
    }
    setHoveredZone(null)
    setDropIndex(null)
  }

  useEffect(() => {
    const updateHeight = () => {
      // If the container ref exists and className includes 'h-full', use container's actual height
      if (containerRef.current && className?.includes("h-full")) {
        const actualHeight = containerRef.current.offsetHeight
        setContainerHeight(actualHeight)
      } else if (style?.height && typeof style.height === "string") {
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
  }, [className, style?.height, isOpponent])

  const typeStyles = {
    grave: "bg-red-500/5 border-red-500/30 hover:border-red-500/50",
    banish: "bg-slate-500/5 border-slate-500/30 hover:border-slate-500/50",
  }

  const _cardStyles = {
    grave: "from-red-500/30 to-red-600/30",
    banish: "from-slate-500/30 to-slate-600/30",
  }

  const isHovered =
    hoveredZone != null && zone != null && hoveredZone.player === zone.player && hoveredZone.type === zone.type

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative rounded-md border-2 border-dashed h-full flex flex-col transition-colors overflow-visible",
        typeStyles[type],
        isHovered && "border-4 border-blue-500 bg-blue-500/20",
        window.innerWidth >= 1024
          ? "px-2 pt-2 pb-6"
          : window.innerWidth >= 768
            ? "px-2 pt-2 pb-6"
            : window.innerWidth >= 640
              ? "px-1.5 pt-1.5 pb-5"
              : "px-1 pt-1 pb-5",
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
                  const cardPosition = Math.min(index * effectiveCardHeight, maxPosition)

                  // カードにzone情報が正しく設定されていることを確認

                  return (
                    <div
                      key={card.id}
                      className="absolute h-14 sm:h-20 md:h-24 lg:h-28 aspect-[59/86] rounded shadow-sm"
                      style={{
                        top: `${Math.round(cardPosition)}px`,
                        zIndex: hoveredCardIndex === index ? 100 : index + 1,
                        transition: "none",
                      }}
                      onMouseEnter={() => setHoveredCardIndex(index)}
                      onMouseLeave={() => setHoveredCardIndex(null)}
                    >
                      <DraggableCard card={card} className="w-full h-full" hoverDirection="left" />
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1 h-full justify-start">
              {orderedDisplayCards.map((card, index) => {
                return (
                  <div
                    key={card.id}
                    className="h-14 sm:h-20 md:h-24 lg:h-28 aspect-[59/86] rounded shadow-sm"
                    style={{
                      zIndex: hoveredCardIndex === index ? 100 : index + 1,
                    }}
                    onMouseEnter={() => setHoveredCardIndex(index)}
                    onMouseLeave={() => setHoveredCardIndex(null)}
                  >
                    <DraggableCard card={card} className="w-full h-full" hoverDirection="left" />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
      {/* Label at the bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-5 flex items-center justify-center">
        <span className="text-[10px] sm:text-xs font-medium text-muted-foreground">
          {type === "grave" ? "墓地" : "除外"} ({cardCount})
        </span>
      </div>
    </div>
  )
}

export function GameField() {
  const [isOpponentFieldOpen, setIsOpponentFieldOpen] = useState(false)
  const [gameState] = useAtom(gameStateAtom)
  const [, moveCard] = useAtom(moveCardAtom)

  const playerBoard = gameState.players.self
  const opponentBoard = gameState.players.opponent

  const draggedCard = useAtomValue(draggedCardAtom)

  // Refs for dynamic height calculation
  const gridRef = useRef<HTMLDivElement>(null)
  const [playerGraveHeight, setPlayerGraveHeight] = useState<number | null>(null)
  const [playerGraveMarginTop, setPlayerGraveMarginTop] = useState<number | null>(null)
  const [opponentGraveHeight, setOpponentGraveHeight] = useState<number | null>(null)

  const handleCardDrop = (from: ZoneId, to: ZoneId) => {
    if (draggedCard && draggedCard.zone && draggedCard.index !== undefined) {
      // draggedCardのzone情報にindexを含める
      const fromWithIndex = { ...from, index: draggedCard.index }
      moveCard({ zone: fromWithIndex }, { zone: to })
    } else {
      moveCard({ zone: from }, { zone: to })
    }
  }

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
    <div className="w-full max-w-6xl mx-auto p-2 sm:p-4">
      {/* Opponent's Area */}
      <div className="mb-2">
        <div className="flex items-center justify-start mb-1">
          <button
            onClick={() => setIsOpponentFieldOpen(!isOpponentFieldOpen)}
            className="flex items-center gap-1 px-2 py-1 hover:bg-muted rounded-md transition-colors text-xs sm:text-sm"
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

        {isOpponentFieldOpen && (
          <div className="space-y-2 mb-2">
            {/* Opponent's Deck & Extra Deck (Top) - viewed from opponent's perspective */}
            <DeckZone 
              type="extra" 
              isOpponent={true} 
              cardCount={opponentBoard.extraDeck.length} 
              cards={opponentBoard.extraDeck}
              onDrop={handleCardDrop} 
            />
            <DeckZone 
              type="deck" 
              isOpponent={true} 
              cardCount={opponentBoard.deck.length} 
              cards={opponentBoard.deck}
              onDrop={handleCardDrop} 
            />

            {/* Opponent's Hand */}
            <DeckZone
              type="hand"
              isOpponent={true}
              cardCount={opponentBoard.hand.length}
              cards={opponentBoard.hand}
              onDrop={handleCardDrop}
            />
          </div>
        )}
      </div>

      {/* Combined Field Layout */}
      <div className="mb-2 flex justify-center">
        <div
          ref={gridRef}
          className="grid grid-cols-[max-content_repeat(5,max-content)_max-content] gap-1 sm:gap-2 p-1 sm:p-2 mx-auto relative overflow-visible"
        >
          {/* Opponent's Field (when open) */}
          {isOpponentFieldOpen && (
            <>
              {/* Row 1: Opponent's Spell/Trap Zones + Grave/Banish */}
              <div /> {/* Empty space above field zone */}
              {[0, 1, 2, 3, 4].map((index) => (
                <Zone
                  key={`opponent-spell-${index}`}
                  className={index === 0 ? "spell-trap-zone-opponent" : ""}
                  type="spell"
                  zone={{ player: "opponent", type: "spellTrapZone", index }}
                  cards={opponentBoard.spellTrapZones[index]}
                  onDrop={handleCardDrop}
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
                  style={{
                    height: opponentGraveHeight
                      ? `${opponentGraveHeight}px`
                      : window.innerWidth >= 768
                        ? "200px"
                        : window.innerWidth >= 640
                          ? "168px"
                          : "116px",
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
                  cardCount={opponentBoard.banished.length}
                  cards={opponentBoard.banished}
                  zone={{ player: "opponent", type: "banished" }}
                  onDrop={handleCardDrop}
                  isOpponent={true}
                  style={{
                    height: opponentGraveHeight
                      ? `${opponentGraveHeight}px`
                      : window.innerWidth >= 768
                        ? "200px"
                        : window.innerWidth >= 640
                          ? "168px"
                          : "116px",
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
              {/* Row 2: Opponent's Field + Monster Zones */}
              <Zone
                className="row-start-2"
                type="field"
                zone={{ player: "opponent", type: "fieldZone" }}
                card={opponentBoard.fieldZone}
                onDrop={handleCardDrop}
              />
              {[0, 1, 2, 3, 4].map((index) => (
                <Zone
                  key={`opponent-monster-${index}`}
                  className={cn("row-start-2", index === 0 ? "monster-zone-opponent" : "")}
                  type="monster"
                  zone={{ player: "opponent", type: "monsterZone", index }}
                  cards={opponentBoard.monsterZones[index]}
                  onDrop={handleCardDrop}
                />
              ))}
            </>
          )}
          {/* Row 3: EMZs (shared row between both players) */}
          <Zone
            className={cn("col-start-3 emz-zone-self", isOpponentFieldOpen ? "row-start-3" : "row-start-1")}
            type="emz"
            zone={{ player: "self", type: "extraMonsterZone", index: 0 }}
            cards={playerBoard.extraMonsterZones[0]}
            onDrop={handleCardDrop}
          />
          <Zone
            className={cn("col-start-5", isOpponentFieldOpen ? "row-start-3" : "row-start-1")}
            type="emz"
            zone={{ player: "self", type: "extraMonsterZone", index: 1 }}
            cards={playerBoard.extraMonsterZones[1]}
            onDrop={handleCardDrop}
          />
          {/* Player's Field + Monster Zones */}
          <Zone
            className={cn("", isOpponentFieldOpen ? "row-start-4" : "row-start-2")}
            type="field"
            zone={{ player: "self", type: "fieldZone" }}
            card={playerBoard.fieldZone}
            onDrop={handleCardDrop}
          />
          {[0, 1, 2, 3, 4].map((index) => (
            <Zone
              key={`self-monster-${index}`}
              className={cn("", isOpponentFieldOpen ? "row-start-4" : "row-start-2")}
              type="monster"
              zone={{ player: "self", type: "monsterZone", index }}
              cards={playerBoard.monsterZones[index]}
              onDrop={handleCardDrop}
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
                marginTop: playerGraveMarginTop
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
                style={{
                  height: playerGraveHeight
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
                style={{
                  height: playerGraveHeight
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
          <div className={cn("", isOpponentFieldOpen ? "row-start-5" : "row-start-3")} />{" "}
          {/* Empty space below field zone */}
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
            />
          ))}
        </div>
      </div>

      {/* Player's Hand, Deck & Extra Deck (Bottom) */}
      <div className="space-y-2">
        <DeckZone type="hand" cardCount={playerBoard.hand.length} cards={playerBoard.hand} onDrop={handleCardDrop} />
        <DeckZone type="deck" cardCount={playerBoard.deck.length} cards={playerBoard.deck} onDrop={handleCardDrop} />
        <DeckZone
          type="extra"
          cardCount={playerBoard.extraDeck.length}
          cards={playerBoard.extraDeck}
          onDrop={handleCardDrop}
        />
      </div>
    </div>
  )
}
