import { useState, useRef } from "react"
import { useSetAtom } from "jotai"
import { draggedCardAtom } from "@/client/atoms/boardAtoms"
import type { Card as GameCard } from "@/shared/types/game"
import { cn } from "@/client/lib/utils"

interface DraggableCardProps {
  card: GameCard
  className?: string
  hoverDirection?: "up" | "left" | "right"
  style?: React.CSSProperties
  stackIndex?: number
}

export function DraggableCard({ card, className, hoverDirection = "up", style, stackIndex }: DraggableCardProps) {
  const setDraggedCard = useSetAtom(draggedCardAtom)
  const [isHovered, setIsHovered] = useState(false)
  const [isTouching, setIsTouching] = useState(false)
  const [touchPosition, setTouchPosition] = useState<{ x: number; y: number } | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  const handleDragStart = (e: React.DragEvent) => {
    // If the card has a zone and stackIndex is provided, update the zone with cardIndex
    const cardWithIndex =
      stackIndex !== undefined && card.zone ? { ...card, zone: { ...card.zone, cardIndex: stackIndex } } : card
    setDraggedCard(cardWithIndex)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragEnd = () => {
    setDraggedCard(null)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsTouching(true)
    // If the card has a zone and stackIndex is provided, update the zone with cardIndex
    const cardWithIndex =
      stackIndex !== undefined && card.zone ? { ...card, zone: { ...card.zone, cardIndex: stackIndex } } : card
    setDraggedCard(cardWithIndex)
    // Prevent default to avoid scrolling and text selection
    e.preventDefault()
    e.stopPropagation()

    if (e.touches.length > 0) {
      const touch = e.touches[0]
      // Account for visual viewport (zoom) offset
      const visualViewport = window.visualViewport
      const scale = visualViewport?.scale ?? 1
      const offsetX = visualViewport?.offsetLeft ?? 0
      const offsetY = visualViewport?.offsetTop ?? 0

      // Convert touch coordinates to visual viewport coordinates
      const x = (touch.clientX - offsetX) / scale
      const y = (touch.clientY - offsetY) / scale

      setTouchPosition({ x, y })
    }

    // Disable body scrolling
    document.body.style.overflow = "hidden"
    document.body.style.touchAction = "none"
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (isTouching && e.changedTouches.length > 0) {
      const touch = e.changedTouches[0]

      // Account for visual viewport (zoom) offset
      const visualViewport = window.visualViewport
      const _scale = visualViewport?.scale ?? 1
      const _offsetX = visualViewport?.offsetLeft ?? 0
      const _offsetY = visualViewport?.offsetTop ?? 0

      // Convert touch coordinates to document coordinates for elementFromPoint
      const docX = touch.clientX
      const docY = touch.clientY

      const element = document.elementFromPoint(docX, docY)

      // Trigger drag and drop events on the element under touch point
      if (element) {
        // Create and dispatch dragenter, dragover, and drop events
        const dragOverEvent = new DragEvent("dragover", {
          bubbles: true,
          cancelable: true,
          dataTransfer: new DataTransfer(),
        })
        element.dispatchEvent(dragOverEvent)

        const dropEvent = new DragEvent("drop", {
          bubbles: true,
          cancelable: true,
          dataTransfer: new DataTransfer(),
        })
        element.dispatchEvent(dropEvent)
      }
    }

    setIsTouching(false)
    setDraggedCard(null)
    setTouchPosition(null)

    // Restore body scrolling
    document.body.style.overflow = ""
    document.body.style.touchAction = ""
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isTouching && e.touches.length > 0) {
      const touch = e.touches[0]
      // Account for visual viewport (zoom) offset
      const visualViewport = window.visualViewport
      const scale = visualViewport?.scale ?? 1
      const offsetX = visualViewport?.offsetLeft ?? 0
      const offsetY = visualViewport?.offsetTop ?? 0

      // Convert touch coordinates to visual viewport coordinates
      const x = (touch.clientX - offsetX) / scale
      const y = (touch.clientY - offsetY) / scale

      setTouchPosition({ x, y })
    }
  }

  return (
    <>
      <div
        ref={cardRef}
        className={cn("transition-all duration-200", className)}
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={(e) => {
          // Only call handleTouchMove if dragging
          if (isTouching) {
            handleTouchMove(e)
          }
        }}
        style={{
          cursor: "grab",
          opacity: isTouching ? 0.5 : 1,
          touchAction: isTouching ? "none" : "auto",
          position: "relative",
          transform:
            isHovered || isTouching
              ? hoverDirection === "left"
                ? "translateX(-8px)"
                : hoverDirection === "right"
                  ? "translateX(8px)"
                  : "translateY(-8px)"
              : "translate(0)",
          zIndex: isHovered || isTouching ? 1000 : 1,
          transition: "transform 0.2s ease",
          ...style,
        }}
      >
        <img
          src={card.imageUrl}
          alt="Card"
          className={cn(
            "w-full h-full object-cover rounded transition-shadow duration-200",
            (isHovered || isTouching) && "shadow-xl",
          )}
          style={{
            transform: `rotate(${card.rotation}deg)`,
          }}
        />
      </div>
      {isTouching && touchPosition && (
        <div
          className="fixed pointer-events-none z-[9999]"
          style={{
            left: `${touchPosition.x * (window.visualViewport?.scale ?? 1) + (window.visualViewport?.offsetLeft ?? 0) - 30}px`,
            top: `${touchPosition.y * (window.visualViewport?.scale ?? 1) + (window.visualViewport?.offsetTop ?? 0) - 43}px`,
            width: "60px",
            height: "86px",
          }}
        >
          <img
            src={card.imageUrl}
            alt="Dragging card"
            className="w-full h-full object-cover rounded shadow-xl"
            style={{
              transform: `rotate(${card.rotation}deg)`,
            }}
          />
        </div>
      )}
    </>
  )
}
