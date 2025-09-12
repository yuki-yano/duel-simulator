import { atom } from "jotai"
import { v4 as uuidv4 } from "uuid"
import type { CardAnimation, Getter, Setter, Position } from "../types"
import type { GameState, GameOperation, Card } from "@/shared/types/game"
import { cardRefsAtom } from "../ui/domRefs"
import { getCardById } from "../helpers/cardHelpers"
import { TOKEN_IMAGE_DATA_URL } from "@/client/constants/tokenImage"
import { ANIM } from "@/client/constants/animation"
import { gameStateAtom } from "../core/gameState"

// Animation state atom
export const cardAnimationsAtom = atom<CardAnimation[]>([])

// Animation cancellation controller
export let animationController: AbortController | null = null

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
export function getCardRect(
  cardId: string | undefined,
  get: Getter,
): { x: number; y: number; width: number; height: number } | undefined {
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
  duration: number,
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
  toRotation: number,
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
  get: Getter,
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

// Create negate animation
export function createNegateAnimation(
  operation: GameOperation,
  currentState: GameState,
  get: Getter,
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
    type: "negate",
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
  get: Getter,
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
  get: Getter,
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

// Helper function to create animations from operations
export function createAnimationsFromOperations(
  operations: GameOperation[],
  prevState: GameState,
  nextState: GameState,
  isReverse: boolean = false,
  speedMultiplier: number = 1,
  get: Getter,
): CardAnimation[] {
  const animations: CardAnimation[] = []
  const animationDuration = Math.floor((ANIM.MOVE.ANIMATION * 2) / (3 * speedMultiplier))

  for (const operation of operations) {
    switch (operation.type) {
      case "move":
      case "summon":
      case "set":
      case "draw": {
        let cardImageUrl: string | undefined
        let fromRotation = 0
        let toRotation = 0

        if (isReverse) {
          // Undo animation: animate from current position (operation.to) back to original position (operation.from)
          if (operation.to) {
            const currentPlayer = prevState.players[operation.to.player]
            const currentCard = getCardById(currentPlayer, operation.cardId)
            if (currentCard) {
              cardImageUrl = currentCard.card.name === "token" ? TOKEN_IMAGE_DATA_URL : currentCard.card.imageUrl
              fromRotation = currentCard.card.rotation ?? 0
            }
          }

          if (operation.from) {
            const targetPlayer = nextState.players[operation.from.player]
            const targetCard = getCardById(targetPlayer, operation.cardId)
            if (targetCard) {
              toRotation = targetCard.card.rotation ?? 0
            }
          }
        } else {
          // Forward animation: animate from operation.from to operation.to
          const fromPlayerKey = operation.from?.player ?? operation.player
          const fromPlayer = prevState.players[fromPlayerKey]
          const fromCard = getCardById(fromPlayer, operation.cardId)
          if (fromCard) {
            cardImageUrl = fromCard.card.name === "token" ? TOKEN_IMAGE_DATA_URL : fromCard.card.imageUrl
            fromRotation = fromCard.card.rotation ?? 0
          }

          if (operation.to) {
            const toPlayer = nextState.players[operation.to.player]
            const toCard = getCardById(toPlayer, operation.cardId)
            if (toCard) {
              toRotation = toCard.card.rotation ?? 0
            }
          }
        }

        // Get card element position before state change
        const cardPos = getCardElementPosition(operation.cardId, get)
        if (cardPos && cardImageUrl !== undefined) {
          animations.push({
            id: uuidv4(),
            type: "move",
            cardId: operation.cardId,
            cardImageUrl,
            fromPosition: cardPos,
            toPosition: cardPos, // Will be updated after state change
            fromRotation,
            toRotation,
            startTime: Date.now(),
            duration: animationDuration,
          })
        }
        break
      }

      case "rotate":
        if (operation.metadata && "angle" in operation.metadata) {
          // prev / next のカード回転角を取得
          const prevPlayer = prevState.players[operation.player]
          const nextPlayer = nextState.players[operation.player]

          const prevCardRes = getCardById(prevPlayer, operation.cardId)
          const nextCardRes = getCardById(nextPlayer, operation.cardId)

          const fromRotation = prevCardRes?.card.rotation ?? 0
          const toRotation = nextCardRes?.card.rotation ?? (operation.metadata.angle as number)

          // Get card element rect (位置は prevState 時点で取得)
          const cardRect = getCardRect(operation.cardId, get)

          // Get card image URL (優先的に prev → next の順で取得)
          let cardImageUrl: string | undefined
          const cardForImage = prevCardRes?.card ?? nextCardRes?.card
          if (cardForImage) {
            cardImageUrl = cardForImage.name === "token" ? TOKEN_IMAGE_DATA_URL : cardForImage.imageUrl
          }

          animations.push({
            id: uuidv4(),
            type: "rotate",
            cardId: operation.cardId,
            cardImageUrl,
            cardRect,
            fromRotation,
            toRotation,
            startTime: Date.now(),
            duration: animationDuration / 2,
          })
        }
        break

      case "changePosition":
        if (operation.to) {
          // Get card element position
          const cardRect = getCardRect(operation.cardId, get)

          const position: Position = {
            zone: {
              player: operation.to.player,
              type: operation.to.zoneType,
              index: operation.to.zoneIndex,
              cardId: operation.cardId,
            },
            cardId: operation.cardId,
          }

          animations.push({
            id: uuidv4(),
            type: "changePosition",
            cardId: operation.cardId,
            position,
            cardRect,
            startTime: Date.now(),
            duration: animationDuration / 2,
          })
        }
        break

      case "toggleHighlight":
        if (operation.to) {
          const position: Position = {
            zone: {
              player: operation.to.player,
              type: operation.to.zoneType,
              index: operation.to.zoneIndex,
              cardId: operation.cardId,
            },
            cardId: operation.cardId,
          }

          // Card rect
          const cardRect = getCardRect(operation.cardId, get)

          // Rotation & image
          let cardRotation: number | undefined = 0
          let cardImageUrl: string | undefined
          if (operation.cardId) {
            const state = isReverse ? prevState : nextState
            const player = state.players[operation.to.player]
            const res = getCardById(player, operation.cardId)
            if (res) {
              cardRotation = res.card.rotation
              cardImageUrl = res.card.imageUrl
            }
          }

          animations.push({
            id: uuidv4(),
            type: "highlight",
            cardId: operation.cardId,
            cardImageUrl,
            position,
            cardRect,
            cardRotation,
            startTime: Date.now(),
            duration: animationDuration / 2,
          })
        }
        break

      case "activate":
        if (operation.to) {
          // Get card element position
          const cardRect = getCardRect(operation.cardId, get)

          // Get card rotation from state
          let cardRotation: number | undefined = 0
          const state = isReverse ? prevState : nextState
          const player = state.players[operation.to.player]
          const result = getCardById(player, operation.cardId)
          if (result) {
            cardRotation = result.card.rotation
          }

          const position: Position = {
            zone: {
              player: operation.to.player,
              type: operation.to.zoneType,
              index: operation.to.zoneIndex,
              cardId: operation.cardId,
            },
            cardId: operation.cardId,
          }

          let cardImageUrl: string | undefined
          if (result) {
            cardImageUrl = result.card.imageUrl
          }

          animations.push({
            id: uuidv4(),
            type: "activate",
            cardId: operation.cardId,
            cardImageUrl,
            position,
            cardRect,
            cardRotation,
            startTime: Date.now(),
            duration: animationDuration,
          })
        }
        break

      case "target":
        if (operation.to) {
          // Get card element position
          const cardRect = getCardRect(operation.cardId, get)

          // Get card rotation from state
          let cardRotation: number | undefined = 0
          const state = isReverse ? prevState : nextState
          const player = state.players[operation.to.player]
          const result = getCardById(player, operation.cardId)
          if (result) {
            cardRotation = result.card.rotation
          }

          const position: Position = {
            zone: {
              player: operation.to.player,
              type: operation.to.zoneType,
              index: operation.to.zoneIndex,
              cardId: operation.cardId,
            },
            cardId: operation.cardId,
          }

          let cardImageUrl: string | undefined
          if (result) {
            cardImageUrl = result.card.imageUrl
          }

          animations.push({
            id: uuidv4(),
            type: "target",
            cardId: operation.cardId,
            cardImageUrl,
            position,
            cardRect,
            cardRotation,
            startTime: Date.now(),
            duration: animationDuration,
          })
        }
        break

      case "negate":
        if (operation.to) {
          // Get card element position
          const cardRect = getCardRect(operation.cardId, get)

          // Get card rotation from state
          let cardRotation: number | undefined = 0
          const state = isReverse ? prevState : nextState
          const player = state.players[operation.to.player]
          const result = getCardById(player, operation.cardId)
          if (result) {
            cardRotation = result.card.rotation
          }

          const position: Position = {
            zone: {
              player: operation.to.player,
              type: operation.to.zoneType,
              index: operation.to.zoneIndex,
              cardId: operation.cardId,
            },
            cardId: operation.cardId,
          }

          let cardImageUrl: string | undefined
          if (result) {
            cardImageUrl = result.card.name === "token" ? TOKEN_IMAGE_DATA_URL : result.card.imageUrl
          }

          animations.push({
            id: uuidv4(),
            type: "negate",
            cardId: operation.cardId,
            cardImageUrl,
            position,
            cardRect,
            cardRotation,
            startTime: Date.now(),
            duration: animationDuration,
          })
        }
        break
    }
  }

  return animations
}

// Helper function to play animations from operations
export async function playOperationAnimations(
  get: Getter,
  set: Setter,
  operations: GameOperation[],
  fromState: GameState,
  toState: GameState,
  isReverse: boolean = false,
  speedMultiplier: number = 1,
): Promise<void> {
  // Cancel any existing animation
  if (animationController) {
    animationController.abort()
  }

  // Create new controller for this animation
  animationController = new AbortController()
  const signal = animationController.signal

  // Create animations from operations
  const animations = createAnimationsFromOperations(operations, fromState, toState, isReverse, speedMultiplier, get)

  if (animations.length === 0) return

  try {
    // Set initial animations
    set(cardAnimationsAtom, animations)

    // Apply new state
    set(gameStateAtom, toState)

    // Small delay to ensure DOM is updated
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(resolve, 50)
      signal.addEventListener("abort", () => {
        clearTimeout(timeout)
        reject(new DOMException("Animation cancelled"))
      })
    })

    // Update move animations with actual end positions
    const updatedAnimations = animations.map((anim) => {
      if (anim.type === "move" && anim.cardId !== undefined) {
        const nextPos = getCardElementPosition(anim.cardId, get)
        return nextPos ? { ...anim, toPosition: nextPos } : anim
      }
      return anim
    })

    // Update animations with correct end positions
    set(cardAnimationsAtom, updatedAnimations)

    // Wait for animation to complete
    const animationDuration = Math.floor((ANIM.MOVE.ANIMATION * 2) / (3 * speedMultiplier))
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(resolve, animationDuration)
      signal.addEventListener("abort", () => {
        clearTimeout(timeout)
        reject(new DOMException("Animation cancelled"))
      })
    })
  } catch (e) {
    if (e instanceof DOMException && e.message === "Animation cancelled") {
      // アニメーションキャンセル時に即座にオーバーレイを消すと
      // 次のアニメーションがセットされるまでの間に空白フレームが発生し
      // チラつきの原因になるため何もしない。
      // 次の playOperationAnimations 呼び出しで cardAnimationsAtom が
      // 上書きされるので自然に置き換わる。
    } else {
      throw e
    }
  } finally {
    // Clean up controller reference
    if (animationController?.signal === signal) {
      animationController = null
    }
  }
}
