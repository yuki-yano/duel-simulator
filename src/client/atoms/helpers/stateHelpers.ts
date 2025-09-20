import { produce } from "immer"
import { INITIAL_GAME_VALUES } from "@/shared/constants/game"
import type { Card, GameState, PlayerBoard, Position, ZoneId, GameOperation } from "@/shared/types/game"
import { getCardById } from "./cardHelpers"
import { removeCardFromZoneById, addCardToZone, updateCardInZone } from "./zoneHelpers"

// Create initial player board
export const createInitialPlayerBoard = (): PlayerBoard => ({
  monsterZones: Array(5)
    .fill(null)
    .map(() => []),
  spellTrapZones: Array(5)
    .fill(null)
    .map(() => []),
  fieldZone: null,
  graveyard: [],
  banished: [],
  extraDeck: [],
  deck: [],
  hand: [],
  extraMonsterZones: Array(2)
    .fill(null)
    .map(() => []),
  freeZone: [], // フィールド下のフリーゾーン
  sideFreeZone: [], // 左側のフリーゾーン（1024px以上）
  sideDeck: [], // サイドデッキ
  lifePoints: INITIAL_GAME_VALUES.LIFE_POINTS,
})

// Create initial game state
export const createInitialGameState = (): GameState => ({
  players: {
    self: createInitialPlayerBoard(),
    opponent: createInitialPlayerBoard(),
  },
  turn: 1,
  phase: "main1",
  currentPlayer: "self",
})

// Perform card move
export function performCardMove(
  state: GameState,
  from: Position,
  to: Position,
  options?: {
    shiftKey?: boolean
    defenseMode?: boolean
    faceDownMode?: boolean
    stackPosition?: "top" | "bottom"
    preventSameZoneReorder?: boolean
  },
): GameState {
  return produce(state, (draft) => {
    const fromPlayer = state.players[from.zone.player]
    const toPlayer = state.players[to.zone.player]

    // Get card by ID (cardId is now required)
    let card: Card | null = null
    let actualFromZone: ZoneId = from.zone

    // ID-based approach
    const result = getCardById(fromPlayer, from.cardId)
    if (result) {
      card = result.card
      actualFromZone = { ...result.zone, player: from.zone.player }
    }

    if (!card) {
      return state
    }

    // Update card's zone information
    // Reset rotation if moving to a zone that doesn't support rotation
    const supportsRotation =
      to.zone.type === "monsterZone" || to.zone.type === "spellTrapZone" || to.zone.type === "extraMonsterZone"

    // Apply rotation and face down state based on options
    let rotation = card.rotation
    let faceDown = card.faceDown

    // フリーゾーンへの移動時は守備表示・裏側表示を無効化
    if (to.zone.type === "freeZone" || to.zone.type === "sideFreeZone") {
      rotation = 0
      faceDown = false
    } else if (supportsRotation) {
      // Handle PC shift key (both defense and face down)
      if (options?.shiftKey === true) {
        // Monster zones: Face up defense position (表側守備表示)
        if (to.zone.type === "monsterZone" || to.zone.type === "extraMonsterZone") {
          rotation = -90
          faceDown = false
        }
        // Spell/Trap zones: Face down (裏側表示)
        else if (to.zone.type === "spellTrapZone") {
          rotation = 0
          faceDown = true
        }
      }
      // Handle mobile toggle buttons separately
      else if (options?.defenseMode === true || options?.faceDownMode === true) {
        // Monster zones
        if (to.zone.type === "monsterZone" || to.zone.type === "extraMonsterZone") {
          if (options.defenseMode === true) {
            rotation = -90 // Defense position
            faceDown = false // Face up
          }
          if (options.faceDownMode === true) {
            faceDown = true // Face down (keep current rotation)
          }
        }
        // Spell/Trap zones
        else if (to.zone.type === "spellTrapZone") {
          rotation = 0 // Always upright
          if (options.faceDownMode === true) {
            faceDown = true // Face down
          } else {
            faceDown = false // Face up
          }
        }
      } else if (to.zone.type === "spellTrapZone") {
        // When moving to spell/trap zone without any options, set to face up
        rotation = 0
        faceDown = false
      }
    }
    // Field zone: Handle face down with shift key or mobile face down mode
    else if (to.zone.type === "fieldZone") {
      if (options?.shiftKey === true || options?.faceDownMode === true) {
        rotation = 0
        faceDown = true
      } else {
        rotation = 0
        faceDown = false
      }
    } else {
      rotation = 0
      faceDown = false
    }

    const updatedCard = produce(card, (draft) => {
      draft.rotation = rotation
      draft.faceDown = faceDown
    })

    // Remove card from source location using card ID and index
    // Use cardIndex from 'from' parameter if available (for stacked cards), otherwise use the one from getCardById
    const cardIndex = from.zone.cardIndex ?? actualFromZone.cardIndex
    const newFromPlayer = removeCardFromZoneById(fromPlayer, actualFromZone, card.id, cardIndex)

    // Determine if this is a cross-zone move
    // For zones with index (monster, spell/trap, EMZ), check both type and index
    // For zones without index (hand, deck, etc), only check type
    const hasIndex =
      actualFromZone.type === "monsterZone" ||
      actualFromZone.type === "spellTrapZone" ||
      actualFromZone.type === "extraMonsterZone"
    const isCrossZoneMove = hasIndex
      ? actualFromZone.type !== to.zone.type || actualFromZone.index !== to.zone.index
      : actualFromZone.type !== to.zone.type

    // Check if preventSameZoneReorder is enabled and this is the same zone
    if (options?.preventSameZoneReorder === true && !isCrossZoneMove && actualFromZone.player === to.zone.player) {
      // Prevent reordering within the same zone
      return state
    }

    // For zone-specific moves, keep the index for certain zone types
    const shouldKeepIndex =
      to.zone.type === "monsterZone" || to.zone.type === "spellTrapZone" || to.zone.type === "extraMonsterZone"

    let targetZone =
      isCrossZoneMove && !shouldKeepIndex
        ? { ...to.zone, index: undefined } // Clear index for non-zone-specific cross-zone moves
        : to.zone // Keep index for same-zone moves and zone-specific moves

    // Calculate cardIndex based on stackPosition for stackable zones
    if (shouldKeepIndex && targetZone.index !== undefined) {
      // Always use the original toPlayer state to get the correct card count
      let existingCards: Card[] = []

      // Get existing cards in the target zone
      if (to.zone.type === "monsterZone") {
        existingCards = toPlayer.monsterZones[targetZone.index] ?? []
      } else if (to.zone.type === "spellTrapZone") {
        existingCards = toPlayer.spellTrapZones[targetZone.index] ?? []
      } else if (to.zone.type === "extraMonsterZone") {
        existingCards = toPlayer.extraMonsterZones[targetZone.index] ?? []
      }

      // Set cardIndex based on stackPosition
      if (options?.stackPosition === "bottom") {
        targetZone = { ...targetZone, cardIndex: existingCards.length }
      } else {
        // Default to top (index 0)
        targetZone = { ...targetZone, cardIndex: 0 }
      }
    } else if (to.zone.type === "freeZone") {
      // Also handle stackPosition for free zones
      // Always use the original toPlayer state to get the correct card count
      const existingCards = toPlayer.freeZone ?? []

      if (options?.stackPosition === "bottom") {
        targetZone = { ...targetZone, cardIndex: existingCards.length }
      } else {
        // Default to top (index 0)
        targetZone = { ...targetZone, cardIndex: 0 }
      }
    }

    // Check if field zone is already occupied
    if (to.zone.type === "fieldZone") {
      const targetPlayer = to.zone.player === from.zone.player ? newFromPlayer : toPlayer
      if (targetPlayer.fieldZone !== null) {
        // Field zone already occupied - cancel the move
        return state
      }
    }

    // Add card to new location
    const newToPlayer = addCardToZone(
      from.zone.player === to.zone.player ? newFromPlayer : toPlayer,
      targetZone,
      updatedCard,
    )

    // Update the draft state
    draft.players[from.zone.player] = newFromPlayer
    draft.players[to.zone.player] = newToPlayer
  })
}

// Perform card rotation
export function performCardRotation(state: GameState, position: Position, angle: number): GameState {
  const player = state.players[position.zone.player]

  // Get card by ID (cardId is now required)
  let card: Card | null = null
  let actualZone: ZoneId = position.zone

  // ID-based approach
  const result = getCardById(player, position.cardId)
  if (result) {
    card = result.card
    actualZone = { ...result.zone, player: position.zone.player }
  }

  if (!card) return state

  const rotatedCard = produce(card, (draft) => {
    draft.rotation = angle
  })
  const newPlayer = updateCardInZone(player, actualZone, rotatedCard)

  return {
    ...state,
    players: {
      ...state.players,
      [position.zone.player]: newPlayer,
    },
  }
}

// Perform card flip (face up/down)
export function performCardFlip(state: GameState, position: Position): GameState {
  const player = state.players[position.zone.player]

  // Get card by ID (cardId is now required)
  let card: Card | null = null
  let actualZone: ZoneId = position.zone

  // ID-based approach
  const result = getCardById(player, position.cardId)
  if (result) {
    card = result.card
    actualZone = { ...result.zone, player: position.zone.player }
  }

  if (!card) return state

  const flippedCard = produce(card, (draft) => {
    draft.faceDown = !(draft.faceDown === true)
  })
  const newPlayer = updateCardInZone(player, actualZone, flippedCard)

  return {
    ...state,
    players: {
      ...state.players,
      [position.zone.player]: newPlayer,
    },
  }
}

// Perform card highlight toggle
export function performCardHighlightToggle(state: GameState, position: Position): GameState {
  const player = state.players[position.zone.player]

  // Get card by ID (cardId is now required)
  let card: Card | null = null
  let actualZone: ZoneId = position.zone

  // ID-based approach
  const result = getCardById(player, position.cardId)
  if (result) {
    card = result.card
    actualZone = { ...result.zone, player: position.zone.player }
  }

  if (!card) return state

  const highlightedCard = produce(card, (draft) => {
    draft.highlighted = !(draft.highlighted === true)
  })
  const newPlayer = updateCardInZone(player, actualZone, highlightedCard)

  return {
    ...state,
    players: {
      ...state.players,
      [position.zone.player]: newPlayer,
    },
  }
}

// Perform update counter
export function performUpdateCounter(state: GameState, position: Position, counterValue: number): GameState {
  const player = state.players[position.zone.player]

  // Get card by ID (cardId is now required)
  let card: Card | null = null
  let actualZone: ZoneId = position.zone

  // ID-based approach
  const result = getCardById(player, position.cardId)
  if (result) {
    card = result.card
    actualZone = { ...result.zone, player: position.zone.player }
  }

  if (!card) return state

  const updatedCard = produce(card, (draft) => {
    draft.counter = counterValue > 0 ? counterValue : undefined
  })
  const newPlayer = updateCardInZone(player, actualZone, updatedCard)

  return {
    ...state,
    players: {
      ...state.players,
      [position.zone.player]: newPlayer,
    },
  }
}

// Apply operation to state
export function applyOperation(state: GameState, operation: GameOperation): GameState {
  let newState = state

  switch (operation.type) {
    case "move":
      if (operation.from && operation.to && operation.cardId) {
        // Reconstruct Position objects from the new operation structure
        const fromPosition: Position = {
          zone: {
            player: operation.from.player,
            type: operation.from.zoneType,
            index: operation.from.zoneIndex,
          },
          cardId: operation.cardId,
        }
        const toPosition: Position = {
          zone: {
            player: operation.to.player,
            type: operation.to.zoneType,
            index: operation.to.insertPosition === "last" ? undefined : operation.to.insertPosition,
          },
          cardId: operation.cardId,
        }
        // Perform the move operation with options (for shift key state)
        const options = operation.metadata as
          | { shiftKey?: boolean; defenseMode?: boolean; faceDownMode?: boolean; stackPosition?: "top" | "bottom" }
          | undefined
        newState = performCardMove(state, fromPosition, toPosition, options)
        return newState
      }
      break
    case "rotate":
      if (
        operation.to &&
        operation.metadata &&
        "angle" in operation.metadata &&
        typeof operation.metadata.angle === "number" &&
        operation.cardId
      ) {
        // Reconstruct Position object
        const position: Position = {
          zone: {
            player: operation.to.player,
            type: operation.to.zoneType,
            index: operation.to.zoneIndex,
          },
          cardId: operation.cardId,
        }
        newState = performCardRotation(state, position, operation.metadata.angle)
        return newState
      }
      break
    case "summon":
      // Handle token summon operations
      if (operation.to && operation.cardId && operation.metadata && "isToken" in operation.metadata) {
        const metadata = operation.metadata as { isToken: boolean; tokenCard?: Card }
        if (metadata.isToken && metadata.tokenCard) {
          const tokenCard = metadata.tokenCard
          newState = produce(state, (draft) => {
            const targetPlayer = draft.players[operation.to!.player]
            if (operation.to!.zoneType === "freeZone") {
              if (!targetPlayer.freeZone) targetPlayer.freeZone = []
              targetPlayer.freeZone.push(tokenCard)
            }
          })
          return newState
        }
      }
      break
    case "draw":
      // Draw operations are handled by move operations
      break
    case "activate":
      // Activate operations don't change state, only visual effects
      break
    case "target":
      // Target operations don't change state, only visual effects
      break
    case "changePosition":
      // Handle flip operations
      if (
        operation.to &&
        operation.cardId &&
        operation.metadata &&
        "flip" in operation.metadata &&
        operation.metadata.flip === true
      ) {
        const position: Position = {
          zone: {
            player: operation.to.player,
            type: operation.to.zoneType,
            index: operation.to.zoneIndex,
          },
          cardId: operation.cardId,
        }
        newState = performCardFlip(state, position)
        return newState
      }
      break
    case "toggleHighlight":
      if (operation.to && operation.cardId) {
        // Reconstruct Position object
        const position: Position = {
          zone: {
            player: operation.to.player,
            type: operation.to.zoneType,
            index: operation.to.zoneIndex,
          },
          cardId: operation.cardId,
        }
        newState = performCardHighlightToggle(state, position)
        return newState
      }
      break
    case "updateCounter":
      if (operation.to && operation.cardId && operation.metadata && "counter" in operation.metadata) {
        // Reconstruct Position object
        const position: Position = {
          zone: {
            player: operation.to.player,
            type: operation.to.zoneType,
            index: operation.to.zoneIndex,
          },
          cardId: operation.cardId,
        }
        newState = performUpdateCounter(state, position, operation.metadata.counter as number)
        return newState
      }
      break
    case "shuffle":
      if (
        operation.from &&
        operation.metadata &&
        "newOrder" in operation.metadata &&
        Array.isArray(operation.metadata.newOrder)
      ) {
        // Shuffle deck with the recorded order
        newState = produce(state, (draft) => {
          const player = draft.players[operation.from!.player]
          if (operation.from!.zoneType === "deck") {
            const newOrder = (operation.metadata as { newOrder: string[] }).newOrder
            // Reorder deck based on recorded card IDs
            player.deck = newOrder.map((cardId) => {
              const card = player.deck.find((c) => c.id === cardId)
              if (!card) throw new Error(`Card ${cardId} not found in deck`)
              return card
            })
          }
        })
        return newState
      }
      break
  }

  return newState
}
