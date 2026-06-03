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
import { withRetry } from './utils/retry'
import { normalizeSyncResults } from './utils/normalizeSyncResults'

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
      await initIDB(opts.dbName, opts.storeName, opts.retryConfig)
      store.setIDBStatus('connected')
      emitHook('onIDBReady')
    } catch (e) {
      const error = e instanceof Error ? e : new IDBError('IDB init failed', e)
      store.setIDBStatus('error')
      emitHook('onIDBError', error)
      throw error
    }

    store.setNetworkStatus(navigator.onLine ? 'online' : 'offline')

    const scheduleSync =
      opts.debounceMs > 0
        ? debounce(() => {
            if (store.isOnline && opts.onSyncNeeded) {
              performSync(store, opts.onSyncNeeded, opts.retryConfig)
            }
          }, opts.debounceMs)
        : () => {
            if (store.isOnline && opts.onSyncNeeded) {
              performSync(store, opts.onSyncNeeded, opts.retryConfig)
            }
          }

    startNetworkMonitor()

    subscribeToNetwork((status) => {
      store.setNetworkStatus(status)
      emitHook('onNetworkChange', status === 'online')

      if (status === 'online' && opts.onSyncNeeded) {
        scheduleSync()
      }
    })

    app.provide('vue-offline-sync-options', opts)
    app.provide(
      'vue-offline-sync-debounced',
      opts.debounceMs > 0 ? scheduleSync : undefined,
    )
  },
}

export async function performSync(
  store: ReturnType<typeof useOfflineSyncStore>,
  onSyncNeeded: (operations: SyncOperation[]) => Promise<SyncResult[]> | SyncResult[],
  retryConfig: { maxRetries: number; retryDelay: number },
): Promise<void> {
  if (store.syncStatus === 'syncing') return

  const operationIds = new Set(
    store.pendingOperations
      .filter(
        (op) =>
          op.status === 'pending'
          || (op.status === 'failed' && op.retries < retryConfig.maxRetries),
      )
      .map((op) => op.id),
  )

  const operations = store.pendingOperations.filter((op) => operationIds.has(op.id))

  if (operations.length === 0) return

  store.setSyncStatus('syncing')
  emitHook('onSyncStart', operations)

  store.pendingOperations.forEach((op) => {
    if (operationIds.has(op.id)) {
      op.status = 'syncing'
    }
  })

  try {
    const raw = await withRetry(
      () => Promise.resolve(onSyncNeeded(operations)),
      retryConfig,
    )
    const results = normalizeSyncResults(raw, operations)
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
    const error = e instanceof Error ? e : new Error(String(e))
    const failures = operations.map((op) => ({
      key: op.key,
      success: false as const,
      error,
    }))
    store.processSyncResults(failures)
    emitHook('onSyncError', failures)
  }
}
