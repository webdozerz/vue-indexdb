import { computed, inject } from 'vue'
import { useOfflineSyncStore } from '../stores/offlineSyncStore'
import type { PluginOptions } from '../types'
import { performSync } from '../plugin'

type ResolvedOptions = Required<
  Pick<PluginOptions, 'dbName' | 'storeName' | 'retryConfig' | 'debounceMs'>
> & {
  onSyncNeeded?: PluginOptions['onSyncNeeded']
  hooks?: PluginOptions['hooks']
}

export function useSyncQueue() {
  const store = useOfflineSyncStore()
  const opts = inject<ResolvedOptions | null>('vue-offline-sync-options', null)

  async function syncAll(): Promise<void> {
    if (!opts?.onSyncNeeded) return
    await performSync(store, opts.onSyncNeeded, opts.retryConfig)
  }

  return {
    pendingOperations: computed(() => store.pendingOperations),
    pendingCount: computed(() => store.pendingCount),
    pendingKeys: computed(() => store.pendingKeys),
    syncAll,
    clearQueue: () => store.clearQueue(),
  }
}
