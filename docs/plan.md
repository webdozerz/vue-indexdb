# vue-indexdb-sync — План

## Концепция

Vue 3 плагин + composables для offline-first persistence. Пакет сохраняет **любые данные** в IndexedDB при потере интернета и даёт реактивные статусы через Pinia store. Данные — произвольные key-value: от состояния модалки до пользовательских данных.

Синхронизация с сервером — **опциональная**, через колбеки. Пакет не знает про API, он только хранит данные и говорит «есть неотправленные ключи — делай с ними что хочешь».

## Структура проекта

```
vue-indexdb/
├── src/
│   ├── index.ts                     # Main entry, plugin export
│   ├── plugin.ts                    # Vue plugin (install function)
│   ├── types.ts                     # TypeScript interfaces & types
│   ├── composables/
│   │   ├── useNetworkStatus.ts      # Online/offline detection
│   │   ├── useOfflineSync.ts        # Main composable for data sync
│   │   ├── useSyncQueue.ts          # Pending operations access
│   │   ├── useIDBStatus.ts          # IndexedDB connection status
│   │   └── useOfflineSyncHooks.ts   # Subscribe to events
│   ├── stores/
│   │   └── offlineSyncStore.ts      # Pinia store
│   ├── services/
│   │   ├── idb.ts                   # IndexedDB CRUD operations
│   │   └── networkMonitor.ts        # Browser online/offline events
│   └── utils/
│       ├── queue.ts                 # Operation queue management
│       └── errors.ts                # Custom error classes
├── docs/
│   └── plan.md
├── tests/
├── package.json
├── tsconfig.json
├── vite.config.ts                   # Library mode
└── LICENSE
```

## Типы

```typescript
type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error'
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'
type NetworkStatus = 'online' | 'offline'
type IDBStatus = 'connected' | 'disconnected' | 'error'
type OperationType = 'create' | 'update' | 'delete'

interface SyncOperation {
  id: string
  key: string
  data: any
  timestamp: number
  type: OperationType
  retries: number
  status: 'pending' | 'syncing' | 'synced' | 'failed'
}

interface SyncResult {
  key: string
  success: boolean
  error?: Error
}

interface PluginOptions {
  dbName?: string                           // default: 'vue-offline-sync'
  storeName?: string                        // default: 'sync-data'
  onSyncNeeded?: (operations: SyncOperation[]) => Promise<SyncResult[]> | SyncResult[]
  retryConfig?: { maxRetries: number; retryDelay: number }
  debounceMs?: number
}
```

### Ключевое: onSyncNeeded

Вместо `apiConfig` с `baseUrl`/`endpoints` — один колбек `onSyncNeeded`. Когда интернет возвращается и есть pending операции, пакет вызывает `onSyncNeeded(operations)`. Пользователь сам решает:
- отправить на свой API
- отправить на разные эндпоинты в зависимости от key
- проигнорировать (данные уже сохранены локально и этого достаточно)
- сделать что угодно ещё

Колбек возвращает `SyncResult[]` — успех/ошибка по каждому ключу. Пакет обновляет статусы операций на основе результата.

**Примеры использования onSyncNeeded:**

```typescript
// Простой — отправить всё на один API
{
  onSyncNeeded: async (ops) => {
    const results = await Promise.allSettled(
      ops.map(op => fetch(`/api/data/${op.key}`, {
        method: op.type === 'delete' ? 'DELETE' : 'PUT',
        body: JSON.stringify(op.data)
      }))
    )
    return ops.map((op, i) => ({
      key: op.key,
      success: results[i].status === 'fulfilled',
      error: results[i].status === 'rejected' ? (results[i] as PromiseRejectedResult).reason : undefined
    }))
  }
}

// Разные API для разных ключей
{
  onSyncNeeded: async (ops) => {
    return Promise.all(ops.map(async (op) => {
      try {
        if (op.key.startsWith('user/')) {
          await fetch('/api/users', { method: 'POST', body: JSON.stringify(op.data) })
        } else if (op.key === 'modal-state') {
          // Не нужно синхронизировать — просто пометим как synced
        } else {
          await fetch(`/api/${op.key}`, { method: 'PUT', body: JSON.stringify(op.data) })
        }
        return { key: op.key, success: true }
      } catch (e) {
        return { key: op.key, success: false, error: e as Error }
      }
    }))
  }
}

// Нет onSyncNeeded — данные просто хранятся локально, без автосинхронизации
{
  dbName: 'my-app'
  // onSyncNeeded не передан — пакет только хранит/читает данные
}
```

## Pinia Store (offlineSyncStore)

### State

| Поле | Тип | Описание |
|---|---|---|
| `networkStatus` | `NetworkStatus` | online / offline |
| `idbStatus` | `IDBStatus` | connected / disconnected / error |
| `syncStatus` | `SyncStatus` | idle / syncing / synced / error |
| `saveStatuses` | `Record<string, SaveStatus>` | Статус сохранения по каждому ключу |
| `pendingOperations` | `SyncOperation[]` | Очередь неотправленных операций |
| `lastSyncAt` | `number \| null` | Timestamp последней успешной синхронизации |
| `lastError` | `Error \| null` | Последняя ошибка |

### Getters

- `pendingCount` — количество pending операций
- `pendingKeys` — ключи pending операций
- `isOnline` — `networkStatus === 'online'`
- `isIDBReady` — `idbStatus === 'connected'`
- `isSynced` — `pendingCount === 0`
- `getSaveStatus(key)` — статус сохранения конкретного ключа

### Actions

- `save(key, data, type?)` — сохранить данные, создать SyncOperation если offline
- `remove(key)` — удалить данные, создать SyncOperation типа delete если offline
- `get(key)` — прочитать данные из IDB
- `syncAll()` — запустить синхронизацию всех pending операций (через onSyncNeeded)
- `markSynced(key)` — вручную пометить ключ как синхронизированный
- `clearQueue()` — очистить очередь pending операций

## Composables

| Composable | Возвращает | Описание |
|---|---|---|
| `useNetworkStatus()` | `isOnline`, `networkStatus` | Реактивный статус сети |
| `useIDBStatus()` | `idbStatus`, `isReady` | Реактивный статус IDB |
| `useOfflineSync(key, opts?)` | `data`, `save()`, `remove()`, `saveStatus`, `isSynced` | Работа с конкретным ключом |
| `useSyncQueue()` | `pendingOperations`, `pendingCount`, `pendingKeys`, `syncAll()`, `clearQueue()` | Доступ к очереди синхронизации |
| `useOfflineSyncHooks()` | `onNetworkChange()`, `onSaveSuccess()`, `onSaveError()`, `onSyncStart()`, `onSyncSuccess()`, `onSyncError()`, `onIDBReady()`, `onIDBError()` | Подписка на события |

## Hooks / Events

Глобальные (через plugin options) и per-key (через `useOfflineSync` опции):

### Глобальные (plugin options)
- `onNetworkChange(online: boolean)`
- `onIDBReady()` / `onIDBError(error)`
- `onSaveSuccess(key, data)` / `onSaveError(key, error)`
- `onSyncStart(operations)` / `onSyncSuccess(results)` / `onSyncError(errors)`
- `onOperationQueued(operation)` / `onOperationSynced(operation)`

### Per-key (useOfflineSync options)
- `onSaveSuccess(data)` / `onSaveError(error)`
- `onSynced()` / `onSyncError(error)`

## Логика работы

### Offline → сохранение данных

```
Пользователь вызывает save(key, data)
  ↓
Данные сохраняются в IndexedDB
  ↓
saveStatuses[key] = 'saving' → 'saved'
  ↓
Если offline → создаётся SyncOperation в pendingOperations
  ↓
saveStatuses[key] = 'saved', но isSynced = false
```

### Online → автосинхронизация

```
navigator.onLine становится true
  ↓
networkStatus = 'online'
  ↓
Если есть pendingOperations и onSyncNeeded → запускается syncAll()
  ↓
syncStatus = 'syncing'
  ↓
Вызывается onSyncNeeded(pendingOperations)
  ↓
По результатам SyncResult[] — операции помечаются synced/failed
  ↓
syncStatus = 'synced' / 'error'
```

### Онлайн → сохранение данных

```
Пользователь вызывает save(key, data) при online
  ↓
Данные сохраняются в IndexedDB
  ↓
saveStatuses[key] = 'saved'
  ↓
SyncOperation НЕ создаётся (данные уже актуальны)
  ↓
Или создаётся, если onSyncNeeded передан — тогда пользователь сам решает когда «синхронизировано»
```

## Пример использования

### Базовый — только хранение

```typescript
// main.ts
const app = createApp(App)
app.use(createPinia())
app.use(VueOfflineSync, {
  dbName: 'my-app'
})

// Component — сохраняем состояние модалки
const { data: modalState, save, saveStatus } = useOfflineSync('modal-state')
const { isOnline } = useNetworkStatus()

// Сохраняем произвольные данные
save({ open: true, tab: 'settings', formData: { name: 'John' } })
```

### С автосинхронизацией

```typescript
// main.ts
app.use(VueOfflineSync, {
  dbName: 'my-app',
  onSyncNeeded: async (ops) => {
    return Promise.all(ops.map(async (op) => {
      try {
        await fetch(`/api/sync/${op.key}`, {
          method: op.type === 'delete' ? 'DELETE' : 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(op.data)
        })
        return { key: op.key, success: true }
      } catch (e) {
        return { key: op.key, success: false, error: e as Error }
      }
    }))
  }
})

// Component
const { data: userData, save, saveStatus, isSynced } = useOfflineSync('user-42', {
  onSaveSuccess: (data) => toast.success('Saved'),
  onSynced: () => toast.success('Synced with server')
})

const { pendingCount } = useSyncQueue()
```

## Фазы реализации

| Фаза | Что делаем | Результат |
|---|---|---|
| **1. Foundation** | package.json, tsconfig, vite lib mode, типы | Проект компилируется, типы определены |
| **2. IDB Service** | idb.ts — open, get, put, delete, getAll | Работает IndexedDB CRUD |
| **3. Pinia Store** | offlineSyncStore — state, getters, actions | Реактивные статусы |
| **4. Network Monitor** | networkMonitor.ts, useNetworkStatus | Детект online/offline |
| **5. Plugin + Composables** | plugin.ts, useOfflineSync, useIDBStatus, useSyncQueue | Полный API |
| **6. Sync Engine** | Queue management, syncAll через onSyncNeeded, retry | Автосинхронизация |
| **7. Hooks System** | useOfflineSyncHooks, emission points | Событийная система |
| **8. Tests** | vitest, unit tests для IDB/store/composables | Покрытие тестами |
| **9. Polish** | README, npm publish config, CI | Готов к публикации |
