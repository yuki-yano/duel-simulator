import { useCallback, useState } from "react"
import type { MouseEvent, TouchEvent } from "react"
import { useAtom, useAtomValue } from "jotai"

import {
  draggedCardAtom,
  moveCardAtom,
  generateTokenAtom,
  shuffleDeckAtom,
  drawMultipleCardsAtom,
  forceDraw5CardsAtom,
} from "@/client/atoms/boardAtoms"
import { rotateCardAtom, flipCardAtom, toggleCardHighlightAtom } from "@/client/atoms/operations/rotation"
import {
  activateEffectAtom,
  targetSelectAtom,
  negateEffectAtom,
  updateCounterAtom,
} from "@/client/atoms/operations/effects"
import type { Card as GameCard, ZoneId, PlayerBoard } from "@/shared/types/game"
import { isTokenLimitReached } from "@/client/utils/tokenCard"

export type ContextMenuState = {
  card: GameCard
  zone: ZoneId
  position: { x: number; y: number }
  cardElement?: HTMLElement | null
} | null

interface UseGameFieldInteractionsParams {
  playerBoard: PlayerBoard
  opponentBoard: PlayerBoard
  mobileDefenseMode: boolean
  mobileFaceDownMode: boolean
  mobileStackBottom: boolean
  preventSameZoneReorder: boolean
  setShowTokenLimitDialog: (value: boolean) => void
  setShowDrawWarningDialog: (value: boolean) => void
}

export const useGameFieldInteractions = ({
  playerBoard,
  opponentBoard,
  mobileDefenseMode,
  mobileFaceDownMode,
  mobileStackBottom,
  preventSameZoneReorder,
  setShowTokenLimitDialog,
  setShowDrawWarningDialog,
}: UseGameFieldInteractionsParams) => {
  const draggedCard = useAtomValue(draggedCardAtom)
  const [, moveCard] = useAtom(moveCardAtom)
  const [, generateToken] = useAtom(generateTokenAtom)
  const [, shuffleDeck] = useAtom(shuffleDeckAtom)
  const [, drawMultipleCards] = useAtom(drawMultipleCardsAtom)
  const [, setForceDraw5Cards] = useAtom(forceDraw5CardsAtom)
  const [, rotateCard] = useAtom(rotateCardAtom)
  const [, activateEffect] = useAtom(activateEffectAtom)
  const [, targetSelect] = useAtom(targetSelectAtom)
  const [, negateEffect] = useAtom(negateEffectAtom)
  const [, flipCard] = useAtom(flipCardAtom)
  const [, toggleCardHighlight] = useAtom(toggleCardHighlightAtom)
  const [, updateCounter] = useAtom(updateCounterAtom)

  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null)

  const handleCardDrop = useCallback(
    (from: ZoneId, to: ZoneId, shiftKey?: boolean) => {
      if (!draggedCard) {
        console.error("No dragged card available for drop operation")
        return
      }

      let hasExistingCards = false
      const targetBoard = to.player === "self" ? playerBoard : opponentBoard

      if (to.type === "monsterZone" && to.index !== undefined) {
        hasExistingCards = targetBoard.monsterZones[to.index].length > 0
      } else if (to.type === "spellTrapZone" && to.index !== undefined) {
        hasExistingCards = targetBoard.spellTrapZones[to.index].length > 0
      } else if (to.type === "extraMonsterZone" && to.index !== undefined) {
        hasExistingCards = targetBoard.extraMonsterZones[to.index].length > 0
      } else if (to.type === "freeZone") {
        hasExistingCards = (targetBoard.freeZone ?? []).length > 0
      }

      const options = {
        shiftKey: shiftKey === true && !hasExistingCards,
        defenseMode: mobileDefenseMode,
        faceDownMode: mobileFaceDownMode,
        stackPosition: (shiftKey === true && hasExistingCards) || mobileStackBottom ? ("bottom" as const) : undefined,
        preventSameZoneReorder: !preventSameZoneReorder,
      }

      if (draggedCard.zone != null && "cardIndex" in draggedCard.zone && draggedCard.zone.cardIndex !== undefined) {
        const fromWithIndex = { ...from, index: draggedCard.zone.cardIndex }
        moveCard({ zone: fromWithIndex, cardId: draggedCard.id }, { zone: to, cardId: draggedCard.id }, options)
      } else {
        moveCard({ zone: from, cardId: draggedCard.id }, { zone: to, cardId: draggedCard.id }, options)
      }
    },
    [draggedCard, mobileDefenseMode, mobileFaceDownMode, mobileStackBottom, moveCard, opponentBoard, playerBoard, preventSameZoneReorder],
  )

  const handleCardContextMenu = useCallback((e: MouseEvent | TouchEvent, card: GameCard, zone: ZoneId) => {
    e.preventDefault()
    const position =
      "touches" in e ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY }
    const cardElement = (e.target as HTMLElement).closest('[draggable="true"]') as HTMLElement | null
    setContextMenu({ card, zone, position, cardElement })
  }, [])

  const handleContextMenuAction = useCallback(
    (action: string, card: GameCard) => {
      try {
        if (action === "rotate" && contextMenu) {
          const newRotation = card.rotation === -90 ? 0 : -90
          rotateCard({ zone: contextMenu.zone, cardId: card.id }, newRotation)
        } else if (action === "activate" && contextMenu) {
          activateEffect({ zone: contextMenu.zone, cardId: card.id }, contextMenu.cardElement ?? undefined)
        } else if (action === "target" && contextMenu) {
          targetSelect({ zone: contextMenu.zone, cardId: card.id }, contextMenu.cardElement ?? undefined)
        } else if (action === "negate" && contextMenu) {
          negateEffect({ zone: contextMenu.zone, cardId: card.id }, contextMenu.cardElement ?? undefined)
        } else if (action === "flip" && contextMenu) {
          flipCard({ zone: contextMenu.zone, cardId: card.id })
        } else if (action === "highlight" && contextMenu) {
          toggleCardHighlight({ zone: contextMenu.zone, cardId: card.id })
        } else if (action === "addCounter" && contextMenu) {
          const currentCounter = card.counter ?? 0
          updateCounter({ zone: contextMenu.zone, cardId: card.id }, currentCounter + 1)
        } else if (action === "removeCounter" && contextMenu) {
          const currentCounter = card.counter ?? 0
          if (currentCounter > 0) {
            updateCounter({ zone: contextMenu.zone, cardId: card.id }, currentCounter - 1)
          }
        }
      } catch (error) {
        alert(`Error in ${action}: ${error instanceof Error ? error.message : String(error)}`)
        console.error(`Error in handleContextMenuAction (${action}):`, error)
      }
    },
    [activateEffect, contextMenu, flipCard, negateEffect, rotateCard, targetSelect, toggleCardHighlight, updateCounter],
  )

  const handleGenerateToken = useCallback(() => {
    if (isTokenLimitReached((playerBoard.freeZone ?? []).length)) {
      setShowTokenLimitDialog(true)
      return
    }
    generateToken("self")
  }, [generateToken, playerBoard.freeZone, setShowTokenLimitDialog])

  const handleShuffleDeck = useCallback(() => {
    shuffleDeck("self")
  }, [shuffleDeck])

  const handleDraw5Cards = useCallback(() => {
    const result = drawMultipleCards(5, "self") as { needsWarning?: boolean; success?: boolean } | undefined
    if (result?.needsWarning === true) {
      setShowDrawWarningDialog(true)
    }
  }, [drawMultipleCards, setShowDrawWarningDialog])

  const handleConfirmedDraw5Cards = useCallback(() => {
    setForceDraw5Cards(true)
    setShowDrawWarningDialog(false)
    drawMultipleCards(5, "self")
  }, [drawMultipleCards, setForceDraw5Cards, setShowDrawWarningDialog])

  return {
    contextMenu,
    setContextMenu,
    handleCardDrop,
    handleCardContextMenu,
    handleContextMenuAction,
    handleGenerateToken,
    handleShuffleDeck,
    handleDraw5Cards,
    handleConfirmedDraw5Cards,
  }
}

export type GameFieldInteractions = ReturnType<typeof useGameFieldInteractions>
