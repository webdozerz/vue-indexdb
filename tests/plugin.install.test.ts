import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createApp } from 'vue'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { VueOfflineSync } from '../src/plugin'
import { useOfflineSyncStore } from '../src/stores/offlineSyncStore'
import { stopNetworkMonitor } from '../src/services/networkMonitor'

describe('VueOfflineSync install scheduleSync', () => {
  let pinia: Pinia

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    stopNetworkMonitor()
  })

  afterEach(() => {
    stopNetworkMonitor()
    vi.useRealTimers()
  })

  async function installPlugin(debounceMs: number, onSyncNeeded: ReturnType<typeof vi.fn>) {
    const app = createApp({})
    app.use(pinia)
    await app.use(VueOfflineSync, {
      debounceMs,
      onSyncNeeded,
    })
    return useOfflineSyncStore()
  }

  it('should debounce performSync on rapid online events', async () => {
    const onSyncNeeded = vi.fn().mockResolvedValue([])
    const store = await installPlugin(100, onSyncNeeded)

    store.setNetworkStatus('offline')
    await store.save('key1', 'a')

    onSyncNeeded.mockClear()
    vi.useFakeTimers()

    window.dispatchEvent(new Event('online'))
    window.dispatchEvent(new Event('online'))
    window.dispatchEvent(new Event('online'))

    expect(onSyncNeeded).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(100)

    expect(onSyncNeeded).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('should call onSyncNeeded immediately when debounceMs is 0', async () => {
    const onSyncNeeded = vi.fn().mockResolvedValue([])
    const store = await installPlugin(0, onSyncNeeded)

    store.setNetworkStatus('offline')
    await store.save('key1', 'a')

    onSyncNeeded.mockClear()

    window.dispatchEvent(new Event('online'))
    await vi.waitFor(() => expect(onSyncNeeded).toHaveBeenCalledTimes(1))

    onSyncNeeded.mockClear()
    await store.save('key2', 'b')

    window.dispatchEvent(new Event('online'))
    await vi.waitFor(() => expect(onSyncNeeded).toHaveBeenCalledTimes(1))
  })
})
