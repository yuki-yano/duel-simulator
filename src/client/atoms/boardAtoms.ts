import { atom } from 'jotai';
import type { Card, GameState, PlayerBoard, Position, ZoneId, GameOperation, GamePhase } from '../../shared/types/game';

// 初期プレイヤーボード
const createInitialPlayerBoard = (): PlayerBoard => ({
  monsterZones: Array(5).fill(null),
  spellTrapZones: Array(5).fill(null),
  fieldZone: null,
  graveyard: [],
  banished: [],
  extraDeck: [],
  deck: [],
  hand: [],
  extraMonsterZone: null,
  lifePoints: 8000,
});

// 初期ゲーム状態
const createInitialGameState = (): GameState => ({
  players: {
    self: createInitialPlayerBoard(),
    opponent: createInitialPlayerBoard(),
  },
  turn: 1,
  phase: 'main1',
  currentPlayer: 'self',
});

// メインのゲーム状態atom
export const gameStateAtom = atom<GameState>(createInitialGameState());

// 操作履歴atom
export const operationsAtom = atom<GameOperation[]>([]);

// UI状態atoms
export const selectedCardAtom = atom<Card | null>(null);
export const draggedCardAtom = atom<Card | null>(null);
export const hoveredZoneAtom = atom<ZoneId | null>(null);
export const highlightedZonesAtom = atom<ZoneId[]>([]);

// デッキ画像から切り出したカードの一時保存
export const extractedCardsAtom = atom<{
  mainDeck: Card[];
  extraDeck: Card[];
}>({
  mainDeck: [],
  extraDeck: [],
});

// 現在のゲームフェーズatom
export const currentPhaseAtom = atom<GamePhase, [GamePhase], void>(
  (get) => get(gameStateAtom).phase,
  (get, set, newPhase: GamePhase) => {
    const state = get(gameStateAtom);
    set(gameStateAtom, {
      ...state,
      phase: newPhase,
    });
  }
);

// カード移動アクション
export const moveCardAtom = atom(
  null,
  (get, set, from: Position, to: Position) => {
    const state = get(gameStateAtom);
    const newState = performCardMove(state, from, to);
    
    if (newState !== state) {
      set(gameStateAtom, newState);
      
      // 操作を記録
      const operation: GameOperation = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        type: 'move',
        from,
        to,
        player: from.zone.player,
      };
      set(operationsAtom, [...get(operationsAtom), operation]);
    } else {
    }
  }
);

// カード回転アクション
export const rotateCardAtom = atom(
  null,
  (get, set, position: Position, angle: number) => {
    const state = get(gameStateAtom);
    const newState = performCardRotation(state, position, angle);
    
    if (newState !== state) {
      set(gameStateAtom, newState);
      
      const operation: GameOperation = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        type: 'rotate',
        to: position,
        player: position.zone.player,
        metadata: { angle },
      };
      set(operationsAtom, [...get(operationsAtom), operation]);
    }
  }
);

// デッキから手札にドロー
export const drawCardAtom = atom(
  null,
  (get, set, player: 'self' | 'opponent', count: number = 1) => {
    const state = get(gameStateAtom);
    const playerBoard = state.players[player];
    
    if (playerBoard.deck.length < count) {
      console.warn('Not enough cards in deck');
      return;
    }
    
    const drawnCards = playerBoard.deck.slice(0, count);
    const remainingDeck = playerBoard.deck.slice(count);
    
    // 残りのデッキカードのindexを更新
    const newDeck = remainingDeck.map((card, idx) => ({ ...card, index: idx }));
    
    // ドローしたカードに新しいzone情報とindexを設定
    const drawnCardsWithZone = drawnCards.map((card, idx) => ({
      ...card,
      zone: { player, type: 'hand' as const },
      index: playerBoard.hand.length + idx
    }));
    
    const newHand = [...playerBoard.hand, ...drawnCardsWithZone];
    
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
    };
    
    set(gameStateAtom, newState);
    
    // 各カードのドローを記録
    drawnCards.forEach((card) => {
      const operation: GameOperation = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        type: 'draw',
        from: { zone: { player, type: 'deck' } },
        to: { zone: { player, type: 'hand' } },
        card,
        player,
      };
      set(operationsAtom, [...get(operationsAtom), operation]);
    });
  }
);

// ヘルパー関数：カード移動の実行
function performCardMove(state: GameState, from: Position, to: Position): GameState {
  const fromPlayer = state.players[from.zone.player];
  const toPlayer = state.players[to.zone.player];
  
  // カードを取得
  const card = getCardAtPosition(fromPlayer, from.zone);
  if (!card) {
    return state;
  }
  
  // カードのゾーン情報を更新
  const updatedCard = {
    ...card,
    zone: to.zone,
    index: to.zone.index
  };
  
  // 元の場所からカードを削除
  const newFromPlayer = removeCardFromZone(fromPlayer, from.zone);
  
  // 新しい場所にカードを追加
  const newToPlayer = addCardToZone(
    from.zone.player === to.zone.player ? newFromPlayer : toPlayer,
    to.zone,
    updatedCard
  );
  
  return {
    ...state,
    players: {
      ...state.players,
      [from.zone.player]: newFromPlayer,
      [to.zone.player]: newToPlayer,
    },
  };
}

// ヘルパー関数：カード回転の実行
function performCardRotation(state: GameState, position: Position, angle: number): GameState {
  const player = state.players[position.zone.player];
  const card = getCardAtPosition(player, position.zone);
  
  if (!card) return state;
  
  const rotatedCard = { ...card, rotation: angle };
  const newPlayer = updateCardInZone(player, position.zone, rotatedCard);
  
  return {
    ...state,
    players: {
      ...state.players,
      [position.zone.player]: newPlayer,
    },
  };
}

// ヘルパー関数：指定位置のカードを取得
function getCardAtPosition(player: PlayerBoard, zone: ZoneId): Card | null {
  switch (zone.type) {
    case 'monsterZone':
      return zone.index !== undefined ? player.monsterZones[zone.index] : null;
    case 'spellTrapZone':
      return zone.index !== undefined ? player.spellTrapZones[zone.index] : null;
    case 'fieldZone':
      return player.fieldZone;
    case 'extraMonsterZone':
      return player.extraMonsterZone;
    case 'hand':
      return zone.index !== undefined ? player.hand[zone.index] : null;
    case 'deck':
      return zone.index !== undefined ? player.deck[zone.index] : null;
    case 'graveyard':
      return zone.index !== undefined ? player.graveyard[zone.index] : null;
    case 'banished':
      return zone.index !== undefined ? player.banished[zone.index] : null;
    case 'extraDeck':
      return zone.index !== undefined ? player.extraDeck[zone.index] : null;
    default:
      return null;
  }
}

// ヘルパー関数：ゾーンからカードを削除
function removeCardFromZone(player: PlayerBoard, zone: ZoneId): PlayerBoard {
  switch (zone.type) {
    case 'monsterZone':
      if (zone.index !== undefined) {
        const newZones = [...player.monsterZones];
        newZones[zone.index] = null;
        return { ...player, monsterZones: newZones };
      }
      break;
    case 'spellTrapZone':
      if (zone.index !== undefined) {
        const newZones = [...player.spellTrapZones];
        newZones[zone.index] = null;
        return { ...player, spellTrapZones: newZones };
      }
      break;
    case 'fieldZone':
      return { ...player, fieldZone: null };
    case 'extraMonsterZone':
      return { ...player, extraMonsterZone: null };
    case 'hand':
      if (zone.index !== undefined) {
        const newHand = [...player.hand];
        newHand.splice(zone.index, 1);
        // 残りのカードのindexを更新
        const updatedHand = newHand.map((card, idx) => ({ ...card, index: idx }));
        return { ...player, hand: updatedHand };
      }
      break;
    case 'deck':
      if (zone.index !== undefined) {
        const newDeck = [...player.deck];
        newDeck.splice(zone.index, 1);
        // 残りのカードのindexを更新
        const updatedDeck = newDeck.map((card, idx) => ({ ...card, index: idx }));
        return { ...player, deck: updatedDeck };
      }
      break;
    case 'graveyard':
      if (zone.index !== undefined) {
        const newGraveyard = [...player.graveyard];
        newGraveyard.splice(zone.index, 1);
        // 残りのカードのindexを更新
        const updatedGraveyard = newGraveyard.map((card, idx) => ({ ...card, index: idx }));
        return { ...player, graveyard: updatedGraveyard };
      }
      break;
    case 'banished':
      if (zone.index !== undefined) {
        const newBanished = [...player.banished];
        newBanished.splice(zone.index, 1);
        // 残りのカードのindexを更新
        const updatedBanished = newBanished.map((card, idx) => ({ ...card, index: idx }));
        return { ...player, banished: updatedBanished };
      }
      break;
    case 'extraDeck':
      if (zone.index !== undefined) {
        const newExtraDeck = [...player.extraDeck];
        newExtraDeck.splice(zone.index, 1);
        // 残りのカードのindexを更新
        const updatedExtraDeck = newExtraDeck.map((card, idx) => ({ ...card, index: idx }));
        return { ...player, extraDeck: updatedExtraDeck };
      }
      break;
  }
  return player;
}

// ヘルパー関数：ゾーンにカードを追加
function addCardToZone(player: PlayerBoard, zone: ZoneId, card: Card): PlayerBoard {
  switch (zone.type) {
    case 'monsterZone':
      if (zone.index !== undefined && player.monsterZones[zone.index] === null) {
        const newZones = [...player.monsterZones];
        newZones[zone.index] = card;
        return { ...player, monsterZones: newZones };
      }
      break;
    case 'spellTrapZone':
      if (zone.index !== undefined && player.spellTrapZones[zone.index] === null) {
        const newZones = [...player.spellTrapZones];
        newZones[zone.index] = card;
        return { ...player, spellTrapZones: newZones };
      }
      break;
    case 'fieldZone':
      return { ...player, fieldZone: card };
    case 'extraMonsterZone':
      return { ...player, extraMonsterZone: card };
    case 'hand': {
      const newCard = { ...card, zone, index: player.hand.length };
      return { ...player, hand: [...player.hand, newCard] };
    }
    case 'deck': {
      const newCard = { ...card, zone, index: player.deck.length };
      return { ...player, deck: [...player.deck, newCard] };
    }
    case 'graveyard': {
      const newCard = { ...card, zone, index: player.graveyard.length };
      return { ...player, graveyard: [...player.graveyard, newCard] };
    }
    case 'banished': {
      const newCard = { ...card, zone, index: player.banished.length };
      return { ...player, banished: [...player.banished, newCard] };
    }
    case 'extraDeck': {
      const newCard = { ...card, zone, index: player.extraDeck.length };
      return { ...player, extraDeck: [...player.extraDeck, newCard] };
    }
  }
  return player;
}

// ヘルパー関数：ゾーン内のカードを更新
function updateCardInZone(player: PlayerBoard, zone: ZoneId, card: Card): PlayerBoard {
  switch (zone.type) {
    case 'monsterZone':
      if (zone.index !== undefined) {
        const newZones = [...player.monsterZones];
        newZones[zone.index] = card;
        return { ...player, monsterZones: newZones };
      }
      break;
    case 'spellTrapZone':
      if (zone.index !== undefined) {
        const newZones = [...player.spellTrapZones];
        newZones[zone.index] = card;
        return { ...player, spellTrapZones: newZones };
      }
      break;
    case 'fieldZone':
      return { ...player, fieldZone: card };
    case 'extraMonsterZone':
      return { ...player, extraMonsterZone: card };
    // 配列系は index で特定のカードを更新
    case 'hand':
      if (zone.index !== undefined) {
        const newHand = [...player.hand];
        newHand[zone.index] = card;
        return { ...player, hand: newHand };
      }
      break;
  }
  return player;
}