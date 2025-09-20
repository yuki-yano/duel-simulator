import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { OperationFactory } from './OperationFactory'

vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => 'test-id-' + Math.random().toString(36).substr(2, 9))
}))

describe('OperationFactory', () => {
  let factory: OperationFactory

  beforeEach(() => {
    factory = new OperationFactory()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-20T10:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('基本機能', () => {
    it('移動操作を生成できる', () => {
      const operation = factory.move(
        { player: 'self', zoneType: 'hand', zoneIndex: 0 },
        { player: 'self', zoneType: 'monsterZone', zoneIndex: 2 }
      ).build()

      expect(operation).toMatchObject({
        type: 'move',
        player: 'self',
        from: { zoneType: 'hand', zoneIndex: 0 },
        to: { zoneType: 'monsterZone', zoneIndex: 2 },
        timestamp: expect.any(Number)
      })
      expect(operation.cardId).toBeDefined()
    })

    it('召喚操作を生成できる', () => {
      const operation = factory.summon('card-123', {
        player: 'self',
        zoneType: 'monsterZone',
        zoneIndex: 3
      }).build()

      expect(operation).toMatchObject({
        type: 'summon',
        player: 'self',
        cardId: 'card-123',
        to: { zoneType: 'monsterZone', zoneIndex: 3 },
        timestamp: expect.any(Number)
      })
    })

    it('攻撃操作を生成できる', () => {
      const operation = factory.attack('attacker-id', 'target-id', {
        damage: 1500,
        destroyed: true
      }).build()

      expect(operation).toMatchObject({
        type: 'attack',
        cardId: 'attacker-id',
        metadata: {
          targetId: 'target-id',
          damage: 1500,
          destroyed: true
        },
        timestamp: expect.any(Number)
      })
    })

    it('裏返し操作を生成できる', () => {
      const operation = factory.flip('card-456').build()

      expect(operation).toMatchObject({
        type: 'changePosition',
        cardId: 'card-456',
        metadata: { flip: true },
        timestamp: expect.any(Number)
      })
    })
  })

  describe('高度な機能', () => {
    it('タイムスタンプをカスタマイズできる', () => {
      const customTime = Date.now() + 1000
      const operation = factory
        .move(
          { player: 'self', zoneType: 'hand', zoneIndex: 0 },
          { player: 'self', zoneType: 'graveyard' }
        )
        .withTimestamp(customTime)
        .build()

      expect(operation.timestamp).toBe(customTime)
    })

    it('メタデータを追加できる', () => {
      const operation = factory
        .move(
          { player: 'self', zoneType: 'deck', zoneIndex: 0 },
          { player: 'self', zoneType: 'hand' }
        )
        .withMetadata({ stackPosition: 'top', special: true })
        .build()

      expect(operation.metadata).toEqual({
        stackPosition: 'top',
        special: true
      })
    })

    it('シーケンスを生成できる', () => {
      const operations = factory.sequence([
        new OperationFactory().draw('self'),
        new OperationFactory().summon('card-1', { player: 'self', zoneType: 'monsterZone', zoneIndex: 2 }),
        new OperationFactory().attack('card-1', 'opponent-card')
      ])

      expect(operations).toHaveLength(3)
      expect(operations[0].type).toBe('draw')
      expect(operations[1].type).toBe('summon')
      expect(operations[2].type).toBe('attack')
      
      // タイムスタンプが順番に増える
      expect(operations[1].timestamp).toBeGreaterThan(operations[0].timestamp)
      expect(operations[2].timestamp).toBeGreaterThan(operations[1].timestamp)
    })

    it('ターン操作をグループで生成できる', () => {
      const operations = factory.turnSequence('self', [
        new OperationFactory().draw('self'),
        new OperationFactory().summon('card-1', { player: 'self', zoneType: 'monsterZone', zoneIndex: 0 }),
        new OperationFactory().changePosition('card-1', 'defense')
      ])

      expect(operations).toHaveLength(4) // startTurn + 3 operations
      expect(operations[0].type).toBe('draw') // startTurnの代わりにdrawを使用
      expect(operations[0].player).toBe('self')
      expect(operations[operations.length - 1].type).toBe('changePosition')
    })
  })
})
