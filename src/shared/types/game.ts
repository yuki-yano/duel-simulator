// Re-export types from Zod schemas
export type {
  Card,
  PlayerBoard,
  GameState,
  GameOperation,
  DeckCardIdsMapping,
  DeckSection,
  DeckConfiguration,
  ReplaySaveData,
  SavedState,
} from "@/client/schemas/replay"

export type ZoneType =
  | "monsterZone"
  | "spellTrapZone"
  | "fieldZone"
  | "graveyard"
  | "banished"
  | "extraDeck"
  | "deck"
  | "hand"
  | "extraMonsterZone"
  | "freeZone"
  | "sideFreeZone"

// Zone identification (read-only location info)
export interface ZoneId {
  player: "self" | "opponent"
  type: ZoneType
  index?: number // Zone slot index (e.g., monsterZone[0-4])
  cardIndex?: number // Index within a stack of cards (for multi-card zones)
  cardId?: string // Card ID for effect animations
}

// Position for card operations (includes operation hints)
export interface Position {
  zone: ZoneId
  insertIndex?: number // Where to insert the card (for move operations)
  cardId: string // IDベースでカードを特定するため（必須）
}

// Target position for move operations
export interface MoveTarget {
  player: "self" | "opponent"
  type: ZoneType
  zoneIndex?: number // Target zone slot (e.g., monsterZone[0-4])
  insertPosition?: number | "last" // Where to insert: specific index or last
}

export type GamePhase = "draw" | "standby" | "main1" | "battle" | "main2" | "end"
