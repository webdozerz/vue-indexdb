import { IDBError } from '../utils/errors'

let dbInstance: IDBDatabase | null = null
let dbName_ = 'vue-offline-sync'
let storeName_ = 'sync-data'

const IDB_VERSION = 2

function openDB(dbName: string, storeName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, IDB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = request.result

      if (event.oldVersion === 1 && db.objectStoreNames.contains(storeName)) {
        db.deleteObjectStore(storeName)
      }

      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName)
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
  await txRequest('readwrite', (s) => s.put(data, key))
}

export async function idbDelete(key: string): Promise<void> {
  if (!isValidIDBKey(key)) return
  await txRequest('readwrite', (s) => s.delete(key))
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
