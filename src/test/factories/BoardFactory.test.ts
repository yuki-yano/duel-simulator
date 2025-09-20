import { describe, it, expect } from 'vitest'
import { BoardFactory } from './BoardFactory'
import { CardFactory } from './CardFactory'

describe('BoardFactory', () => {
  describe('基本機能', () => {
    it('空のボードを生成できる', () => {
      const factory = new BoardFactory()
      const board = factory.build()

      expect(board.hand).toEqual([])
      expect(board.deck).toEqual([])
      expect(board.graveyard).toEqual([])
      expect(board.banished).toEqual([])
      expect(board.extraDeck).toEqual([])
      expect(board.monsterZones).toEqual([[], [], [], [], []])
      expect(board.spellTrapZones).toEqual([[], [], [], [], []])
      expect(board.extraMonsterZones).toEqual([[], []])
      expect(board.fieldZone).toBeNull()
      expect(board.freeZone).toEqual([])
      expect(board.sideFreeZone).toEqual([])
    })

    it('初期手札付きボードを生成できる', () => {
      const factory = new BoardFactory()
      const board = factory.withHand(5).build()

      expect(board.hand).toHaveLength(5)
      expect(board.hand[0]).toHaveProperty('id')
      expect(board.hand[0]).toHaveProperty('name')
    })

    it('デッキ付きボードを生成できる', () => {
      const factory = new BoardFactory()
      const board = factory.withDeck(40).build()

      expect(board.deck).toHaveLength(40)
      expect(board.deck[0]).toHaveProperty('id')
    })
  })

  describe('フィールドプリセット', () => {
    it('モンスターゾーン満杯のボードを生成できる', () => {
      const factory = new BoardFactory()
      const board = factory.preset('fullMonsters').build()

      board.monsterZones.forEach((zone) => {
        expect(zone).toHaveLength(1)
        expect(zone[0].type).toBe('monster')
      })
    })

    it('魔法罠ゾーン満杯のボードを生成できる', () => {
      const factory = new BoardFactory()
      const board = factory.preset('fullSpellTrap').build()

      board.spellTrapZones.forEach((zone) => {
        expect(zone).toHaveLength(1)
        expect(['spell', 'trap']).toContain(zone[0].type)
      })
    })

    it('中盤の盤面を生成できる', () => {
      const factory = new BoardFactory()
      const board = factory.preset('midGame').build()

      // 手札、4-6枚
      expect(board.hand.length).toBeGreaterThanOrEqual(4)
      expect(board.hand.length).toBeLessThanOrEqual(6)
      // モンスターゾーンに2-3体
      const monsterCount = board.monsterZones.filter((z) => z.length > 0).length
      expect(monsterCount).toBeGreaterThanOrEqual(2)
      expect(monsterCount).toBeLessThanOrEqual(3)
      // 墓地にカードあり
      expect(board.graveyard.length).toBeGreaterThan(0)
    })
  })

  describe('カスタム配置', () => {
    it('特定ゾーンにカードを配置できる', () => {
      const cardFactory = new CardFactory()
      const card = cardFactory.withName('Special Monster').build()
      
      const factory = new BoardFactory()
      const board = factory
        .withZone('monsterZones', 2, [card])
        .build()

      expect(board.monsterZones[2]).toHaveLength(1)
      expect(board.monsterZones[2][0].name).toBe('Special Monster')
    })

    it('フィールドゾーンにカードを配置できる', () => {
      const cardFactory = new CardFactory()
      const fieldCard = cardFactory.spell().withName('Field Spell').build()
      
      const factory = new BoardFactory()
      const board = factory
        .withFieldZone(fieldCard)
        .build()

      expect(board.fieldZone).not.toBeNull()
      expect(board.fieldZone?.name).toBe('Field Spell')
    })

    it('複数のゾーンを同時に設定できる', () => {
      const factory = new BoardFactory()
      const board = factory
        .withHand(5)
        .withDeck(40)
        .withGraveyard(10)
        .build()

      expect(board.hand).toHaveLength(5)
      expect(board.deck).toHaveLength(40)
      expect(board.graveyard).toHaveLength(10)
    })
  })
})
