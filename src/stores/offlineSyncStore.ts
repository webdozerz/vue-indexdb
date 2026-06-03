import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  NetworkStatus,
  IDBStatus,
  SyncStatus,
  SaveStatus,
  SyncOperation,
  SyncResult,
  OperationType,
} from '../types'
import { idbGet, idbPut, idbDelete } from '../services/idb'
import { IDBError } from '../utils/errors'

export const useOfflineSyncStore = defineStore('offline-sync', () => {
  const networkStatus = ref<NetworkStatus>(navigator.onLine ? 'online' : 'offline')
  const idbStatus = ref<IDBStatus>('disconnected')
  const syncStatus = ref<SyncStatus>('idle')
  const saveStatuses = ref<Record<string, SaveStatus>>({})
  const pendingOperations = ref<SyncOperation[]>([])
  const lastSyncAt = ref<number | null>(null)
  const lastError = ref<Error | null>(null)

  const pendingCount = computed(() => pendingOperations.value.length)
  const pendingKeys = computed(() => pendingOperations.value.map((op) => op.key))
  const isOnline = computed(() => networkStatus.value === 'online')
  const isIDBReady = computed(() => idbStatus.value === 'connected')
  const isSynced = computed(() => pendingCount.value === 0)

  function getSaveStatus(key: string): SaveStatus {
    return saveStatuses.value[key] ?? 'idle'
  }

  function setIDBStatus(status: IDBStatus) {
    idbStatus.value = status
  }

  function setNetworkStatus(status: NetworkStatus) {
    networkStatus.value = status
  }

  function setSyncStatus(status: SyncStatus) {
    syncStatus.value = status
  }

  function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  }

  async function save(key: string, data: any, type: OperationType = 'update'): Promise<void> {
    saveStatuses.value[key] = 'saving'
    lastError.value = null

    try {
      await idbPut(key, data)
      saveStatuses.value[key] = 'saved'

      if (!isOnline.value) {
        const existingIdx = pendingOperations.value.findIndex((op) => op.key === key)
        const operation: SyncOperation = {
          id: generateId(),
          key,
          data,
          timestamp: Date.now(),
          type,
          retries: 0,
          status: 'pending',
        }

        if (existingIdx >= 0) {
          pendingOperations.value[existingIdx] = operation
        } else {
          pendingOperations.value.push(operation)
        }
      }
    } catch (e) {
      saveStatuses.value[key] = 'error'
      lastError.value = e instanceof Error ? e : new IDBError('Save failed', e)
      throw e
    }
  }

  async function remove(key: string): Promise<void> {
    saveStatuses.value[key] = 'saving'
    lastError.value = null

    try {
      await idbDelete(key)
      saveStatuses.value[key] = 'saved'

      if (!isOnline.value) {
        const existingIdx = pendingOperations.value.findIndex((op) => op.key === key)
        const operation: SyncOperation = {
          id: generateId(),
          key,
          data: null,
          timestamp: Date.now(),
          type: 'delete',
          retries: 0,
          status: 'pending',
        }

        if (existingIdx >= 0) {
          pendingOperations.value[existingIdx] = operation
        } else {
          pendingOperations.value.push(operation)
        }
      }
    } catch (e) {
      saveStatuses.value[key] = 'error'
      lastError.value = e instanceof Error ? e : new IDBError('Remove failed', e)
      throw e
    }
  }

  async function get(key: string): Promise<any> {
    return idbGet(key)
  }

  function markSynced(key: string): void {
    const idx = pendingOperations.value.findIndex((op) => op.key === key)
    if (idx >= 0) {
      pendingOperations.value.splice(idx, 1)
    }
    if (pendingOperations.value.length === 0) {
      syncStatus.value = 'synced'
      lastSyncAt.value = Date.now()
    }
  }

  function processSyncResults(results: SyncResult[]): void {
    const failedKeys = new Set<string>()

    for (const result of results) {
      if (result.success) {
        const idx = pendingOperations.value.findIndex((op) => op.key === result.key)
        if (idx >= 0) {
          pendingOperations.value[idx].status = 'synced'
          pendingOperations.value.splice(idx, 1)
        }
      } else {
        failedKeys.add(result.key)
        const idx = pendingOperations.value.findIndex((op) => op.key === result.key)
        if (idx >= 0) {
          pendingOperations.value[idx].status = 'failed'
          pendingOperations.value[idx].retries += 1
        }
      }
    }

    if (failedKeys.size === 0) {
      syncStatus.value = 'synced'
      lastSyncAt.value = Date.now()
    } else if (failedKeys.size < results.length) {
      syncStatus.value = 'synced'
      lastSyncAt.value = Date.now()
    } else {
      syncStatus.value = 'error'
    }
  }

  function clearQueue(): void {
    pendingOperations.value = []
  }

  return {
    networkStatus,
    idbStatus,
    syncStatus,
    saveStatuses,
    pendingOperations,
    lastSyncAt,
    lastError,
    pendingCount,
    pendingKeys,
    isOnline,
    isIDBReady,
    isSynced,
    getSaveStatus,
    setIDBStatus,
    setNetworkStatus,
    setSyncStatus,
    save,
    remove,
    get,
    markSynced,
    processSyncResults,
    clearQueue,
  }
})
