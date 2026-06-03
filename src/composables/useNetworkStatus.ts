import { computed } from 'vue'
import { useOfflineSyncStore } from '../stores/offlineSyncStore'

export function useNetworkStatus() {
  const store = useOfflineSyncStore()

  return {
    isOnline: computed(() => store.isOnline),
    networkStatus: computed(() => store.networkStatus),
  }
}
