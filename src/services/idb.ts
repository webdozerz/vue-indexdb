import type { IDBEntry } from '../types'
import { IDBError } from '../utils/errors'

let dbInstance: IDBDatabase | null = null
let dbName_ = 'vue-offline-sync'
let storeName_ = 'sync-data'

function openDB(dbName: string, storeName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath: 'key' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new IDBError('Failed to open IndexedDB', request.error))
  })
}

export async function initIDB(dbName: string, storeName: string): Promise<IDBDatabase> {
  dbName_ = dbName
  storeName_ = storeName
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

export async function idbGet(key: string): Promise<any> {
  const entry = (await txRequest('readonly', (s) => s.get(key))) as IDBEntry | undefined
  return entry?.data ?? null
}

export async function idbPut(key: string, data: any): Promise<void> {
  const entry: IDBEntry = { key, data, timestamp: Date.now() }
  await txRequest('readwrite', (s) => s.put(entry))
}

export async function idbDelete(key: string): Promise<void> {
  await txRequest('readwrite', (s) => s.delete(key))
}

export async function idbGetAll(): Promise<IDBEntry[]> {
  return (await txRequest('readonly', (s) => s.getAll())) as IDBEntry[]
}

export async function idbGetAllKeys(): Promise<string[]> {
  return (await txRequest('readonly', (s) => s.getAllKeys())) as string[]
}

export async function idbClear(): Promise<void> {
  await txRequest('readwrite', (s) => s.clear())
}
