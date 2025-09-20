import { describe, it, expect, vi } from 'vitest'
import { CardFactory } from './CardFactory'

vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => 'test-id-' + Math.random().toString(36).substr(2, 9))
}))

describe('CardFactory', () => {
  describe('基本機能', () => {
    it('デフォルトモンスターカードを生成できる', () => {
      const factory = new CardFactory()
      const card = factory.build()

      expect(card).toMatchObject({
        type: 'monster',
        attack: 1000,
        defense: 1000,
        level: 4,
        position: 'attack'
      })
      expect(card.id).toBeDefined()
      expect(card.name).toBeDefined()
    })

    it('魔法カードを生成できる', () => {
      const factory = new CardFactory()
      const card = factory.spell().build()

      expect(card.type).toBe('spell')
      expect(card.attack).toBeUndefined()
      expect(card.defense).toBeUndefined()
      expect(card.level).toBeUndefined()
    })

    it('罠カードを生成できる', () => {
      const factory = new CardFactory()
      const card = factory.trap().build()

      expect(card.type).toBe('trap')
      expect(card.attack).toBeUndefined()
      expect(card.defense).toBeUndefined()
      expect(card.level).toBeUndefined()
    })
  })

  describe('高度な機能', () => {
    it('複数のカードをバッチ生成できる', () => {
      const factory = new CardFactory()
      const cards = factory.buildMany(5)

      expect(cards).toHaveLength(5)
      // 各カードが異なるIDを持つ
      const ids = new Set(cards.map(c => c.id))
      expect(ids.size).toBe(5)
    })

    it('ランダムなパラメータでカードを生成できる', () => {
      const factory = new CardFactory()
      const card = factory.randomize().build()

      expect(card.attack).toBeGreaterThanOrEqual(0)
      expect(card.attack).toBeLessThanOrEqual(5000)
      expect(card.defense).toBeGreaterThanOrEqual(0)
      expect(card.defense).toBeLessThanOrEqual(5000)
      expect(card.level).toBeGreaterThanOrEqual(1)
      expect(card.level).toBeLessThanOrEqual(12)
    })

    it('メソッドチェーンでカスタマイズできる', () => {
      const factory = new CardFactory()
      const card = factory
        .withName('Custom Card')
        .withAttack(2500)
        .withDefense(2000)
        .withLevel(7)
        .faceDown()
        .inDefensePosition()
        .build()

      expect(card).toMatchObject({
        name: 'Custom Card',
        attack: 2500,
        defense: 2000,
        level: 7,
        position: 'defense',
        faceDown: true
      })
    })

    it('カスタム属性でオーバーライドできる', () => {
      const factory = new CardFactory()
      const card = factory.build({
        name: 'Override Card',
        attack: 3000
      })

      expect(card.name).toBe('Override Card')
      expect(card.attack).toBe(3000)
      expect(card.defense).toBe(1000) // デフォルト値
    })
  })
})
