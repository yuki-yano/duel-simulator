import { useEffect, useRef } from "react"
import { produce } from "immer"
import type { Card as GameCard, ZoneId } from "@/shared/types/game"
import { cn } from "@/client/lib/utils"

interface CardContextMenuProps {
  card: GameCard
  zone: ZoneId
  position: { x: number; y: number }
  onClose: () => void
  onAction: (action: string, card: GameCard) => void
  isReplayActive?: boolean
}

export function CardContextMenu({ card, zone, position, onClose, onAction, isReplayActive }: CardContextMenuProps) {
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
  const adjustedPosition = produce(position, (draft) => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      if (rect.right > viewportWidth) {
        draft.x = viewportWidth - rect.width - 10
      }
      if (rect.bottom > viewportHeight) {
        draft.y = viewportHeight - rect.height - 10
      }
    }
  })

  const isMonsterSpellTrapZone =
    zone.type === "monsterZone" || zone.type === "spellTrapZone" || zone.type === "extraMonsterZone"

  const isMonsterZone = zone.type === "monsterZone" || zone.type === "extraMonsterZone"

  const menuItems = [
    {
      id: "activate",
      label: "効果の発動",
      enabled: card.faceDown !== true && isReplayActive === false,
    },
    {
      id: "target",
      label: "対象に取る",
      enabled: card.faceDown !== true && isReplayActive === false,
    },
    {
      id: "highlight",
      label: card.highlighted === true ? "ハイライトを解除" : "ハイライト",
      enabled: isReplayActive === false,
    },
    {
      id: "rotate",
      label: card.rotation === -90 ? "攻撃表示にする" : "守備表示にする",
      enabled: isMonsterZone && isReplayActive === false,
    },
    {
      id: "flip",
      label: card.faceDown === true ? "表側表示にする" : "裏側表示にする",
      enabled: isMonsterSpellTrapZone && isReplayActive === false,
    },
  ]

  return (
    <div
      ref={menuRef}
      className={cn(
        "fixed z-[10000] bg-white dark:bg-gray-800",
        "border border-gray-200 dark:border-gray-700",
        "rounded-lg shadow-lg py-1 min-w-[180px]",
        "animate-in fade-in-0 zoom-in-95 duration-200",
      )}
      style={{
        left: `${adjustedPosition.x}px`,
        top: `${adjustedPosition.y}px`,
      }}
      onTouchEnd={(e) => {
        // Prevent touch events from propagating on menu container
        e.stopPropagation()
      }}
    >
      {menuItems.map((item) => (
        <button
          key={item.id}
          className={cn(
            "w-full px-4 py-2 text-left",
            "text-sm",
            "transition-colors duration-150",
            item.enabled
              ? "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
              : "text-gray-400 dark:text-gray-500 cursor-not-allowed",
          )}
          disabled={!item.enabled}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            if (item.enabled) {
              try {
                onAction(item.id, card)
              } catch (error) {
                console.error("Error in context menu action:", error)
              } finally {
                onClose()
              }
            }
          }}
          onTouchEnd={(e) => {
            // Handle touch events for mobile
            e.preventDefault()
            e.stopPropagation()
            if (item.enabled) {
              try {
                onAction(item.id, card)
              } catch (error) {
                console.error("Error in context menu action:", error)
              } finally {
                onClose()
              }
            }
          }}
        >
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  )
}
