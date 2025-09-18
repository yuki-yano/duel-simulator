import { useCallback, useState } from "react"

import type { ZoneId } from "@/shared/types/game"

export interface ModalBounds {
  top: number
  left: number
  right: number
  bottom: number
}

export interface ExtraDeckModalBounds {
  top: number
  left: number
  width: number
  bottom: number
}

export const useGameFieldModals = () => {
  const [expandedZone, setExpandedZone] = useState<ZoneId | null>(null)
  const [modalBounds, setModalBounds] = useState<ModalBounds>({ top: 0, left: 0, right: 0, bottom: 0 })
  const [isExtraDeckExpanded, setIsExtraDeckExpanded] = useState(false)
  const [extraDeckModalBounds, setExtraDeckModalBounds] = useState<ExtraDeckModalBounds>({
    top: 0,
    left: 0,
    width: 0,
    bottom: 0,
  })

  const openZoneExpandModal = useCallback((zone: ZoneId) => {
    const calculateModalBounds = () => {
      const handElement = document.querySelector(".hand-zone-self")
      const extraDeckElement = document.querySelector(".extra-zone-self")
      const graveElement = document.querySelector(".grave-zone-self")
      const banishElement = document.querySelector(".banish-zone-self")
      const deckElement = document.querySelector(".deck-zone-self")

      if (!handElement || !extraDeckElement || !graveElement || !banishElement || !deckElement) {
        console.error("Could not find required zone elements")
        return null
      }

      const graveRect = graveElement.getBoundingClientRect()
      const banishRect = banishElement.getBoundingClientRect()
      const deckRect = deckElement.getBoundingClientRect()

      return {
        top: Math.max(graveRect.bottom, banishRect.bottom) + window.scrollY,
        left: graveRect.left + window.scrollX,
        right: banishRect.right + window.scrollX,
        bottom: deckRect.bottom + window.scrollY,
      }
    }

    const bounds = calculateModalBounds()
    if (bounds) {
      setModalBounds(bounds)
      setExpandedZone(zone)
    }
  }, [])

  const openExtraDeckExpandModal = useCallback(() => {
    const calculateModalBounds = () => {
      const extraDeckElement = document.querySelector(".extra-zone-self")
      const deckElement = document.querySelector(".deck-zone-self")

      if (!extraDeckElement || !deckElement) {
        console.error("Could not find required zone elements")
        return null
      }

      const extraRect = extraDeckElement.getBoundingClientRect()
      const deckRect = deckElement.getBoundingClientRect()

      return {
        top: extraRect.bottom + window.scrollY,
        left: extraRect.left + window.scrollX,
        width: extraRect.width,
        bottom: deckRect.bottom + window.scrollY,
      }
    }

    const bounds = calculateModalBounds()
    if (bounds) {
      setExtraDeckModalBounds(bounds)
      setIsExtraDeckExpanded(true)
    }
  }, [])

  return {
    expandedZone,
    setExpandedZone,
    modalBounds,
    isExtraDeckExpanded,
    setIsExtraDeckExpanded,
    extraDeckModalBounds,
    openZoneExpandModal,
    openExtraDeckExpandModal,
  }
}

export type GameFieldModalState = ReturnType<typeof useGameFieldModals>
