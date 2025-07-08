import { useEffect, useRef } from "react"
import type { Card as GameCard } from "@/shared/types/game"
import { cn } from "@/client/lib/utils"

interface CardContextMenuProps {
  card: GameCard
  position: { x: number; y: number }
  onClose: () => void
  onAction: (action: string, card: GameCard) => void
}

export function CardContextMenu({ card, position, onClose, onAction }: CardContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("touchstart", handleClickOutside)

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("touchstart", handleClickOutside)
    }
  }, [onClose])

  // Adjust position to keep menu within viewport
  const adjustedPosition = { ...position }
  if (menuRef.current) {
    const rect = menuRef.current.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    if (rect.right > viewportWidth) {
      adjustedPosition.x = viewportWidth - rect.width - 10
    }
    if (rect.bottom > viewportHeight) {
      adjustedPosition.y = viewportHeight - rect.height - 10
    }
  }

  const menuItems = [
    { id: "rotate", label: "回転" },
    { id: "flip", label: "裏返す" },
    { id: "toGraveyard", label: "墓地へ送る" },
    { id: "toBanished", label: "除外する" },
    { id: "toHand", label: "手札に戻す" },
    { id: "toDeck", label: "デッキに戻す" },
  ]

  return (
    <div
      ref={menuRef}
      className={cn(
        "fixed z-[10000] bg-white dark:bg-gray-800",
        "border border-gray-200 dark:border-gray-700",
        "rounded-lg shadow-lg py-1 min-w-[180px]",
        "animate-in fade-in-0 zoom-in-95 duration-200"
      )}
      style={{
        left: `${adjustedPosition.x}px`,
        top: `${adjustedPosition.y}px`,
      }}
    >
      {menuItems.map((item) => (
        <button
          key={item.id}
          className={cn(
            "w-full px-4 py-2 text-left",
            "text-sm text-gray-400 dark:text-gray-500",
            "cursor-not-allowed",
            "transition-colors duration-150"
          )}
          disabled
          onClick={() => {
            onAction(item.id, card)
            onClose()
          }}
        >
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  )
}