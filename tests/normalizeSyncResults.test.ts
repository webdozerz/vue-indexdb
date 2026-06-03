import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { normalizeSyncResults } from '../src/utils/normalizeSyncResults'
import type { SyncOperation } from '../src/types'

const operations: SyncOperation[] = [
  {
    id: '1',
    key: 'key1',
    data: 'a',
    timestamp: 1,
    type: 'update',
    retries: 0,
    status: 'pending',
  },
  {
    id: '2',
    key: 'key2',
    data: 'b',
    timestamp: 2,
    type: 'update',
    retries: 0,
    status: 'pending',
  },
]

describe('normalizeSyncResults', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should return synthetic failures when response is not an array', () => {
    const results = normalizeSyncResults(null, operations)

    expect(results).toHaveLength(2)
    expect(results.every((r) => !r.success)).toBe(true)
    expect(console.warn).toHaveBeenCalled()
  })

  it('should fill missing keys with incomplete failure', () => {
    const results = normalizeSyncResults(
      [{ key: 'key1', success: true }],
      operations,
    )

    expect(results[0]).toEqual({ key: 'key1', success: true })
    expect(results[1].key).toBe('key2')
    expect(results[1].success).toBe(false)
    expect(results[1].error?.message).toBe('Incomplete sync response')
  })

  it('should skip invalid entries and warn', () => {
    const results = normalizeSyncResults(
      [{ key: 'key1', success: true }, { bad: true }, { key: 'key2', success: false }],
      operations,
    )

    expect(results[0].success).toBe(true)
    expect(results[1].success).toBe(false)
    expect(console.warn).toHaveBeenCalled()
  })
})
