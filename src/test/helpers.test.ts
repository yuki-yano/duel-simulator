import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createMockCard,
  createMockBoard,
  createMockOperation,
  generateCardId,
  waitForNextUpdate,
  flushPromises,
  mockLocalStorage
} from './helpers'

describe('Test Helpers', () => {
  describe('createMockCard', () => {
    it('デフォルト値でカードを生成できる', () => {
      const card = createMockCard()
      expect(card).toHaveProperty('id')
      expect(card).toHaveProperty('name')
      expect(card).toHaveProperty('type')
      expect(card.type).toBe('monster')
    })

    it('overridesで特定フィールドを上書きできる', () => {
      const card = createMockCard({
        name: 'Blue-Eyes White Dragon',
        type: 'monster',
        attack: 3000
      })
      expect(card.name).toBe('Blue-Eyes White Dragon')
      expect(card.attack).toBe(3000)
    })

    it('IDが自動生成される', () => {
      const card1 = createMockCard()
      const card2 = createMockCard()
      expect(card1.id).toBeTruthy()
      expect(card2.id).toBeTruthy()
      expect(card1.id).not.toBe(card2.id)
    })

    it('各タイプのカードを生成できる', () => {
      const monster = createMockCard({ type: 'monster' })
      const spell = createMockCard({ type: 'spell' })
      const trap = createMockCard({ type: 'trap' })

      expect(monster.type).toBe('monster')
      expect(spell.type).toBe('spell')
      expect(trap.type).toBe('trap')
    })
  })

  describe('createMockBoard', () => {
    it('空のボード状態を生成できる', () => {
      const board = createMockBoard()
      expect(board.player1).toBeDefined()
      expect(board.player2).toBeDefined()
      expect(board.player1.hand).toEqual([])
      expect(board.player1.deck).toEqual([])
    })

    it('ゾーンごとにカードを配置できる', () => {
      const card = createMockCard()
      const board = createMockBoard({
        player1: {
          hand: [card],
          monsterZones: [[card], [], [], [], []]
        }
      })
      expect(board.player1.hand).toHaveLength(1)
      expect(board.player1.hand[0]).toBe(card)
      expect(board.player1.monsterZones[0][0]).toBe(card)
    })
  })

  describe('createMockOperation', () => {
    it('デフォルトのmove操作を生成できる', () => {
      const op = createMockOperation()
      expect(op.type).toBe('move')
      expect(op.cardId).toBeTruthy()
      expect(op.from).toBeDefined()
      expect(op.to).toBeDefined()
    })

    it('各種操作タイプを生成できる', () => {
      const move = createMockOperation({ type: 'move' })
      const rotate = createMockOperation({ type: 'rotate' })
      const flip = createMockOperation({ type: 'changePosition' })

      expect(move.type).toBe('move')
      expect(rotate.type).toBe('rotate')
      expect(flip.type).toBe('changePosition')
    })
  })

  describe('generateCardId', () => {
    it('ユニークなIDを生成する', () => {
      const id1 = generateCardId()
      const id2 = generateCardId()
      expect(id1).toBeTruthy()
      expect(id2).toBeTruthy()
      expect(id1).not.toBe(id2)
    })
  })

  describe('waitForNextUpdate', () => {
    it('Promiseが解決されるまで待機できる', async () => {
      let resolved = false
      const promise = new Promise<void>(resolve => {
        setTimeout(() => {
          resolved = true
          resolve()
        }, 10)
      })

      expect(resolved).toBe(false)
      await waitForNextUpdate()
      await promise
      expect(resolved).toBe(true)
    })
  })

  describe('flushPromises', () => {
    it('保留中のPromiseが全て解決される', async () => {
      let count = 0
      void Promise.resolve().then(() => count++)
      void Promise.resolve().then(() => count++)
      void Promise.resolve().then(() => count++)

      expect(count).toBe(0)
      await flushPromises()
      expect(count).toBe(3)
    })
  })

  describe('mockLocalStorage', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('localStorageのモックを作成できる', () => {
      const storage = mockLocalStorage()
      expect(storage.getItem).toBeDefined()
      expect(storage.setItem).toBeDefined()
      expect(storage.removeItem).toBeDefined()
      expect(storage.clear).toBeDefined()
    })

    it('getItem/setItem/removeItemが動作する', () => {
      const storage = mockLocalStorage()
      
      expect(storage.getItem('key')).toBeNull()
      
      storage.setItem('key', 'value')
      expect(storage.getItem('key')).toBe('value')
      
      storage.removeItem('key')
      expect(storage.getItem('key')).toBeNull()
    })

    it('初期データを設定できる', () => {
      const storage = mockLocalStorage({
        key1: 'value1',
        key2: 'value2'
      })
      
      expect(storage.getItem('key1')).toBe('value1')
      expect(storage.getItem('key2')).toBe('value2')
    })
  })
})
