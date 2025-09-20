import { useRef, useEffect } from "react"
import { createPortal } from "react-dom"
import { useSetAtom, useAtomValue } from "jotai"
import { replayPlayingAtom, updateCardRefAtom } from "@/client/atoms/boardAtoms"
import type { Card as GameCard, ZoneId } from "@/shared/types/game"
import { cn } from "@/client/lib/utils"
import { CardVisual } from "@/client/components/CardVisual"
import { DragPreview } from "@/client/components/DragPreview"
import { useCardAnimation } from "@/client/hooks/useCardAnimation"
import { useDragAndDrop } from "@/client/hooks/useDragAndDrop"
import { useTouchDrag } from "@/client/hooks/useTouchDrag"
import { useCardInteraction } from "@/client/hooks/useCardInteraction"
import { DEFAULT_ANIMATION_DURATION } from "@/client/constants/animation"

type DraggableCardProps = {
  card: GameCard
  zone: ZoneId
  className?: string
  hoverDirection?: "up" | "left" | "right"
  style?: React.CSSProperties
  stackIndex?: number
  onContextMenu?: (e: React.MouseEvent | React.TouchEvent, card: GameCard, zone: ZoneId) => void
  onContextMenuClose?: () => void
  isDisabled?: boolean
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
  isDisabled = false,
}: DraggableCardProps) {
  const isReplayPlaying = useAtomValue(replayPlayingAtom)
  const updateCardRef = useSetAtom(updateCardRefAtom)
  const cardRef = useRef<HTMLDivElement>(null)

  // Animation states
  const {
    isAnimating,
    highlightAnimating,
    targetAnimating,
    activateAnimating,
    rotateAnimating,
    flipAnimating,
  } = useCardAnimation(card.id)

  // PC drag handlers
  const pcDrag = useDragAndDrop({
    card,
    zone,
    stackIndex,
    isReplayPlaying,
    isDisabled,
    cardRef,
  })

  // Touch drag handlers
  const touchDrag = useTouchDrag({
    card,
    zone,
    stackIndex,
    isReplayPlaying,
    isDisabled,
    cardRef,
    onContextMenu,
    onContextMenuClose,
  })

  // Interaction handlers (click, hover, context menu)
  const interaction = useCardInteraction({
    card,
    zone,
    stackIndex,
    isReplayPlaying,
    isDisabled,
    cardRef,
    onContextMenu,
  })

  // Unified drag state
  const isDragging = pcDrag.isDragging || touchDrag.isDragging
  const dragPosition = pcDrag.dragPosition || touchDrag.dragPosition
  const dragOffset = pcDrag.dragOffset || touchDrag.dragOffset
  const isTouching = touchDrag.isTouching

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

  return (
    <>
      <div
        ref={cardRef}
        className={cn(className)}
        draggable={!isReplayPlaying && !isDisabled}
        data-card-id={card.id}
        onDragStart={pcDrag.handleDragStart}
        onDrag={pcDrag.handleDrag}
        onDragEnd={pcDrag.handleDragEnd}
        onMouseEnter={interaction.handleMouseEnter}
        onMouseLeave={interaction.handleMouseLeave}
        onClick={interaction.handleClick}
        onContextMenu={interaction.handleContextMenu}
        onTouchEnd={touchDrag.handleTouchEnd}
        onTouchMove={touchDrag.handleTouchMove}
        style={{
          cursor: isReplayPlaying || isDisabled ? "not-allowed" : "grab",
          // activate アニメーション中は薄くする程度に留め、完全に隠さない
          opacity: activateAnimating ? 0.25 : isTouching || isDragging ? 0.5 : 1,
          visibility: isAnimating || rotateAnimating || flipAnimating ? "hidden" : "visible",
          // transform だけスムーズにする
          transition: `transform ${DEFAULT_ANIMATION_DURATION.CARD_TRANSITION}ms`,
          WebkitTouchCallout: "none",
          WebkitUserSelect: "none",
          position: "relative",
          transform:
            (interaction.isHovered || isTouching) &&
            !isReplayPlaying &&
            !highlightAnimating &&
            !targetAnimating &&
            !activateAnimating &&
            !rotateAnimating &&
            !flipAnimating
              ? hoverDirection === "left"
                ? "translateX(-8px)"
                : hoverDirection === "right"
                  ? "translateX(8px)"
                  : "translateY(-8px)"
              : "translate(0)",
          zIndex: (interaction.isHovered || isTouching) && !isReplayPlaying ? 1000 : 1,
          ...style,
        }}
      >
        <CardVisual
          card={card}
          isHovered={interaction.isHovered}
          isTouching={isTouching}
          highlightAnimating={highlightAnimating}
        />
      </div>
      {isDragging && dragPosition && dragOffset && (
        createPortal(
          <DragPreview
            card={card}
            position={dragPosition}
            offset={dragOffset}
            isTouching={isTouching}
          />,
          document.body,
        )
      )}
    </>
  )
}
