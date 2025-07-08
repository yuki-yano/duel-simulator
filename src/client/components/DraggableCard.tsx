import { useState, useRef, useEffect } from "react"
import { useSetAtom, useAtomValue } from "jotai"
import { draggedCardAtom, replayPlayingAtom, cardAnimationsAtom } from "@/client/atoms/boardAtoms"
import type { Card as GameCard } from "@/shared/types/game"
import { cn } from "@/client/lib/utils"

interface DraggableCardProps {
  card: GameCard
  className?: string
  hoverDirection?: "up" | "left" | "right"
  style?: React.CSSProperties
  stackIndex?: number
  onContextMenu?: (e: React.MouseEvent | React.TouchEvent, card: GameCard) => void
}

export function DraggableCard({ card, className, hoverDirection = "up", style, stackIndex, onContextMenu }: DraggableCardProps) {
  const setDraggedCard = useSetAtom(draggedCardAtom)
  const isReplayPlaying = useAtomValue(replayPlayingAtom)
  const cardAnimations = useAtomValue(cardAnimationsAtom)
  const [isHovered, setIsHovered] = useState(false)
  const [isTouching, setIsTouching] = useState(false)
  const [touchPosition, setTouchPosition] = useState<{ x: number; y: number } | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null)
  const dragOffsetRef = useRef<{ x: number; y: number } | null>(null)
  
  // Check if this card is currently animating
  const isAnimating = cardAnimations.some(anim => anim.cardId === card.id)

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current != null) {
        clearTimeout(longPressTimerRef.current)
      }
    }
  }, [])

  const handleDragStart = (e: React.DragEvent) => {
    // Disable dragging during replay
    if (isReplayPlaying) {
      e.preventDefault()
      return
    }
    
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
    // Disable touch dragging during replay
    if (isReplayPlaying) {
      e.preventDefault()
      return
    }
    
    // Clear any existing long press timer
    if (longPressTimerRef.current != null) {
      clearTimeout(longPressTimerRef.current)
    }

    // Prevent default to avoid scrolling, text selection, and iOS context menu
    e.preventDefault()
    e.stopPropagation()

    if (e.touches.length > 0) {
      const touch = e.touches[0]
      
      // Store initial touch position for detecting movement
      touchStartPosRef.current = { x: touch.clientX, y: touch.clientY }
      
      // Calculate offset from touch point to card center
      if (cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect()
        const cardCenterX = rect.left + rect.width / 2
        const cardCenterY = rect.top + rect.height / 2
        
        
        // Store the offset from touch point to card center
        dragOffsetRef.current = {
          x: cardCenterX - touch.clientX,
          y: cardCenterY - touch.clientY
        }
      } else {
        // Fallback if card ref is not available
        dragOffsetRef.current = { x: 0, y: 0 }
      }
      
      // Set up long press detection (1000ms = 1 second)
      longPressTimerRef.current = setTimeout(() => {
        if (touchStartPosRef.current && onContextMenu) {
          // Trigger custom context menu
          onContextMenu(e, card)
        }
      }, 1000)

      // Start dragging immediately
      setIsTouching(true)
      const cardWithIndex =
        stackIndex !== undefined && card.zone ? { ...card, zone: { ...card.zone, cardIndex: stackIndex } } : card
      setDraggedCard(cardWithIndex)

      // Get current touch position in client coordinates
      setTouchPosition({ x: touch.clientX, y: touch.clientY })
    }

    // Disable body scrolling
    document.body.style.overflow = "hidden"
    document.body.style.touchAction = "none"
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    // Clear long press timer
    if (longPressTimerRef.current != null) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }

    if (isTouching && e.changedTouches.length > 0) {
      const touch = e.changedTouches[0]

      // Temporarily hide the dragging card to get the correct element
      setTouchPosition(null)

      // Small delay to ensure the dragging card is hidden
      setTimeout(() => {
        // Use clientX/clientY directly for elementFromPoint
        const element = document.elementFromPoint(touch.clientX, touch.clientY)

        // Trigger drag and drop events on the element under touch point
        if (element) {
          // Walk up the DOM tree to find a droppable zone
          let targetElement: Element | null = element
          let foundDroppable = false
          
          while (targetElement && !foundDroppable) {
            // Check if this element or its parent has drag event handlers
            if ((targetElement as HTMLElement).ondrop || (targetElement as HTMLElement).ondragover || 
                targetElement.classList.contains('zone') ||
                targetElement.classList.contains('deck-zone') ||
                targetElement.classList.contains('grave-zone')) {
              foundDroppable = true
              break
            }
            targetElement = targetElement.parentElement
          }
          
          if (foundDroppable && targetElement) {
            // Create and dispatch dragenter, dragover, and drop events
            const dragOverEvent = new DragEvent("dragover", {
              bubbles: true,
              cancelable: true,
              dataTransfer: new DataTransfer(),
              clientX: touch.clientX,
              clientY: touch.clientY,
            })
            targetElement.dispatchEvent(dragOverEvent)

            // Small delay to ensure dragOver is processed before drop
            setTimeout(() => {
              const dropEvent = new DragEvent("drop", {
                bubbles: true,
                cancelable: true,
                dataTransfer: new DataTransfer(),
                clientX: touch.clientX,
                clientY: touch.clientY,
              })
              targetElement.dispatchEvent(dropEvent)
              
              // Clear dragged card after drop event is processed
              setTimeout(() => {
                setDraggedCard(null)
              }, 0)
            }, 10)
          } else {
            // No droppable zone found, clear dragged card
            setDraggedCard(null)
          }
        } else {
          // No element found at touch point, clear dragged card
          setDraggedCard(null)
        }
        
        setIsTouching(false)
        // Don't clear dragged card here - it's handled above
      }, 0)
    } else {
      setIsTouching(false)
      setDraggedCard(null)
      setTouchPosition(null)
    }
    
    touchStartPosRef.current = null
    dragOffsetRef.current = null

    // Restore body scrolling
    document.body.style.overflow = ""
    document.body.style.touchAction = ""
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isTouching && e.touches.length > 0) {
      const touch = e.touches[0]
      
      // Cancel long press if finger moved more than 10 pixels
      if (longPressTimerRef.current != null && touchStartPosRef.current != null) {
        const deltaX = Math.abs(touch.clientX - touchStartPosRef.current.x)
        const deltaY = Math.abs(touch.clientY - touchStartPosRef.current.y)
        if (deltaX > 10 || deltaY > 10) {
          clearTimeout(longPressTimerRef.current)
          longPressTimerRef.current = null
        }
      }
      
      
      // Use clientX/clientY (viewport coordinates)
      setTouchPosition({ x: touch.clientX, y: touch.clientY })
      
      // Fire dragOver event on the element under the touch point
      const element = document.elementFromPoint(touch.clientX, touch.clientY)
      if (element) {
        const dragOverEvent = new DragEvent("dragover", {
          bubbles: true,
          cancelable: true,
          dataTransfer: new DataTransfer(),
          clientX: touch.clientX,
          clientY: touch.clientY,
        })
        element.dispatchEvent(dragOverEvent)
      }
    }
  }

  return (
    <>
      <div
        ref={cardRef}
        className={cn("transition-all duration-200", className)}
        draggable={!isReplayPlaying}
        data-card-id={card.id}
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
          cursor: isReplayPlaying ? "not-allowed" : "grab",
          opacity: isAnimating ? 0 : isTouching ? 0.5 : 1,
          visibility: isAnimating ? "hidden" : "visible",
          touchAction: isTouching ? "none" : "auto",
          position: "relative",
          transform:
            (isHovered || isTouching) && !isReplayPlaying
              ? hoverDirection === "left"
                ? "translateX(-8px)"
                : hoverDirection === "right"
                  ? "translateX(8px)"
                  : "translateY(-8px)"
              : "translate(0)",
          zIndex: (isHovered || isTouching) && !isReplayPlaying ? 1000 : 1,
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
            WebkitUserSelect: "none",
            userSelect: "none",
            WebkitTouchCallout: "none",
          }}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>
      {isTouching && touchPosition && dragOffsetRef.current && (() => {
        // Use fixed size for drag image
        const dragImageWidth = 60
        const dragImageHeight = 86
        
        // Simple positioning without any pinch zoom adjustments
        const displayX = touchPosition.x + dragOffsetRef.current.x - dragImageWidth / 2
        const displayY = touchPosition.y + dragOffsetRef.current.y - dragImageHeight / 2
        
        return (
          <div
            className="fixed pointer-events-none z-[9999]"
            style={{
              left: `${displayX}px`,
              top: `${displayY}px`,
              width: `${dragImageWidth}px`,
              height: `${dragImageHeight}px`,
              pointerEvents: "none",
            }}
          >
          <img
            src={card.imageUrl}
            alt="Dragging card"
            className="w-full h-full object-cover rounded shadow-xl"
            style={{
              transform: `rotate(${card.rotation}deg)`,
              WebkitUserSelect: "none",
              userSelect: "none",
              WebkitTouchCallout: "none",
            }}
          />
          </div>
        )
      })()}
    </>
  )
}
