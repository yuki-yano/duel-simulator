import { useState, useRef, useCallback } from "react"
import { useSetAtom } from "jotai"
import { draggedCardAtom } from "@/client/atoms/boardAtoms"
import { EMPTY_DRAG_IMAGE } from "@/client/constants/drag"
import { calculateDragOffset } from "@/client/utils/dragHelpers"
import type { Card as GameCard, ZoneId } from "@/shared/types/game"

type UseDragAndDropProps = {
  card: GameCard
  zone: ZoneId
  stackIndex?: number
  isReplayPlaying: boolean
  isDisabled: boolean
  cardRef: React.RefObject<HTMLDivElement | null>
}

export function useDragAndDrop({
  card,
  zone,
  stackIndex,
  isReplayPlaying,
  isDisabled,
  cardRef,
}: UseDragAndDropProps) {
  const setDraggedCard = useSetAtom(draggedCardAtom)
  const [isDragging, setIsDragging] = useState(false)
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null)
  const dragOffsetRef = useRef<{ x: number; y: number } | null>(null)

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      // Disable dragging during replay or when disabled
      if (isReplayPlaying || isDisabled) {
        e.preventDefault()
        return
      }

      // Hide default drag image
      e.dataTransfer.setDragImage(EMPTY_DRAG_IMAGE, 0, 0)

      // Calculate offset from mouse point to card center
      dragOffsetRef.current = calculateDragOffset(cardRef.current, e.clientX, e.clientY)

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
    },
    [card, zone, stackIndex, isReplayPlaying, isDisabled, setDraggedCard, cardRef]
  )

  const handleDrag = useCallback((e: React.DragEvent) => {
    if (e.clientX !== 0 && e.clientY !== 0) {
      setDragPosition({ x: e.clientX, y: e.clientY })
    }
  }, [])

  const handleDragEnd = useCallback(
    (e: React.DragEvent) => {
      setDraggedCard(null)
      setIsDragging(false)
      setDragPosition(null)

      // Reset z-index
      const element = e.currentTarget as HTMLElement
      if (element !== null) {
        element.style.zIndex = ""
        element.style.position = ""
      }
    },
    [setDraggedCard]
  )

  return {
    isDragging,
    dragPosition,
    dragOffset: dragOffsetRef.current,
    handleDragStart,
    handleDrag,
    handleDragEnd,
  }
}
