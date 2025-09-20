import { cn } from "@/client/lib/utils"
import { TOKEN_IMAGE_DATA_URL } from "@/client/constants/tokenImage"
import type { Card as GameCard } from "@/shared/types/game"

type CardVisualProps = {
  card: GameCard
  isHovered: boolean
  isTouching: boolean
  highlightAnimating?: boolean
}

export function CardVisual({ card, isHovered, isTouching, highlightAnimating = false }: CardVisualProps) {
  return (
    <div className="relative w-full h-full">
      <img
        src={card.name === "token" ? TOKEN_IMAGE_DATA_URL : card.imageUrl}
        alt="Card"
        className={cn(
          "w-full h-full object-cover rounded transition-shadow duration-200",
          (isHovered || isTouching) && "shadow-xl"
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
  )
}
