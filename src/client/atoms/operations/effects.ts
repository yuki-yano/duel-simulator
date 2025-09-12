import { atom } from "jotai"
import type { Card, GameOperation, Position } from "../../../shared/types/game"
import { gameStateAtom } from "../core/gameState"
import { operationsAtom } from "../core/operations"
import { performUpdateCounter } from "../helpers/stateHelpers"
import { getCardById } from "../helpers/cardHelpers"
import { v4 as uuidv4 } from "uuid"
import { TOKEN_IMAGE_DATA_URL } from "@/client/constants/tokenImage"

import { addToHistory } from "../history/historyStack"
import { replayRecordingAtom, replayOperationsAtom } from "../replay/recording"
import { cardAnimationsAtom } from "../replay/animations"

export const updateCounterAtom = atom(null, (get, set, position: Position, counterValue: number) => {
  const state = get(gameStateAtom)
  const newState = performUpdateCounter(state, position, counterValue)

  if (newState !== state) {
    // Create operation BEFORE adding to history
    const operation: GameOperation = {
      id: uuidv4(),
      timestamp: Date.now(),
      type: "updateCounter",
      cardId: position.cardId,
      to: {
        player: position.zone.player,
        zoneType: position.zone.type,
        zoneIndex: position.zone.index,
      },
      player: position.zone.player,
      metadata: { counter: counterValue },
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
  }
})

// Card effect activation action
export const activateEffectAtom = atom(null, (get, set, position: Position, cardElement?: HTMLElement) => {
  try {
    // Get the card at this position to get its ID
    const state = get(gameStateAtom)
    const playerBoard = state.players[position.zone.player]
    let card: Card | null = null

    // Use ID-based approach (cardId is now required)
    const cardId = position.cardId || position.zone.cardId
    if (cardId === undefined) {
      console.error("No cardId provided to activateEffectAtom")
      return
    }
    const result = getCardById(playerBoard, cardId)
    if (result !== null) {
      card = result.card
    }

    // Add card ID to position for zoom effect
    const positionWithCardId = {
      ...position,
      zone: {
        ...position.zone,
        cardId: card?.id,
      },
    }

    // Effect activation doesn't change game state, only visual effect
    const operation: GameOperation = {
      id: uuidv4(),
      timestamp: Date.now(),
      type: "activate",
      cardId: position.cardId,
      to: {
        player: position.zone.player,
        zoneType: position.zone.type,
        zoneIndex: position.zone.index,
      },
      player: position.zone.player,
    }

    set(operationsAtom, [...get(operationsAtom), operation])

    // Also record to replay operations if recording
    if (get(replayRecordingAtom)) {
      set(replayOperationsAtom, [...get(replayOperationsAtom), operation])
    }

    // Get card position if element is provided
    const cardRect = cardElement ? cardElement.getBoundingClientRect() : null

    // Trigger visual effect animation
    const animations = get(cardAnimationsAtom)
    const animationId = uuidv4()

    const newAnimation = {
      id: animationId,
      type: "activate" as const,
      cardId: card?.id,
      position: positionWithCardId,
      cardImageUrl: card?.name === "token" ? TOKEN_IMAGE_DATA_URL : card?.imageUrl,
      cardRect: cardRect
        ? {
            x: cardRect.x,
            y: cardRect.y,
            width: cardRect.width,
            height: cardRect.height,
          }
        : undefined,
      cardRotation: card?.rotation,
      startTime: Date.now(),
    }

    set(cardAnimationsAtom, [...animations, newAnimation])

    // Add to history for undo/redo support (same gameState, but new operation)
    const currentState = get(gameStateAtom)
    addToHistory(get, set, currentState)
  } catch (error) {
    console.error("Error in activateEffectAtom:", error)
    throw error
  }
})

// Target selection action (same as effect activation for now)
export const targetSelectAtom = atom(null, (get, set, position: Position, cardElement?: HTMLElement) => {
  try {
    // Get the card at this position to get its ID
    const state = get(gameStateAtom)
    const playerBoard = state.players[position.zone.player]
    let card: Card | null = null
    // Use ID-based approach (cardId is now required)
    const cardId = position.cardId || position.zone.cardId
    if (cardId === undefined) {
      console.error("No cardId provided to targetSelectAtom")
      return
    }
    const result = getCardById(playerBoard, cardId)
    if (result !== null) {
      card = result.card
    }
    // Add card ID to position for zoom effect
    const positionWithCardId = {
      ...position,
      zone: {
        ...position.zone,
        cardId: card?.id,
      },
    }
    // Target selection doesn't change game state, only visual effect
    const operation: GameOperation = {
      id: uuidv4(),
      timestamp: Date.now(),
      type: "target",
      cardId: position.cardId,
      to: {
        player: position.zone.player,
        zoneType: position.zone.type,
        zoneIndex: position.zone.index,
      },
      player: position.zone.player,
    }
    set(operationsAtom, [...get(operationsAtom), operation])
    // Also record to replay operations if recording
    if (get(replayRecordingAtom)) {
      set(replayOperationsAtom, [...get(replayOperationsAtom), operation])
    }
    // Get card position if element is provided
    const cardRect = cardElement ? cardElement.getBoundingClientRect() : null
    // Trigger visual effect animation
    const animations = get(cardAnimationsAtom)
    const animationId = uuidv4()
    const newAnimation = {
      id: animationId,
      type: "target" as const,
      cardId: card?.id,
      cardImageUrl: card?.imageUrl,
      position: positionWithCardId,
      cardRect: cardRect
        ? {
            x: cardRect.x,
            y: cardRect.y,
            width: cardRect.width,
            height: cardRect.height,
          }
        : undefined,
      cardRotation: card?.rotation,
      startTime: Date.now(),
    }
    set(cardAnimationsAtom, [...animations, newAnimation])
    // Add to history for undo/redo support (same gameState, but new operation)
    const currentState = get(gameStateAtom)
    addToHistory(get, set, currentState)
  } catch (error) {
    console.error("Error in targetSelectAtom:", error)
    throw error
  }
})

// Card negate effect action
export const negateEffectAtom = atom(null, (get, set, position: Position, cardElement?: HTMLElement) => {
  try {
    // Get the card at this position to get its ID
    const state = get(gameStateAtom)
    const playerBoard = state.players[position.zone.player]
    let card: Card | null = null

    // Use ID-based approach (cardId is now required)
    const cardId = position.cardId || position.zone.cardId
    if (cardId === undefined) {
      console.error("No cardId provided to negateEffectAtom")
      return
    }
    const result = getCardById(playerBoard, cardId)
    if (result !== null) {
      card = result.card
    }

    // Add card ID to position for negate effect
    const positionWithCardId = {
      ...position,
      zone: {
        ...position.zone,
        cardId: card?.id,
      },
    }

    // Negate effect doesn't change game state, only visual effect
    const operation: GameOperation = {
      id: uuidv4(),
      timestamp: Date.now(),
      type: "negate",
      cardId: position.cardId,
      to: {
        player: position.zone.player,
        zoneType: position.zone.type,
        zoneIndex: position.zone.index,
      },
      player: position.zone.player,
    }

    set(operationsAtom, [...get(operationsAtom), operation])

    // Also record to replay operations if recording
    if (get(replayRecordingAtom)) {
      set(replayOperationsAtom, [...get(replayOperationsAtom), operation])
    }

    // Get card position if element is provided
    const cardRect = cardElement ? cardElement.getBoundingClientRect() : null

    // Trigger visual effect animation
    const animations = get(cardAnimationsAtom)
    const animationId = uuidv4()

    const newAnimation = {
      id: animationId,
      type: "negate" as const,
      cardId: card?.id,
      position: positionWithCardId,
      cardImageUrl: card?.name === "token" ? TOKEN_IMAGE_DATA_URL : card?.imageUrl,
      cardRect: cardRect
        ? {
            x: cardRect.x,
            y: cardRect.y,
            width: cardRect.width,
            height: cardRect.height,
          }
        : undefined,
      cardRotation: card?.rotation,
      startTime: Date.now(),
    }

    set(cardAnimationsAtom, [...animations, newAnimation])

    // Add to history for undo/redo support (same gameState, but new operation)
    const currentState = get(gameStateAtom)
    addToHistory(get, set, currentState)
  } catch (error) {
    console.error("Error in negateEffectAtom:", error)
    throw error
  }
})

// Note: toggleCardHighlightAtom has been moved to rotation.ts
// as it's more related to card state changes like rotation and flip
