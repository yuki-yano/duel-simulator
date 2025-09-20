import { nanoid } from 'nanoid'
import type { GameOperation } from '../../shared/types/game'

interface Location {
  player: 'self' | 'opponent'
  zoneType: 'monsterZone' | 'spellTrapZone' | 'fieldZone' | 'graveyard' | 'banished' | 'extraDeck' | 'deck' | 'hand' | 'extraMonsterZone' | 'freeZone' | 'sideFreeZone' | 'sideDeck'
  zoneIndex?: number
}

export class OperationFactory {
  private operation: Partial<GameOperation> = {}
  private timestampIncrement = 100 // ms between operations in sequence

  private reset(): void {
    this.operation = {}
  }

  move(from: Location, to: Location): this {
    this.operation = {
      type: 'move',
      player: from.player,
      cardId: nanoid(),
      from: { player: from.player, zoneType: from.zoneType, zoneIndex: from.zoneIndex },
      to: { player: to.player, zoneType: to.zoneType, zoneIndex: to.zoneIndex },
      timestamp: Date.now(),
      id: nanoid()
    }
    return this
  }

  summon(cardId: string, to: Location): this {
    this.operation = {
      type: 'summon',
      player: to.player,
      cardId,
      to: { player: to.player, zoneType: to.zoneType, zoneIndex: to.zoneIndex },
      timestamp: Date.now(),
      id: nanoid()
    }
    return this
  }

  attack(attackerId: string, targetId: string, metadata?: Record<string, unknown>): this {
    this.operation = {
      type: 'attack',
      cardId: attackerId,
      player: 'self', // デフォルト値
      metadata: { ...metadata, targetId },
      timestamp: Date.now(),
      id: nanoid()
    }
    return this
  }

  flip(cardId: string): this {
    this.operation = {
      type: 'changePosition',
      cardId,
      player: 'self', // デフォルト値
      metadata: { flip: true },
      timestamp: Date.now(),
      id: nanoid()
    }
    return this
  }

  draw(player: 'self' | 'opponent'): this {
    this.operation = {
      type: 'draw',
      player,
      cardId: nanoid(), // ドロー操作でもcardIdが必要
      timestamp: Date.now(),
      id: nanoid()
    }
    return this
  }

  changePosition(cardId: string, position: 'attack' | 'defense'): this {
    this.operation = {
      type: 'changePosition',
      cardId,
      player: 'self', // デフォルト値
      metadata: { position },
      timestamp: Date.now(),
      id: nanoid()
    }
    return this
  }

  startTurn(player: 'self' | 'opponent'): this {
    this.operation = {
      type: 'draw', // startTurnは存在しないのでdrawで代替
      player,
      cardId: nanoid(),
      timestamp: Date.now(),
      id: nanoid()
    }
    return this
  }

  withTimestamp(timestamp: number): this {
    this.operation.timestamp = timestamp
    return this
  }

  withMetadata(metadata: Record<string, unknown>): this {
    this.operation.metadata = metadata
    return this
  }

  build(): GameOperation {
    // 必須フィールドを確保
    if (this.operation.id === undefined) {
      this.operation.id = nanoid()
    }
    if (this.operation.timestamp === undefined) {
      this.operation.timestamp = Date.now()
    }
    if (this.operation.player === undefined) {
      this.operation.player = 'self'
    }
    if (this.operation.cardId === undefined) {
      this.operation.cardId = nanoid()
    }
    const result = { ...this.operation } as GameOperation
    this.reset()
    return result
  }

  sequence(builders: OperationFactory[]): GameOperation[] {
    const operations: GameOperation[] = []
    const currentTime = Date.now()

    builders.forEach((builder, index) => {
      const op = builder.build()
      op.timestamp = currentTime + index * this.timestampIncrement
      operations.push(op)
    })

    return operations
  }

  turnSequence(player: 'self' | 'opponent', builders: OperationFactory[]): GameOperation[] {
    const startTurnOp = this.startTurn(player).build()
    const operations = this.sequence(builders)
    return [startTurnOp, ...operations]
  }
}
