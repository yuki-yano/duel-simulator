import { useEffect, useRef, useState } from "react"
import { cn } from "@/client/lib/utils"
import { ANIM } from "@/client/constants/animation"
import type { Position } from "@/shared/types/game"

interface EffectActivationAnimationProps {
  position: Position
  cardRect?: { x: number; y: number; width: number; height: number }
  cardRotation?: number
  cardImageUrl?: string
  onComplete: () => void
}

export function EffectActivationAnimation({
  position,
  cardRect,
  cardRotation = 0,
  cardImageUrl,
  onComplete,
}: EffectActivationAnimationProps) {
  const [animationState, setAnimationState] =
    useState<"initial" | "expanding" | "shrinking">("initial")
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

    const startId = requestAnimationFrame(() => setAnimationState("expanding"))

    // Start shrink at halfway point so total expand+shrink fits in D
    const shrinkTimer = setTimeout(() => setAnimationState("shrinking"), D / 2)

    // Call onComplete after animation completes (hide immediately)
    const completeTimer = setTimeout(() => {
      if (!onCompleteCalled.current) {
        onCompleteCalled.current = true
        onComplete()
      }
    }, D)

    return () => {
      cancelAnimationFrame(startId)
      clearTimeout(shrinkTimer)
      clearTimeout(completeTimer)
    }
  }, [onComplete])

  if (!effectPosition.current) return null

  // 拡大率を旧演出に合わせる
  const scale = animationState === "expanding" ? 1.1 : 1
  const pos = effectPosition.current

  return (
    <div
      className="fixed pointer-events-none"
      style={{
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        width: `${pos.width}px`,
        height: `${pos.height}px`,
        transform: `rotate(${cardRotation}deg) scale(${scale})`,
        transformOrigin: "center",
        transition: `transform ${ANIM.EFFECT.ANIMATION}ms ease-out`,
        zIndex: 9997,
      }}
    >
      {/* Card zoom */}
      <img
        src={cardImageUrl}
        alt="Effect card"
        className="absolute inset-0 w-full h-full object-cover rounded"
        draggable={false}
      />

      {/* flash / mist overlays similar logic, reuse previous but depends on animationState */}
      <div
        className={cn(
          "absolute pointer-events-none transition-opacity duration-200 inset-[-2px]",
          animationState === "initial" ? "opacity-0" : "opacity-100",
        )}
        style={{
          zIndex: 1,
        }}
      >
        {/* white flash */}
        <div
          className={cn(
            "absolute inset-0 rounded-lg bg-white/50",
            animationState === "expanding" && "animate-[whiteFlash_0.3s_ease-out]",
          )}
        />
        {/* inner blue glow */}
        <div
          className={cn(
            "absolute inset-0 rounded-lg bg-blue-400/20",
            animationState === "expanding" && "animate-[pulseGlow_0.5s_ease-out]",
          )}
          style={{
            boxShadow: "inset 0 0 20px rgba(96, 165, 250, 0.5), 0 0 30px rgba(147, 197, 253, 0.4)",
          }}
        />

        {/* blue mist / bubble effect */}
        <div
          className={cn(
            "absolute inset-0 rounded-lg",
            animationState === "expanding" && "animate-[blueMist_0.5s_ease-out]",
          )}
          style={{
            background:
              "radial-gradient(circle at center, rgba(147, 197, 253, 0.3) 0%, rgba(59, 130, 246, 0.2) 40%, transparent 70%)",
            filter: "blur(8px)",
          }}
        />

        {/* sparkles - size 0.25rem (w-1 h-1) */}
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "absolute w-1 h-1 bg-blue-200 rounded-full",
              animationState === "expanding" && "animate-[sparkle_0.6s_ease-out]",
            )}
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${i * 0.08}s`,
            }}
          />
        ))}

        {/* Edge highlight */}
        <div
          className={cn(
            "absolute inset-0 rounded-lg border border-blue-300/50",
            animationState === "expanding" && "animate-[edgeGlow_0.4s_ease-out]",
          )}
        />
      </div>
    </div>
  )
}
