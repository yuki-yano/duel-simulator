import { atom } from "jotai"
import { v4 as uuidv4 } from "uuid"
import type { CardAnimation, Getter } from "../types"
import type { GameState, GameOperation, Card } from "@/shared/types/game"
import { cardRefsAtom } from "../ui/domRefs"
import { getCardById } from "../helpers/cardHelpers"
import { TOKEN_IMAGE_DATA_URL } from "@/client/constants/tokenImage"
import { ANIM } from "@/client/constants/animation"

// Animation state atom
export const cardAnimationsAtom = atom<CardAnimation[]>([])

// Replay speed control
export const replaySpeedAtom = atom<number>(1) // Default 1x speed
export const replayStartDelayAtom = atom<number>(0.5) // Default 0.5 seconds delay

// Get animation duration based on current speed multiplier
export function getAnimationDuration(baseDuration: number, get: Getter): number {
  const speed = get(replaySpeedAtom)
  return Math.round(baseDuration / speed)
}

// Get card element position
export function getCardElementPosition(cardId: string, get: Getter): { x: number; y: number } | null {
  const cardRefs = get(cardRefsAtom)
  const element = cardRefs.get(cardId)
  if (!element) return null
  const rect = element.getBoundingClientRect()
  return { x: rect.x, y: rect.y }
}

// Get card rect
export function getCardRect(cardId: string | undefined, get: Getter): { x: number; y: number; width: number; height: number } | undefined {
  if (cardId === undefined || cardId === null || cardId === "") return undefined
  const cardRefs = get(cardRefsAtom)
  const element = cardRefs.get(cardId)
  if (!element) return undefined
  const rect = element.getBoundingClientRect()
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  }
}

// Create move animation
export function createMoveAnimation(
  card: Card,
  fromPosition: { x: number; y: number },
  toPosition: { x: number; y: number },
  fromRotation: number,
  toRotation: number,
  duration: number
): CardAnimation {
  return {
    id: uuidv4(),
    type: "move",
    cardId: card.id,
    cardImageUrl: card.name === "token" ? TOKEN_IMAGE_DATA_URL : card.imageUrl,
    fromPosition,
    toPosition,
    fromRotation,
    toRotation,
    startTime: Date.now(),
    duration,
  }
}

// Create rotate animation
export function createRotateAnimation(
  cardId: string,
  cardImageUrl: string,
  cardRect: { x: number; y: number; width: number; height: number },
  fromRotation: number,
  toRotation: number
): CardAnimation {
  return {
    id: uuidv4(),
    type: "rotate",
    cardId,
    cardImageUrl,
    cardRect,
    fromRotation,
    toRotation,
    startTime: Date.now(),
    duration: ANIM.ROTATION.ANIMATION,
  }
}

// Create activate animation
export function createActivateAnimation(
  operation: GameOperation,
  currentState: GameState,
  get: Getter
): CardAnimation | null {
  if (!operation.to || !operation.cardId) return null

  const cardRect = getCardRect(operation.cardId, get)
  
  let cardRotation: number | undefined = 0
  let cardImageUrl: string | undefined
  
  const player = currentState.players[operation.to.player]
  const result = getCardById(player, operation.cardId)
  if (result) {
    cardRotation = result.card.rotation
    cardImageUrl = result.card.name === "token" ? TOKEN_IMAGE_DATA_URL : result.card.imageUrl
  }

  const position = {
    zone: {
      player: operation.to.player,
      type: operation.to.zoneType,
      index: operation.to.zoneIndex,
      cardId: operation.cardId,
    },
    cardId: operation.cardId,
  }

  return {
    id: uuidv4(),
    type: "activate",
    cardId: operation.cardId,
    cardImageUrl,
    position,
    cardRect,
    cardRotation,
    startTime: Date.now(),
  }
}

// Create target animation
export function createTargetAnimation(
  operation: GameOperation,
  currentState: GameState,
  get: Getter
): CardAnimation | null {
  if (!operation.to || !operation.cardId) return null

  const cardRect = getCardRect(operation.cardId, get)
  
  let cardRotation: number | undefined = 0
  let cardImageUrl: string | undefined
  
  const player = currentState.players[operation.to.player]
  const result = getCardById(player, operation.cardId)
  if (result) {
    cardRotation = result.card.rotation
    cardImageUrl = result.card.imageUrl
  }

  const position = {
    zone: {
      player: operation.to.player,
      type: operation.to.zoneType,
      index: operation.to.zoneIndex,
      cardId: operation.cardId,
    },
    cardId: operation.cardId,
  }

  return {
    id: uuidv4(),
    type: "target",
    cardId: operation.cardId,
    cardImageUrl,
    position,
    cardRect,
    cardRotation,
    startTime: Date.now(),
    duration: ANIM.TARGET.ANIMATION,
  }
}

// Create highlight animation
export function createHighlightAnimation(
  operation: GameOperation,
  currentState: GameState,
  get: Getter
): CardAnimation | null {
  if (!operation.to || !operation.cardId) return null

  const cardRect = getCardRect(operation.cardId, get)
  
  let cardRotation: number | undefined = 0
  let cardImageUrl: string | undefined
  
  const player = currentState.players[operation.to.player]
  const result = getCardById(player, operation.cardId)
  if (result) {
    cardRotation = result.card.rotation
    cardImageUrl = result.card.imageUrl
  }

  return {
    id: uuidv4(),
    type: "highlight",
    cardId: operation.cardId,
    cardImageUrl,
    cardRect,
    cardRotation,
    startTime: Date.now(),
    duration: ANIM.HIGHLIGHT.ANIMATION,
  }
}