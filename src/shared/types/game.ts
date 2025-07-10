export interface Card {
  id: string
  imageUrl: string
  name?: string
  attack?: number
  defense?: number
  level?: number
  type?: string
  description?: string
  position: "attack" | "defense" | "facedown" | "spell" | "set"
  rotation: number
  faceDown?: boolean
  highlighted?: boolean
  // Note: zone and index are removed - card location is determined by its position in PlayerBoard arrays
}

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

export interface PlayerBoard {
  monsterZones: Card[][]
  spellTrapZones: Card[][]
  fieldZone: Card | null
  graveyard: Card[]
  banished: Card[]
  extraDeck: Card[]
  deck: Card[]
  hand: Card[]
  extraMonsterZones: Card[][]
  lifePoints: number
}

export interface GameState {
  players: {
    self: PlayerBoard
    opponent: PlayerBoard
  }
  turn: number
  phase: GamePhase
  currentPlayer: "self" | "opponent"
}

export type GamePhase = "draw" | "standby" | "main1" | "battle" | "main2" | "end"

export interface GameOperation {
  id: string
  timestamp: number
  type:
    | "move"
    | "summon"
    | "set"
    | "attack"
    | "activate"
    | "draw"
    | "shuffle"
    | "rotate"
    | "changePosition"
    | "toggleHighlight"
  cardId: string // Always track by card ID
  from?: {
    player: "self" | "opponent"
    zoneType: ZoneType
    zoneIndex?: number // Which zone slot (for multi-slot zones)
  }
  to?: {
    player: "self" | "opponent"
    zoneType: ZoneType
    zoneIndex?: number // Which zone slot (for multi-slot zones)
    insertPosition?: number | "last" // Where to insert in the target zone
  }
  player: "self" | "opponent"
  metadata?: Record<string, unknown>
}

export interface SavedState {
  id: string
  type: "snapshot" | "replay"
  initialState: GameState
  operations: GameOperation[]
  metadata: {
    title?: string
    description?: string
    createdAt: number
    originalStartIndex?: number
    originalEndIndex?: number
    deckImageHash?: string
  }
}

export interface DeckCardIdsMapping {
  mainDeck: { [index: number]: string } // index -> cardId
  extraDeck: { [index: number]: string } // index -> cardId
}

export interface ReplaySaveData {
  version: "1.0"
  type: "replay"
  data: {
    initialState: GameState
    operations: GameOperation[]
    deckImageHash: string
    deckCardIds: DeckCardIdsMapping // カードIDマッピング
  }
  metadata: {
    title: string
    description?: string
    createdAt: number
    duration: number
    operationCount: number
  }
}
