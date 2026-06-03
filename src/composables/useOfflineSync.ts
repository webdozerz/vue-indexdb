import { ref, computed, watch, onUnmounted } from 'vue'
import { useOfflineSyncStore } from '../stores/offlineSyncStore'
import type { UseOfflineSyncOptions, KeyHooks, SaveStatus } from '../types'

export function useOfflineSync(key: string, options?: UseOfflineSyncOptions) {
  const store = useOfflineSyncStore()
  const data = ref<any>(null)
  const hooks: KeyHooks = options?.hooks ?? {}

  const saveStatus = computed<SaveStatus>(() => store.getSaveStatus(key))
  const isSynced = computed(() => !store.pendingKeys.includes(key))

  async function load(): Promise<void> {
    if (store.isIDBReady) {
      data.value = await store.get(key)
    }
  }

  async function save(newData: any): Promise<void> {
    data.value = newData
    try {
      await store.save(key, newData)
      hooks.onSaveSuccess?.(newData)
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e))
      hooks.onSaveError?.(error)
      throw e
    }
  }

  async function remove(): Promise<void> {
    try {
      await store.remove(key)
      data.value = null
      hooks.onSaveSuccess?.(null)
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e))
      hooks.onSaveError?.(error)
      throw e
    }
  }

  const stopWatch = watch(
    () => store.isIDBReady,
    (ready) => {
      if (ready) load()
    },
    { immediate: true },
  )

  const stopSyncWatch = watch(isSynced, (synced) => {
    if (synced) {
      hooks.onSynced?.()
    }
  })

  onUnmounted(() => {
    stopWatch()
    stopSyncWatch()
  })

  return {
    data,
    save,
    remove,
    saveStatus,
    isSynced,
  }
}
