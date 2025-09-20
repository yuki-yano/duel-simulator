import { useEffect, useRef } from "react"
import { produce } from "immer"
import { useTranslation } from "react-i18next"
import type { Card as GameCard, ZoneId } from "@/shared/types/game"
import { cn } from "@/client/lib/utils"
import { useScreenSize } from "@client/hooks/useScreenSize"
import { Z_INDEX } from "@/client/constants/zIndex"

type CardContextMenuProps = {
  card: GameCard
  zone: ZoneId
  position: { x: number; y: number }
  onClose: () => void
  onAction: (action: string, card: GameCard) => void
  isReplayActive?: boolean
}

export function CardContextMenu({ card, zone, position, onClose, onAction, isReplayActive }: CardContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const { width: screenWidth } = useScreenSize()
  const { t } = useTranslation(["game"])

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
      const viewportWidth = screenWidth
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
    zone.type === "monsterZone" ||
    zone.type === "spellTrapZone" ||
    zone.type === "extraMonsterZone" ||
    zone.type === "fieldZone"

  const isMonsterZone = zone.type === "monsterZone" || zone.type === "extraMonsterZone"

  const isCounterZone =
    zone.type === "monsterZone" ||
    zone.type === "spellTrapZone" ||
    zone.type === "extraMonsterZone" ||
    zone.type === "fieldZone"

  const menuItems = [
    {
      id: "activate",
      label: t("contextMenu.activate"),
      enabled: card.faceDown !== true && isReplayActive === false,
    },
    {
      id: "negate",
      label: t("contextMenu.negate"),
      enabled: card.faceDown !== true && isReplayActive === false,
    },
    {
      id: "target",
      label: t("contextMenu.target"),
      enabled: card.faceDown !== true && isReplayActive === false,
    },
    {
      id: "highlight",
      label: card.highlighted === true ? t("contextMenu.unhighlight") : t("contextMenu.highlight"),
      enabled: isReplayActive === false,
    },
    {
      id: "rotate",
      label: card.rotation === -90 ? t("contextMenu.setAttackPosition") : t("contextMenu.setDefensePosition"),
      enabled: isMonsterZone && isReplayActive === false,
    },
    {
      id: "flip",
      label: card.faceDown === true ? t("contextMenu.setFaceUp") : t("contextMenu.setFaceDown"),
      enabled: isMonsterSpellTrapZone && isReplayActive === false,
    },
    {
      id: "addCounter",
      label: t("contextMenu.addCounter"),
      enabled: isCounterZone && isReplayActive === false,
    },
    {
      id: "removeCounter",
      label: t("contextMenu.removeCounter"),
      enabled: isCounterZone && isReplayActive === false && (card.counter ?? 0) > 0,
    },
  ]

  return (
    <div
      ref={menuRef}
      className={cn(
        "fixed bg-white dark:bg-gray-800",
        "border border-gray-200 dark:border-gray-700",
        "rounded-lg shadow-lg py-1 w-auto",
        "animate-in fade-in-0 zoom-in-95 duration-200",
      )}
      style={{
        left: `${adjustedPosition.x}px`,
        top: `${adjustedPosition.y}px`,
        zIndex: Z_INDEX.CARD_CONTEXT_MENU,
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
            "block w-full px-4 py-2 text-left whitespace-nowrap",
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
