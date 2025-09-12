import type { Atom, WritableAtom } from "jotai"
import type { Card, GameState, GameOperation, ZoneId, Position } from "@/shared/types/game"
export type { Position } from "@/shared/types/game"
import type { DeckProcessMetadata } from "@/client/components/DeckImageProcessor"

// Helper types for atom get/set
export type Getter = <Value>(atom: Atom<Value>) => Value
export type Setter = <Value, Args extends unknown[], Result>(
  atom: WritableAtom<Value, Args, Result>,
  ...args: Args
) => Result

// History entry for undo/redo
export interface HistoryEntry {
  gameState: GameState
  operationCount: number
  operations: GameOperation[]
}

// Replay data structure
export interface ReplayData {
  startSnapshot: GameState
  operations: GameOperation[]
  startTime: number
  endTime?: number
}

// Card animation for visual effects
export interface CardAnimation {
  id: string
  type: "move" | "activate" | "target" | "rotate" | "changePosition" | "highlight" | "negate"
  cardId?: string
  cardImageUrl?: string
  fromPosition?: { x: number; y: number }
  toPosition?: { x: number; y: number }
  position?: Position
  cardRect?: { x: number; y: number; width: number; height: number }
  cardRotation?: number
  // For rotate animation
  fromRotation?: number
  toRotation?: number
  // For changePosition animation
  fromCardPosition?: Position
  toCardPosition?: Position
  // For highlight animation
  fromHighlight?: boolean
  toHighlight?: boolean
  startTime: number
  duration?: number
}

// Extracted deck data
export interface ExtractedCards {
  mainDeck: Card[]
  extraDeck: Card[]
  sideDeck?: Card[]
}

// Move options for card operations
export interface MoveOptions {
  stackPosition?: "top" | "bottom"
  suppressAnimation?: boolean
}

// Moved card info
export interface MovedCard {
  card: Card
  fromZone: ZoneId
  toZone: ZoneId
}

// Export deck metadata type
export type { DeckProcessMetadata }
