import { nanoid } from 'nanoid'
import type { Card, GameOperation, PlayerBoard } from '../shared/types/game'

/**
 * モックカードを生成する
 * @param overrides 上書きするフィールド
 * @returns モックカード
 */
export function createMockCard(overrides: Partial<Card> = {}): Card {
  return {
    id: nanoid(),
    name: 'Test Card',
    type: 'monster',
    attack: 1000,
    defense: 1000,
    level: 4,
    position: 'attack',
    rotation: 0,
    ...overrides
  }
}

/**
 * モックボード状態を生成する
 * @param overrides 上書きするフィールド
 * @returns モックボード
 */
export function createMockBoard(overrides: {
  player1?: Partial<PlayerBoard>
  player2?: Partial<PlayerBoard>
} = {}): { player1: PlayerBoard; player2: PlayerBoard } {
  const defaultPlayerBoard: PlayerBoard = {
    deck: [],
    hand: [],
    graveyard: [],
    monsterZones: [[], [], [], [], []],
    spellTrapZones: [[], [], [], [], []],
    fieldZone: null,
    extraDeck: [],
    banished: [],
    extraMonsterZones: [[], []],
    freeZone: [],
    sideFreeZone: [],
    sideDeck: [],
    lifePoints: 8000
  }

  return {
    player1: {
      ...defaultPlayerBoard,
      ...overrides.player1
    },
    player2: {
      ...defaultPlayerBoard,
      ...overrides.player2
    }
  }
}

/**
 * モック操作を生成する
 * @param overrides 上書きするフィールド
 * @returns モック操作
 */
export function createMockOperation(overrides: Partial<GameOperation> = {}): GameOperation {
  return {
    id: nanoid(),
    type: 'move',
    cardId: nanoid(),
    timestamp: Date.now(),
    player: 'self',
    from: {
      player: 'self',
      zoneType: 'hand',
      zoneIndex: 0
    },
    to: {
      player: 'self',
      zoneType: 'monsterZone',
      zoneIndex: 0
    },
    ...overrides
  }
}

/**
 * テスト用カードIDを生成する
 * @returns カードID
 */
export function generateCardId(): string {
  return nanoid()
}

/**
 * 非同期更新を待機する
 * @param timeout タイムアウト時間（ミリ秒）
 * @returns Promise
 */
export function waitForNextUpdate(timeout = 0): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, timeout))
}

/**
 * 保留中のPromiseを全て解決する
 * @returns Promise
 */
export function flushPromises(): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, 0)
  })
}

/**
 * localStorageのモックを作成する
 * @param initialData 初期データ
 * @returns localStorageモック
 */
export function mockLocalStorage(initialData: Record<string, string> = {}): Storage {
  const store: Record<string, string> = { ...initialData }

  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      Object.keys(store).forEach(key => delete store[key])
    },
    get length() {
      return Object.keys(store).length
    },
    key: (index: number) => {
      const keys = Object.keys(store)
      return keys[index] ?? null
    }
  }
}

/**
 * sessionStorageのモックを作成する
 * @param initialData 初期データ
 * @returns sessionStorageモック
 */
export function mockSessionStorage(initialData: Record<string, string> = {}): Storage {
  return mockLocalStorage(initialData)
}
