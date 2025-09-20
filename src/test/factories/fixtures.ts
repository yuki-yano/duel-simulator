import type { Card, PlayerBoard, GameOperation } from '../../shared/types/game'
import { CardFactory } from './CardFactory'
import { BoardFactory } from './BoardFactory'
import { OperationFactory } from './OperationFactory'

/**
 * 有名カードデータ
 */
export const FAMOUS_CARDS = {
  BlueEyesWhiteDragon: {
    name: '青眼の白龍',
    type: 'monster' as const,
    attack: 3000,
    defense: 2500,
    level: 8
  },
  DarkMagician: {
    name: 'ブラック・マジシャン',
    type: 'monster' as const,
    attack: 2500,
    defense: 2100,
    level: 7
  },
  RedEyesBlackDragon: {
    name: '真紅眼の黒竜',
    type: 'monster' as const,
    attack: 2400,
    defense: 2000,
    level: 7
  },
  MonsterReborn: {
    name: '死者蘇生',
    type: 'spell' as const
  },
  MirrorForce: {
    name: '聖なるバリア ―ミラーフォース―',
    type: 'trap' as const
  }
} as const

/**
 * プリセットデッキ
 */
export const PRESET_DECKS = {
  starter: (): Card[] => {
    const factory = new CardFactory()
    const deck: Card[] = []
    
    // モンスターカード30枚
    for (let i = 0; i < 30; i++) {
      if (i < 5) {
        // 上級モンスター
        deck.push(factory.withLevel(7 + Math.floor(Math.random() * 2)).withAttack(2400 + Math.floor(Math.random() * 600)).build())
      } else if (i < 15) {
        // 中級モンスター
        deck.push(factory.withLevel(5 + Math.floor(Math.random() * 2)).withAttack(1500 + Math.floor(Math.random() * 500)).build())
      } else {
        // 下級モンスター
        deck.push(factory.withLevel(1 + Math.floor(Math.random() * 4)).withAttack(500 + Math.floor(Math.random() * 1000)).build())
      }
    }
    
    // 魔法カード7枚
    for (let i = 0; i < 7; i++) {
      deck.push(factory.spell().build())
    }
    
    // 罠カード3枚
    for (let i = 0; i < 3; i++) {
      deck.push(factory.trap().build())
    }
    
    return deck
  },
  
  exodia: (): Card[] => {
    const factory = new CardFactory()
    const deck: Card[] = []
    
    // エグゾディアパーツ
    deck.push(factory.withName('封印されしエグゾディア').withAttack(1000).withDefense(1000).build())
    deck.push(factory.withName('封印されし者の右腕').withAttack(200).withDefense(300).build())
    deck.push(factory.withName('封印されし者の左腕').withAttack(200).withDefense(300).build())
    deck.push(factory.withName('封印されし者の右足').withAttack(200).withDefense(300).build())
    deck.push(factory.withName('封印されし者の左足').withAttack(200).withDefense(300).build())
    
    // ドローサポート
    for (let i = 0; i < 35; i++) {
      deck.push(factory.spell().withName('ドローサポート').build())
    }
    
    return deck
  }
} as const

/**
 * ゲーム状態プリセット
 */
export const GAME_STATES = {
  earlyGame: (): { player1: PlayerBoard; player2: PlayerBoard } => {
    const boardFactory = new BoardFactory()
    return {
      player1: boardFactory.withHand(5).withDeck(35).build(),
      player2: boardFactory.withHand(5).withDeck(35).build()
    }
  },
  
  midGame: (): { player1: PlayerBoard; player2: PlayerBoard } => {
    const boardFactory = new BoardFactory()
    return {
      player1: boardFactory.preset('midGame').build(),
      player2: boardFactory.preset('midGame').build()
    }
  },
  
  lateGame: (): { player1: PlayerBoard; player2: PlayerBoard } => {
    const boardFactory = new BoardFactory()
    const cardFactory = new CardFactory()
    
    const player1 = boardFactory
      .withHand(2)
      .withDeck(10)
      .withGraveyard(20)
      .build()
    
    // フィールドに1-2体
    player1.monsterZones[2] = [cardFactory.withAttack(3000).build()]

    const player2 = boardFactory
      .withHand(1)
      .withDeck(8)
      .withGraveyard(22)
      .build()

    // フィールドに1体、伏せカード1枚
    player2.monsterZones[1] = [cardFactory.withAttack(2500).build()]
    player2.spellTrapZones[2] = [cardFactory.trap().faceDown().build()]
    
    return { player1, player2 }
  }
} as const

/**
 * ヘルパー関数
 */
export function getCard(cardName: keyof typeof FAMOUS_CARDS): Card {
  const cardFactory = new CardFactory()
  const cardData = FAMOUS_CARDS[cardName]
  return cardFactory.build(cardData)
}

export function getDeck(deckName: keyof typeof PRESET_DECKS): Card[] {
  return PRESET_DECKS[deckName]()
}

export function getGameState(stateName: keyof typeof GAME_STATES): { player1: PlayerBoard; player2: PlayerBoard } {
  return GAME_STATES[stateName]()
}

/**
 * サンプルリプレイデータ生成
 */
export function createSampleReplay(): GameOperation[] {
  const factory = new OperationFactory()
  const operations: GameOperation[] = []
  
  // ゲーム開始
  operations.push(factory.startTurn('self').build())
  operations.push(factory.draw('self').build())

  // モンスター召喚
  operations.push(factory.summon('card-1', { player: 'self', zoneType: 'monsterZone', zoneIndex: 2 }).build())

  // 魔法セット
  operations.push(factory.move(
    { player: 'self', zoneType: 'hand', zoneIndex: 1 },
    { player: 'self', zoneType: 'spellTrapZone', zoneIndex: 2 }
  ).build())

  // ターンエンド
  operations.push(factory.startTurn('opponent').build())
  operations.push(factory.draw('opponent').build())

  // 相手モンスター召喚
  operations.push(factory.summon('card-2', { player: 'opponent', zoneType: 'monsterZone', zoneIndex: 2 }).build())
  
  // 戦闘
  operations.push(factory.attack('card-2', 'card-1', { damage: 500 }).build())
  
  return operations
}
