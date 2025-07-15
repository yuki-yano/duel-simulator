import { useState, useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import { useSetAtom, useAtomValue } from "jotai"
import { 
  draggedCardAtom, 
  replayPlayingAtom, 
  cardAnimationsAtom, 
  updateCardRefAtom,
  activateEffectAtom,
  targetSelectAtom,
} from "@/client/atoms/boardAtoms"
import type { Card as GameCard, ZoneId, Position } from "@/shared/types/game"
import { cn } from "@/client/lib/utils"
import { TOKEN_IMAGE_DATA_URL } from "@/client/constants/tokenImage"
import { useScreenSize } from "@client/hooks/useScreenSize"

const LONG_PRESS_DURATION_MS = 600
const TOUCH_MOVE_THRESHOLD = 5
const DOUBLE_CLICK_THRESHOLD_MS = 300

// Create empty image once to avoid re-creating on every drag
const EMPTY_DRAG_IMAGE = new Image()
EMPTY_DRAG_IMAGE.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs="

interface DraggableCardProps {
  card: GameCard
  zone: ZoneId
  className?: string
  hoverDirection?: "up" | "left" | "right"
  style?: React.CSSProperties
  stackIndex?: number
  onContextMenu?: (e: React.MouseEvent | React.TouchEvent, card: GameCard, zone: ZoneId) => void
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
  const updateCardRef = useSetAtom(updateCardRefAtom)
  const activateEffect = useSetAtom(activateEffectAtom)
  const targetSelect = useSetAtom(targetSelectAtom)
  const { isMediumScreen, isSmallScreen } = useScreenSize()
  const [isHovered, setIsHovered] = useState(false)
  const [isTouching, setIsTouching] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null)
  const dragOffsetRef = useRef<{ x: number; y: number } | null>(null)
  const suppressDragImageRef = useRef<boolean>(false)
  const lastClickTimeRef = useRef<number>(0)

  // Unified drag state for PC and mobile
  const [isDragging, setIsDragging] = useState(false)
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null)

  // Check if this card is currently animating (only for move animations)
  const isAnimating = cardAnimations.some((anim) => anim.type === "move" && anim.cardId === card.id)

  // Check if this card has a highlight animation
  const highlightAnimating = cardAnimations.some((anim) => anim.type === "highlight" && anim.cardId === card.id)
  // Check if this card is in target animation (used to suppress hover shift only)
  const targetAnimating = cardAnimations.some((anim) => anim.type === "target" && anim.cardId === card.id)
  // Check if this card is in effect activation animation (used to suppress hover shift)
  const activateAnimating = cardAnimations.some((anim) => anim.type === "activate" && anim.cardId === card.id)
  // Check if this card is in rotate animation (used to suppress hover shift)
  const rotateAnimating = cardAnimations.some((anim) => anim.type === "rotate" && anim.cardId === card.id)

  // Track card ref
  useEffect(() => {
    if (cardRef.current) {
      updateCardRef(card.id, cardRef.current)
    }
    
    return () => {
      // Clean up ref when unmounting
      updateCardRef(card.id, null)
    }
  }, [card.id, updateCardRef])

  // Clean up timers on unmount and setup touch listeners
  useEffect(() => {
    const element = cardRef.current
    if (!element) return

    // Touch event handlers
    const handleTouchStart = (e: TouchEvent) => {
      // Only handle touch events, not mouse events
      if (e.type !== "touchstart") return

      // Disable touch dragging during replay
      if (isReplayPlaying) {
        e.preventDefault()
        return
      }

      // Clear any existing timers
      if (longPressTimerRef.current != null) {
        clearTimeout(longPressTimerRef.current)
      }

      // Prevent default to avoid scrolling when touching a card
      e.preventDefault()
      e.stopPropagation()

      if (e.touches.length > 0) {
        const touch = e.touches[0]

        // Store initial touch position
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

        // Start dragging immediately
        setIsTouching(true)
        setIsDragging(true)
        const cardWithZone = {
          ...card,
          zone: stackIndex !== undefined ? { ...zone, cardIndex: stackIndex } : zone,
        }
        setDraggedCard(cardWithZone)
        setDragPosition({ x: touch.clientX, y: touch.clientY })

        // Disable body scrolling
        document.body.style.overflow = "hidden"
        document.body.style.touchAction = "none"

        // Set up long press detection (600ms)
        longPressTimerRef.current = setTimeout(() => {
          if (touchStartPosRef.current && onContextMenu) {
            // Hide drag image when showing context menu
            setDragPosition(null)
            setIsDragging(false)
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
            onContextMenu(syntheticEvent, card, zone)
          }
        }, LONG_PRESS_DURATION_MS)
      }
    }

    // Add non-passive touch listener to prevent scrolling on card touch
    element.addEventListener("touchstart", handleTouchStart, { passive: false })

    return () => {
      if (longPressTimerRef.current != null) {
        clearTimeout(longPressTimerRef.current)
      }
      element.removeEventListener("touchstart", handleTouchStart)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReplayPlaying, card, stackIndex, onContextMenu, setDraggedCard])

  const handleDragStart = (e: React.DragEvent) => {
    // Disable dragging during replay
    if (isReplayPlaying) {
      e.preventDefault()
      return
    }

    // Hide default drag image
    e.dataTransfer.setDragImage(EMPTY_DRAG_IMAGE, 0, 0)

    // Calculate offset from mouse point to card center
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect()
      const cardCenterX = rect.left + rect.width / 2
      const cardCenterY = rect.top + rect.height / 2

      dragOffsetRef.current = {
        x: cardCenterX - e.clientX,
        y: cardCenterY - e.clientY,
      }
    } else {
      dragOffsetRef.current = { x: 0, y: 0 }
    }

    // If the card has a zone and stackIndex is provided, update the zone with cardIndex
    const cardWithZone = {
      ...card,
      zone: stackIndex !== undefined ? { ...zone, cardIndex: stackIndex } : zone,
    }
    setDraggedCard(cardWithZone)
    e.dataTransfer.effectAllowed = "move"

    // Set drag state
    setIsDragging(true)
    setDragPosition({ x: e.clientX, y: e.clientY })

    // Set high z-index for the dragging element
    const element = e.currentTarget as HTMLElement
    if (element !== null) {
      element.style.zIndex = "9999"
      element.style.position = "relative"
    }
  }

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedCard(null)
    setIsDragging(false)
    setDragPosition(null)

    // Reset z-index
    const element = e.currentTarget as HTMLElement
    if (element !== null) {
      element.style.zIndex = ""
      element.style.position = ""
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    // Clear timers
    if (longPressTimerRef.current != null) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }

    // Reset touch action on element
    if (cardRef.current) {
      cardRef.current.style.touchAction = ""
    }

    if (isTouching && e.changedTouches.length > 0) {
      const touch = e.changedTouches[0]

      // If drag image is suppressed and user hasn't moved, don't perform drop
      if (suppressDragImageRef.current && touchStartPosRef.current) {
        const deltaX = Math.abs(touch.clientX - touchStartPosRef.current.x)
        const deltaY = Math.abs(touch.clientY - touchStartPosRef.current.y)
        if (deltaX <= TOUCH_MOVE_THRESHOLD && deltaY <= TOUCH_MOVE_THRESHOLD) {
          // User hasn't moved, keep context menu open
          setIsTouching(false)
          setIsDragging(false)
          setDraggedCard(null)
          touchStartPosRef.current = null
          dragOffsetRef.current = null
          suppressDragImageRef.current = false
          return
        }
      }

      // Temporarily hide the dragging card to get the correct element
      setDragPosition(null)

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
              targetElement.classList.contains("grave-zone") ||
              targetElement.classList.contains("zone-expand-modal-drop") ||
              targetElement.getAttribute("data-droppable") === "true"
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
        setIsDragging(false)
        setDragPosition(null)
        // Don't clear dragged card here - it's handled above
      }, 0)
    } else {
      setIsTouching(false)
      setIsDragging(false)
      setDraggedCard(null)
      setDragPosition(null)
    }

    touchStartPosRef.current = null
    dragOffsetRef.current = null
    suppressDragImageRef.current = false

    // Restore body scrolling
    document.body.style.overflow = ""
    document.body.style.touchAction = ""
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      const touch = e.touches[0]

      // Check if finger moved
      if (touchStartPosRef.current != null) {
        const deltaX = Math.abs(touch.clientX - touchStartPosRef.current.x)
        const deltaY = Math.abs(touch.clientY - touchStartPosRef.current.y)

        // Cancel long press if moved more than threshold
        if (deltaX > TOUCH_MOVE_THRESHOLD || deltaY > TOUCH_MOVE_THRESHOLD) {
          if (longPressTimerRef.current != null) {
            clearTimeout(longPressTimerRef.current)
            longPressTimerRef.current = null
          }
        }
      }

      // If drag image is suppressed and user started moving, close menu and resume dragging
      if (suppressDragImageRef.current && touchStartPosRef.current != null) {
        const deltaX = Math.abs(touch.clientX - touchStartPosRef.current.x)
        const deltaY = Math.abs(touch.clientY - touchStartPosRef.current.y)
        if (deltaX > TOUCH_MOVE_THRESHOLD || deltaY > TOUCH_MOVE_THRESHOLD) {
          suppressDragImageRef.current = false
          if (onContextMenuClose) {
            onContextMenuClose()
          }
        }
      }

      // Update touch position if not suppressed
      if (!suppressDragImageRef.current) {
        // Use clientX/clientY (viewport coordinates)
        setDragPosition({ x: touch.clientX, y: touch.clientY })
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

  // Handle double click for PC only
  const handleDoubleClick = (e: React.MouseEvent) => {
    // Disable during replay
    if (isReplayPlaying) {
      return
    }

    const position: Position = {
      zone: stackIndex !== undefined ? { ...zone, cardIndex: stackIndex } : zone,
      cardId: card.id,
    }

    if (e.shiftKey) {
      // Shift + double click = target selection
      targetSelect(position, cardRef.current || undefined)
    } else {
      // Double click = activate effect
      activateEffect(position, cardRef.current || undefined)
    }
  }

  // Handle click for double click detection
  const handleClick = (e: React.MouseEvent) => {
    // Disable during replay
    if (isReplayPlaying) {
      return
    }

    const currentTime = Date.now()
    const timeSinceLastClick = currentTime - lastClickTimeRef.current

    if (timeSinceLastClick < DOUBLE_CLICK_THRESHOLD_MS) {
      // This is a double click
      handleDoubleClick(e)
    }

    lastClickTimeRef.current = currentTime
  }

  return (
    <>
      <div
        ref={cardRef}
        className={cn("duration-200", className)}
        draggable={!isReplayPlaying}
        data-card-id={card.id}
        onDragStart={handleDragStart}
        onDrag={(e) => {
          if (e.clientX !== 0 && e.clientY !== 0) {
            setDragPosition({ x: e.clientX, y: e.clientY })
          }
        }}
        onDragEnd={handleDragEnd}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleClick}
        onContextMenu={(e) => {
          e.preventDefault()
          if (onContextMenu) {
            onContextMenu(e, card, zone)
          }
        }}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        style={{
          cursor: isReplayPlaying ? "not-allowed" : "grab",
          // activate アニメーション中は薄くする程度に留め、完全に隠さない
          opacity: activateAnimating ? 0.25 : isTouching || isDragging ? 0.5 : 1,
          visibility: isAnimating || rotateAnimating ? "hidden" : "visible",
          // transform だけスムーズにする
          transition: "transform 200ms",
          WebkitTouchCallout: "none",
          WebkitUserSelect: "none",
          position: "relative",
          transform:
            (isHovered || isTouching) &&
            !isReplayPlaying &&
            !highlightAnimating &&
            !targetAnimating &&
            !activateAnimating &&
            !rotateAnimating
              ? hoverDirection === "left"
                ? "translateX(-8px)"
                : hoverDirection === "right"
                  ? "translateX(8px)"
                  : "translateY(-8px)"
              : "translate(0)",
          zIndex: (isHovered || isTouching) && !isReplayPlaying ? 1000 : 1,
          ...style,
        }}
      >
        <div className="relative w-full h-full">
          <img
            src={card.name === "token" ? TOKEN_IMAGE_DATA_URL : card.imageUrl}
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
              // Intentionally not setting WebkitUserDrag to allow PC drag
            }}
            onContextMenu={(e) => e.preventDefault()}
          />
          {card.faceDown === true && (
            <div
              className="absolute inset-0 rounded pointer-events-none bg-black/40"
              style={{
                transform: `rotate(${card.rotation}deg)`,
              }}
            />
          )}
          {card.highlighted === true && !highlightAnimating && (
            <div
              className="absolute inset-0 rounded pointer-events-none"
              style={{
                transform: `rotate(${card.rotation}deg)`,
                border: "3px solid #ef4444",
                boxShadow: "inset 0 0 10px rgba(239, 68, 68, 0.5), 0 0 15px rgba(239, 68, 68, 0.6)",
              }}
            />
          )}
          {card.counter !== undefined && card.counter !== null && card.counter > 0 && (
            <div className="absolute top-1 right-1 bg-white text-blue-500 text-[8px] sm:text-[10px] min-w-[16px] h-[16px] sm:min-w-[20px] sm:h-[20px] rounded-full flex items-center justify-center font-bold pointer-events-none z-50 border-2 border-blue-500">
              {card.counter}
            </div>
          )}
        </div>
      </div>
      {isDragging &&
        dragPosition &&
        dragOffsetRef.current &&
        createPortal(
          (() => {
            // Use responsive size for drag image based on screen size
            let baseHeight: number
            if (isMediumScreen) {
              baseHeight = 96
            } else if (isSmallScreen) {
              baseHeight = 80
            } else {
              baseHeight = 56
            }
            const baseWidth = Math.round((baseHeight * 59) / 86) // Maintain aspect ratio

            // Adjust container size based on rotation
            const isRotated = card.rotation === -90 || card.rotation === 90
            const dragImageWidth = isRotated ? baseHeight : baseWidth
            const dragImageHeight = isRotated ? baseWidth : baseHeight

            const displayX = isTouching
              ? dragPosition.x + dragOffsetRef.current.x - dragImageWidth / 2
              : dragPosition.x - dragImageWidth / 2
            const displayY = isTouching
              ? dragPosition.y + dragOffsetRef.current.y - dragImageHeight / 2
              : dragPosition.y - dragImageHeight / 2

            return (
              <div
                className="fixed pointer-events-none"
                style={{
                  left: `${displayX}px`,
                  top: `${displayY}px`,
                  width: `${dragImageWidth}px`,
                  height: `${dragImageHeight}px`,
                  pointerEvents: "none",
                  zIndex: 99999,
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
                    src={card.name === "token" ? TOKEN_IMAGE_DATA_URL : card.imageUrl}
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
                  {card.faceDown === true && (
                    <div className="absolute inset-0 rounded pointer-events-none bg-black/40" />
                  )}
                </div>
              </div>
            )
          })(),
          document.body,
        )}
    </>
  )
}
