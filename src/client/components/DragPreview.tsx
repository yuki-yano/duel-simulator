import { TOKEN_IMAGE_DATA_URL } from "@/client/constants/tokenImage"
import { Z_INDEX } from "@/client/constants/zIndex"
import { CARD_SIZE, calculateCardWidth } from "@/client/constants/card"
import { useScreenSize } from "@/client/hooks/useScreenSize"
import type { Card as GameCard } from "@/shared/types/game"

type DragPreviewProps = {
  card: GameCard
  position: { x: number; y: number }
  offset: { x: number; y: number }
  isTouching: boolean
}

export function DragPreview({ card, position, offset, isTouching }: DragPreviewProps) {
  const { isMediumScreen, isSmallScreen } = useScreenSize()

  // Use responsive size for drag image based on screen size
  const baseHeight = isMediumScreen
    ? CARD_SIZE.MEDIUM.HEIGHT
    : isSmallScreen
      ? CARD_SIZE.SMALL.HEIGHT
      : CARD_SIZE.DEFAULT.HEIGHT
  const baseWidth = calculateCardWidth(baseHeight) // Maintain aspect ratio

  // Adjust container size based on rotation
  const isRotated = card.rotation === -90 || card.rotation === 90
  const dragImageWidth = isRotated ? baseHeight : baseWidth
  const dragImageHeight = isRotated ? baseWidth : baseHeight

  const displayX = isTouching
    ? position.x + offset.x - dragImageWidth / 2
    : position.x - dragImageWidth / 2
  const displayY = isTouching
    ? position.y + offset.y - dragImageHeight / 2
    : position.y - dragImageHeight / 2

  return (
    <div
      className="fixed pointer-events-none"
      style={{
        left: `${displayX}px`,
        top: `${displayY}px`,
        width: `${dragImageWidth}px`,
        height: `${dragImageHeight}px`,
        pointerEvents: "none",
        zIndex: Z_INDEX.DRAGGABLE_CARD_PREVIEW,
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
}
