import { useEffect, useState } from "react"
import { useAtom } from "jotai"
import { cardAnimationsAtom, type CardAnimation } from "@/client/atoms/boardAtoms"
import { cn } from "@/client/lib/utils"
import { EffectActivationAnimation } from "./EffectActivationAnimation"
import { TargetSelectionAnimation } from "./TargetSelectionAnimation"
import { HighlightAnimation } from "./HighlightAnimation"
import { RotateAnimation } from "./RotateAnimation"
import { NegateAnimation } from "./NegateAnimation"
import { FlipAnimation } from "./FlipAnimation"
import { useScreenSize } from "@client/hooks/useScreenSize"

type AnimatedCardProps = {
  animation: CardAnimation
  onComplete: () => void
}

function AnimatedCard({ animation, onComplete }: AnimatedCardProps) {
  const [position, setPosition] = useState(animation.fromPosition!)
  const [rotation, setRotation] = useState(animation.fromRotation ?? 0)
  const [rotateY, setRotateY] = useState(0)
  const [showFaceDown, setShowFaceDown] = useState(animation.fromFaceDown ?? false)
  const { isMediumScreen, isSmallScreen } = useScreenSize()

  // Check if this move involves a flip
  // Only flip if both values are explicitly defined and different
  const isFlipping =
    animation.fromFaceDown !== undefined &&
    animation.toFaceDown !== undefined &&
    animation.fromFaceDown !== animation.toFaceDown

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
      // If flipping, start the Y rotation
      if (isFlipping) {
        setRotateY(90)
      }
    }, 10)

    // If flipping, switch face state at halfway point
    let flipTimer: NodeJS.Timeout | undefined
    if (isFlipping) {
      flipTimer = setTimeout(
        () => {
          setShowFaceDown(animation.toFaceDown ?? false)
          setRotateY(0) // Complete the flip
        },
        (animation.duration ?? 300) / 2,
      )
    }

    // Call onComplete when animation finishes
    const completeTimer = setTimeout(() => {
      onComplete()
    }, animation.duration ?? 300)

    return () => {
      clearTimeout(timer)
      if (flipTimer) clearTimeout(flipTimer)
      clearTimeout(completeTimer)
    }
  }, [animation, onComplete, isFlipping])

  if (animation.type !== "move") return null

  const cardWidth = isMediumScreen ? 66 : isSmallScreen ? 55 : 40
  const cardHeight = isMediumScreen ? 96 : isSmallScreen ? 80 : 56

  return (
    <div
      className="fixed pointer-events-none z-[10000]"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transition: `all ${animation.duration ?? 300}ms ease-in-out`,
        width: `${cardWidth}px`,
        height: `${cardHeight}px`,
        perspective: isFlipping ? "1000px" : undefined,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          transformStyle: isFlipping ? "preserve-3d" : undefined,
          transform: `rotate(${rotation}deg) ${isFlipping ? `rotateY(${rotateY}deg)` : ""}`,
          transition: isFlipping
            ? `transform ${animation.duration ?? 300}ms ease-in-out, transform ${(animation.duration ?? 300) / 2}ms ease-in-out`
            : `transform ${animation.duration ?? 300}ms ease-in-out`,
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
        {showFaceDown && <div className="absolute inset-0 rounded bg-black/40" />}
      </div>
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
        } else if (animation.type === "flip" && animation.cardRect) {
          return (
            <FlipAnimation
              key={animation.id}
              cardRect={animation.cardRect}
              cardImageUrl={animation.cardImageUrl}
              fromFaceDown={animation.fromFaceDown ?? false}
              toFaceDown={animation.toFaceDown ?? false}
              cardRotation={animation.cardRotation ?? 0}
              duration={animation.duration}
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
