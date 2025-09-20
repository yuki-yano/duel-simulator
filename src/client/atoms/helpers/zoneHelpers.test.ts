import { describe, it, expect, beforeEach } from 'vitest'
import { addCardToZone, removeCardFromZoneById } from './zoneHelpers'
import type { PlayerBoard, Card, ZoneId } from '@/shared/types/game'
import { CardFactory, BoardFactory } from '@/test/factories'

describe('zoneHelpers', () => {
  let cardFactory: CardFactory
  let boardFactory: BoardFactory
  let testCard: Card
  let emptyBoard: PlayerBoard

  beforeEach(() => {
    cardFactory = new CardFactory()
    boardFactory = new BoardFactory()
    testCard = cardFactory.withName('Test Monster').build()
    emptyBoard = boardFactory.build()
  })

  describe('addCardToZone', () => {
    describe('モンスターゾーン', () => {
      it('空のモンスターゾーンにカードを追加できる', () => {
        const zone: ZoneId = { player: 'self', type: 'monsterZone', index: 0 }
        const result = addCardToZone(emptyBoard, zone, testCard)

        expect(result.monsterZones[0]).toHaveLength(1)
        expect(result.monsterZones[0][0].id).toBe(testCard.id)
      })

      it('特定のモンスターゾーンにカードを追加できる', () => {
        const zone: ZoneId = { player: 'self', type: 'monsterZone', index: 2 }
        const result = addCardToZone(emptyBoard, zone, testCard)

        expect(result.monsterZones[2]).toHaveLength(1)
        expect(result.monsterZones[2][0].id).toBe(testCard.id)
      })

      it('既存カードの上に追加できる（デフォルト）', () => {
        const existingCard = cardFactory.withName('Existing').build()
        const board = boardFactory.withZone('monsterZones', 0, [existingCard]).build()
        const zone: ZoneId = { player: 'self', type: 'monsterZone', index: 0, cardIndex: 0 }

        const result = addCardToZone(board, zone, testCard)

        expect(result.monsterZones[0]).toHaveLength(2)
        expect(result.monsterZones[0][0].id).toBe(testCard.id)
        expect(result.monsterZones[0][1].id).toBe(existingCard.id)
      })

      it('既存カードの下に追加できる', () => {
        const existingCard = cardFactory.withName('Existing').build()
        const board = boardFactory.withZone('monsterZones', 0, [existingCard]).build()
        const zone: ZoneId = { player: 'self', type: 'monsterZone', index: 0, cardIndex: 1 }

        const result = addCardToZone(board, zone, testCard)

        expect(result.monsterZones[0]).toHaveLength(2)
        expect(result.monsterZones[0][0].id).toBe(existingCard.id)
        expect(result.monsterZones[0][1].id).toBe(testCard.id)
      })

      it('満杯時はカードを追加せず元のボードを返す', () => {
        // 全モンスターゾーンを埋める
        const board = boardFactory.preset('fullMonsters').build()
        const zone: ZoneId = { player: 'self', type: 'monsterZone' }

        const result = addCardToZone(board, zone, testCard)

        // 元のボードと同じ
        expect(result).toEqual(board)
      })

      it('スタック内のカードのrotationとcounterをリセットする', () => {
        const existingCard = cardFactory
          .withName('Existing')
          .withRotation(180)
          .withCounter(3)
          .build()
        const board = boardFactory.withZone('monsterZones', 0, [existingCard]).build()
        const zone: ZoneId = { player: 'self', type: 'monsterZone', index: 0, cardIndex: 0 }

        const result = addCardToZone(board, zone, testCard)

        // 新カード（index 0）は元の値を保持（rotationは設定されていない場合undefined）
        expect(result.monsterZones[0][0].rotation).toBe(testCard.rotation)
        expect(result.monsterZones[0][0].counter).toBe(testCard.counter)

        // 既存カード（index 1）はリセットされる
        expect(result.monsterZones[0][1].rotation).toBe(0)
        expect(result.monsterZones[0][1].counter).toBeUndefined()
      })
    })

    describe('魔法罠ゾーン', () => {
      it('空の魔法罠ゾーンにカードを追加できる', () => {
        const spellCard = cardFactory.spell().build()
        const zone: ZoneId = { player: 'self', type: 'spellTrapZone', index: 1 }

        const result = addCardToZone(emptyBoard, zone, spellCard)

        expect(result.spellTrapZones[1]).toHaveLength(1)
        expect(result.spellTrapZones[1][0].id).toBe(spellCard.id)
      })

      it('満杯時はカードを追加せず元のボードを返す', () => {
        const board = boardFactory.preset('fullSpellTraps').build()
        const spellCard = cardFactory.spell().build()
        const zone: ZoneId = { player: 'self', type: 'spellTrapZone' }

        const result = addCardToZone(board, zone, spellCard)

        expect(result).toEqual(board)
      })
    })

    describe('フィールドゾーン', () => {
      it('空のフィールドゾーンにカードを配置できる', () => {
        const fieldSpell = cardFactory.spell().withName('Field Spell').build()
        const zone: ZoneId = { player: 'self', type: 'fieldZone' }

        const result = addCardToZone(emptyBoard, zone, fieldSpell)

        expect(result.fieldZone).toBeDefined()
        expect(result.fieldZone?.id).toBe(fieldSpell.id)
      })

      it('既存カードがある場合は配置せず元のボードを返す', () => {
        const existingField = cardFactory.spell().withName('Existing Field').build()
        const board = boardFactory.withField(existingField).build()
        const newField = cardFactory.spell().withName('New Field').build()
        const zone: ZoneId = { player: 'self', type: 'fieldZone' }

        const result = addCardToZone(board, zone, newField)

        expect(result.fieldZone?.id).toBe(existingField.id)
        expect(result).toEqual(board)
      })
    })

    describe('手札', () => {
      it('手札の末尾にカードを追加できる', () => {
        const board = boardFactory.withHand(2).build()
        const zone: ZoneId = { player: 'self', type: 'hand' }

        const result = addCardToZone(board, zone, testCard)

        expect(result.hand).toHaveLength(3)
        expect(result.hand[2].id).toBe(testCard.id)
      })

      it('手札の特定位置にカードを挿入できる', () => {
        const board = boardFactory.withHand(2).build()
        const zone: ZoneId = { player: 'self', type: 'hand', index: 1 }

        const result = addCardToZone(board, zone, testCard)

        expect(result.hand).toHaveLength(3)
        expect(result.hand[1].id).toBe(testCard.id)
      })

      it('手札に追加時にカウンターをリセットする', () => {
        const cardWithCounter = cardFactory.withCounter(5).build()
        const zone: ZoneId = { player: 'self', type: 'hand' }

        const result = addCardToZone(emptyBoard, zone, cardWithCounter)

        expect(result.hand[0].counter).toBeUndefined()
      })
    })

    describe('デッキ', () => {
      it('デッキのボトムにカードを追加できる', () => {
        const board = boardFactory.withDeck(2).build()
        const zone: ZoneId = { player: 'self', type: 'deck' }

        const result = addCardToZone(board, zone, testCard)

        expect(result.deck).toHaveLength(3)
        expect(result.deck[2].id).toBe(testCard.id)
      })

      it('デッキの特定位置にカードを挿入できる', () => {
        const board = boardFactory.withDeck(2).build()
        const zone: ZoneId = { player: 'self', type: 'deck', index: 1 }

        const result = addCardToZone(board, zone, testCard)

        expect(result.deck).toHaveLength(3)
        expect(result.deck[1].id).toBe(testCard.id)
      })
    })

    describe('墓地', () => {
      it('墓地の末尾にカードを追加できる', () => {
        const board = boardFactory.build()
        board.graveyard = [cardFactory.withName('Old Card').build()]
        const zone: ZoneId = { player: 'self', type: 'graveyard' }

        const result = addCardToZone(board, zone, testCard)

        expect(result.graveyard).toHaveLength(2)
        expect(result.graveyard[1].id).toBe(testCard.id)
      })
    })

    describe('フリーゾーン', () => {
      it('フリーゾーンにカードを追加できる', () => {
        const zone: ZoneId = { player: 'self', type: 'freeZone' }

        const result = addCardToZone(emptyBoard, zone, testCard)

        expect(result.freeZone).toHaveLength(1)
        expect(result.freeZone![0].id).toBe(testCard.id)
      })

      it('フリーゾーン追加時にrotationをリセットする', () => {
        const rotatedCard = cardFactory.withRotation(180).build()
        const zone: ZoneId = { player: 'self', type: 'freeZone' }

        const result = addCardToZone(emptyBoard, zone, rotatedCard)

        expect(result.freeZone![0].rotation).toBe(0)
      })

      it('フリーゾーン追加時にfaceDownをfalseにする', () => {
        const faceDownCard = cardFactory.withFaceDown(true).build()
        const zone: ZoneId = { player: 'self', type: 'freeZone' }

        const result = addCardToZone(emptyBoard, zone, faceDownCard)

        expect(result.freeZone![0].faceDown).toBe(false)
      })
    })

    describe('サイドフリーゾーン', () => {
      it('サイドフリーゾーンにカードを追加できる', () => {
        const zone: ZoneId = { player: 'self', type: 'sideFreeZone' }

        const result = addCardToZone(emptyBoard, zone, testCard)

        expect(result.sideFreeZone).toHaveLength(1)
        expect(result.sideFreeZone![0].id).toBe(testCard.id)
      })
    })

    describe('エクストラモンスターゾーン', () => {
      it('エクストラモンスターゾーンにカードを追加できる', () => {
        const zone: ZoneId = { player: 'self', type: 'extraMonsterZone', index: 0 }

        const result = addCardToZone(emptyBoard, zone, testCard)

        expect(result.extraMonsterZones[0]).toHaveLength(1)
        expect(result.extraMonsterZones[0][0].id).toBe(testCard.id)
      })
    })

    describe('immutability', () => {
      it('元のボードオブジェクトを変更しない', () => {
        const originalBoard = boardFactory.build()
        const originalBoardCopy = JSON.parse(JSON.stringify(originalBoard))
        const zone: ZoneId = { player: 'self', type: 'hand' }

        addCardToZone(originalBoard, zone, testCard)

        expect(originalBoard).toEqual(originalBoardCopy)
      })
    })
  })

  describe('removeCardFromZoneById', () => {
    it('モンスターゾーンからカードを削除できる', () => {
      const card = cardFactory.build()
      const board = boardFactory.withZone('monsterZones', 0, [card]).build()
      const zone: ZoneId = { player: 'self', type: 'monsterZone', index: 0 }

      const result = removeCardFromZoneById(board, zone, card.id)

      expect(result.monsterZones[0]).toHaveLength(0)
    })

    it('スタックから特定カードを削除できる', () => {
      const card1 = cardFactory.withName('Card 1').build()
      const card2 = cardFactory.withName('Card 2').build()
      const card3 = cardFactory.withName('Card 3').build()
      const board = boardFactory.withZone('monsterZones', 0, [card1, card2, card3]).build()
      const zone: ZoneId = { player: 'self', type: 'monsterZone', index: 0 }

      const result = removeCardFromZoneById(board, zone, card2.id)

      expect(result.monsterZones[0]).toHaveLength(2)
      expect(result.monsterZones[0][0].id).toBe(card1.id)
      expect(result.monsterZones[0][1].id).toBe(card3.id)
    })

    it('手札からカードを削除できる', () => {
      const board = boardFactory.withHand(3).build()
      const cardToRemove = board.hand[1]
      const zone: ZoneId = { player: 'self', type: 'hand' }

      const result = removeCardFromZoneById(board, zone, cardToRemove.id)

      expect(result.hand).toHaveLength(2)
      expect(result.hand.find(c => c.id === cardToRemove.id)).toBeUndefined()
    })

    it('フィールドゾーンからカードを削除できる', () => {
      const fieldCard = cardFactory.spell().build()
      const board = boardFactory.withField(fieldCard).build()
      const zone: ZoneId = { player: 'self', type: 'fieldZone' }

      const result = removeCardFromZoneById(board, zone, fieldCard.id)

      expect(result.fieldZone).toBeNull()
    })

    it('存在しないカードIDの場合は元のボードを返す', () => {
      const card = cardFactory.build()
      const board = boardFactory.withZone('monsterZones', 0, [card]).build()
      const zone: ZoneId = { player: 'self', type: 'monsterZone', index: 0 }

      const result = removeCardFromZoneById(board, zone, 'non-existent-id')

      expect(result).toEqual(board)
      expect(result.monsterZones[0]).toHaveLength(1)
    })

    it('空のゾーンから削除しようとした場合は元のボードを返す', () => {
      const zone: ZoneId = { player: 'self', type: 'monsterZone', index: 0 }

      const result = removeCardFromZoneById(emptyBoard, zone, 'any-id')

      expect(result).toEqual(emptyBoard)
    })
  })
})
