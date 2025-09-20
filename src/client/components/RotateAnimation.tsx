import { useLayoutEffect, useState } from "react"
import { ANIM } from "@/client/constants/animation"
import { Z_INDEX } from "@/client/constants/zIndex"

type RotateAnimationProps = {
  cardRect: { x: number; y: number; width: number; height: number }
  fromRotation?: number
  toRotation?: number
  cardImageUrl?: string
  duration?: number
  onComplete: () => void
}

export function RotateAnimation({
  cardRect,
  fromRotation = 0,
  toRotation = 0,
  cardImageUrl,
  duration = ANIM.ROTATION.ANIMATION,
  onComplete,
}: RotateAnimationProps) {
  const [rotation, setRotation] = useState(fromRotation)
  // トランジション有効化フラグ
  const [isAnimating, setIsAnimating] = useState(false)

  // 初期角度を適用 → 次フレームで目標角度へ遷移させる
  useLayoutEffect(() => {
    // 一旦トランジション無効で fromRotation を描画
    setIsAnimating(false)
    setRotation(fromRotation)

    // 次フレームでトランジションを有効化して toRotation に変更
    const raf = requestAnimationFrame(() => {
      setIsAnimating(true)
      setRotation(toRotation)
    })

    const timer = setTimeout(() => {
      onComplete()
    }, duration)

    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
    }
  }, [fromRotation, toRotation, duration, onComplete])

  return (
    <div
      className="fixed pointer-events-none"
      style={{
        left: `${cardRect.x}px`,
        top: `${cardRect.y}px`,
        width: `${cardRect.width}px`,
        height: `${cardRect.height}px`,
        transform: `rotate(${rotation}deg)`,
        transformOrigin: "center",
        transition: isAnimating ? `transform ${duration}ms ease-in-out` : "none",
        zIndex: Z_INDEX.ROTATE_ANIMATION,
      }}
    >
      <img
        src={cardImageUrl}
        alt="Rotating card"
        className="absolute inset-0 w-full h-full object-cover rounded"
        draggable={false}
      />
    </div>
  )
}
