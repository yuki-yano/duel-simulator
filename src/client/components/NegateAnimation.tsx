import { useEffect, useRef, useState } from "react"
import { cn } from "@/client/lib/utils"
import { ANIM } from "@/client/constants/animation"
import type { Position } from "@/shared/types/game"

type NegateAnimationProps = {
  position: Position
  cardRect?: { x: number; y: number; width: number; height: number }
  cardRotation?: number
  cardImageUrl?: string
  onComplete: () => void
}

export function NegateAnimation({
  position,
  cardRect,
  cardRotation = 0,
  cardImageUrl,
  onComplete,
}: NegateAnimationProps) {
  const [animationState, setAnimationState] = useState<"initial" | "showing" | "fading">("initial")
  const onCompleteCalled = useRef(false)

  // Calculate effect position on mount
  const effectPosition = useRef<{ x: number; y: number; width: number; height: number } | null>(null)
  if (effectPosition.current == null) {
    if (cardRect) {
      effectPosition.current = cardRect
    } else {
      // fallback query same as before but simplified to card id
      const el = position.cardId ? document.querySelector(`[data-card-id="${position.cardId}"]`) : null
      if (el) {
        const rect = el.getBoundingClientRect()
        effectPosition.current = { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
      }
    }
  }

  useEffect(() => {
    const D = ANIM.EFFECT.ANIMATION

    const startId = requestAnimationFrame(() => setAnimationState("showing"))

    // Start fading at halfway point
    const fadeTimer = setTimeout(() => setAnimationState("fading"), D / 2)

    // Call onComplete after animation completes
    const completeTimer = setTimeout(() => {
      if (!onCompleteCalled.current) {
        onCompleteCalled.current = true
        onComplete()
      }
    }, D)

    return () => {
      cancelAnimationFrame(startId)
      clearTimeout(fadeTimer)
      clearTimeout(completeTimer)
    }
  }, [onComplete])

  if (!effectPosition.current) return null

  const pos = effectPosition.current
  const opacity = animationState === "showing" ? 1 : animationState === "fading" ? 0 : 0

  return (
    <div
      className="fixed pointer-events-none"
      style={{
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        width: `${pos.width}px`,
        height: `${pos.height}px`,
        transform: `rotate(${cardRotation}deg)`,
        transformOrigin: "center",
        zIndex: 9998,
      }}
    >
      {/* Card image (darkened) */}
      <img
        src={cardImageUrl}
        alt="Negated card"
        className="absolute inset-0 w-full h-full object-cover rounded brightness-50"
        draggable={false}
      />

      {/* Red X mark overlay */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          opacity,
          transition: `opacity ${ANIM.EFFECT.ANIMATION / 2}ms ease-out`,
        }}
      >
        {/* X mark made with CSS */}
        <div className="relative w-full h-full">
          {/* First diagonal line */}
          <div
            className={cn(
              "absolute bg-red-600 rounded-full shadow-lg",
              animationState === "showing" && "animate-[slideInDiagonal1_0.3s_ease-out]",
            )}
            style={{
              width: "120%",
              height: "8px",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%) rotate(45deg)",
              boxShadow: "0 0 20px rgba(220, 38, 38, 0.8), 0 0 40px rgba(220, 38, 38, 0.4)",
            }}
          />
          {/* Second diagonal line */}
          <div
            className={cn(
              "absolute bg-red-600 rounded-full shadow-lg",
              animationState === "showing" && "animate-[slideInDiagonal2_0.3s_ease-out]",
            )}
            style={{
              width: "120%",
              height: "8px",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%) rotate(-45deg)",
              boxShadow: "0 0 20px rgba(220, 38, 38, 0.8), 0 0 40px rgba(220, 38, 38, 0.4)",
            }}
          />

          {/* Red glow effect */}
          <div
            className={cn(
              "absolute inset-0 rounded-lg",
              animationState === "showing" && "animate-[redPulse_0.5s_ease-out]",
            )}
            style={{
              background: "radial-gradient(circle at center, rgba(220, 38, 38, 0.3) 0%, transparent 70%)",
              filter: "blur(10px)",
            }}
          />

          {/* Red flash effect */}
          <div
            className={cn(
              "absolute inset-0 rounded-lg bg-red-600/20",
              animationState === "showing" && "animate-[redFlash_0.3s_ease-out]",
            )}
          />

          {/* Red particles */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "absolute w-1 h-1 bg-red-400 rounded-full",
                animationState === "showing" && "animate-[redSparkle_0.6s_ease-out]",
              )}
              style={{
                left: `${50 + Math.cos((i * Math.PI * 2) / 8) * 40}%`,
                top: `${50 + Math.sin((i * Math.PI * 2) / 8) * 40}%`,
                animationDelay: `${i * 0.05}s`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
