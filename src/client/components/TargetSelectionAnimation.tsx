import { useEffect, useState, useRef } from "react"
import { cn } from "@/client/lib/utils"
import { ANIMATION_DURATIONS } from "@/client/atoms/boardAtoms"

interface TargetSelectionAnimationProps {
  cardRect: { x: number; y: number; width: number; height: number }
  cardRotation?: number
  onComplete: () => void
}

export function TargetSelectionAnimation({
  cardRect,
  cardRotation = 0,
  onComplete,
}: TargetSelectionAnimationProps) {
  const [animationState, setAnimationState] = useState<'expanding' | 'shrinking' | 'hidden'>('expanding')
  const onCompleteCalledRef = useRef(false)

  useEffect(() => {
    // 拡大から縮小への切り替え
    const expandTimer = setTimeout(() => {
      setAnimationState('shrinking')
    }, ANIMATION_DURATIONS.TARGET_SELECTION)
    
    // 完全に非表示とonComplete呼び出し
    const hideTimer = setTimeout(() => {
      setAnimationState('hidden')
      
      // onCompleteは縮小アニメーション完了後に呼ぶ
      if (!onCompleteCalledRef.current) {
        onCompleteCalledRef.current = true
        onComplete()
      }
    }, ANIMATION_DURATIONS.TARGET_SELECTION * 2)
    
    // Cleanup function
    return () => {
      clearTimeout(expandTimer)
      clearTimeout(hideTimer)
    }
  }, []) // Empty dependencies array - run only on mount

  if (animationState === 'hidden') return null

  // Check if card is rotated
  const isRotated = cardRotation === -90 || cardRotation === 90
  const isExpanded = animationState === 'expanding'

  return (
    <>
      {/* Yellow highlight overlay - 黄色いハイライトオーバーレイ（ハイライトと同じ見た目） */}
      <div
        className="fixed pointer-events-none"
        style={{
          // 守備表示の場合、カードの中心に合わせて位置調整
          left: isRotated
            ? `${cardRect.x + (cardRect.width - cardRect.height) / 2}px`
            : `${cardRect.x}px`,
          top: isRotated
            ? `${cardRect.y - (cardRect.width - cardRect.height) / 2}px`
            : `${cardRect.y}px`,
          // 守備表示の場合、幅と高さを入れ替え
          width: isRotated ? `${cardRect.height}px` : `${cardRect.width}px`,
          height: isRotated ? `${cardRect.width}px` : `${cardRect.height}px`,
          zIndex: 9998,
          // カードと同じように拡大する
          transform: isExpanded ? "scale(1.1)" : "scale(1)",
          transformOrigin: "center",
          transition: `all ${ANIMATION_DURATIONS.TARGET_SELECTION}ms cubic-bezier(0.34, 1.56, 0.64, 1)`,
        }}
      >
        <div
          className="absolute inset-0 rounded pointer-events-none"
          style={{
            transform: `rotate(${cardRotation}deg)`,
            border: "3px solid #fbbf24",
            boxShadow: "inset 0 0 10px rgba(251, 191, 36, 0.5), 0 0 15px rgba(251, 191, 36, 0.6)",
            transition: "all 0.2s ease",
          }}
        />
      </div>
    </>
  )
}