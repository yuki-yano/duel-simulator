import { atom } from "jotai"
import type { Getter } from "jotai"
import type { GameOperation, Position } from "../../../shared/types/game"
import type { CardAnimation } from "../types"
import { gameStateAtom } from "../core/gameState"
import { operationsAtom } from "../core/operations"
import { cardRefsAtom } from "../ui/domRefs"
import { performCardRotation, performCardFlip, performCardHighlightToggle } from "../helpers/stateHelpers"
import { getCardById } from "../helpers/cardHelpers"
import { v4 as uuidv4 } from "uuid"
import { TOKEN_IMAGE_DATA_URL } from "@/client/constants/tokenImage"
import { ANIM } from "../constants"

import { addToHistory } from "../history/historyStack"
import { replayRecordingAtom, replayOperationsAtom } from "../replay/recording"
import { cardAnimationsAtom } from "../replay/animations"

// Get card rect from ref
function getCardRect(cardId: string, get: Getter): { x: number; y: number; width: number; height: number } | undefined {
  const refs = get(cardRefsAtom)
  const element = refs.get(cardId)
  if (!element) return undefined

  const rect = element.getBoundingClientRect()
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  }
}

export const rotateCardAtom = atom(null, (get, set, position: Position, angle: number) => {
  const state = get(gameStateAtom)

  // Get previous rotation before updating
  let prevRotation = 0
  {
    const player = state.players[position.zone.player]
    const res = getCardById(player, position.cardId)
    if (res) prevRotation = res.card.rotation
  }

  const newState = performCardRotation(state, position, angle)

  if (newState !== state) {
    // Create operation BEFORE adding to history
    const operation: GameOperation = {
      id: uuidv4(),
      timestamp: Date.now(),
      type: "rotate",
      cardId: position.cardId,
      to: {
        player: position.zone.player,
        zoneType: position.zone.type,
        zoneIndex: position.zone.index,
      },
      player: position.zone.player,
      metadata: { angle },
    }

    // Create rotate animation BEFORE updating state to prevent flicker
    const cardRect = getCardRect(position.cardId, get)

    if (cardRect) {
      // Retrieve card image URL from current state (before update)
      const player = state.players[position.zone.player]
      const res = getCardById(player, position.cardId)

      const cardImageUrl = res ? (res.card.name === "token" ? TOKEN_IMAGE_DATA_URL : res.card.imageUrl) : undefined

      const animation: CardAnimation = {
        id: uuidv4(),
        type: "rotate",
        cardId: position.cardId,
        cardImageUrl,
        cardRect,
        fromRotation: prevRotation,
        toRotation: angle,
        startTime: Date.now(),
        duration: ANIM.ROTATION.ANIMATION,
      }

      const existingAnims = get(cardAnimationsAtom)
      set(cardAnimationsAtom, [...existingAnims, animation])
    }

    // Delay state update by 1 frame to prevent flicker
    requestAnimationFrame(() => {
      // Update operations BEFORE history
      set(operationsAtom, [...get(operationsAtom), operation])

      // Then update game state and add to history
      set(gameStateAtom, newState)
      addToHistory(get, set, newState)

      // Also record to replay operations if recording
      if (get(replayRecordingAtom)) {
        set(replayOperationsAtom, [...get(replayOperationsAtom), operation])
      }
    })
  }
})

// Card flip (face up/down) action
export const flipCardAtom = atom(null, (get, set, position: Position) => {
  const state = get(gameStateAtom)

  // Get current card state before flipping
  let prevFaceDown = false
  {
    const player = state.players[position.zone.player]
    const res = getCardById(player, position.cardId)
    if (res) prevFaceDown = res.card.faceDown === true
  }

  const newState = performCardFlip(state, position)

  if (newState !== state) {
    // Create operation BEFORE adding to history
    const operation: GameOperation = {
      id: uuidv4(),
      timestamp: Date.now(),
      type: "changePosition",
      cardId: position.cardId,
      to: {
        player: position.zone.player,
        zoneType: position.zone.type,
        zoneIndex: position.zone.index,
      },
      player: position.zone.player,
      metadata: { flip: true },
    }

    // Create flip animation BEFORE updating state to prevent flicker
    const cardRect = getCardRect(position.cardId, get)

    if (cardRect) {
      // Retrieve card info from current state (before update)
      const player = state.players[position.zone.player]
      const res = getCardById(player, position.cardId)

      const cardImageUrl = res ? (res.card.name === "token" ? TOKEN_IMAGE_DATA_URL : res.card.imageUrl) : undefined
      const cardRotation = res ? res.card.rotation : 0

      const animation: CardAnimation = {
        id: uuidv4(),
        type: "flip",
        cardId: position.cardId,
        cardImageUrl,
        cardRect,
        cardRotation,
        fromFaceDown: prevFaceDown,
        toFaceDown: !prevFaceDown,
        startTime: Date.now(),
        duration: ANIM.FLIP.ANIMATION,
      }

      const existingAnims = get(cardAnimationsAtom)
      set(cardAnimationsAtom, [...existingAnims, animation])
    }

    // Delay state update by 1 frame to prevent flicker
    requestAnimationFrame(() => {
      // Update operations BEFORE history
      set(operationsAtom, [...get(operationsAtom), operation])

      // Then update game state and add to history
      set(gameStateAtom, newState)
      addToHistory(get, set, newState)

      // Also record to replay operations if recording
      if (get(replayRecordingAtom)) {
        set(replayOperationsAtom, [...get(replayOperationsAtom), operation])
      }
    })
  }
})

export const toggleCardHighlightAtom = atom(null, (get, set, position: Position) => {
  const state = get(gameStateAtom)
  const newState = performCardHighlightToggle(state, position)

  if (newState !== state) {
    // Create operation BEFORE adding to history
    const operation: GameOperation = {
      id: uuidv4(),
      timestamp: Date.now(),
      type: "toggleHighlight",
      cardId: position.cardId,
      to: {
        player: position.zone.player,
        zoneType: position.zone.type,
        zoneIndex: position.zone.index,
      },
      player: position.zone.player,
    }

    // Update operations BEFORE history
    set(operationsAtom, [...get(operationsAtom), operation])

    // Then update game state and add to history
    set(gameStateAtom, newState)
    addToHistory(get, set, newState)

    // Also record to replay operations if recording
    if (get(replayRecordingAtom)) {
      set(replayOperationsAtom, [...get(replayOperationsAtom), operation])
    }

    // Create highlight animation for immediate feedback
    const player = newState.players[position.zone.player]
    const result = getCardById(player, position.cardId)
    if (result && result.card.highlighted === true) {
      // Only create animation when turning highlight ON
      const cardRect = getCardRect(position.cardId, get)

      if (cardRect) {
        const animationId = uuidv4()
        const animation: CardAnimation = {
          id: animationId,
          type: "highlight",
          cardId: position.cardId,
          cardImageUrl: result.card.imageUrl,
          position,
          cardRect,
          cardRotation: result.card.rotation,
          startTime: Date.now(),
          duration: ANIM.HIGHLIGHT.ANIMATION,
        }

        // Add animation without checking for duplicates (like target/activate)
        const existingAnimations = get(cardAnimationsAtom)
        set(cardAnimationsAtom, [...existingAnimations, animation])
      }
    }
  }
})
