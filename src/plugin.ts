import type { PluginOptions, SyncOperation, SyncResult } from './types'
import { initIDB } from './services/idb'
import {
  startNetworkMonitor,
  stopNetworkMonitor,
  subscribeToNetwork,
} from './services/networkMonitor'
import { useOfflineSyncStore } from './stores/offlineSyncStore'
import { setGlobalHooks, emitHook } from './composables/useOfflineSyncHooks'
import { IDBError } from './utils/errors'
import type { App, Plugin } from 'vue'
import { debounce } from './utils/debounce'

const DEFAULT_OPTIONS: Required<Pick<PluginOptions, 'dbName' | 'storeName' | 'retryConfig' | 'debounceMs'>> & {
  onSyncNeeded?: PluginOptions['onSyncNeeded']
  hooks?: PluginOptions['hooks']
} = {
  dbName: 'vue-offline-sync',
  storeName: 'sync-data',
  retryConfig: { maxRetries: 3, retryDelay: 1000 },
  debounceMs: 300,
}

export const VueOfflineSync: Plugin = {
  async install(app: App, options?: PluginOptions) {
    const opts = { ...DEFAULT_OPTIONS, ...options }

    setGlobalHooks(opts.hooks ?? {})

    const store = useOfflineSyncStore()

    try {
      await initIDB(opts.dbName, opts.storeName)
      store.setIDBStatus('connected')
      emitHook('onIDBReady')
    } catch (e) {
      const error = e instanceof Error ? e : new IDBError('IDB init failed', e)
      store.setIDBStatus('error')
      emitHook('onIDBError', error)
      throw error
    }

    store.setNetworkStatus(navigator.onLine ? 'online' : 'offline')

    startNetworkMonitor()

    subscribeToNetwork((status) => {
      store.setNetworkStatus(status)
      emitHook('onNetworkChange', status === 'online')

      if (status === 'online' && store.pendingCount > 0 && opts.onSyncNeeded) {
        performSync(store, opts.onSyncNeeded, opts.retryConfig)
      }
    })

    const debouncedSync = opts.debounceMs > 0
      ? debounce(() => {
          if (store.isOnline && store.pendingCount > 0 && opts.onSyncNeeded) {
            performSync(store, opts.onSyncNeeded, opts.retryConfig)
          }
        }, opts.debounceMs)
      : undefined

    app.provide('vue-offline-sync-options', opts)
    app.provide('vue-offline-sync-debounced', debouncedSync)
  },
}

export async function performSync(
  store: ReturnType<typeof useOfflineSyncStore>,
  onSyncNeeded: (operations: SyncOperation[]) => Promise<SyncResult[]> | SyncResult[],
  retryConfig: { maxRetries: number; retryDelay: number },
): Promise<void> {
  if (store.syncStatus === 'syncing') return

  const operations = store.pendingOperations.filter(
    (op) => op.status === 'pending' || (op.status === 'failed' && op.retries < retryConfig.maxRetries),
  )

  if (operations.length === 0) return

  store.setSyncStatus('syncing')
  emitHook('onSyncStart', operations)

  for (const op of operations) {
    const idx = store.pendingOperations.findIndex((o) => o.id === op.id)
    if (idx >= 0) {
      store.pendingOperations[idx].status = 'syncing'
    }
  }

  try {
    const results = await onSyncNeeded(operations)
    store.processSyncResults(results)

    const successes = results.filter((r) => r.success)
    const failures = results.filter((r) => !r.success)

    if (successes.length > 0) {
      emitHook('onSyncSuccess', successes)
    }
    if (failures.length > 0) {
      emitHook('onSyncError', failures)
    }
  } catch (e) {
    store.setSyncStatus('error')
    const error = e instanceof Error ? e : new Error(String(e))
    emitHook('onSyncError', operations.map((op) => ({ key: op.key, success: false, error })))
  }
}
