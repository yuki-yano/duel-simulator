export interface Card {
  id: string;
  imageUrl: string;
  name?: string;
  attack?: number;
  defense?: number;
  level?: number;
  type?: string;
  description?: string;
  position: 'attack' | 'defense' | 'facedown' | 'spell' | 'set';
  rotation: number;
  zone?: ZoneId;
  index?: number;
}

export type ZoneType = 
  | 'monsterZone'
  | 'spellTrapZone'
  | 'fieldZone'
  | 'graveyard'
  | 'banished'
  | 'extraDeck'
  | 'deck'
  | 'hand'
  | 'extraMonsterZone';

export interface ZoneId {
  player: 'self' | 'opponent';
  type: ZoneType;
  index?: number;
}

export interface Position {
  zone: ZoneId;
  index?: number;
}

export interface PlayerBoard {
  monsterZones: (Card | null)[];
  spellTrapZones: (Card | null)[];
  fieldZone: Card | null;
  graveyard: Card[];
  banished: Card[];
  extraDeck: Card[];
  deck: Card[];
  hand: Card[];
  extraMonsterZone: Card | null;
  lifePoints: number;
}

export interface GameState {
  players: {
    self: PlayerBoard;
    opponent: PlayerBoard;
  };
  turn: number;
  phase: GamePhase;
  currentPlayer: 'self' | 'opponent';
}

export type GamePhase = 
  | 'draw'
  | 'standby'
  | 'main1'
  | 'battle'
  | 'main2'
  | 'end';

export interface GameOperation {
  id: string;
  timestamp: number;
  type: 'move' | 'summon' | 'set' | 'attack' | 'activate' | 'draw' | 'shuffle' | 'rotate' | 'changePosition';
  from?: Position;
  to?: Position;
  card?: Card;
  player: 'self' | 'opponent';
  metadata?: Record<string, any>;
}

export interface SavedState {
  id: string;
  type: 'snapshot' | 'replay';
  initialState: GameState;
  operations: GameOperation[];
  metadata: {
    title?: string;
    description?: string;
    createdAt: number;
    originalStartIndex?: number;
    originalEndIndex?: number;
    deckImageHash?: string;
  };
}