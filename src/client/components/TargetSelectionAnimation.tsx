import { useEffect, useState, useRef } from "react"
import { ANIMATION_DURATIONS } from "@/client/atoms/boardAtoms"

interface TargetSelectionAnimationProps {
  cardRect: { x: number; y: number; width: number; height: number }
  cardRotation?: number
  cardImageUrl?: string
  onComplete: () => void
}

export function TargetSelectionAnimation({
  cardRect,
  cardRotation = 0,
  cardImageUrl,
  onComplete,
}: TargetSelectionAnimationProps) {
  const [animationState, setAnimationState] =
    useState<"initial" | "expanding" | "shrinking">("initial")
  const onCompleteCalledRef = useRef(false)

  useEffect(() => {
    // 次のフレームで拡大を開始
    const startId = requestAnimationFrame(() => {
      setAnimationState("expanding")
    })

    // 拡大完了後に縮小開始
    const shrinkTimer = setTimeout(() => {
      setAnimationState("shrinking")
    }, ANIMATION_DURATIONS.TARGET_SELECTION)

    // 縮小完了後に onComplete を呼ぶ（overlay は親の unmount で消える）
    const completeTimer = setTimeout(() => {
      if (!onCompleteCalledRef.current) {
        onCompleteCalledRef.current = true
        onComplete()
      }
    }, ANIMATION_DURATIONS.TARGET_SELECTION * 2)

    return () => {
      cancelAnimationFrame(startId)
      clearTimeout(shrinkTimer)
      clearTimeout(completeTimer)
    }
  }, [onComplete])

  const scale = animationState === "expanding" ? 1.1 : 1

  return (
    <div
      className="fixed pointer-events-none"
      style={{
        left: `${cardRect.x}px`,
        top: `${cardRect.y}px`,
        width: `${cardRect.width}px`,
        height: `${cardRect.height}px`,
        zIndex: 9998,
        transform: `rotate(${cardRotation}deg) scale(${scale})`,
        transformOrigin: "center",
        transition: `transform ${ANIMATION_DURATIONS.TARGET_SELECTION}ms cubic-bezier(0.34, 1.56, 0.64, 1)`,
      }}
    >
      {/* Card image */}
      <img
        src={cardImageUrl}
        alt="Target card"
        className="absolute inset-0 w-full h-full object-cover rounded"
        draggable={false}
        style={{ pointerEvents: "none" }}
      />
      {/* Highlight border */}
      <div
        className="absolute inset-0 rounded pointer-events-none"
        style={{
          border: "3px solid #fbbf24",
          boxShadow: "inset 0 0 10px rgba(251, 191, 36, 0.5), 0 0 15px rgba(251, 191, 36, 0.6)",
        }}
      />
    </div>
  )
}
