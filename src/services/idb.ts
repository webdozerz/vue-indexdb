import { IDBError } from '../utils/errors'
import { withRetry } from '../utils/retry'
import type { RetryConfig } from '../types'

let dbInstance: IDBDatabase | null = null
let dbName_ = 'vue-offline-sync'
let storeName_ = 'sync-data'
let retryConfig_: RetryConfig = { maxRetries: 3, retryDelay: 1000 }

const IDB_VERSION = 2

function openDB(dbName: string, storeName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, IDB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result

      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new IDBError('Failed to open IndexedDB', request.error))
  })
}

export async function initIDB(
  dbName: string,
  storeName: string,
  retryConfig?: RetryConfig,
): Promise<IDBDatabase> {
  dbName_ = dbName
  storeName_ = storeName
  if (retryConfig) {
    retryConfig_ = retryConfig
  }
  dbInstance = await openDB(dbName, storeName)
  return dbInstance
}

export function getDB(): IDBDatabase {
  if (!dbInstance) {
    throw new IDBError('IndexedDB not initialized. Call initIDB first.')
  }
  return dbInstance
}

function txRequest(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<IDBRequest['result']> {
  return new Promise((resolve, reject) => {
    const db = getDB()
    const tx = db.transaction(storeName_, mode)
    const store = tx.objectStore(storeName_)
    const request = fn(store)

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new IDBError(`IDB ${mode} operation failed`, request.error))
  })
}

function isValidIDBKey(key: unknown): boolean {
  if (typeof key === 'string' && key.length > 0) return true
  if (typeof key === 'number' && Number.isFinite(key)) return true
  if (key instanceof Date) return true
  if (Array.isArray(key)) return true
  return false
}

export async function idbGet(key: string): Promise<any> {
  if (!isValidIDBKey(key)) return null
  const result = await txRequest('readonly', (s) => s.get(key))
  return result ?? null
}

export async function idbPut(key: string, data: any): Promise<void> {
  await withRetry(
    () => txRequest('readwrite', (s) => s.put(data, key)),
    retryConfig_,
  )
}

export async function idbDelete(key: string): Promise<void> {
  if (!isValidIDBKey(key)) return
  await withRetry(
    () => txRequest('readwrite', (s) => s.delete(key)),
    retryConfig_,
  )
}

export async function idbGetAll(): Promise<{ key: string; value: any }[]> {
  return new Promise((resolve, reject) => {
    const db = getDB()
    const tx = db.transaction(storeName_, 'readonly')
    const store = tx.objectStore(storeName_)
    const request = store.openCursor()
    const entries: { key: string; value: any }[] = []

    request.onsuccess = () => {
      const cursor = request.result
      if (cursor) {
        entries.push({ key: cursor.key as string, value: cursor.value })
        cursor.continue()
      } else {
        resolve(entries)
      }
    }
    request.onerror = () => reject(new IDBError('IDB openCursor failed', request.error))
  })
}

export async function idbGetAllKeys(): Promise<string[]> {
  return (await txRequest('readonly', (s) => s.getAllKeys())) as string[]
}

export async function idbClear(): Promise<void> {
  await txRequest('readwrite', (s) => s.clear())
}
