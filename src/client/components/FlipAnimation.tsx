import { useLayoutEffect, useState } from "react"
import { ANIM } from "@/client/constants/animation"

type FlipAnimationProps = {
  cardRect: { x: number; y: number; width: number; height: number }
  cardImageUrl?: string
  fromFaceDown: boolean
  toFaceDown: boolean
  cardRotation: number
  duration?: number
  onComplete: () => void
}

export function FlipAnimation({
  cardRect,
  cardImageUrl,
  fromFaceDown,
  toFaceDown,
  cardRotation = 0,
  duration = ANIM.FLIP.ANIMATION,
  onComplete,
}: FlipAnimationProps) {
  const [rotateY, setRotateY] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const [showFaceDown, setShowFaceDown] = useState(fromFaceDown)

  useLayoutEffect(() => {
    // トランジション無効で初期状態を設定
    setIsAnimating(false)
    setRotateY(0)
    setShowFaceDown(fromFaceDown)

    // 次フレームでアニメーション開始
    const raf = requestAnimationFrame(() => {
      setIsAnimating(true)
      // Y軸方向に90度回転
      setRotateY(90)
    })

    // 半分の時間で表裏を切り替え
    const flipTimer = setTimeout(() => {
      setShowFaceDown(toFaceDown)
      // さらに90度回転して元の向きに戻す
      setRotateY(0)
    }, duration / 2)

    const completeTimer = setTimeout(() => {
      onComplete()
    }, duration)

    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(flipTimer)
      clearTimeout(completeTimer)
    }
  }, [fromFaceDown, toFaceDown, duration, onComplete])

  return (
    <div
      className="fixed pointer-events-none"
      style={{
        left: `${cardRect.x}px`,
        top: `${cardRect.y}px`,
        width: `${cardRect.width}px`,
        height: `${cardRect.height}px`,
        zIndex: 9999,
        perspective: "1000px", // 3D効果を適用
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          transformStyle: "preserve-3d",
          transform: `rotateZ(${cardRotation}deg) rotateY(${rotateY}deg)`,
          transition: isAnimating ? `transform ${duration / 2}ms ease-in-out` : "none",
        }}
      >
        <img
          src={cardImageUrl}
          alt="Flipping card"
          className="absolute inset-0 w-full h-full object-cover rounded"
          draggable={false}
        />
        {showFaceDown && <div className="absolute inset-0 rounded bg-black/40" />}
      </div>
    </div>
  )
}
