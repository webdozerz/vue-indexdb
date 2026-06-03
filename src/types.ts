/// <reference types="vitest" />

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error'
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'
export type NetworkStatus = 'online' | 'offline'
export type IDBStatus = 'connected' | 'disconnected' | 'error'
export type OperationType = 'create' | 'update' | 'delete'
export type OperationStatus = 'pending' | 'syncing' | 'synced' | 'failed'

export interface SyncOperation {
  id: string
  key: string
  data: any
  timestamp: number
  type: OperationType
  retries: number
  status: OperationStatus
}

export interface SyncResult {
  key: string
  success: boolean
  error?: Error
}

export interface RetryConfig {
  maxRetries: number
  retryDelay: number
}

export interface PluginOptions {
  dbName?: string
  storeName?: string
  onSyncNeeded?: (operations: SyncOperation[]) => Promise<SyncResult[]> | SyncResult[]
  retryConfig?: RetryConfig
  debounceMs?: number
  hooks?: GlobalHooks
}

export interface GlobalHooks {
  onNetworkChange?: (online: boolean) => void
  onIDBReady?: () => void
  onIDBError?: (error: Error) => void
  onSaveSuccess?: (key: string, data: any) => void
  onSaveError?: (key: string, error: Error) => void
  onSyncStart?: (operations: SyncOperation[]) => void
  onSyncSuccess?: (results: SyncResult[]) => void
  onSyncError?: (errors: SyncResult[]) => void
  onOperationQueued?: (operation: SyncOperation) => void
  onOperationSynced?: (operation: SyncOperation) => void
}

export interface UseOfflineSyncOptions {
  hooks?: KeyHooks
}

export interface KeyHooks {
  onSaveSuccess?: (data: any) => void
  onSaveError?: (error: Error) => void
  onSynced?: () => void
  onSyncError?: (error: Error) => void
}

export interface StoreState {
  networkStatus: NetworkStatus
  idbStatus: IDBStatus
  syncStatus: SyncStatus
  saveStatuses: Record<string, SaveStatus>
  pendingOperations: SyncOperation[]
  lastSyncAt: number | null
  lastError: Error | null
}
