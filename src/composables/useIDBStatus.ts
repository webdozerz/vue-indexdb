import { computed } from 'vue'
import { useOfflineSyncStore } from '../stores/offlineSyncStore'

export function useIDBStatus() {
  const store = useOfflineSyncStore()

  return {
    idbStatus: computed(() => store.idbStatus),
    isReady: computed(() => store.isIDBReady),
  }
}
