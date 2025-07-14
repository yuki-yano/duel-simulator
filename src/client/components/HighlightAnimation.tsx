import { useEffect, useState, useRef } from "react"
import { ANIMATION_DURATIONS } from "@/client/atoms/boardAtoms"

interface HighlightAnimationProps {
  cardRect: { x: number; y: number; width: number; height: number }
  cardRotation?: number
  hideStaticBorder?: boolean
  onComplete: () => void
}

export function HighlightAnimation({ cardRect, cardRotation = 0, onComplete }: HighlightAnimationProps) {
  const [animationState, setAnimationState] = useState<"expanding" | "shrinking" | "hidden">("expanding")
  const onCompleteCalledRef = useRef(false)

  useEffect(() => {
    // 拡大から縮小への切り替え
    const expandTimer = setTimeout(() => {
      setAnimationState("shrinking")
    }, ANIMATION_DURATIONS.HIGHLIGHT / 2)

    // 完全に非表示とonComplete呼び出し
    const hideTimer = setTimeout(() => {
      setAnimationState("hidden")

      // onCompleteは縮小アニメーション完了後に呼ぶ
      if (!onCompleteCalledRef.current) {
        onCompleteCalledRef.current = true
        onComplete()
      }
    }, ANIMATION_DURATIONS.HIGHLIGHT)

    // Cleanup function
    return () => {
      clearTimeout(expandTimer)
      clearTimeout(hideTimer)
    }
  }, [onComplete])

  if (animationState === "hidden") return null

  const isExpanded = animationState === "expanding"

  return (
    <>
      {/* Red highlight overlay - 赤いハイライトオーバーレイ */}
      <div
        className="fixed pointer-events-none"
        style={{
          // カードの元の位置（回転前の位置）
          left: `${cardRect.x}px`,
          top: `${cardRect.y}px`,
          width: `${cardRect.width}px`,
          height: `${cardRect.height}px`,
          zIndex: 9998,
          // 回転と拡大を同時に適用
          transform: `rotate(${cardRotation}deg) ${isExpanded ? "scale(1.1)" : "scale(1)"}`,
          transformOrigin: "center",
          transition: `all ${ANIMATION_DURATIONS.HIGHLIGHT / 2}ms cubic-bezier(0.34, 1.56, 0.64, 1)`,
        }}
      >
        <div
          className="absolute inset-0 rounded pointer-events-none"
          style={{
            border: "3px solid #ef4444",
            boxShadow: "inset 0 0 10px rgba(239, 68, 68, 0.5), 0 0 15px rgba(239, 68, 68, 0.6)",
            transition: "all 0.2s ease",
          }}
        />
      </div>
    </>
  )
}