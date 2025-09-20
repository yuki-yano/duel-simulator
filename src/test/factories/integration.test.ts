import { describe, it, expect } from "vitest"
import {
  CardFactory,
  BoardFactory,
  OperationFactory,
  getCard,
  getDeck,
  getGameState,
  createSampleReplay,
} from "./index"

describe("ファクトリー統合テスト", () => {
  describe("ファクトリーの統合", () => {
    it("複数のファクトリーを組み合わせて使用できる", () => {
      const cardFactory = new CardFactory()
      const boardFactory = new BoardFactory()
      const operationFactory = new OperationFactory()

      // カードを作成
      const monster = cardFactory.withName("Test Dragon").withAttack(2500).build()

      // ボードを作成してカードを配置
      const board = boardFactory.withZone("monsterZones", 2, [monster]).build()

      // 操作を記録
      const operation = operationFactory
        .summon(monster.id, {
          player: "self",
          zoneType: "monsterZone",
          zoneIndex: 2,
        })
        .build()

      expect(board.monsterZones[2][0].id).toBe(monster.id)
      expect(operation.cardId).toBe(monster.id)
      expect(operation.to?.zoneType).toBe("monsterZone")
      expect(operation.to?.zoneIndex).toBe(2)
    })
  })

  describe("フィクスチャー", () => {
    it("有名カードを取得できる", () => {
      const blueEyes = getCard("BlueEyesWhiteDragon")
      expect(blueEyes.name).toBe("青眼の白龍")
      expect(blueEyes.attack).toBe(3000)
      expect(blueEyes.defense).toBe(2500)
      expect(blueEyes.level).toBe(8)
    })

    it("プリセットデッキを取得できる", () => {
      const deck = getDeck("starter")
      expect(deck).toHaveLength(40)

      const monsters = deck.filter((c) => c.type === "monster")
      const spells = deck.filter((c) => c.type === "spell")
      const traps = deck.filter((c) => c.type === "trap")

      expect(monsters).toHaveLength(30)
      expect(spells).toHaveLength(7)
      expect(traps).toHaveLength(3)
    })

    it("ゲーム状態を取得できる", () => {
      const { player1 } = getGameState("midGame")

      expect(player1.hand.length).toBeGreaterThanOrEqual(4)
      expect(player1.hand.length).toBeLessThanOrEqual(6)
      expect(player1.graveyard.length).toBeGreaterThan(0)

      const p1Monsters = player1.monsterZones.filter((z) => z.length > 0)
      expect(p1Monsters.length).toBeGreaterThanOrEqual(2)
      expect(p1Monsters.length).toBeLessThanOrEqual(3)
    })

    it("サンプルリプレイを生成できる", () => {
      const replay = createSampleReplay()

      expect(replay.length).toBeGreaterThan(0)
      expect(replay[0].type).toBe("draw")

      const summonOps = replay.filter((op) => op.type === "summon")
      expect(summonOps.length).toBeGreaterThanOrEqual(2)

      const attackOps = replay.filter((op) => op.type === "attack")
      expect(attackOps.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe("メソッドチェーンのテスト", () => {
    it("カードファクトリーのメソッドチェーンが正しく動作する", () => {
      const factory = new CardFactory()
      const card = factory.spell().withName("Power Spell").build()

      expect(card.type).toBe("spell")
      expect(card.name).toBe("Power Spell")
      expect(card.attack).toBeUndefined()
    })

    it("ボードファクトリーのメソッドチェーンが正しく動作する", () => {
      const factory = new BoardFactory()
      const board = factory.withHand(5).withDeck(40).preset("fullMonsters").build()

      expect(board.hand).toHaveLength(5)
      expect(board.deck).toHaveLength(40)
      board.monsterZones.forEach((zone) => {
        expect(zone).toHaveLength(1)
      })
    })
  })
})
