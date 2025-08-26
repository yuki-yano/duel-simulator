import { atom } from "jotai"
import type { GameOperation, Card } from "../../../shared/types/game"
import { gameStateAtom } from "../core/gameState"
import { operationsAtom } from "../core/operations"
import { v4 as uuidv4 } from "uuid"
import { nanoid } from "nanoid"
import { produce } from "immer"
import { TOKEN_IMAGE_DATA_URL } from "@/client/constants/tokenImage"

import { addToHistory, resetHistoryAtom } from "../history/historyStack"
import { replayRecordingAtom, replayOperationsAtom, stopReplayRecordingAtom } from "../replay/recording"
import { replayPlayingAtom, stopReplayAtom } from "../replay/playback"
import { cardAnimationsAtom } from "../replay/animations"
import { selectedCardAtom, draggedCardAtom, hoveredZoneAtom, highlightedZonesAtom } from "../ui/selection"
import { initialStateAfterDeckLoadAtom } from "../deck/deckState"

export const drawCardAtom = atom(null, (get, set, player: "self" | "opponent", count: number = 1) => {
  const state = get(gameStateAtom)
  const playerBoard = state.players[player]

  if (playerBoard.deck.length < count) {
    console.warn("Not enough cards in deck")
    return
  }

  const drawnCards = playerBoard.deck.slice(0, count)
  const remainingDeck = playerBoard.deck.slice(count)

  // Remaining deck cards (no index property needed)
  const newDeck = [...remainingDeck]

  // Drawn cards (no zone/index properties needed)
  const drawnCardsWithZone = [...drawnCards]

  const newHand = [...playerBoard.hand, ...drawnCardsWithZone]

  const newState = {
    ...state,
    players: {
      ...state.players,
      [player]: {
        ...playerBoard,
        deck: newDeck,
        hand: newHand,
      },
    },
  }

  // Record draw operation for each card BEFORE updating history
  const operations: GameOperation[] = []
  drawnCards.forEach((card, _index) => {
    const operation: GameOperation = {
      id: uuidv4(),
      timestamp: Date.now(),
      type: "draw",
      cardId: card.id,
      from: {
        player,
        zoneType: "deck",
      },
      to: {
        player,
        zoneType: "hand",
        insertPosition: "last",
      },
      player,
    }
    operations.push(operation)
  })

  // Update operations BEFORE history
  const currentOps = get(operationsAtom)
  set(operationsAtom, [...currentOps, ...operations])

  // Then update game state and add to history
  set(gameStateAtom, newState)
  addToHistory(get, set, newState)

  // Also record to replay operations if recording
  if (get(replayRecordingAtom)) {
    const currentReplayOps = get(replayOperationsAtom)
    set(replayOperationsAtom, [...currentReplayOps, ...operations])
  }
})

// Generate token card atom
export const generateTokenAtom = atom(null, (get, set, targetPlayer: "self" | "opponent" = "self") => {
  const state = get(gameStateAtom)
  const tokenCard: Card = {
    id: nanoid(),
    name: "token",
    imageUrl: TOKEN_IMAGE_DATA_URL,
    position: "attack",
    rotation: 0,
    faceDown: false,
    highlighted: false,
    type: "monster",
  }

  // Create new state with token added to free zone
  const newState = produce(state, (draft) => {
    if (!draft.players[targetPlayer].freeZone) {
      draft.players[targetPlayer].freeZone = []
    }
    draft.players[targetPlayer].freeZone.push(tokenCard)
  })

  // Create operation for history (including token card data for replay)
  const operation: GameOperation = {
    id: nanoid(),
    timestamp: Date.now(),
    type: "summon",
    cardId: tokenCard.id,
    to: {
      player: targetPlayer,
      zoneType: "freeZone",
      insertPosition: "last",
    },
    player: targetPlayer,
    metadata: {
      isToken: true,
      tokenCard: tokenCard, // Include full card data for replay
    },
  }

  // Update operations BEFORE history
  set(operationsAtom, (prev) => [...prev, operation])

  // Then update state and history
  set(gameStateAtom, newState)
  addToHistory(get, set, newState)

  // Also record to replay operations if recording
  if (get(replayRecordingAtom)) {
    set(replayOperationsAtom, (prev) => [...prev, operation])
  }

  return tokenCard
})

// Shuffle deck atom
export const shuffleDeckAtom = atom(null, (get, set, targetPlayer: "self" | "opponent" = "self") => {
  const state = get(gameStateAtom)
  const deck = state.players[targetPlayer].deck

  // Create a shuffled copy of card IDs
  const cardIds = deck.map((card) => card.id)
  const shuffledIds = [...cardIds]

  // Fisher-Yates shuffle
  for (let i = shuffledIds.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffledIds[i], shuffledIds[j]] = [shuffledIds[j], shuffledIds[i]]
  }

  // Create new state with shuffled deck
  const newState = produce(state, (draft) => {
    draft.players[targetPlayer].deck = shuffledIds.map((cardId) => {
      const card = deck.find((c) => c.id === cardId)
      if (!card) throw new Error(`Card ${cardId} not found in deck`)
      return card
    })
  })

  // Create operation for history
  const operation: GameOperation = {
    id: nanoid(),
    timestamp: Date.now(),
    type: "shuffle",
    cardId: "", // Not specific to a single card
    from: {
      player: targetPlayer,
      zoneType: "deck",
    },
    player: targetPlayer,
    metadata: {
      newOrder: shuffledIds, // Record the new order for replay
    },
  }

  // Update operations BEFORE history
  set(operationsAtom, (prev) => [...prev, operation])

  // Then update state and history
  set(gameStateAtom, newState)
  addToHistory(get, set, newState)

  // Also record to replay operations if recording
  if (get(replayRecordingAtom)) {
    set(replayOperationsAtom, (prev) => [...prev, operation])
  }
})

// Force draw flag for 5-card draw confirmation
export const forceDraw5CardsAtom = atom(false)

// Draw multiple cards atom
export const drawMultipleCardsAtom = atom(
  null,
  (get, set, count: number = 5, targetPlayer: "self" | "opponent" = "self") => {
    // Special handling for 5-card draw (reset + shuffle + draw)
    if (count === 5) {
      const state = get(gameStateAtom)
      const player = state.players[targetPlayer]
      const forceDrawFlag = get(forceDraw5CardsAtom)
      const initialState = get(initialStateAfterDeckLoadAtom)

      // Check if cards exist in zones other than hand, deck, and extra deck
      const hasCardsInOtherZones =
        player.monsterZones.some((zone) => zone.length > 0) ||
        player.spellTrapZones.some((zone) => zone.length > 0) ||
        player.extraMonsterZones.some((zone) => zone.length > 0) ||
        player.fieldZone !== null ||
        player.graveyard.length > 0 ||
        player.banished.length > 0 ||
        (player.freeZone?.length ?? 0) > 0 ||
        (player.sideFreeZone?.length ?? 0) > 0

      if (hasCardsInOtherZones && !forceDrawFlag) {
        // Return warning flag instead of performing the action
        return { needsWarning: true }
      }

      // Reset force draw flag
      if (forceDrawFlag) {
        set(forceDraw5CardsAtom, false)
      }

      // Restore original deck contents from initial state (excluding tokens)
      if (!initialState) {
        console.error("No initial state available for 5-card draw")
        return { success: false }
      }

      const initialDeck = initialState.players[targetPlayer].deck
      const initialHand = initialState.players[targetPlayer].hand
      const initialExtraDeck = initialState.players[targetPlayer].extraDeck

      // Combine initial deck and hand cards (they were all originally in the deck)
      const allMainCards = [...initialDeck, ...initialHand]
      const extraCards = [...initialExtraDeck]

      // Shuffle main deck cards
      const shuffledMainCards = [...allMainCards]
      for (let i = shuffledMainCards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[shuffledMainCards[i], shuffledMainCards[j]] = [shuffledMainCards[j], shuffledMainCards[i]]
      }

      // Create new state based on initial state
      const newState = produce(initialState, (draft) => {
        // Clear all zones first (reset to initial state)
        const targetPlayerBoard = draft.players[targetPlayer]

        // Clear all zones
        targetPlayerBoard.monsterZones = [[], [], [], [], []]
        targetPlayerBoard.spellTrapZones = [[], [], [], [], []]
        targetPlayerBoard.extraMonsterZones = [[], []]
        targetPlayerBoard.fieldZone = null
        targetPlayerBoard.graveyard = []
        targetPlayerBoard.banished = []
        targetPlayerBoard.freeZone = []
        targetPlayerBoard.sideFreeZone = []

        // Set up shuffled deck and draw 5
        targetPlayerBoard.hand = shuffledMainCards.slice(0, 5)
        targetPlayerBoard.deck = shuffledMainCards.slice(5)
        targetPlayerBoard.extraDeck = extraCards
      })

      // Reset history to make this operation non-undoable
      // This is essentially a reset operation with shuffle and draw
      set(resetHistoryAtom, newState)

      return { success: true }
    } else {
      // Normal draw for other counts
      for (let i = 0; i < count; i++) {
        set(drawCardAtom, targetPlayer, 1)
      }
      return { success: true }
    }
  },
)

// Reset to initial state (deck loaded state)
export const resetToInitialStateAtom = atom(null, (get, set) => {
  const initialState = get(initialStateAfterDeckLoadAtom)

  if (initialState) {
    // Create a deep copy of the initial state
    const resetState = produce(initialState, () => {})

    // Reset game state and clear history
    set(resetHistoryAtom, resetState)

    // Clear any active animations or UI state
    set(selectedCardAtom, null)
    set(draggedCardAtom, null)
    set(hoveredZoneAtom, null)
    set(highlightedZonesAtom, [])
    set(cardAnimationsAtom, [])

    // Stop any active replay
    if (get(replayPlayingAtom)) {
      set(stopReplayAtom)
    }

    // Stop recording if active
    if (get(replayRecordingAtom)) {
      set(stopReplayRecordingAtom)
    }
  }
})