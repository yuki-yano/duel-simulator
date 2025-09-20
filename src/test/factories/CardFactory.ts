import { nanoid } from 'nanoid'
import type { Card } from '../../shared/types/game'

export class CardFactory {
  private defaults: Partial<Card> = {
    id: '',
    name: 'Test Card',
    type: 'monster',
    attack: 1000,
    defense: 1000,
    level: 4,
    position: 'attack',
    rotation: 0
  }

  private overrides: Partial<Card> = {}
  private shouldRandomize = false

  constructor() {
    this.reset()
  }

  private reset(): void {
    this.overrides = {}
    this.shouldRandomize = false
  }

  spell(): this {
    this.overrides.type = 'spell'
    delete this.overrides.attack
    delete this.overrides.defense
    delete this.overrides.level
    return this
  }

  trap(): this {
    this.overrides.type = 'trap'
    delete this.overrides.attack
    delete this.overrides.defense
    delete this.overrides.level
    return this
  }

  withName(name: string): this {
    this.overrides.name = name
    return this
  }

  withAttack(attack: number): this {
    this.overrides.attack = attack
    return this
  }

  withDefense(defense: number): this {
    this.overrides.defense = defense
    return this
  }

  withLevel(level: number): this {
    this.overrides.level = level
    return this
  }

  faceDown(): this {
    this.overrides.faceDown = true
    return this
  }

  inDefensePosition(): this {
    this.overrides.position = 'defense'
    return this
  }

  withRotation(rotation: number): this {
    this.overrides.rotation = rotation
    return this
  }

  withCounter(counter: number): this {
    this.overrides.counter = counter
    return this
  }

  withFaceDown(faceDown: boolean): this {
    this.overrides.faceDown = faceDown
    return this
  }

  randomize(): this {
    this.shouldRandomize = true
    return this
  }

  private generateRandomStats(): Partial<Card> {
    return {
      attack: Math.floor(Math.random() * 5001),
      defense: Math.floor(Math.random() * 5001),
      level: Math.floor(Math.random() * 12) + 1
    }
  }

  build(customOverrides: Partial<Card> = {}): Card {
    const id = nanoid()
    let cardData = { ...this.defaults }

    if (this.shouldRandomize) {
      cardData = { ...cardData, ...this.generateRandomStats() }
    }

    // Apply overrides from method chains
    cardData = { ...cardData, ...this.overrides }

    // Apply custom overrides from parameter
    cardData = { ...cardData, ...customOverrides }

    // Set ID
    cardData.id = id

    // Handle type-specific fields
    if (cardData.type === 'spell' || cardData.type === 'trap') {
      delete cardData.attack
      delete cardData.defense
      delete cardData.level
    }

    const result = cardData as Card
    this.reset()
    return result
  }

  buildMany(count: number, customOverrides: Partial<Card> = {}): Card[] {
    const cards: Card[] = []
    for (let i = 0; i < count; i++) {
      cards.push(this.build(customOverrides))
    }
    return cards
  }
}
