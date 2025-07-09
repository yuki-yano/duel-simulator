import { useEffect, useState } from "react"
import { cn } from "@/client/lib/utils"
import type { Position } from "@/shared/types/game"

interface EffectActivationAnimationProps {
  position: Position
  cardRect?: { x: number; y: number; width: number; height: number }
  cardRotation?: number
  onComplete: () => void
}

export function EffectActivationAnimation({ position, cardRect, cardRotation = 0, onComplete }: EffectActivationAnimationProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [effectPosition, setEffectPosition] = useState<{ x: number; y: number; width: number; height: number } | null>(
    null,
  )

  useEffect(() => {
    // If cardRect is provided, use it directly
    if (cardRect) {
      setEffectPosition(cardRect)
      setIsVisible(true)

      // Hide and complete after animation
      const timer = setTimeout(() => {
        setIsVisible(false)
        setTimeout(onComplete, 200) // Wait for fade out
      }, 400)

      return () => clearTimeout(timer)
    }

    // Otherwise, try to find element by selector (fallback)
    const getElementSelector = () => {
      const { zone } = position
      if (zone === undefined) return null

      if (zone.type === "monsterZone") {
        return `[data-zone-type="monsterZone"][data-zone-player="${zone.player}"][data-zone-index="${zone.index}"] [draggable="true"]`
      } else if (zone.type === "spellTrapZone") {
        return `[data-zone-type="spellTrapZone"][data-zone-player="${zone.player}"][data-zone-index="${zone.index}"] [draggable="true"]`
      } else if (zone.type === "extraMonsterZone") {
        return `[data-zone-type="extraMonsterZone"][data-zone-player="${zone.player}"][data-zone-index="${zone.index}"] [draggable="true"]`
      } else if (zone.type === "graveyard") {
        if (zone.cardId !== undefined) {
          return `[data-card-id="${zone.cardId}"]`
        }
        // Fallback to first child if no cardId (shouldn't happen with the fix)
        return `[data-zone-type="graveyard"][data-zone-player="${zone.player}"] [draggable="true"]:first-child`
      } else if (zone.type === "hand") {
        if (zone.cardId !== undefined) {
          return `[data-card-id="${zone.cardId}"]`
        }
        // Fallback using index
        return `[data-zone-type="hand"][data-zone-player="${zone.player}"] [draggable="true"]:nth-child(${(zone.index ?? 0) + 1})`
      }

      return null
    }

    const selector = getElementSelector()
    if (selector === null) {
      onComplete()
      return
    }

    const element = document.querySelector(selector)
    if (element === null) {
      onComplete()
      return
    }

    // Get element position and dimensions
    const rect = element.getBoundingClientRect()
    setEffectPosition({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    })

    // Show effect
    setIsVisible(true)

    // Hide and complete after animation
    const timer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(onComplete, 200) // Wait for fade out
    }, 400)

    return () => clearTimeout(timer)
  }, [position, cardRect, onComplete])

  if (!effectPosition) return null

  // Check if card is rotated
  const isRotated = cardRotation === -90 || cardRotation === 90

  return (
    <>
      {/* Card zoom effect - カード自体の拡大 */}
      <style>
        {`
          [data-card-id="${position.zone?.cardId ?? ""}"] {
            transform: ${isVisible ? `rotate(${cardRotation}deg) scale(1.05)` : `rotate(${cardRotation}deg) scale(1)`} !important;
            transition: transform 0.3s ease-out !important;
            z-index: ${isVisible ? "9997" : "auto"} !important;
            position: relative !important;
          }
        `}
      </style>

      {/* White flash overlay - 最初の一瞬だけ */}
      <div
        className={cn(
          "fixed pointer-events-none",
          "transition-opacity duration-100",
          isVisible ? "opacity-100" : "opacity-0",
        )}
        style={{
          left: `${effectPosition.x - 2}px`,
          top: `${effectPosition.y - 2}px`,
          width: `${effectPosition.width + 4}px`,
          height: `${effectPosition.height + 4}px`,
          zIndex: 9999,
        }}
      >
        <div
          className={cn("absolute inset-0 rounded-lg bg-white/50", isVisible && "animate-[whiteFlash_0.3s_ease-out]")}
          style={{
            transform: isRotated ? `rotate(${cardRotation}deg)` : undefined,
            transformOrigin: "center",
          }}
        />
      </div>

      {/* Blue mist overlay */}
      <div
        className={cn(
          "fixed pointer-events-none",
          "transition-opacity duration-200",
          isVisible ? "opacity-100" : "opacity-0",
        )}
        style={{
          left: `${effectPosition.x - 2}px`,
          top: `${effectPosition.y - 2}px`,
          width: `${effectPosition.width + 4}px`,
          height: `${effectPosition.height + 4}px`,
          zIndex: 9998,
          transform: isRotated ? `rotate(${cardRotation}deg)` : undefined,
          transformOrigin: "center",
        }}
      >
        {/* Blue glowing mist */}
        <div
          className={cn("absolute inset-0 rounded-lg", isVisible && "animate-[blueMist_0.5s_ease-out]")}
          style={{
            background:
              "radial-gradient(circle at center, rgba(147, 197, 253, 0.3) 0%, rgba(59, 130, 246, 0.2) 40%, transparent 70%)",
            filter: "blur(8px)",
          }}
        />

        {/* Inner blue glow */}
        <div
          className={cn(
            "absolute inset-0 rounded-lg",
            "bg-blue-400/20",
            isVisible && "animate-[pulseGlow_0.5s_ease-out]",
          )}
          style={{
            boxShadow: "inset 0 0 20px rgba(96, 165, 250, 0.5), 0 0 30px rgba(147, 197, 253, 0.4)",
          }}
        />

        {/* Sparkling particles */}
        <div className="absolute inset-0 overflow-hidden rounded-lg">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className={cn(
                "absolute w-1 h-1 bg-blue-200 rounded-full",
                isVisible && "animate-[sparkle_0.6s_ease-out]",
              )}
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${i * 0.08}s`,
              }}
            />
          ))}
        </div>

        {/* Edge highlight */}
        <div
          className={cn(
            "absolute inset-0 rounded-lg",
            "border border-blue-300/50",
            isVisible && "animate-[edgeGlow_0.4s_ease-out]",
          )}
        />
      </div>
    </>
  )
}
