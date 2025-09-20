import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeAll, vi } from 'vitest'
import './matchers'

// ==================== グローバル設定 ====================

// React Testing Library自動クリーンアップ
afterEach(() => {
  cleanup()
})

// ==================== ブラウザAPIモック ====================

// IntersectionObserver モック
beforeAll(() => {
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
    takeRecords: vi.fn(),
    root: null,
    rootMargin: '',
    thresholds: []
  }))
})

// ResizeObserver モック
beforeAll(() => {
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn()
  }))
})

// matchMedia モック
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  })
})

// ==================== エラーハンドリング ====================

// コンソールエラーの監視
const originalError = console.error
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    // React Testing Libraryの警告は無視
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render')
    ) {
      return
    }
    originalError.call(console, ...args)
  }
})

afterEach(() => {
  console.error = originalError
})

// ==================== タイムアウト設定 ====================

// 長時間実行テストのタイムアウト延長
export const extendTimeout = (timeout = 30000) => {
  vi.setConfig({ testTimeout: timeout })
}

// ==================== カスタムマッチャー ====================

// カスタムマッチャーはmatchers.tsで定義

// カスタムマッチャーの実装はhelpers.tsに移動
