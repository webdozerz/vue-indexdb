import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  startNetworkMonitor,
  stopNetworkMonitor,
  subscribeToNetwork,
  getInitialNetworkStatus,
} from '../src/services/networkMonitor'

describe('networkMonitor', () => {
  beforeEach(() => {
    stopNetworkMonitor()
  })

  afterEach(() => {
    stopNetworkMonitor()
  })

  it('should return initial network status', () => {
    const status = getInitialNetworkStatus()
    expect(['online', 'offline']).toContain(status)
  })

  it('should call listeners on online event', () => {
    const cb = vi.fn()
    startNetworkMonitor()
    subscribeToNetwork(cb)

    window.dispatchEvent(new Event('online'))

    expect(cb).toHaveBeenCalledWith('online')
  })

  it('should call listeners on offline event', () => {
    const cb = vi.fn()
    startNetworkMonitor()
    subscribeToNetwork(cb)

    window.dispatchEvent(new Event('offline'))

    expect(cb).toHaveBeenCalledWith('offline')
  })

  it('should unsubscribe correctly', () => {
    const cb = vi.fn()
    startNetworkMonitor()
    const unsub = subscribeToNetwork(cb)

    unsub()
    window.dispatchEvent(new Event('online'))

    expect(cb).not.toHaveBeenCalled()
  })

  it('should not double-start', () => {
    startNetworkMonitor()
    startNetworkMonitor()

    const cb = vi.fn()
    subscribeToNetwork(cb)
    window.dispatchEvent(new Event('online'))

    expect(cb).toHaveBeenCalledTimes(1)

    stopNetworkMonitor()
  })
})
