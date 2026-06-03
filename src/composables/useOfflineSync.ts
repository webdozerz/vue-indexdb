import { ref, computed, watch, onUnmounted, toValue, type MaybeRef } from 'vue'
import { useOfflineSyncStore } from '../stores/offlineSyncStore'
import type { UseOfflineSyncOptions, KeyHooks, SaveStatus } from '../types'

export function useOfflineSync(key: MaybeRef<string>, options?: UseOfflineSyncOptions) {
  const store = useOfflineSyncStore()
  const data = ref<any>(null)
  const hooks: KeyHooks = options?.hooks ?? {}

  const saveStatus = computed<SaveStatus>(() => store.getSaveStatus(toValue(key)))
  const isSynced = computed(() => !store.pendingKeys.includes(toValue(key)))

  async function load(): Promise<void> {
    if (store.isIDBReady) {
      data.value = await store.get(toValue(key))
    }
  }

  async function save(newData: any): Promise<void> {
    data.value = newData
    try {
      await store.save(toValue(key), newData)
      hooks.onSaveSuccess?.(newData)
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e))
      hooks.onSaveError?.(error)
      throw e
    }
  }

  async function remove(): Promise<void> {
    try {
      await store.remove(toValue(key))
      data.value = null
      hooks.onSaveSuccess?.(null)
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e))
      hooks.onSaveError?.(error)
      throw e
    }
  }

  const stopWatchIDB = watch(
    () => store.isIDBReady,
    (ready) => {
      if (ready) load()
    },
    { immediate: true },
  )

  const stopWatchKey = watch(
    () => toValue(key),
    () => load(),
  )

  const stopSyncWatch = watch(isSynced, (synced) => {
    if (synced) {
      hooks.onSynced?.()
    }
  })

  onUnmounted(() => {
    stopWatchIDB()
    stopWatchKey()
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
