import { describe, it, expect, vi, beforeEach } from 'vitest'
import { performSync } from '../src/plugin'
import { useOfflineSyncStore } from '../src/stores/offlineSyncStore'
import { initIDB } from '../src/services/idb'

let dbCounter = 0

beforeEach(async () => {
  dbCounter++
  await initIDB(`test-perform-sync-${dbCounter}`, `test-store-${dbCounter}`)
})

const fastRetry = { maxRetries: 2, retryDelay: 1 }

describe('performSync', () => {
  it('should mark failed operations and increment retries on partial failure', async () => {
    const store = useOfflineSyncStore()
    store.setNetworkStatus('offline')
    await store.save('key1', 'a')
    await store.save('key2', 'b')

    const onSyncNeeded = vi.fn().mockResolvedValue([
      { key: 'key1', success: true },
      { key: 'key2', success: false, error: new Error('fail') },
    ])

    await performSync(store, onSyncNeeded, fastRetry)

    expect(onSyncNeeded).toHaveBeenCalledTimes(1)
    expect(store.pendingCount).toBe(1)
    expect(store.pendingOperations[0].key).toBe('key2')
    expect(store.pendingOperations[0].status).toBe('failed')
    expect(store.pendingOperations[0].retries).toBe(1)
  })

  it('should retry onSyncNeeded when it throws then succeeds', async () => {
    const store = useOfflineSyncStore()
    store.setNetworkStatus('offline')
    await store.save('key1', 'a')

    const onSyncNeeded = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue([{ key: 'key1', success: true }])

    await performSync(store, onSyncNeeded, fastRetry)

    expect(onSyncNeeded).toHaveBeenCalledTimes(2)
    expect(store.pendingCount).toBe(0)
    expect(store.syncStatus).toBe('synced')
  })

  it('should mark operations failed after onSyncNeeded exhausts retries', async () => {
    const store = useOfflineSyncStore()
    store.setNetworkStatus('offline')
    await store.save('key1', 'a')

    const onSyncNeeded = vi.fn().mockRejectedValue(new Error('persistent'))

    await performSync(store, onSyncNeeded, fastRetry)

    expect(onSyncNeeded).toHaveBeenCalledTimes(3)
    expect(store.pendingCount).toBe(1)
    expect(store.pendingOperations[0].status).toBe('failed')
    expect(store.pendingOperations[0].retries).toBe(1)
    expect(store.syncStatus).toBe('error')
  })

  it('should skip operations that exceeded maxRetries', async () => {
    const store = useOfflineSyncStore()
    store.setNetworkStatus('offline')
    await store.save('key1', 'a')
    store.pendingOperations[0].status = 'failed'
    store.pendingOperations[0].retries = fastRetry.maxRetries

    const onSyncNeeded = vi.fn().mockResolvedValue([])

    await performSync(store, onSyncNeeded, fastRetry)

    expect(onSyncNeeded).not.toHaveBeenCalled()
  })

  it('should not run a second sync while already syncing', async () => {
    const store = useOfflineSyncStore()
    store.setNetworkStatus('offline')
    await store.save('key1', 'a')

    let resolveSync!: (value: { key: string; success: boolean }[]) => void
    const onSyncNeeded = vi.fn(
      () =>
        new Promise<{ key: string; success: boolean }[]>((resolve) => {
          resolveSync = resolve
        }),
    )

    const first = performSync(store, onSyncNeeded, fastRetry)
    await performSync(store, onSyncNeeded, fastRetry)

    expect(onSyncNeeded).toHaveBeenCalledTimes(1)

    resolveSync([{ key: 'key1', success: true }])
    await first

    expect(store.pendingCount).toBe(0)
  })

  it('should fail all operations when onSyncNeeded returns non-array', async () => {
    const store = useOfflineSyncStore()
    store.setNetworkStatus('offline')
    await store.save('key1', 'a')
    await store.save('key2', 'b')

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const onSyncNeeded = vi.fn().mockResolvedValue(null)

    await performSync(store, onSyncNeeded, fastRetry)

    expect(store.pendingCount).toBe(2)
    expect(store.pendingOperations.every((op) => op.status === 'failed')).toBe(true)
    expect(store.pendingOperations.every((op) => op.retries === 1)).toBe(true)
    expect(store.pendingOperations.every((op) => op.status !== 'syncing')).toBe(true)
    warnSpy.mockRestore()
  })

  it('should fail missing keys when onSyncNeeded returns partial results', async () => {
    const store = useOfflineSyncStore()
    store.setNetworkStatus('offline')
    await store.save('key1', 'a')
    await store.save('key2', 'b')

    const onSyncNeeded = vi.fn().mockResolvedValue([{ key: 'key1', success: true }])

    await performSync(store, onSyncNeeded, fastRetry)

    expect(store.pendingCount).toBe(1)
    expect(store.pendingOperations[0].key).toBe('key2')
    expect(store.pendingOperations[0].status).toBe('failed')
    expect(store.pendingOperations[0].retries).toBe(1)
  })
})
