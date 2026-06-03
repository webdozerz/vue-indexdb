# vue-indexdb-sync

Offline-first IndexedDB persistence for Vue 3 + Pinia.

Automatically saves data to IndexedDB when offline and provides reactive status tracking through Pinia store. When internet returns — syncs pending operations via your callback.

## Install

```bash
npm install vue-indexdb-sync
# or
pnpm add vue-indexdb-sync
```

**Peer dependencies:** `vue >= 3.3.0` and `pinia >= 2.0.0` must be installed in your project.

## Setup

```ts
// main.ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { VueOfflineSync } from 'vue-indexdb-sync'

const app = createApp(App)
app.use(createPinia())
app.use(VueOfflineSync, {
  dbName: 'my-app-offline',
  // onSyncNeeded — optional, see "Sync with server" below
})
app.mount('#app')
```

## Statuses

The package tracks four reactive status types:

| Status | Values | Description |
|---|---|---|
| **NetworkStatus** | `online` \| `offline` | Browser network connectivity |
| **IDBStatus** | `connected` \| `disconnected` \| `error` | IndexedDB connection state |
| **SaveStatus** | `idle` \| `saving` \| `saved` \| `error` | Per-key save operation state |
| **SyncStatus** | `idle` \| `syncing` \| `synced` \| `error` | Global sync queue state |

Each pending operation also has its own status: `pending` \| `syncing` \| `synced` \| `failed`

## Composables

### `useOfflineSync(key, options?)`

Main composable. Stores and retrieves data for a specific key. Key accepts `string` or `Ref<string>` (reactive).

```ts
const { data, save, remove, saveStatus, isSynced } = useOfflineSync('user-settings')

// Save any data — string, number, object, array
await save({ theme: 'dark', lang: 'en' })

// Read current data (reactive)
console.log(data.value) // { theme: 'dark', lang: 'en' }

// Remove data
await remove()
```

**With reactive key:**

```ts
const selectedKey = ref('user-1')
const { data, save, saveStatus } = useOfflineSync(selectedKey)

// Changing key auto-reloads data from IDB
selectedKey.value = 'user-2'
```

**With per-key hooks:**

```ts
const { data, save } = useOfflineSync('form-data', {
  hooks: {
    onSaveSuccess: (data) => console.log('Saved:', data),
    onSaveError: (error) => console.error('Save failed:', error),
    onSynced: () => console.log('Synced with server'),
    onSyncError: (error) => console.error('Sync failed:', error),
  },
})
```

**Returns:**

| Property | Type | Description |
|---|---|---|
| `data` | `Ref<any>` | Current data from composable (reactive) |
| `save` | `(data: any) => Promise<void>` | Save data to IDB |
| `remove` | `() => Promise<void>` | Remove data from IDB |
| `saveStatus` | `ComputedRef<SaveStatus>` | Save status for this key |
| `isSynced` | `ComputedRef<boolean>` | Whether this key has no pending sync |

### `useNetworkStatus()`

```ts
const { isOnline, networkStatus } = useNetworkStatus()
```

| Property | Type | Description |
|---|---|---|
| `isOnline` | `ComputedRef<boolean>` | `true` when online |
| `networkStatus` | `ComputedRef<NetworkStatus>` | `'online'` or `'offline'` |

### `useIDBStatus()`

```ts
const { idbStatus, isReady } = useIDBStatus()
```

| Property | Type | Description |
|---|---|---|
| `idbStatus` | `ComputedRef<IDBStatus>` | IDB connection status |
| `isReady` | `ComputedRef<boolean>` | `true` when IDB connected |

### `useSyncQueue()`

```ts
const { pendingOperations, pendingCount, pendingKeys, syncAll, clearQueue } = useSyncQueue()
```

| Property | Type | Description |
|---|---|---|
| `pendingOperations` | `ComputedRef<SyncOperation[]>` | All pending operations |
| `pendingCount` | `ComputedRef<number>` | Number of pending operations |
| `pendingKeys` | `ComputedRef<string[]>` | Keys with pending operations |
| `syncAll` | `() => Promise<void>` | Trigger sync for all pending |
| `clearQueue` | `() => void` | Clear all pending operations |

### `useOfflineSyncHooks()`

Subscribe to global events. Each function returns an `unsubscribe` callback.

```ts
const { onNetworkChange, onSaveSuccess, onSyncStart } = useOfflineSyncHooks()

const unsub = onNetworkChange((online) => {
  console.log('Network:', online ? 'online' : 'offline')
})

onSaveSuccess((key, data) => {
  console.log(`Saved key="${key}"`)
})

onSyncStart((operations) => {
  console.log(`Syncing ${operations.length} operations`)
})

// Unsubscribe when no longer needed
unsub()
```

**Available hooks:**

| Hook | Callback signature | When fired |
|---|---|---|
| `onNetworkChange` | `(online: boolean) => void` | Network status changes |
| `onIDBReady` | `() => void` | IndexedDB initialized |
| `onIDBError` | `(error: Error) => void` | IndexedDB init failed |
| `onSaveSuccess` | `(key: string, data: any) => void` | Data saved to IDB |
| `onSaveError` | `(key: string, error: Error) => void` | Save to IDB failed |
| `onSyncStart` | `(operations: SyncOperation[]) => void` | Sync started |
| `onSyncSuccess` | `(results: SyncResult[]) => void` | Some operations synced |
| `onSyncError` | `(errors: SyncResult[]) => void` | Some operations failed |
| `onOperationQueued` | `(operation: SyncOperation) => void` | Operation added to queue |
| `onOperationSynced` | `(operation: SyncOperation) => void` | Single operation synced |

## Pinia Store

Access the underlying store directly:

```ts
import { useOfflineSyncStore } from 'vue-indexdb-sync'

const store = useOfflineSyncStore()

// State
store.networkStatus  // 'online' | 'offline'
store.idbStatus      // 'connected' | 'disconnected' | 'error'
store.syncStatus     // 'idle' | 'syncing' | 'synced' | 'error'
store.saveStatuses   // { [key]: SaveStatus }
store.pendingOperations // SyncOperation[]
store.lastSyncAt     // number | null
store.lastError      // Error | null

// Getters
store.pendingCount   // number
store.pendingKeys    // string[]
store.isOnline       // boolean
store.isIDBReady     // boolean
store.isSynced       // boolean (no pending ops)
store.getSaveStatus('my-key') // SaveStatus

// Actions
await store.save('key', data)     // Save data
await store.remove('key')         // Remove data
await store.get('key')            // Read from IDB
store.markSynced('key')           // Mark key as synced
store.clearQueue()                // Clear all pending
```

## Sync with Server

By default the package only stores data locally. To sync with a server when internet returns, provide `onSyncNeeded` callback:

```ts
app.use(VueOfflineSync, {
  dbName: 'my-app',
  onSyncNeeded: async (operations) => {
    return Promise.all(ops.map(async (op) => {
      try {
        await fetch(`/api/data/${op.key}`, {
          method: op.type === 'delete' ? 'DELETE' : 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(op.data),
        })
        return { key: op.key, success: true }
      } catch (e) {
        return { key: op.key, success: false, error: e as Error }
      }
    }))
  },
})
```

**How it works:**
1. When offline, `save()` stores data in IDB and creates a `SyncOperation` in the pending queue
2. When internet returns, `onSyncNeeded(operations)` is called automatically
3. Return `SyncResult[]` — the package updates operation statuses based on results
4. Failed sync operations are retried up to `retryConfig.maxRetries` (default: 3)
5. Failed local IDB writes (`save` / `remove`) use the same `retryConfig` with exponential backoff

**Different endpoints per key:**

```ts
onSyncNeeded: async (ops) => {
  return Promise.all(ops.map(async (op) => {
    if (op.key.startsWith('user/')) {
      await fetch('/api/users', { method: 'POST', body: JSON.stringify(op.data) })
    } else if (op.key === 'modal-state') {
      // Local-only data, no sync needed
    } else {
      await fetch(`/api/data/${op.key}`, { method: 'PUT', body: JSON.stringify(op.data) })
    }
    return { key: op.key, success: true }
  }))
}
```

**No `onSyncNeeded`** — data is only stored in IndexedDB, no server sync.

## Plugin Options

```ts
interface PluginOptions {
  dbName?: string          // default: 'vue-offline-sync'
  storeName?: string       // default: 'sync-data'
  onSyncNeeded?: (operations: SyncOperation[]) => Promise<SyncResult[]> | SyncResult[]
  retryConfig?: { maxRetries: number; retryDelay: number }  // sync + local IDB ops; default: { maxRetries: 3, retryDelay: 1000 }
  debounceMs?: number      // default: 300
  hooks?: GlobalHooks      // global event callbacks
}
```

## Usage Examples

### Save form data offline

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useOfflineSync } from 'vue-indexdb-sync'

const form = ref({ name: '', email: '' })
const { save, saveStatus } = useOfflineSync('contact-form')

async function handleSubmit() {
  await save({ ...form.value })
}
</script>

<template>
  <form @submit.prevent="handleSubmit">
    <input v-model="form.name" placeholder="Name" />
    <input v-model="form.email" placeholder="Email" />
    <button type="submit">Save</button>
    <span v-if="saveStatus === 'saved'">Saved!</span>
  </form>
</template>
```

### Persist todo list

```ts
const todos = ref([{ id: 1, text: 'Task', done: false }])
const { save, data } = useOfflineSync('todos')

// data is reactive and auto-loaded from IDB on mount
watch(todos, (list) => save([...list]), { deep: true })
```

### Show offline banner

```vue
<script setup lang="ts">
import { useNetworkStatus } from 'vue-indexdb-sync'
const { isOnline } = useNetworkStatus()
</script>

<template>
  <div v-if="!isOnline" class="offline-banner">You are offline</div>
</template>
```

### Pending operations indicator

```vue
<script setup lang="ts">
import { useSyncQueue } from 'vue-indexdb-sync'
const { pendingCount, syncAll } = useSyncQueue()
</script>

<template>
  <div v-if="pendingCount > 0">
    {{ pendingCount }} pending changes
    <button @click="syncAll">Sync now</button>
  </div>
</template>
```

### Global notifications via hooks

```ts
// main.ts
app.use(VueOfflineSync, {
  dbName: 'my-app',
  hooks: {
    onNetworkChange: (online) => {
      console.log(online ? 'Back online!' : 'Gone offline')
    },
    onSyncSuccess: (results) => {
      console.log(`Synced ${results.length} items`)
    },
    onSyncError: (errors) => {
      console.error(`Failed to sync ${errors.length} items`)
    },
  },
})
```

## Known limitations & edge cases

### Multiple tabs

IndexedDB does not lock writes across browser tabs. If two tabs update the same key, the last write wins. For conflict handling, add versioning in your data model (e.g. `updatedAt` or a `version` field) in the application layer.

### Tab closed during sync

The pending sync queue lives in Pinia memory and is lost when the tab closes. Data already written to IndexedDB remains. On the next online session, only operations still in the queue (or re-queued by your app) are synced. Use idempotent server APIs to avoid duplicate side effects.

### Large payloads

There is no built-in chunking or pagination. Split large datasets in `onSyncNeeded` (e.g. batch requests per key or chunk size).

### Schema changes

The package does not run complex IndexedDB schema migrations. If you change the object store structure, use a new `dbName` or clear the database manually:

```ts
indexedDB.deleteDatabase('vue-offline-sync')
```

Experimental v1 dev databases are not migrated automatically; delete the database if upgrade issues occur.

### Retries

`retryConfig` applies to both server sync (`onSyncNeeded`) and local IndexedDB `put`/`delete` operations. UI save status (`saved` / `error`) is unchanged: retries happen before the status is set.

## License

[Apache-2.0](./LICENSE)
