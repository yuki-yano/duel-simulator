import { atom } from "jotai"
import type { GameState } from "@/shared/types/game"
import type { DeckProcessMetadata, ExtractedCards } from "../types"
import { gameStateAtom } from "../core/gameState"

// Deck loaded state
export const isDeckLoadedAtom = atom<boolean>((get) => {
  const state = get(gameStateAtom)
  const deckMetadata = get(deckMetadataAtom)

  // If deck metadata exists, deck has been loaded
  if (deckMetadata) return true

  // Otherwise check if any cards exist in any player's deck
  return (
    state.players.self.deck.length > 0 ||
    state.players.opponent.deck.length > 0 ||
    state.players.self.extraDeck.length > 0 ||
    state.players.opponent.extraDeck.length > 0
  )
})

// Initial state after deck loading (for reset functionality)
export const initialStateAfterDeckLoadAtom = atom<GameState | null>(null)

// History index when deck was loaded (for undo limit)
export const deckLoadHistoryIndexAtom = atom<number>(0)

// Temporary storage for cards extracted from deck image
export const extractedCardsAtom = atom<ExtractedCards>({
  mainDeck: [],
  extraDeck: [],
  sideDeck: [],
})

// Deck metadata for saving replays
export const deckMetadataAtom = atom<DeckProcessMetadata | null>(null)

// Track if side deck was initially loaded with deck
export const hasSideDeckAtom = atom<boolean>(false)
