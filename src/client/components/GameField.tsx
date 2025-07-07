import { useState, useRef, useEffect } from "react"
import { cn } from "@client/lib/utils"
import { ChevronDown, ChevronUp } from "lucide-react"

interface ZoneProps {
  className?: string
  label?: string
  children?: React.ReactNode
  type?: "monster" | "spell" | "field" | "extra" | "deck" | "emz" | "hand"
  isOpponent?: boolean
  cardCount?: number
}

interface GraveZoneProps {
  type: "grave" | "banish"
  cardCount: number
  label?: string
  className?: string
}

function Zone({ className, label, children, type = "monster", isOpponent = false }: ZoneProps) {
  const typeStyles = {
    monster: "bg-blue-500/5 border-blue-500/30 hover:border-blue-500/50",
    spell: "bg-green-500/5 border-green-500/30 hover:border-green-500/50",
    field: "bg-amber-500/5 border-amber-500/30 hover:border-amber-500/50",
    extra: "bg-purple-500/5 border-purple-500/30 hover:border-purple-500/50",
    deck: "bg-gray-500/5 border-gray-500/30 hover:border-gray-500/50",
    emz: "bg-indigo-500/5 border-indigo-500/30 hover:border-indigo-500/50",
    hand: isOpponent ? "bg-gray-700/10 border-gray-700/30" : "bg-blue-500/5 border-blue-500/30",
  }

  return (
    <div
      className={cn(
        "relative h-14 sm:h-20 md:h-28 aspect-[59/86] rounded-md border-2 border-dashed flex items-center justify-center transition-colors",
        typeStyles[type],
        className,
      )}
    >
      {label !== undefined && label !== "" && (
        <span className="absolute top-0.5 left-0.5 text-[8px] sm:text-[10px] md:text-xs text-muted-foreground font-medium">
          {label}
        </span>
      )}
      {children}
    </div>
  )
}

interface HandZoneProps {
  isOpponent?: boolean
  cardCount?: number
}

function HandZone({ isOpponent = false, cardCount = 0 }: HandZoneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  const maxDisplay = 20
  const cards = Array.from({ length: Math.min(cardCount, maxDisplay) }, (_, i) => i)

  // Card dimensions based on height (maintaining 59:86 ratio)
  const cardHeightPx = window.innerWidth >= 768 ? 112 : window.innerWidth >= 640 ? 80 : 56 // md:h-28 (112px), sm:h-20 (80px), h-14 (56px)
  const cardWidthPx = Math.round((cardHeightPx * 59) / 86)
  const spacing = 8 // gap between cards when not overlapping
  const padding = window.innerWidth >= 640 ? 16 : 8 // Container padding (smaller on mobile)

  // Calculate available width for cards
  const availableWidth = containerWidth - padding * 2

  // Check if cards need to overlap
  const totalWidthNeeded = cards.length * cardWidthPx + (cards.length - 1) * spacing
  const needsOverlap = totalWidthNeeded > availableWidth

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

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full h-24 sm:h-32 md:h-36 rounded-lg border-2 border-dashed p-1 pb-1.5 sm:p-2 sm:pb-2 md:pb-3",
        isOpponent ? "bg-gray-500/10 border-gray-500/30" : "bg-blue-500/10 border-blue-500/30",
      )}
    >
      <span className="absolute top-1 left-1 text-[10px] sm:text-xs font-medium text-muted-foreground z-10">
        {isOpponent ? "相手の手札" : "手札"} ({cardCount})
      </span>
      {cardCount > 0 ? (
        <div className="relative h-full w-full flex items-center justify-start overflow-hidden mt-2 sm:mt-3">
          <div className="relative h-full flex items-center py-0.5 sm:py-1" style={{ width: availableWidth }}>
            {cards.map((index) => {
              // Calculate overlap to fit all cards in available space
              let cardPosition
              if (needsOverlap && containerWidth > 0) {
                const totalOverlap = totalWidthNeeded - availableWidth
                const overlapPerCard = cards.length > 1 ? totalOverlap / (cards.length - 1) : 0
                cardPosition = index * (cardWidthPx - overlapPerCard)
              } else {
                // No overlap needed, use normal spacing
                cardPosition = index * (cardWidthPx + spacing)
              }

              return (
                <div
                  key={index}
                  className={cn(
                    "absolute h-14 sm:h-20 md:h-28 aspect-[59/86] rounded bg-gradient-to-b shadow-sm transition-all hover:z-20 hover:translate-y-[-4px]",
                    isOpponent ? "from-gray-500/30 to-gray-600/30 rotate-180" : "from-blue-500/30 to-blue-600/30",
                  )}
                  style={{
                    left: `${cardPosition}px`,
                    zIndex: index + 1,
                  }}
                >
                  {!isOpponent && (
                    <span className="absolute top-1 left-1 text-[10px] sm:text-xs text-white/80 font-medium">
                      {index + 1}
                    </span>
                  )}
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
}

function DeckZone({ type, cardCount = 40, orientation = "horizontal" }: DeckZoneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  // Show all cards for deck
  const maxDisplay = orientation === "horizontal" ? 60 : 30
  const displayCount = Math.min(cardCount, maxDisplay)
  const cards = Array.from({ length: displayCount }, (_, i) => i)

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
    const cardHeightPx = window.innerWidth >= 768 ? 112 : window.innerWidth >= 640 ? 80 : 56 // md:h-28 (112px), sm:h-20 (80px), h-14 (56px)
    const cardWidthPx = Math.round((cardHeightPx * 59) / 86)
    const padding = window.innerWidth >= 640 ? 16 : 8 // Container padding (smaller on mobile)

    // Calculate available width for cards
    const availableWidth = containerWidth - padding * 2

    return (
      <div
        ref={containerRef}
        className={cn(
          "relative w-full h-24 sm:h-32 md:h-36 rounded-lg border-2 border-dashed p-1 pb-1.5 sm:p-2 sm:pb-2 md:pb-3",
          zoneStyles[type],
        )}
      >
        <span className="absolute top-1 left-1 text-[10px] sm:text-xs font-medium text-muted-foreground z-10">
          {type === "deck" ? "デッキ" : "EXデッキ"} ({cardCount})
        </span>
        {cardCount > 0 ? (
          <div className="relative h-full w-full flex items-center justify-start overflow-hidden mt-2 sm:mt-3">
            {containerWidth > 0 ? (
              <div className="relative h-full flex items-center py-0.5 sm:py-1" style={{ width: availableWidth }}>
                {cards.map((index) => {
                  // Calculate minimal overlap to fit all cards in available width
                  const minOffset = 3 // minimum visible width of each card
                  const totalMinWidth = minOffset * (cards.length - 1) + cardWidthPx

                  let cardPosition
                  if (totalMinWidth <= availableWidth) {
                    // If we have enough space, distribute cards evenly
                    const extraSpace = availableWidth - totalMinWidth
                    const spacing = extraSpace / (cards.length - 1)
                    cardPosition = index * (minOffset + spacing)
                  } else {
                    // If not enough space, use minimum offset
                    cardPosition = index * minOffset
                  }

                  return (
                    <div
                      key={index}
                      className={cn(
                        "absolute h-14 sm:h-20 md:h-28 aspect-[59/86] rounded bg-gradient-to-b shadow-sm",
                        cardStyles[type],
                      )}
                      style={{
                        left: `${cardPosition}px`,
                        zIndex: cards.length - index,
                      }}
                    />
                  )
                })}
              </div>
            ) : (
              <div className="flex items-center gap-1 py-0.5 sm:py-1">
                {cards.slice(0, 5).map((index) => (
                  <div
                    key={index}
                    className={cn(
                      "h-14 sm:h-20 md:h-28 aspect-[59/86] rounded bg-gradient-to-b shadow-sm",
                      cardStyles[type],
                    )}
                  />
                ))}
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
                {cards.map((index) => (
                  <div
                    key={index}
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

function GraveZone({ type, cardCount, className }: GraveZoneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // Initialize with estimated height for 2 field zones to prevent animation
  const getInitialHeight = () => {
    if (window.innerWidth >= 768) return 232 // md: h-28 * 2 + gap
    if (window.innerWidth >= 640) return 168 // sm: h-20 * 2 + gap
    return 116 // mobile: h-14 * 2 + gap
  }
  const [containerHeight, setContainerHeight] = useState(getInitialHeight())

  const maxDisplay = 20
  const displayCount = Math.min(cardCount, maxDisplay)
  const cards = Array.from({ length: displayCount }, (_, i) => i)

  // Card dimensions based on height (maintaining 59:86 ratio)
  const cardHeightPx = window.innerWidth >= 768 ? 112 : window.innerWidth >= 640 ? 80 : 56 // md:h-28 (112px), sm:h-20 (80px), h-14 (56px)
  const cardWidthPx = Math.round((cardHeightPx * 59) / 86)
  const spacing = 4 // gap between cards when not overlapping
  const padding = 8 // Container padding (reduced to p-1 = 4px * 2)

  // Calculate available height for cards
  const availableHeight = containerHeight - padding * 2

  // Check if cards need to overlap
  const totalHeightNeeded = cards.length * cardHeightPx + (cards.length - 1) * spacing
  const needsOverlap = totalHeightNeeded > availableHeight

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

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative rounded-md border-2 border-dashed p-1 h-full flex flex-col transition-colors",
        typeStyles[type],
        className,
      )}
    >
      {cardCount > 0 && (
        <div className="flex-1 flex flex-col items-center justify-start overflow-hidden">
          {needsOverlap && containerHeight > 0 ? (
            <div className="relative" style={{ height: availableHeight, width: cardWidthPx }}>
              {cards.map((index) => {
                // Calculate overlap to fit all cards in available space
                // The last card should end exactly at availableHeight
                const effectiveCardHeight = (availableHeight - cardHeightPx) / (cards.length - 1)
                const cardPosition = index * effectiveCardHeight

                return (
                  <div
                    key={index}
                    className={cn(
                      "absolute h-14 sm:h-20 md:h-28 aspect-[59/86] rounded bg-gradient-to-b shadow-sm",
                      cardStyles[type],
                    )}
                    style={{
                      top: `${Math.round(cardPosition)}px`,
                      zIndex: cards.length - index,
                      transition: "none",
                    }}
                  />
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              {cards.map((index) => (
                <div
                  key={index}
                  className={cn(
                    "h-14 sm:h-20 md:h-28 aspect-[59/86] rounded bg-gradient-to-b shadow-sm",
                    cardStyles[type],
                  )}
                  style={{
                    zIndex: cards.length - index,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function GameField() {
  const [isOpponentFieldOpen, setIsOpponentFieldOpen] = useState(false)

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
              <Zone type="spell" />
              <Zone type="spell" />
              <Zone type="spell" />
              <Zone type="spell" />
              <Zone type="spell" />
              <div className="row-span-2 flex gap-1 sm:gap-2">
                <GraveZone
                  type="grave"
                  cardCount={3}
                  className="h-[7.25rem] sm:h-[10.5rem] md:h-[14.5rem] min-w-[3.5rem] sm:min-w-[5rem] md:min-w-[7rem]"
                />
                <GraveZone
                  type="banish"
                  cardCount={3}
                  className="h-[7.25rem] sm:h-[10.5rem] md:h-[14.5rem] min-w-[3.5rem] sm:min-w-[5rem] md:min-w-[7rem]"
                />
              </div>
              {/* Row 2: Opponent's Field + Monster Zones */}
              <Zone className="row-start-2" type="field" />
              <Zone className="row-start-2" type="monster" />
              <Zone className="row-start-2" type="monster" />
              <Zone className="row-start-2" type="monster" />
              <Zone className="row-start-2" type="monster" />
              <Zone className="row-start-2" type="monster" />
            </>
          )}
          {/* Row 3: EMZs (shared row between both players) */}
          <Zone className={cn("col-start-3", isOpponentFieldOpen ? "row-start-3" : "row-start-1")} type="emz" />
          <Zone className={cn("col-start-5", isOpponentFieldOpen ? "row-start-3" : "row-start-1")} type="emz" />
          {/* Player's Field + Monster Zones */}
          <Zone className={cn("", isOpponentFieldOpen ? "row-start-4" : "row-start-2")} type="field" />
          <Zone className={cn("", isOpponentFieldOpen ? "row-start-4" : "row-start-2")} type="monster" />
          <Zone className={cn("", isOpponentFieldOpen ? "row-start-4" : "row-start-2")} type="monster" />
          <Zone className={cn("", isOpponentFieldOpen ? "row-start-4" : "row-start-2")} type="monster" />
          <Zone className={cn("", isOpponentFieldOpen ? "row-start-4" : "row-start-2")} type="monster" />
          <Zone className={cn("", isOpponentFieldOpen ? "row-start-4" : "row-start-2")} type="monster" />
          {/* Player's Grave/Banish (spanning both monster and spell rows) */}
          <div className={cn("row-span-2 flex gap-1 sm:gap-2", isOpponentFieldOpen ? "row-start-4" : "row-start-2")}>
            <GraveZone
              type="grave"
              cardCount={20}
              className="h-[7.25rem] sm:h-[10.5rem] md:h-[14.5rem] min-w-[3.5rem] sm:min-w-[5rem] md:min-w-[7rem]"
            />
            <GraveZone
              type="banish"
              cardCount={15}
              className="h-[7.25rem] sm:h-[10.5rem] md:h-[14.5rem] min-w-[3.5rem] sm:min-w-[5rem] md:min-w-[7rem]"
            />
          </div>
          {/* Player's Spell/Trap Zones */}
          <div className={cn("", isOpponentFieldOpen ? "row-start-5" : "row-start-3")} />{" "}
          {/* Empty space below field zone */}
          <Zone className={cn("", isOpponentFieldOpen ? "row-start-5" : "row-start-3")} type="spell" />
          <Zone className={cn("", isOpponentFieldOpen ? "row-start-5" : "row-start-3")} type="spell" />
          <Zone className={cn("", isOpponentFieldOpen ? "row-start-5" : "row-start-3")} type="spell" />
          <Zone className={cn("", isOpponentFieldOpen ? "row-start-5" : "row-start-3")} type="spell" />
          <Zone className={cn("", isOpponentFieldOpen ? "row-start-5" : "row-start-3")} type="spell" />
        </div>
      </div>

      {/* Player's Hand, Deck & Extra Deck (Bottom) */}
      <div className="space-y-2">
        <HandZone cardCount={7} />
        <DeckZone type="deck" cardCount={35} />
        <DeckZone type="extra" cardCount={15} />
      </div>
    </div>
  )
}
