import { useState, useRef, useCallback } from "react"
import { useSetAtom } from "jotai"
import { activateEffectAtom, targetSelectAtom } from "@/client/atoms/operations/effects"
import { flipCardAtom } from "@/client/atoms/operations/rotation"
import { DOUBLE_CLICK_THRESHOLD_MS } from "@/client/constants/drag"
import { ANIM } from "@/client/constants/animation"
import type { Card as GameCard, ZoneId, Position } from "@/shared/types/game"

type UseCardInteractionProps = {
  card: GameCard
  zone: ZoneId
  stackIndex?: number
  isReplayPlaying: boolean
  isDisabled: boolean
  cardRef: React.RefObject<HTMLDivElement | null>
  onContextMenu?: (e: React.MouseEvent | React.TouchEvent, card: GameCard, zone: ZoneId) => void
}

export function useCardInteraction({
  card,
  zone,
  stackIndex,
  isReplayPlaying,
  isDisabled,
  cardRef,
  onContextMenu,
}: UseCardInteractionProps) {
  const activateEffect = useSetAtom(activateEffectAtom)
  const targetSelect = useSetAtom(targetSelectAtom)
  const flipCard = useSetAtom(flipCardAtom)
  const [isHovered, setIsHovered] = useState(false)
  const lastClickTimeRef = useRef<number>(0)

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
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
        // Check if card is face down
        if (card.faceDown === true) {
          // First flip the card face up
          flipCard(position)
          // Then activate effect after a short delay for the flip animation
          setTimeout(() => {
            activateEffect(position, cardRef.current || undefined)
          }, ANIM.FLIP.DURATION)
        } else {
          // Card is already face up, just activate effect
          activateEffect(position, cardRef.current || undefined)
        }
      }
    },
    [card, zone, stackIndex, isReplayPlaying, activateEffect, targetSelect, flipCard, cardRef]
  )

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      // Disable during replay or when disabled
      if (isReplayPlaying || isDisabled) {
        return
      }

      const currentTime = Date.now()
      const timeSinceLastClick = currentTime - lastClickTimeRef.current

      if (timeSinceLastClick < DOUBLE_CLICK_THRESHOLD_MS) {
        // This is a double click
        handleDoubleClick(e)
      }

      lastClickTimeRef.current = currentTime
    },
    [isReplayPlaying, isDisabled, handleDoubleClick]
  )

  const handleContextMenuClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      if (onContextMenu && !isDisabled) {
        onContextMenu(e, card, zone)
      }
    },
    [onContextMenu, isDisabled, card, zone]
  )

  const handleMouseEnter = useCallback(() => setIsHovered(true), [])
  const handleMouseLeave = useCallback(() => setIsHovered(false), [])

  return {
    isHovered,
    handleClick,
    handleContextMenu: handleContextMenuClick,
    handleMouseEnter,
    handleMouseLeave,
  }
}
