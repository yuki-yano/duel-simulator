import { expect } from 'vitest'

// TypeScript型定義の拡張
declare module 'vitest' {
  interface Assertion<T = any> {
    toBeValidCard(): T
    toBeInZone(zone: string): T
    toHaveGameOperation(operation: Partial<{ type: string; cardId: string }>): T
    toHaveCardCount(count: number): T
  }
  interface AsymmetricMatchersContaining {
    toBeValidCard(): unknown
    toBeInZone(zone: string): unknown
    toHaveGameOperation(operation: Partial<{ type: string; cardId: string }>): unknown
    toHaveCardCount(count: number): unknown
  }
}

interface MatcherResult {
  pass: boolean
  message: () => string
}

// カスタムマッチャーの実装
expect.extend({
  /**
   * 有効なカード構造を検証する
   */
  toBeValidCard(received: unknown): MatcherResult {
    const isObject = (val: unknown): val is Record<string, unknown> => {
      return val !== null && val !== undefined && typeof val === 'object'
    }

    if (isObject(received) &&
        'id' in received && received.id !== undefined &&
        'name' in received && received.name !== undefined &&
        'type' in received && received.type !== undefined) {
      return {
        message: () => `expected ${JSON.stringify(received)} not to be a valid card`,
        pass: true
      }
    } else {
      const missing: string[] = []
      if (received === null || received === undefined) {
        missing.push('object is null/undefined')
      } else if (isObject(received)) {
        if (!('id' in received) || received.id === undefined) missing.push('id')
        if (!('name' in received) || received.name === undefined) missing.push('name')
        if (!('type' in received) || received.type === undefined) missing.push('type')
      } else {
        missing.push('not an object')
      }
      return {
        message: () => `expected ${JSON.stringify(received)} to be a valid card (missing: ${missing.join(', ')})`,
        pass: false
      }
    }
  },

  /**
   * カードが特定のゾーンに存在することを検証する
   */
  toBeInZone(received: unknown, zone: string): MatcherResult {
    const isCard = (val: unknown): val is { id: string; zone?: string } => {
      return val !== null && val !== undefined && typeof val === 'object' && 'id' in val
    }

    if (isCard(received)) {
      const inZone = received.zone === zone
      if (inZone) {
        return {
          message: () => `expected card ${received.id} not to be in ${zone}`,
          pass: true
        }
      } else {
        return {
          message: () => `expected card ${received.id} to be in ${zone}, but was in ${received.zone ?? 'unknown'}`,
          pass: false
        }
      }
    }
    return {
      message: () => `expected ${JSON.stringify(received)} to be a valid card`,
      pass: false
    }
  },

  /**
   * 操作配列に特定の操作が含まれることを検証する
   */
  toHaveGameOperation(received: unknown, expected: Partial<{ type: string; cardId: string }>): MatcherResult {
    if (!Array.isArray(received)) {
      return {
        message: () => `expected ${JSON.stringify(received)} to be an array`,
        pass: false
      }
    }

    const found = received.find((op) => {
      if (typeof op !== 'object' || op === null) return false
      const operation = op as Record<string, unknown>
      if (expected.type !== undefined && operation.type !== expected.type) return false
      if (expected.cardId !== undefined && operation.cardId !== expected.cardId) return false
      return true
    })

    if (found !== undefined) {
      return {
        message: () => `expected operations not to contain ${JSON.stringify(expected)}`,
        pass: true
      }
    } else {
      return {
        message: () => `expected operations to contain ${JSON.stringify(expected)}`,
        pass: false
      }
    }
  },

  /**
   * カード枚数を検証する
   */
  toHaveCardCount(received: unknown, expected: number): MatcherResult {
    if (!Array.isArray(received)) {
      return {
        message: () => `expected ${JSON.stringify(received)} to be an array`,
        pass: false
      }
    }

    const actual = received.length
    const pass = actual === expected

    if (pass) {
      return {
        message: () => `expected not to have ${expected} cards`,
        pass: true
      }
    } else {
      return {
        message: () => `expected to have ${expected} cards, but got ${actual}`,
        pass: false
      }
    }
  }
})
