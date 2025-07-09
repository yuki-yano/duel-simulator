import { useState, useRef, useEffect } from "react"
import { useSetAtom, useAtomValue } from "jotai"
import { draggedCardAtom, replayPlayingAtom, cardAnimationsAtom } from "@/client/atoms/boardAtoms"
import type { Card as GameCard, ZoneId } from "@/shared/types/game"
import { cn } from "@/client/lib/utils"

interface DraggableCardProps {
  card: GameCard
  zone: ZoneId // Zone information passed separately
  className?: string
  hoverDirection?: "up" | "left" | "right"
  style?: React.CSSProperties
  stackIndex?: number
  onContextMenu?: (e: React.MouseEvent | React.TouchEvent, card: GameCard) => void
  onContextMenuClose?: () => void
}

export function DraggableCard({
  card,
  zone,
  className,
  hoverDirection = "up",
  style,
  stackIndex,
  onContextMenu,
  onContextMenuClose,
}: DraggableCardProps) {
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
  const suppressDragImageRef = useRef<boolean>(false)

  // Check if this card is currently animating
  const isAnimating = cardAnimations.some((anim) => anim.cardId === card.id)

  // Clean up timers on unmount and setup non-passive touch listeners
  useEffect(() => {
    const element = cardRef.current
    if (!element) return

    // Non-passive touch event handlers
    const handleTouchStartNonPassive = (e: TouchEvent) => {
      // Only handle touch events, not mouse events
      if (e.type !== "touchstart") return

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

      // Clear any existing text/image selection
      const selection = window.getSelection()
      if (selection) {
        selection.removeAllRanges()
      }

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
            y: cardCenterY - touch.clientY,
          }
        } else {
          // Fallback if card ref is not available
          dragOffsetRef.current = { x: 0, y: 0 }
        }

        // Set up long press detection (600ms)
        longPressTimerRef.current = setTimeout(() => {
          if (touchStartPosRef.current && onContextMenu) {
            // Hide drag image when showing context menu
            setTouchPosition(null)
            suppressDragImageRef.current = true
            // Create synthetic event for onContextMenu
            const syntheticEvent = {
              preventDefault: () => {},
              stopPropagation: () => {},
              touches: e.touches,
              changedTouches: e.changedTouches,
              targetTouches: e.targetTouches,
              currentTarget: element,
              target: e.target,
            } as unknown as React.TouchEvent
            // Trigger custom context menu
            onContextMenu(syntheticEvent, card)
          }
        }, 600)

        // Start dragging immediately
        setIsTouching(true)
        const cardWithZone = {
          ...card,
          zone: stackIndex !== undefined ? { ...zone, cardIndex: stackIndex } : zone,
        }
        setDraggedCard(cardWithZone)

        // Get current touch position in client coordinates
        setTouchPosition({ x: touch.clientX, y: touch.clientY })
      }

      // Disable body scrolling
      document.body.style.overflow = "hidden"
      document.body.style.touchAction = "none"
    }

    // Add non-passive touch listener
    element.addEventListener("touchstart", handleTouchStartNonPassive, { passive: false })

    return () => {
      if (longPressTimerRef.current != null) {
        clearTimeout(longPressTimerRef.current)
      }
      element.removeEventListener("touchstart", handleTouchStartNonPassive)
    }
  }, [isReplayPlaying, card, stackIndex, onContextMenu, setDraggedCard, setTouchPosition])

  const handleDragStart = (e: React.DragEvent) => {
    // Disable dragging during replay
    if (isReplayPlaying) {
      e.preventDefault()
      return
    }

    // If the card has a zone and stackIndex is provided, update the zone with cardIndex
    const cardWithZone = {
      ...card,
      zone: stackIndex !== undefined ? { ...zone, cardIndex: stackIndex } : zone,
    }
    setDraggedCard(cardWithZone)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragEnd = () => {
    setDraggedCard(null)
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    // Clear long press timer
    if (longPressTimerRef.current != null) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }

    // If context menu was shown and no movement occurred, keep menu open
    // const noMovement = touchStartPosRef.current && contextMenuShownRef.current

    if (isTouching && e.changedTouches.length > 0) {
      const touch = e.changedTouches[0]

      // If drag image is suppressed and user hasn't moved, don't perform drop
      if (suppressDragImageRef.current && touchStartPosRef.current) {
        const deltaX = Math.abs(touch.clientX - touchStartPosRef.current.x)
        const deltaY = Math.abs(touch.clientY - touchStartPosRef.current.y)
        if (deltaX <= 10 && deltaY <= 10) {
          // User hasn't moved, keep context menu open
          setIsTouching(false)
          setDraggedCard(null)
          touchStartPosRef.current = null
          dragOffsetRef.current = null
          suppressDragImageRef.current = false
          return
        }
      }

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
            if (
              (targetElement as HTMLElement).ondrop ||
              (targetElement as HTMLElement).ondragover ||
              targetElement.classList.contains("zone") ||
              targetElement.classList.contains("deck-zone") ||
              targetElement.classList.contains("grave-zone")
            ) {
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
    suppressDragImageRef.current = false

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

      // If drag image is suppressed and user started moving, close menu and resume dragging
      if (suppressDragImageRef.current && touchStartPosRef.current != null) {
        const deltaX = Math.abs(touch.clientX - touchStartPosRef.current.x)
        const deltaY = Math.abs(touch.clientY - touchStartPosRef.current.y)
        if (deltaX > 10 || deltaY > 10) {
          suppressDragImageRef.current = false
          if (onContextMenuClose) {
            onContextMenuClose()
          }
        }
      }

      // Update touch position if not suppressed
      if (!suppressDragImageRef.current) {
        // Use clientX/clientY (viewport coordinates)
        setTouchPosition({ x: touch.clientX, y: touch.clientY })
      }

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
        onContextMenu={(e) => {
          e.preventDefault()
          if (onContextMenu) {
            onContextMenu(e, card)
          }
        }}
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
          WebkitTouchCallout: "none",
          WebkitUserSelect: "none",
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
        <div className="relative w-full h-full">
          <img
            src={card.imageUrl}
            alt="Card"
            className={cn(
              "w-full h-full object-cover rounded transition-shadow duration-200",
              (isHovered || isTouching) && "shadow-xl",
            )}
            style={{
              transform: `rotate(${card.rotation}deg)`,
              transition: "transform 0.2s ease",
              WebkitUserSelect: "none",
              userSelect: "none",
              WebkitTouchCallout: "none",
              // Intentionally not setting WebkitUserDrag to allow PC drag
            }}
            onContextMenu={(e) => e.preventDefault()}
          />
          {/* Face down overlay */}
          {card.faceDown === true && (
            <div
              className="absolute inset-0 rounded pointer-events-none bg-black/40"
              style={{
                transform: `rotate(${card.rotation}deg)`,
                transition: "transform 0.2s ease",
              }}
            />
          )}
          {/* Highlight overlay */}
          {card.highlighted === true && (
            <div
              className="absolute inset-0 rounded pointer-events-none"
              style={{
                transform: `rotate(${card.rotation}deg)`,
                border: "3px solid #ef4444",
                boxShadow: "inset 0 0 10px rgba(239, 68, 68, 0.5), 0 0 15px rgba(239, 68, 68, 0.6)",
                transition: "all 0.2s ease",
              }}
            />
          )}
        </div>
      </div>
      {isTouching &&
        touchPosition &&
        dragOffsetRef.current &&
        (() => {
          // Use fixed size for drag image
          const baseWidth = 60
          const baseHeight = 86

          // Adjust container size based on rotation
          const isRotated = card.rotation === -90 || card.rotation === 90
          const dragImageWidth = isRotated ? baseHeight : baseWidth
          const dragImageHeight = isRotated ? baseWidth : baseHeight

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
              <div
                className="relative"
                style={{
                  width: `${baseWidth}px`,
                  height: `${baseHeight}px`,
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  transform: `translate(-50%, -50%) rotate(${card.rotation}deg)`,
                }}
              >
                <img
                  src={card.imageUrl}
                  alt="Dragging card"
                  draggable={false}
                  className="w-full h-full object-cover rounded shadow-xl"
                  style={{
                    WebkitUserSelect: "none",
                    userSelect: "none",
                    WebkitTouchCallout: "none",
                    pointerEvents: "none",
                  }}
                  onContextMenu={(e) => e.preventDefault()}
                />
                {/* Face down overlay for drag image */}
                {card.faceDown === true && <div className="absolute inset-0 rounded pointer-events-none bg-black/40" />}
              </div>
            </div>
          )
        })()}
    </>
  )
}
