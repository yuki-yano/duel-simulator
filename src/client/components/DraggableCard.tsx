import { useState, useRef } from "react"
import { useSetAtom } from "jotai"
import { draggedCardAtom } from "@/client/atoms/boardAtoms"
import type { Card as GameCard } from "@/shared/types/game"
import { cn } from "@/client/lib/utils"

interface DraggableCardProps {
  card: GameCard
  className?: string
  hoverDirection?: 'up' | 'left'
}

export function DraggableCard({ card, className, hoverDirection = 'up' }: DraggableCardProps) {
  const setDraggedCard = useSetAtom(draggedCardAtom)
  const [isHovered, setIsHovered] = useState(false)
  const [isTouching, setIsTouching] = useState(false)
  const [touchPosition, setTouchPosition] = useState({ x: 0, y: 0 })
  const cardRef = useRef<HTMLDivElement>(null)

  const handleDragStart = (e: React.DragEvent) => {
    setDraggedCard(card)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragEnd = () => {
    setDraggedCard(null)
  }
  
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsTouching(true)
    setDraggedCard(card)
    // Prevent default to avoid scrolling and text selection
    e.preventDefault()
    e.stopPropagation()
    
    if (e.touches.length > 0) {
      const touch = e.touches[0]
      setTouchPosition({ x: touch.clientX, y: touch.clientY })
    }
    
    // bodyのスクロールを無効化
    document.body.style.overflow = 'hidden'
    document.body.style.touchAction = 'none'
  }
  
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (isTouching && e.changedTouches.length > 0) {
      const touch = e.changedTouches[0]
      const element = document.elementFromPoint(touch.clientX, touch.clientY)
      
      // Trigger drag and drop events on the element under touch point
      if (element) {
        // Create and dispatch dragenter, dragover, and drop events
        const dragOverEvent = new DragEvent('dragover', { 
          bubbles: true,
          cancelable: true,
          dataTransfer: new DataTransfer()
        })
        element.dispatchEvent(dragOverEvent)
        
        const dropEvent = new DragEvent('drop', { 
          bubbles: true,
          cancelable: true,
          dataTransfer: new DataTransfer()
        })
        element.dispatchEvent(dropEvent)
      }
    }
    
    setIsTouching(false)
    setDraggedCard(null)
    
    // bodyのスクロールを復元
    document.body.style.overflow = ''
    document.body.style.touchAction = ''
  }
  
  const handleTouchMove = (e: React.TouchEvent) => {
    // Prevent scrolling while dragging
    e.preventDefault()
    
    if (isTouching && e.touches.length > 0) {
      const touch = e.touches[0]
      setTouchPosition({ x: touch.clientX, y: touch.clientY })
    }
  }

  return (
    <>
      <div
        ref={cardRef}
        className={cn(
        "transition-all duration-200",
        className
      )}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      style={{
        cursor: "grab",
        transform: (isHovered || isTouching) 
          ? hoverDirection === 'left' 
            ? "translateX(-8px)" 
            : "translateY(-8px)" 
          : "translate(0)",
        zIndex: (isHovered || isTouching) ? 1000 : undefined,
        position: (isHovered || isTouching) ? "relative" : undefined,
        opacity: isTouching ? 0.5 : 1,
      }}
    >
      <img
        src={card.imageUrl}
        alt="Card"
        className={cn(
          "w-full h-full object-cover rounded transition-shadow duration-200",
          (isHovered || isTouching) && "shadow-xl"
        )}
        style={{
          transform: `rotate(${card.rotation}deg)`,
        }}
      />
    </div>
      {isTouching && (
        <div
          className="fixed pointer-events-none z-[9999]"
          style={{
            left: touchPosition.x - 30,
            top: touchPosition.y - 43,
            width: 60,
            height: 86,
          }}
        >
          <img
            src={card.imageUrl}
            alt="Dragging card"
            className="w-full h-full object-cover rounded shadow-xl"
            style={{
              transform: `rotate(${card.rotation}deg)`,
            }}
          />
        </div>
      )}
    </>
  )
}