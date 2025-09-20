import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { atom, useAtomValue } from 'jotai'
import { TestWrapper } from './TestWrapper'

const testAtom = atom('initial')

describe('TestWrapper', () => {
  describe('基本機能', () => {
    it('子コンポーネントをレンダリングできる', () => {
      render(
        <TestWrapper>
          <div>Test Content</div>
        </TestWrapper>
      )
      expect(screen.getByText('Test Content')).toBeInTheDocument()
    })

    it('Jotai Providerが含まれる', () => {
      const TestComponent = () => {
        const value = useAtomValue(testAtom)
        return <div>{value}</div>
      }

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      )
      expect(screen.getByText('initial')).toBeInTheDocument()
    })
  })

  describe('Provider機能', () => {
    it('Jotaiのatomを正しくProvideできる', () => {
      const customAtom = atom('test value')
      const TestComponent = () => {
        const value = useAtomValue(customAtom)
        return <div>{value}</div>
      }

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      )
      expect(screen.getByText('test value')).toBeInTheDocument()
    })
  })

  describe('エラーハンドリング', () => {
    it('子コンポーネントのエラーをキャッチできる', () => {
      const ThrowError = () => {
        throw new Error('Test error')
      }

      render(
        <TestWrapper>
          <ThrowError />
        </TestWrapper>
      )

      expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument()
    })

    it('onErrorコールバックが呼ばれる', () => {
      const onError = vi.fn()
      const ThrowError = () => {
        throw new Error('Test error')
      }

      render(
        <TestWrapper onError={onError}>
          <ThrowError />
        </TestWrapper>
      )

      expect(onError).toHaveBeenCalled()
      const errorCall = onError.mock.calls[0]
      expect(errorCall[0]).toBeInstanceOf(Error)
      expect(errorCall[0].message).toBe('Test error')
    })
  })
})
