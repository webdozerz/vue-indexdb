import { describe, it, expect, vi } from 'vitest'
import { withRetry } from '../src/utils/retry'

describe('withRetry', () => {
  it('should return result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    const result = await withRetry(fn, { maxRetries: 3, retryDelay: 10 })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('should retry until success', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok')

    const result = await withRetry(fn, { maxRetries: 3, retryDelay: 1 })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('should throw after maxRetries exhausted', async () => {
    const error = new Error('persistent')
    const fn = vi.fn().mockRejectedValue(error)

    await expect(
      withRetry(fn, { maxRetries: 2, retryDelay: 1 }),
    ).rejects.toThrow('persistent')
    expect(fn).toHaveBeenCalledTimes(3)
  })
})
