import { describe, it, expect } from 'vitest'
import './matchers'
import { createMockCard } from './helpers'

describe('Custom Matchers', () => {
  describe('toBeValidCard', () => {
    it('有効なカード構造で成功する', () => {
      const card = createMockCard()
      expect(card).toBeValidCard()
    })

    it('idが欠けている場合失敗する', () => {
      const card = { name: 'Test', type: 'monster' }
      expect(card).not.toBeValidCard()
    })

    it('nameが欠けている場合失敗する', () => {
      const card = { id: '123', type: 'monster' }
      expect(card).not.toBeValidCard()
    })

    it('typeが欠けている場合失敗する', () => {
      const card = { id: '123', name: 'Test' }
      expect(card).not.toBeValidCard()
    })
  })

  describe('toBeInZone', () => {
    it('正しいゾーンにいる場合成功する', () => {
      const card = { ...createMockCard(), zone: 'hand' }
      expect(card).toBeInZone('hand')
    })

    it('違うゾーンにいる場合失敗する', () => {
      const card = { ...createMockCard(), zone: 'hand' }
      expect(card).not.toBeInZone('graveyard')
    })

    it('zoneフィールドがない場合失敗する', () => {
      const card = createMockCard()
      expect(card).not.toBeInZone('hand')
    })
  })

  describe('toHaveGameOperation', () => {
    it('操作履歴に特定の操作が含まれる場合成功する', () => {
      const operations = [
        { id: '1', type: 'move', cardId: 'card1', from: 'hand', to: 'field' },
        { id: '2', type: 'rotate', cardId: 'card2', position: 'defense' }
      ]
      expect(operations).toHaveGameOperation({ type: 'move', cardId: 'card1' })
    })

    it('typeが一致する操作が存在する場合成功する', () => {
      const operations = [
        { id: '1', type: 'flip', cardId: 'card1' },
        { id: '2', type: 'move', cardId: 'card2' }
      ]
      expect(operations).toHaveGameOperation({ type: 'flip' })
    })

    it('操作が存在しない場合失敗する', () => {
      const operations = [
        { id: '1', type: 'move', cardId: 'card1' }
      ]
      expect(operations).not.toHaveGameOperation({ type: 'rotate' })
    })
  })

  describe('toHaveCardCount', () => {
    it('指定数のカードが存在する場合成功する', () => {
      const cards = [createMockCard(), createMockCard(), createMockCard()]
      expect(cards).toHaveCardCount(3)
    })

    it('カード数が違う場合失敗する', () => {
      const cards = [createMockCard(), createMockCard()]
      expect(cards).not.toHaveCardCount(3)
    })

    it('空配列でcount=0の場合成功する', () => {
      const cards: unknown[] = []
      expect(cards).toHaveCardCount(0)
    })
  })
})
