import { useEffect, useState } from "react"
import { useAtom } from "jotai"
import { cardAnimationsAtom, type CardAnimation } from "@/client/atoms/boardAtoms"
import { cn } from "@/client/lib/utils"
import { EffectActivationAnimation } from "./EffectActivationAnimation"
import { TargetSelectionAnimation } from "./TargetSelectionAnimation"
import { HighlightAnimation } from "./HighlightAnimation"
import { RotateAnimation } from "./RotateAnimation"
import { NegateAnimation } from "./NegateAnimation"
import { useScreenSize } from "@client/hooks/useScreenSize"

type AnimatedCardProps = {
  animation: CardAnimation
  onComplete: () => void
}

function AnimatedCard({ animation, onComplete }: AnimatedCardProps) {
  const [position, setPosition] = useState(animation.fromPosition!)
  const [rotation, setRotation] = useState(animation.fromRotation ?? 0)
  const { isMediumScreen, isSmallScreen } = useScreenSize()

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
      if (animation.toRotation !== undefined) {
        setRotation(animation.toRotation)
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
        width: isMediumScreen ? "66px" : isSmallScreen ? "55px" : "40px",
        height: isMediumScreen ? "96px" : isSmallScreen ? "80px" : "56px",
        transform: `rotate(${rotation}deg)`,
        transformOrigin: "center",
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
              cardImageUrl={animation.cardImageUrl}
              onComplete={() => handleAnimationComplete(animation.id)}
            />
          )
        } else if (animation.type === "target" && animation.cardRect) {
          return (
            <TargetSelectionAnimation
              key={animation.id}
              cardRect={animation.cardRect}
              cardRotation={animation.cardRotation}
              cardImageUrl={animation.cardImageUrl}
              onComplete={() => handleAnimationComplete(animation.id)}
            />
          )
        } else if (animation.type === "highlight" && animation.cardRect) {
          return (
            <HighlightAnimation
              key={animation.id}
              cardRect={animation.cardRect}
              cardRotation={animation.cardRotation}
              cardImageUrl={animation.cardImageUrl}
              onComplete={() => handleAnimationComplete(animation.id)}
            />
          )
        } else if (animation.type === "rotate" && animation.cardRect) {
          return (
            <RotateAnimation
              key={animation.id}
              cardRect={animation.cardRect}
              fromRotation={animation.fromRotation ?? 0}
              toRotation={animation.toRotation ?? 0}
              cardImageUrl={animation.cardImageUrl}
              duration={animation.duration}
              onComplete={() => handleAnimationComplete(animation.id)}
            />
          )
        } else if (animation.type === "negate" && animation.position) {
          return (
            <NegateAnimation
              key={animation.id}
              position={animation.position}
              cardRect={animation.cardRect}
              cardRotation={animation.cardRotation}
              cardImageUrl={animation.cardImageUrl}
              onComplete={() => handleAnimationComplete(animation.id)}
            />
          )
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
