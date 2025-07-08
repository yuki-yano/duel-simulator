import { useState, useRef, useEffect } from "react"
import { cn } from "@client/lib/utils"
import { ChevronDown, ChevronUp } from "lucide-react"
import { useAtom, useAtomValue } from "jotai"
import { gameStateAtom, hoveredZoneAtom, draggedCardAtom, moveCardAtom } from "@/client/atoms/boardAtoms"
import type { Card as GameCard, ZoneId, ZoneType } from "@/shared/types/game"
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
  onDrop?: (fromZone: ZoneId, toZone: ZoneId) => void
}

interface GraveZoneProps {
  type: "grave" | "banish"
  cardCount: number
  label?: string
  className?: string
  cards?: GameCard[]
  zone?: ZoneId
  onDrop?: (fromZone: ZoneId, toZone: ZoneId) => void
}

function Zone({ className, label, children, type = "monster", isOpponent = false, zone, card, onDrop }: ZoneProps) {
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

  const isHovered = hoveredZone && zone && 
    hoveredZone.player === zone.player && 
    hoveredZone.type === zone.type && 
    hoveredZone.index === zone.index

  return (
    <div
      className={cn(
        "relative h-14 sm:h-20 md:h-24 lg:h-28 aspect-[59/86] rounded-md border-2 border-dashed flex items-center justify-center transition-colors",
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
      {card && (
        <DraggableCard 
          card={card} 
          className="w-full h-full"
        />
      )}
      {children}
    </div>
  )
}

interface HandZoneProps {
  isOpponent?: boolean
  cardCount?: number
  cards?: GameCard[]
  onDrop?: (fromZone: ZoneId, toZone: ZoneId) => void
}

function HandZone({ isOpponent = false, cardCount = 0, cards = [], onDrop }: HandZoneProps) {
  const [hoveredZone, setHoveredZone] = useAtom(hoveredZoneAtom)
  const draggedCard = useAtomValue(draggedCardAtom)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [hoveredCardIndex, setHoveredCardIndex] = useState<number | null>(null)

  const isMobile = window.innerWidth <= 1024 // 1024px以下をモバイルとする
  const maxDisplay = 40 // 最大表示枚数を増やす
  const displayCards = cards.length > 0 ? cards.slice(0, maxDisplay) : Array.from({ length: Math.min(cardCount, maxDisplay) }, (_, i) => i)

  // Card dimensions based on height (maintaining 59:86 ratio)
  const cardHeightPx = window.innerWidth >= 1024 ? 112 : window.innerWidth >= 768 ? 96 : window.innerWidth >= 640 ? 80 : 56 // lg:h-28 (112px), md:h-24 (96px), sm:h-20 (80px), h-14 (56px)
  const cardWidthPx = Math.round((cardHeightPx * 59) / 86)
  const spacing = 8 // gap between cards when not overlapping
  const padding = window.innerWidth >= 640 ? 16 : 8 // Container padding (smaller on mobile)

  // Calculate available width for cards
  const availableWidth = containerWidth - padding * 2

  // モバイルで20枚以上の場合は2行表示
  const needsTwoRows = isMobile && displayCards.length >= 20
  const rowCount = needsTwoRows ? 2 : 1
  const cardsPerRow = needsTwoRows ? Math.ceil(displayCards.length / 2) : displayCards.length

  // Check if cards need to overlap (per row)
  const totalWidthNeeded = cardsPerRow * cardWidthPx + (cardsPerRow - 1) * spacing
  const needsOverlap = totalWidthNeeded > availableWidth
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (draggedCard && !isOpponent) {
      setHoveredZone({ player: 'self', type: 'hand' })
    }
  }
  
  const handleDragLeave = () => {
    setHoveredZone(null)
  }
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (draggedCard && onDrop && draggedCard.zone && !isOpponent) {
      onDrop(draggedCard.zone, { player: 'self', type: 'hand' })
    }
    setHoveredZone(null)
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

  const isHovered = hoveredZone && !isOpponent &&
    hoveredZone.player === 'self' && 
    hoveredZone.type === 'hand'
  
  // コンテナの高さを行数に応じて調整
  const containerHeight = needsTwoRows 
    ? "h-44 sm:h-56 md:h-60 lg:h-72" // 2行の場合（176px, 224px, 240px, 288px）
    : "h-24 sm:h-32 md:h-36 lg:h-36" // 1行の場合

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full rounded-lg border-2 border-dashed p-1 pb-1.5 sm:p-2 sm:pb-2 md:pb-3 overflow-visible",
        containerHeight,
        isOpponent ? "bg-gray-500/10 border-gray-500/30" : "bg-blue-500/10 border-blue-500/30",
        isHovered && "border-4 border-blue-500 bg-blue-500/20",
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <span className="absolute top-1 left-1 text-[10px] sm:text-xs font-medium text-muted-foreground z-10">
        {isOpponent ? "相手の手札" : "手札"} ({cardCount})
      </span>
      {cardCount > 0 ? (
        <div className={cn(
          "relative h-full w-full flex items-center justify-start overflow-visible",
          needsTwoRows ? "mt-1 sm:mt-2" : "mt-1 sm:mt-2"
        )}>
          <div className="relative h-full flex flex-col justify-center gap-1 overflow-visible py-0.5 sm:py-1" style={{ width: availableWidth }}>
            {Array.from({ length: rowCount }, (_, rowIndex) => {
              const startIdx = rowIndex * cardsPerRow
              const endIdx = Math.min(startIdx + cardsPerRow, displayCards.length)
              const rowCards = displayCards.slice(startIdx, endIdx)
              const rowCardCount = rowCards.length

              // 各行のカード配置を計算
              const rowTotalWidthNeeded = rowCardCount * cardWidthPx + (rowCardCount - 1) * spacing
              const rowNeedsOverlap = rowTotalWidthNeeded > availableWidth

              return (
                <div key={rowIndex} className="relative h-14 sm:h-20 md:h-24 lg:h-28" style={{ width: availableWidth }}>
                  {rowCards.map((item, cardIndex) => {
                    const globalIndex = startIdx + cardIndex
                    const isCard = typeof item === 'object' && item !== null
                    
                    let cardPosition
                    if (rowNeedsOverlap && containerWidth > 0) {
                      const totalOverlap = rowTotalWidthNeeded - availableWidth
                      const overlapPerCard = rowCardCount > 1 ? totalOverlap / (rowCardCount - 1) : 0
                      cardPosition = cardIndex * (cardWidthPx - overlapPerCard)
                    } else {
                      // No overlap needed, use normal spacing
                      cardPosition = cardIndex * (cardWidthPx + spacing)
                    }

                    if (isCard) {
                      const card = item as GameCard
                      
                      return (
                        <div
                          key={card.id}
                          className="absolute h-14 sm:h-20 md:h-24 lg:h-28 aspect-[59/86] rounded shadow-sm transition-all hover:translate-y-[-4px]"
                          style={{
                            left: `${cardPosition}px`,
                            zIndex: hoveredCardIndex === globalIndex ? 100 : globalIndex + 1,
                          }}
                          onMouseEnter={() => setHoveredCardIndex(globalIndex)}
                          onMouseLeave={() => setHoveredCardIndex(null)}
                        >
                          <DraggableCard 
                            card={card} 
                            className="w-full h-full"
                          />
                        </div>
                      )
                    }
                    
                    return (
                      <div
                        key={globalIndex}
                        className={cn(
                          "absolute h-14 sm:h-20 md:h-24 lg:h-28 aspect-[59/86] rounded bg-gradient-to-b shadow-sm transition-all hover:translate-y-[-4px]",
                          isOpponent ? "from-gray-500/30 to-gray-600/30 rotate-180" : "from-blue-500/30 to-blue-600/30",
                        )}
                        style={{
                          left: `${cardPosition}px`,
                          zIndex: hoveredCardIndex === globalIndex ? 100 : globalIndex + 1,
                        }}
                        onMouseEnter={() => setHoveredCardIndex(globalIndex)}
                        onMouseLeave={() => setHoveredCardIndex(null)}
                      >
                        {!isOpponent && (
                          <span className="absolute top-1 left-1 text-[10px] sm:text-xs text-white/80 font-medium">
                            {globalIndex + 1}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}

interface DeckZoneProps {
  type: "deck" | "extra"
  isOpponent?: boolean
  cardCount?: number
  orientation?: "horizontal" | "vertical"
  cards?: GameCard[]
  onDrop?: (fromZone: ZoneId, toZone: ZoneId) => void
}

function DeckZone({ type, cardCount = 40, orientation = "horizontal", cards = [], onDrop }: DeckZoneProps) {
  const [hoveredZone, setHoveredZone] = useAtom(hoveredZoneAtom)
  const draggedCard = useAtomValue(draggedCardAtom)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [hoveredCardIndex, setHoveredCardIndex] = useState<number | null>(null)

  const isMobile = window.innerWidth <= 1024 // 1024px以下をモバイルとする
  // Show all cards for deck
  const maxDisplay = orientation === "horizontal" ? 60 : 30
  const displayCount = Math.min(cardCount, maxDisplay)
  const displayCards = cards.length > 0 ? cards.slice(0, displayCount) : Array.from({ length: displayCount }, (_, i) => i)
  
  // モバイルで20枚以上の場合は2行表示
  const needsTwoRows = isMobile && displayCards.length >= 20 && orientation === "horizontal"
  const rowCount = needsTwoRows ? 2 : 1
  const cardsPerRow = needsTwoRows ? Math.ceil(displayCards.length / 2) : displayCards.length
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (draggedCard) {
      setHoveredZone({ player: 'self', type: type === 'deck' ? 'deck' : 'extraDeck' })
    }
  }
  
  const handleDragLeave = () => {
    setHoveredZone(null)
  }
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (draggedCard && onDrop && draggedCard.zone) {
      onDrop(draggedCard.zone, { player: 'self', type: type === 'deck' ? 'deck' : 'extraDeck' })
    }
    setHoveredZone(null)
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
    gy: "bg-red-500/10 border-red-500/30",
    banished: "bg-slate-500/10 border-slate-500/30",
  }

  const cardStyles = {
    deck: "from-gray-500/30 to-gray-600/30",
    extra: "from-purple-500/30 to-purple-600/30",
    gy: "from-red-500/30 to-red-600/30",
    banished: "from-slate-500/30 to-slate-600/30",
  }

  if (orientation === "horizontal") {
    // Card dimensions for horizontal layout (maintaining aspect ratio)
    const cardHeightPx = window.innerWidth >= 1024 ? 112 : window.innerWidth >= 768 ? 96 : window.innerWidth >= 640 ? 80 : 56 // lg:h-28 (112px), md:h-24 (96px), sm:h-20 (80px), h-14 (56px)
    const cardWidthPx = Math.round((cardHeightPx * 59) / 86)
    const padding = window.innerWidth >= 640 ? 16 : 8 // Container padding (smaller on mobile)

    // Calculate available width for cards
    const availableWidth = containerWidth - padding * 2

    const isHovered = hoveredZone && hoveredZone.player === 'self' && 
      hoveredZone.type === (type === 'deck' ? 'deck' : 'extraDeck')
    
    // コンテナの高さを行数に応じて調整
    const containerHeight = needsTwoRows 
      ? "h-44 sm:h-56 md:h-60 lg:h-72" // 2行の場合（176px, 224px, 240px, 288px）
      : "h-24 sm:h-32 md:h-36 lg:h-36" // 1行の場合

    return (
      <div
        ref={containerRef}
        className={cn(
          "relative w-full rounded-lg border-2 border-dashed p-1 pb-1.5 sm:p-2 sm:pb-2 md:pb-3 overflow-visible",
          containerHeight,
          zoneStyles[type],
          isHovered && "border-4 border-blue-500 bg-blue-500/20",
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <span className="absolute top-1 left-1 text-[10px] sm:text-xs font-medium text-muted-foreground z-10">
          {type === "deck" ? "デッキ" : "EXデッキ"} ({cardCount})
        </span>
        {cardCount > 0 ? (
          <div className={cn(
            "relative h-full w-full flex items-center justify-start overflow-visible",
            needsTwoRows ? "mt-1 sm:mt-2" : "mt-1 sm:mt-2"
          )}>
            {containerWidth > 0 ? (
              <div className="relative h-full flex flex-col justify-center gap-1 overflow-visible py-0.5 sm:py-1" style={{ width: availableWidth }}>
                {Array.from({ length: rowCount }, (_, rowIndex) => {
                  const startIdx = rowIndex * cardsPerRow
                  const endIdx = Math.min(startIdx + cardsPerRow, displayCards.length)
                  const rowCards = displayCards.slice(startIdx, endIdx)
                  const rowCardCount = rowCards.length

                  // 各行のカード配置を計算
                  const minOffset = 3 // minimum visible width of each card
                  const totalMinWidth = minOffset * (rowCardCount - 1) + cardWidthPx

                  return (
                    <div key={rowIndex} className="relative h-14 sm:h-20 md:h-24 lg:h-28" style={{ width: availableWidth }}>
                      {rowCards.map((item, cardIndex) => {
                        const globalIndex = startIdx + cardIndex
                        const isCard = typeof item === 'object' && item !== null
                        
                        let cardPosition
                        if (totalMinWidth <= availableWidth) {
                          // If we have enough space, distribute cards evenly
                          const extraSpace = availableWidth - totalMinWidth
                          const spacing = rowCardCount > 1 ? extraSpace / (rowCardCount - 1) : 0
                          cardPosition = cardIndex * (minOffset + spacing)
                        } else {
                          // If not enough space, use minimum offset
                          cardPosition = cardIndex * minOffset
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
                              <DraggableCard 
                                card={card} 
                                className="w-full h-full"
                              />
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
                  const isCard = typeof item === 'object' && item !== null
                  return isCard ? (
                    <div key={(item as GameCard).id} className="h-14 sm:h-20 md:h-24 lg:h-28 aspect-[59/86] rounded shadow-sm">
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

function GraveZone({ type, cardCount, className, cards = [], zone, onDrop }: GraveZoneProps) {
  const [hoveredZone, setHoveredZone] = useAtom(hoveredZoneAtom)
  const draggedCard = useAtomValue(draggedCardAtom)
  const containerRef = useRef<HTMLDivElement>(null)
  // Initialize with estimated height for 2 field zones to prevent animation
  const getInitialHeight = () => {
    if (window.innerWidth >= 768) return 232 // md: h-28 * 2 + gap
    if (window.innerWidth >= 640) return 168 // sm: h-20 * 2 + gap
    return 116 // mobile: h-14 * 2 + gap
  }
  const [containerHeight, setContainerHeight] = useState(getInitialHeight())
  const [hoveredCardIndex, setHoveredCardIndex] = useState<number | null>(null)

  const maxDisplay = 20
  const displayCount = Math.min(cardCount, maxDisplay)
  const displayCards = cards.length > 0 ? cards.slice(0, displayCount) : []

  // Card dimensions based on height (maintaining 59:86 ratio)
  const cardHeightPx = window.innerWidth >= 768 ? 112 : window.innerWidth >= 640 ? 80 : 56 // md:h-28 (112px), sm:h-20 (80px), h-14 (56px)
  const cardWidthPx = Math.round((cardHeightPx * 59) / 86)
  const spacing = 4 // gap between cards when not overlapping
  const padding = 8 // Container padding (reduced to p-1 = 4px * 2)

  // Calculate available height for cards
  const availableHeight = containerHeight - padding * 2

  // Check if cards need to overlap
  const totalHeightNeeded = displayCards.length * cardHeightPx + (displayCards.length - 1) * spacing
  const needsOverlap = totalHeightNeeded > availableHeight
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (draggedCard && zone) {
      setHoveredZone(zone)
    }
  }
  
  const handleDragLeave = () => {
    setHoveredZone(null)
  }
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (draggedCard && onDrop && draggedCard.zone && zone) {
      onDrop(draggedCard.zone, zone)
    }
    setHoveredZone(null)
  }

  useEffect(() => {
    const updateHeight = () => {
      // Always use fixed height based on window size
      setContainerHeight(getInitialHeight())
    }

    // Use requestAnimationFrame to ensure immediate update
    requestAnimationFrame(updateHeight)

    // Only listen to window resize for fixed height behavior
    window.addEventListener("resize", updateHeight)
    return () => {
      window.removeEventListener("resize", updateHeight)
    }
  }, [])

  const typeStyles = {
    grave: "bg-red-500/5 border-red-500/30 hover:border-red-500/50",
    banish: "bg-slate-500/5 border-slate-500/30 hover:border-slate-500/50",
  }

  const cardStyles = {
    grave: "from-red-500/30 to-red-600/30",
    banish: "from-slate-500/30 to-slate-600/30",
  }

  const isHovered = hoveredZone && zone && 
    hoveredZone.player === zone.player && 
    hoveredZone.type === zone.type
  
  return (
    <div
      ref={containerRef}
      className={cn(
        "relative rounded-md border-2 border-dashed p-1 h-full flex flex-col transition-colors",
        typeStyles[type],
        isHovered && "border-4 border-blue-500 bg-blue-500/20",
        className,
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {displayCards.length > 0 && (
        <div className="flex-1 flex flex-col items-center justify-start overflow-hidden">
          {needsOverlap && containerHeight > 0 ? (
            <div className="relative" style={{ height: availableHeight, width: cardWidthPx }}>
              {displayCards.map((card, index) => {
                // Calculate overlap to fit all cards in available space
                // The last card should end exactly at availableHeight
                const effectiveCardHeight = (availableHeight - cardHeightPx) / (displayCards.length - 1)
                const cardPosition = index * effectiveCardHeight

                // カードにzone情報が正しく設定されていることを確認
                return (
                  <div
                    key={card.id}
                    className="absolute h-14 sm:h-20 md:h-24 lg:h-28 aspect-[59/86] rounded shadow-sm"
                    style={{
                      top: `${Math.round(cardPosition)}px`,
                      zIndex: hoveredCardIndex === index ? 100 : displayCards.length - index,
                      transition: "none",
                    }}
                    onMouseEnter={() => setHoveredCardIndex(index)}
                    onMouseLeave={() => setHoveredCardIndex(null)}
                  >
                    <DraggableCard 
                      card={card} 
                      className="w-full h-full"
                      hoverDirection="left"
                    />
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              {displayCards.map((card, index) => {
                return (
                  <div
                    key={card.id}
                    className="h-14 sm:h-20 md:h-24 lg:h-28 aspect-[59/86] rounded shadow-sm"
                    style={{
                      zIndex: hoveredCardIndex === index ? 100 : displayCards.length - index,
                    }}
                    onMouseEnter={() => setHoveredCardIndex(index)}
                    onMouseLeave={() => setHoveredCardIndex(null)}
                  >
                    <DraggableCard 
                      card={card} 
                      className="w-full h-full"
                      hoverDirection="left"
                    />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
      {displayCards.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-xs sm:text-sm text-muted-foreground">
            {type === "grave" ? "墓地" : "除外"} (0)
          </span>
        </div>
      )}
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
  
  const handleCardDrop = (from: ZoneId, to: ZoneId) => {
    if (draggedCard && draggedCard.zone && draggedCard.index !== undefined) {
      // draggedCardのzone情報にindexを含める
      const fromWithIndex = { ...from, index: draggedCard.index }
      moveCard({ zone: fromWithIndex }, { zone: to })
    } else {
      moveCard({ zone: from }, { zone: to })
    }
  }

  return (
    <div className="w-full max-w-6xl mx-auto p-2 sm:p-4">
      {/* Opponent's Area */}
      <div className="mb-2">
        <div className="flex items-center justify-end mb-1">
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
            <DeckZone type="extra" isOpponent={true} cardCount={15} />
            <DeckZone type="deck" isOpponent={true} cardCount={40} />

            {/* Opponent's Hand */}
            <HandZone isOpponent={true} cardCount={6} />
          </div>
        )}
      </div>

      {/* Combined Field Layout */}
      <div className="mb-2 flex justify-center">
        <div className="grid grid-cols-[max-content_repeat(5,max-content)_max-content] gap-1 sm:gap-2 p-1 sm:p-2 mx-auto">
          {/* Opponent's Field (when open) */}
          {isOpponentFieldOpen && (
            <>
              {/* Row 1: Opponent's Spell/Trap Zones + Grave/Banish */}
              <div /> {/* Empty space above field zone */}
              {[0, 1, 2, 3, 4].map((index) => (
                <Zone 
                  key={`opponent-spell-${index}`}
                  type="spell" 
                  zone={{ player: 'opponent', type: 'spellTrapZone', index }}
                  card={opponentBoard.spellTrapZones[index]}
                  onDrop={handleCardDrop}
                />
              ))}
              <div className="row-span-2 flex gap-1 sm:gap-2">
                <GraveZone
                  type="grave"
                  cardCount={opponentBoard.graveyard.length}
                  cards={opponentBoard.graveyard}
                  zone={{ player: 'opponent', type: 'graveyard' }}
                  onDrop={handleCardDrop}
                  className="h-[7.25rem] sm:h-[10.5rem] md:h-[14.5rem] min-w-[3.5rem] sm:min-w-[5rem] md:min-w-[7rem]"
                />
                <GraveZone
                  type="banish"
                  cardCount={opponentBoard.banished.length}
                  cards={opponentBoard.banished}
                  zone={{ player: 'opponent', type: 'banished' }}
                  onDrop={handleCardDrop}
                  className="h-[7.25rem] sm:h-[10.5rem] md:h-[14.5rem] min-w-[3.5rem] sm:min-w-[5rem] md:min-w-[7rem]"
                />
              </div>
              {/* Row 2: Opponent's Field + Monster Zones */}
              <Zone 
                className="row-start-2" 
                type="field" 
                zone={{ player: 'opponent', type: 'fieldZone' }}
                card={opponentBoard.fieldZone}
                onDrop={handleCardDrop}
              />
              {[0, 1, 2, 3, 4].map((index) => (
                <Zone 
                  key={`opponent-monster-${index}`}
                  className="row-start-2" 
                  type="monster" 
                  zone={{ player: 'opponent', type: 'monsterZone', index }}
                  card={opponentBoard.monsterZones[index]}
                  onDrop={handleCardDrop}
                />
              ))}
            </>
          )}
          {/* Row 3: EMZs (shared row between both players) */}
          <Zone className={cn("col-start-3", isOpponentFieldOpen ? "row-start-3" : "row-start-1")} type="emz" />
          <Zone className={cn("col-start-5", isOpponentFieldOpen ? "row-start-3" : "row-start-1")} type="emz" />
          {/* Player's Field + Monster Zones */}
          <Zone 
            className={cn("", isOpponentFieldOpen ? "row-start-4" : "row-start-2")} 
            type="field" 
            zone={{ player: 'self', type: 'fieldZone' }}
            card={playerBoard.fieldZone}
            onDrop={handleCardDrop}
          />
          {[0, 1, 2, 3, 4].map((index) => (
            <Zone 
              key={`self-monster-${index}`}
              className={cn("", isOpponentFieldOpen ? "row-start-4" : "row-start-2")} 
              type="monster" 
              zone={{ player: 'self', type: 'monsterZone', index }}
              card={playerBoard.monsterZones[index]}
              onDrop={handleCardDrop}
            />
          ))}
          {/* Player's Grave/Banish (spanning both monster and spell rows) */}
          <div className={cn("row-span-2 flex gap-1 sm:gap-2", isOpponentFieldOpen ? "row-start-4" : "row-start-2")}>
            <GraveZone
              type="grave"
              cardCount={playerBoard.graveyard.length}
              cards={playerBoard.graveyard}
              zone={{ player: 'self', type: 'graveyard' }}
              onDrop={handleCardDrop}
              className="h-[7.25rem] sm:h-[10.5rem] md:h-[14.5rem] min-w-[3.5rem] sm:min-w-[5rem] md:min-w-[7rem]"
            />
            <GraveZone
              type="banish"
              cardCount={playerBoard.banished.length}
              cards={playerBoard.banished}
              zone={{ player: 'self', type: 'banished' }}
              onDrop={handleCardDrop}
              className="h-[7.25rem] sm:h-[10.5rem] md:h-[14.5rem] min-w-[3.5rem] sm:min-w-[5rem] md:min-w-[7rem]"
            />
          </div>
          {/* Player's Spell/Trap Zones */}
          <div className={cn("", isOpponentFieldOpen ? "row-start-5" : "row-start-3")} />{" "}
          {/* Empty space below field zone */}
          {[0, 1, 2, 3, 4].map((index) => (
            <Zone 
              key={`self-spell-${index}`}
              className={cn("", isOpponentFieldOpen ? "row-start-5" : "row-start-3")} 
              type="spell" 
              zone={{ player: 'self', type: 'spellTrapZone', index }}
              card={playerBoard.spellTrapZones[index]}
              onDrop={handleCardDrop}
            />
          ))}
        </div>
      </div>

      {/* Player's Hand, Deck & Extra Deck (Bottom) */}
      <div className="space-y-2">
        <HandZone 
          cardCount={playerBoard.hand.length} 
          cards={playerBoard.hand}
          onDrop={handleCardDrop}
        />
        <DeckZone 
          type="deck" 
          cardCount={playerBoard.deck.length} 
          cards={playerBoard.deck}
          onDrop={handleCardDrop}
        />
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
