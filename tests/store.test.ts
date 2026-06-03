import { describe, it, expect, beforeEach } from 'vitest'
import { useOfflineSyncStore } from '../src/stores/offlineSyncStore'
import { initIDB } from '../src/services/idb'

let dbCounter = 0

beforeEach(async () => {
  dbCounter++
  await initIDB(`test-store-db-${dbCounter}`, `test-store-${dbCounter}`)
})

describe('offlineSyncStore', () => {
  it('should have correct initial state', () => {
    const store = useOfflineSyncStore()
    expect(store.syncStatus).toBe('idle')
    expect(store.pendingCount).toBe(0)
    expect(store.pendingKeys).toEqual([])
    expect(store.lastSyncAt).toBeNull()
    expect(store.lastError).toBeNull()
  })

  it('should save data and update saveStatus', async () => {
    const store = useOfflineSyncStore()
    store.setNetworkStatus('online')

    await store.save('user', { name: 'John' })

    expect(store.getSaveStatus('user')).toBe('saved')
    expect(store.pendingCount).toBe(0)
  })

  it('should create pending operation when offline', async () => {
    const store = useOfflineSyncStore()
    store.setNetworkStatus('offline')

    await store.save('user', { name: 'John' })

    expect(store.getSaveStatus('user')).toBe('saved')
    expect(store.pendingCount).toBe(1)
    expect(store.pendingKeys).toContain('user')
    expect(store.pendingOperations[0].type).toBe('update')
    expect(store.pendingOperations[0].status).toBe('pending')
  })

  it('should update existing pending operation for same key', async () => {
    const store = useOfflineSyncStore()
    store.setNetworkStatus('offline')

    await store.save('user', { name: 'John' })
    await store.save('user', { name: 'Jane' })

    expect(store.pendingCount).toBe(1)
    expect(store.pendingOperations[0].data).toEqual({ name: 'Jane' })
  })

  it('should remove data and create delete operation when offline', async () => {
    const store = useOfflineSyncStore()
    store.setNetworkStatus('offline')

    await store.save('user', { name: 'John' })
    await store.remove('user')

    expect(store.pendingCount).toBe(1)
    expect(store.pendingOperations[0].type).toBe('delete')
  })

  it('should read data from IDB', async () => {
    const store = useOfflineSyncStore()
    await store.save('user', { name: 'John' })
    const data = await store.get('user')
    expect(data).toEqual({ name: 'John' })
  })

  it('should mark key as synced', async () => {
    const store = useOfflineSyncStore()
    store.setNetworkStatus('offline')

    await store.save('key1', 'a')
    await store.save('key2', 'b')

    store.markSynced('key1')

    expect(store.pendingCount).toBe(1)
    expect(store.pendingKeys).not.toContain('key1')
    expect(store.pendingKeys).toContain('key2')
  })

  it('should process sync results', async () => {
    const store = useOfflineSyncStore()
    store.setNetworkStatus('offline')

    await store.save('key1', 'a')
    await store.save('key2', 'b')

    store.processSyncResults([
      { key: 'key1', success: true },
      { key: 'key2', success: false, error: new Error('fail') },
    ])

    expect(store.pendingCount).toBe(1)
    expect(store.pendingOperations[0].key).toBe('key2')
    expect(store.pendingOperations[0].status).toBe('failed')
    expect(store.pendingOperations[0].retries).toBe(1)
    expect(store.syncStatus).toBe('synced')
    expect(store.lastSyncAt).not.toBeNull()
  })

  it('should set error sync status when all fail', async () => {
    const store = useOfflineSyncStore()
    store.setNetworkStatus('offline')

    await store.save('key1', 'a')

    store.processSyncResults([{ key: 'key1', success: false, error: new Error('fail') }])

    expect(store.syncStatus).toBe('error')
  })

  it('should clear queue', async () => {
    const store = useOfflineSyncStore()
    store.setNetworkStatus('offline')

    await store.save('key1', 'a')
    await store.save('key2', 'b')

    store.clearQueue()

    expect(store.pendingCount).toBe(0)
  })

  it('should mark all synced when last pending is removed', async () => {
    const store = useOfflineSyncStore()
    store.setNetworkStatus('offline')

    await store.save('key1', 'a')

    store.markSynced('key1')

    expect(store.pendingCount).toBe(0)
    expect(store.syncStatus).toBe('synced')
    expect(store.lastSyncAt).not.toBeNull()
  })
})
