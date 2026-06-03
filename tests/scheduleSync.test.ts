import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { performSync } from '../src/plugin'
import { useOfflineSyncStore } from '../src/stores/offlineSyncStore'
import { initIDB } from '../src/services/idb'
import { debounce } from '../src/utils/debounce'

let dbCounter = 0

beforeEach(async () => {
  dbCounter++
  await initIDB(`test-schedule-sync-${dbCounter}`, `test-store-${dbCounter}`)
})

const fastRetry = { maxRetries: 2, retryDelay: 1 }

describe('scheduleSync pattern (plugin install)', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  function createScheduleSync(
    store: ReturnType<typeof useOfflineSyncStore>,
    debounceMs: number,
    onSyncNeeded: ReturnType<typeof vi.fn>,
  ) {
    if (debounceMs > 0) {
      return debounce(() => {
        if (store.isOnline) {
          performSync(store, onSyncNeeded, fastRetry)
        }
      }, debounceMs)
    }
    return () => {
      if (store.isOnline) {
        performSync(store, onSyncNeeded, fastRetry)
      }
    }
  }

  it('should debounce performSync on rapid scheduleSync calls', async () => {
    vi.useFakeTimers()
    const store = useOfflineSyncStore()
    const onSyncNeeded = vi.fn().mockResolvedValue([])

    store.setNetworkStatus('offline')
    await store.save('key1', 'a')

    const scheduleSync = createScheduleSync(store, 100, onSyncNeeded)
    store.setNetworkStatus('online')

    scheduleSync()
    scheduleSync()
    scheduleSync()

    expect(onSyncNeeded).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(100)

    expect(onSyncNeeded).toHaveBeenCalledTimes(1)
  })

  it('should call performSync on each scheduleSync when debounceMs is 0', async () => {
    const store = useOfflineSyncStore()
    const onSyncNeeded = vi.fn().mockResolvedValue([])

    store.setNetworkStatus('offline')
    await store.save('key1', 'a')

    const scheduleSync = createScheduleSync(store, 0, onSyncNeeded)
    store.setNetworkStatus('online')

    scheduleSync()
    await vi.waitFor(() => expect(onSyncNeeded).toHaveBeenCalledTimes(1))

    onSyncNeeded.mockClear()
    await store.save('key2', 'b')

    scheduleSync()
    await vi.waitFor(() => expect(onSyncNeeded).toHaveBeenCalledTimes(1))
  })
})
