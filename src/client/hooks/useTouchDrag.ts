import { useState, useRef, useCallback, useEffect } from "react"
import { useSetAtom } from "jotai"
import { draggedCardAtom } from "@/client/atoms/boardAtoms"
import { LONG_PRESS_DURATION_MS, TOUCH_MOVE_THRESHOLD } from "@/client/constants/drag"
import {
  calculateDragOffset,
  findDroppableZone,
  createDragEvent,
  lockBodyScroll,
  unlockBodyScroll,
} from "@/client/utils/dragHelpers"
import type { Card as GameCard, ZoneId } from "@/shared/types/game"

type UseTouchDragProps = {
  card: GameCard
  zone: ZoneId
  stackIndex?: number
  isReplayPlaying: boolean
  isDisabled: boolean
  cardRef: React.RefObject<HTMLDivElement | null>
  onContextMenu?: (e: React.MouseEvent | React.TouchEvent, card: GameCard, zone: ZoneId) => void
  onContextMenuClose?: () => void
}

export function useTouchDrag({
  card,
  zone,
  stackIndex,
  isReplayPlaying,
  isDisabled,
  cardRef,
  onContextMenu,
  onContextMenuClose,
}: UseTouchDragProps) {
  const setDraggedCard = useSetAtom(draggedCardAtom)
  const [isTouching, setIsTouching] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null)

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null)
  const dragOffsetRef = useRef<{ x: number; y: number } | null>(null)
  const suppressDragImageRef = useRef<boolean>(false)

  // Touch event handlers
  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      // Only handle touch events, not mouse events
      if (e.type !== "touchstart") return

      // Disable touch dragging during replay or when disabled
      if (isReplayPlaying || isDisabled) {
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
        dragOffsetRef.current = calculateDragOffset(cardRef.current, touch.clientX, touch.clientY)

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
        lockBodyScroll()

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
              currentTarget: cardRef.current,
              target: e.target,
            } as unknown as React.TouchEvent
            // Trigger custom context menu
            onContextMenu(syntheticEvent, card, zone)
          }
        }, LONG_PRESS_DURATION_MS)
      }
    },
    [isReplayPlaying, isDisabled, card, zone, stackIndex, onContextMenu, setDraggedCard, cardRef]
  )

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
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
          const dragOverEvent = createDragEvent("dragover", touch.clientX, touch.clientY)
          element.dispatchEvent(dragOverEvent)
        }
      }
    },
    [onContextMenuClose]
  )

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
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
            const targetElement = findDroppableZone(element)

            if (targetElement) {
              // Create and dispatch dragenter, dragover, and drop events
              const dragOverEvent = createDragEvent("dragover", touch.clientX, touch.clientY)
              targetElement.dispatchEvent(dragOverEvent)

              // Small delay to ensure dragOver is processed before drop
              setTimeout(() => {
                const dropEvent = createDragEvent("drop", touch.clientX, touch.clientY)
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
      unlockBodyScroll()
    },
    [isTouching, setDraggedCard, cardRef]
  )

  // Setup touch listeners
  useEffect(() => {
    const element = cardRef.current
    if (!element) return

    // Add non-passive touch listener to prevent scrolling on card touch
    element.addEventListener("touchstart", handleTouchStart, { passive: false })

    return () => {
      if (longPressTimerRef.current != null) {
        clearTimeout(longPressTimerRef.current)
      }
      element.removeEventListener("touchstart", handleTouchStart)
    }
  }, [handleTouchStart, cardRef])

  return {
    isTouching,
    isDragging,
    dragPosition,
    dragOffset: dragOffsetRef.current,
    handleTouchMove,
    handleTouchEnd,
  }
}
