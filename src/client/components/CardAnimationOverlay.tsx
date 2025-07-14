import { useEffect, useState } from "react"
import { useAtom } from "jotai"
import { cardAnimationsAtom, type CardAnimation } from "@/client/atoms/boardAtoms"
import { cn } from "@/client/lib/utils"
import { EffectActivationAnimation } from "./EffectActivationAnimation"
import { TargetSelectionAnimation } from "./TargetSelectionAnimation"
import { HighlightAnimation } from "./HighlightAnimation"

interface AnimatedCardProps {
  animation: CardAnimation
  onComplete: () => void
}

function AnimatedCard({ animation, onComplete }: AnimatedCardProps) {
  const [position, setPosition] = useState(animation.fromPosition!)

  useEffect(() => {
    if (animation.type !== "move") {
      onComplete()
      return
    }

    // Start animation after a small delay to ensure initial position is rendered
    const timer = setTimeout(() => {
      if (animation.toPosition) {
        setPosition(animation.toPosition)
      }
    }, 10)

    // Call onComplete when animation finishes
    const completeTimer = setTimeout(() => {
      onComplete()
    }, animation.duration ?? 300)

    return () => {
      clearTimeout(timer)
      clearTimeout(completeTimer)
    }
  }, [animation, onComplete])

  if (animation.type !== "move") return null

  return (
    <div
      className="fixed pointer-events-none z-[10000]"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transition: `all ${animation.duration ?? 300}ms ease-in-out`,
        width: window.innerWidth >= 768 ? "66px" : window.innerWidth >= 640 ? "55px" : "40px",
        height: window.innerWidth >= 768 ? "96px" : window.innerWidth >= 640 ? "80px" : "56px",
      }}
    >
      <img
        src={animation.cardImageUrl}
        alt="Animating card"
        className={cn(
          "w-full h-full object-cover rounded shadow-xl",
          "opacity-70", // Semi-transparent during animation
        )}
      />
    </div>
  )
}

export function CardAnimationOverlay() {
  const [animations, setAnimations] = useAtom(cardAnimationsAtom)

  const handleAnimationComplete = (animationId: string) => {
    setAnimations((prev) => prev.filter((anim) => anim.id !== animationId))
  }

  return (
    <>
      {animations.map((animation) => {
        if (animation.type === "activate" && animation.position) {
          return (
            <EffectActivationAnimation
              key={animation.id}
              position={animation.position}
              cardRect={animation.cardRect}
              cardRotation={animation.cardRotation}
              onComplete={() => handleAnimationComplete(animation.id)}
            />
          )
        } else if (animation.type === "target" && animation.cardRect) {
          return (
            <TargetSelectionAnimation
              key={animation.id}
              cardRect={animation.cardRect}
              cardRotation={animation.cardRotation}
              onComplete={() => handleAnimationComplete(animation.id)}
            />
          )
        } else if (animation.type === "highlight" && animation.position) {
          // Use HighlightAnimation for highlight effect (red border + scale)
          const cardElement = document.querySelector(`[data-card-id="${animation.cardId}"]`)
          if (cardElement) {
            const rect = cardElement.getBoundingClientRect()
            return (
              <HighlightAnimation
                key={animation.id}
                cardRect={{
                  x: rect.x,
                  y: rect.y,
                  width: rect.width,
                  height: rect.height,
                }}
                cardRotation={0}
                onComplete={() => handleAnimationComplete(animation.id)}
              />
            )
          }
          // Fallback to onComplete if element not found
          setTimeout(() => handleAnimationComplete(animation.id), 100)
          return null
        } else {
          return (
            <AnimatedCard
              key={animation.id}
              animation={animation}
              onComplete={() => handleAnimationComplete(animation.id)}
            />
          )
        }
      })}
    </>
  )
}
