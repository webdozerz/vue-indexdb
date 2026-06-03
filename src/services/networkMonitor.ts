import type { NetworkStatus } from '../types'

type NetworkCallback = (status: NetworkStatus) => void

const listeners = new Set<NetworkCallback>()
let monitoring = false

function handleOnline() {
  listeners.forEach((cb) => cb('online'))
}

function handleOffline() {
  listeners.forEach((cb) => cb('offline'))
}

export function startNetworkMonitor(): void {
  if (monitoring) return
  monitoring = true
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
}

export function stopNetworkMonitor(): void {
  if (!monitoring) return
  monitoring = false
  window.removeEventListener('online', handleOnline)
  window.removeEventListener('offline', handleOffline)
  listeners.clear()
}

export function subscribeToNetwork(cb: NetworkCallback): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export function getInitialNetworkStatus(): NetworkStatus {
  return navigator.onLine ? 'online' : 'offline'
}
