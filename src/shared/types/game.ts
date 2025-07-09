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
  zone?: ZoneId
  index?: number
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

export interface ZoneId {
  player: "self" | "opponent"
  type: ZoneType
  index?: number
  cardIndex?: number // Index within a stack of cards
  cardId?: string // Card ID for effect animations
}

export interface Position {
  zone: ZoneId
  index?: number
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
  type: "move" | "summon" | "set" | "attack" | "activate" | "draw" | "shuffle" | "rotate" | "changePosition"
  from?: Position
  to?: Position
  card?: Card
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
