import { useEffect, useState } from "react"
import { useAtom } from "jotai"
import { cardAnimationsAtom, type CardAnimation } from "@/client/atoms/boardAtoms"
import { cn } from "@/client/lib/utils"

interface AnimatedCardProps {
  animation: CardAnimation
  onComplete: () => void
}

function AnimatedCard({ animation, onComplete }: AnimatedCardProps) {
  const [position, setPosition] = useState(animation.fromPosition)
  
  useEffect(() => {
    // Start animation after a small delay to ensure initial position is rendered
    const timer = setTimeout(() => {
      setPosition(animation.toPosition)
    }, 10)
    
    // Call onComplete when animation finishes
    const completeTimer = setTimeout(() => {
      onComplete()
    }, animation.duration)
    
    return () => {
      clearTimeout(timer)
      clearTimeout(completeTimer)
    }
  }, [animation, onComplete])
  
  return (
    <div
      className="fixed pointer-events-none z-[10000]"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transition: `all ${animation.duration}ms ease-in-out`,
        width: window.innerWidth >= 1024 ? "77px" : window.innerWidth >= 768 ? "66px" : window.innerWidth >= 640 ? "55px" : "40px",
        height: window.innerWidth >= 1024 ? "112px" : window.innerWidth >= 768 ? "96px" : window.innerWidth >= 640 ? "80px" : "56px",
      }}
    >
      <img
        src={animation.cardImageUrl}
        alt="Animating card"
        className={cn(
          "w-full h-full object-cover rounded shadow-xl",
          "opacity-70" // Semi-transparent during animation
        )}
      />
    </div>
  )
}

export function CardAnimationOverlay() {
  const [animations, setAnimations] = useAtom(cardAnimationsAtom)
  
  const handleAnimationComplete = (cardId: string) => {
    setAnimations(prev => prev.filter(anim => anim.cardId !== cardId))
  }
  
  return (
    <>
      {animations.map(animation => (
        <AnimatedCard
          key={animation.cardId}
          animation={animation}
          onComplete={() => handleAnimationComplete(animation.cardId)}
        />
      ))}
    </>
  )
}