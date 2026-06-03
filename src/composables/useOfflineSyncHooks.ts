import type { GlobalHooks, SyncOperation, SyncResult } from '../types'

type Unsubscribe = () => void
type HookCallbacks = {
  onNetworkChange: (online: boolean) => void
  onIDBReady: () => void
  onIDBError: (error: Error) => void
  onSaveSuccess: (key: string, data: any) => void
  onSaveError: (key: string, error: Error) => void
  onSyncStart: (operations: SyncOperation[]) => void
  onSyncSuccess: (results: SyncResult[]) => void
  onSyncError: (errors: SyncResult[]) => void
  onOperationQueued: (operation: SyncOperation) => void
  onOperationSynced: (operation: SyncOperation) => void
}

type HookKey = keyof HookCallbacks

export function useOfflineSyncHooks() {
  const hooks = getGlobalHooks()

  function createSubscribe<K extends HookKey>(event: K): (cb: HookCallbacks[K]) => Unsubscribe {
    return (cb) => {
      const original = hooks[event]
      ;(hooks as any)[event] = (...args: any[]) => {
        ;(original as any)?.(...args)
        ;(cb as any)(...args)
      }

      return () => {
        ;(hooks as any)[event] = original
      }
    }
  }

  return {
    onNetworkChange: createSubscribe('onNetworkChange'),
    onIDBReady: createSubscribe('onIDBReady'),
    onIDBError: createSubscribe('onIDBError'),
    onSaveSuccess: createSubscribe('onSaveSuccess'),
    onSaveError: createSubscribe('onSaveError'),
    onSyncStart: createSubscribe('onSyncStart'),
    onSyncSuccess: createSubscribe('onSyncSuccess'),
    onSyncError: createSubscribe('onSyncError'),
    onOperationQueued: createSubscribe('onOperationQueued'),
    onOperationSynced: createSubscribe('onOperationSynced'),
  }
}

let globalHooks: GlobalHooks = {}

export function setGlobalHooks(hooks: GlobalHooks): void {
  globalHooks = hooks
}

export function getGlobalHooks(): GlobalHooks {
  return globalHooks
}

export function emitHook<K extends keyof GlobalHooks>(
  event: K,
  ...args: Parameters<NonNullable<GlobalHooks[K]>>
): void {
  ;(globalHooks[event] as any)?.(...args)
}
