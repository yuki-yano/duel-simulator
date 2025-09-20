import { describe, it, expect } from 'vitest'

// サンプルテスト: Vitest環境が正しく動作することを確認
describe('Vitest環境の動作確認', () => {
  it('基本的な演算が正しく動作する', () => {
    expect(1 + 1).toBe(2)
    expect(true).toBe(true)
    expect('hello').toBe('hello')
  })

  it('配列の操作が正しく動作する', () => {
    const array = [1, 2, 3]
    expect(array).toHaveLength(3)
    expect(array).toContain(2)
    expect(array[0]).toBe(1)
  })

  it('オブジェクトの比較が正しく動作する', () => {
    const obj = { name: 'test', value: 42 }
    expect(obj).toEqual({ name: 'test', value: 42 })
    expect(obj).toHaveProperty('name')
    expect(obj.value).toBe(42)
  })

  it('非同期処理が正しく動作する', async () => {
    const promise = Promise.resolve('success')
    await expect(promise).resolves.toBe('success')
  })

  it('例外のテストが正しく動作する', () => {
    const throwError = () => {
      throw new Error('Test error')
    }
    expect(throwError).toThrow('Test error')
  })
})
