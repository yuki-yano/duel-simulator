import type { Card, PlayerBoard } from '../../shared/types/game'
import { CardFactory } from './CardFactory'

type BoardPreset = 'fullMonsters' | 'fullSpellTrap' | 'fullSpellTraps' | 'midGame'

export class BoardFactory {
  private cardFactory = new CardFactory()
  private board: PlayerBoard = this.createEmptyBoard()
  private customZones: Map<string, { index?: number; cards: Card[] }> = new Map()

  private createEmptyBoard(): PlayerBoard {
    return {
      hand: [],
      deck: [],
      graveyard: [],
      banished: [],
      extraDeck: [],
      monsterZones: [[], [], [], [], []],
      spellTrapZones: [[], [], [], [], []],
      extraMonsterZones: [[], []],
      fieldZone: null,
      freeZone: [],
      sideFreeZone: [],
      sideDeck: [],
      lifePoints: 8000
    }
  }

  withHand(count: number): this {
    this.board.hand = this.cardFactory.buildMany(count)
    return this
  }

  withDeck(count: number): this {
    this.board.deck = this.cardFactory.buildMany(count)
    return this
  }

  withGraveyard(count: number): this {
    this.board.graveyard = this.cardFactory.buildMany(count)
    return this
  }

  withExtraDeck(count: number): this {
    this.board.extraDeck = this.cardFactory.buildMany(count)
    return this
  }

  withZone(zone: 'monsterZones' | 'spellTrapZones' | 'extraMonsterZones', index: number, cards: Card[]): this {
    if (zone === 'monsterZones' && index >= 0 && index < 5) {
      this.board.monsterZones[index] = cards
    } else if (zone === 'spellTrapZones' && index >= 0 && index < 5) {
      this.board.spellTrapZones[index] = cards
    } else if (zone === 'extraMonsterZones' && index >= 0 && index < 2) {
      this.board.extraMonsterZones[index] = cards
    }
    return this
  }

  withFieldZone(card: Card | null): this {
    this.board.fieldZone = card
    return this
  }

  withField(card: Card | null): this {
    this.board.fieldZone = card
    return this
  }

  preset(preset: BoardPreset): this {
    switch (preset) {
      case 'fullMonsters':
        for (let i = 0; i < 5; i++) {
          this.board.monsterZones[i] = [this.cardFactory.build()]
        }
        break

      case 'fullSpellTrap':
      case 'fullSpellTraps':
        for (let i = 0; i < 5; i++) {
          const card = i % 2 === 0 ? this.cardFactory.spell().build() : this.cardFactory.trap().build()
          this.board.spellTrapZones[i] = [card]
        }
        break

      case 'midGame': {
        // 中盤の典型的な盤面
        this.board.hand = this.cardFactory.buildMany(5)
        this.board.deck = this.cardFactory.buildMany(30)

        // モンスター2-3体
        this.board.monsterZones[1] = [this.cardFactory.build()]
        this.board.monsterZones[2] = [this.cardFactory.build()]
        if (Math.random() > 0.5) {
          this.board.monsterZones[3] = [this.cardFactory.build()]
        }

        // 魔法置1-2枚
        this.board.spellTrapZones[2] = [this.cardFactory.trap().build()]
        if (Math.random() > 0.5) {
          this.board.spellTrapZones[3] = [this.cardFactory.spell().build()]
        }

        // 墓地に5-8枚
        const graveyardCount = 5 + Math.floor(Math.random() * 4)
        this.board.graveyard = this.cardFactory.buildMany(graveyardCount)
        break
      }
    }
    return this
  }

  build(): PlayerBoard {
    const result = { ...this.board }
    this.board = this.createEmptyBoard()
    this.customZones.clear()
    return result
  }
}
