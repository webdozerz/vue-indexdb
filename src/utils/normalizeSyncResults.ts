import type { SyncOperation, SyncResult } from '../types'

const INVALID_RESPONSE_ERROR = new Error('Invalid sync response')
const INCOMPLETE_RESPONSE_ERROR = new Error('Incomplete sync response')

function isValidSyncResult(item: unknown): item is SyncResult {
  return (
    typeof item === 'object'
    && item !== null
    && typeof (item as SyncResult).key === 'string'
    && typeof (item as SyncResult).success === 'boolean'
  )
}

export function normalizeSyncResults(
  results: unknown,
  operations: SyncOperation[],
): SyncResult[] {
  if (!Array.isArray(results)) {
    console.warn('[vue-indexdb-sync] onSyncNeeded must return an array')
    return operations.map((op) => ({
      key: op.key,
      success: false,
      error: INVALID_RESPONSE_ERROR,
    }))
  }

  const byKey = new Map<string, SyncResult>()

  for (const item of results) {
    if (isValidSyncResult(item)) {
      byKey.set(item.key, item)
    } else {
      console.warn('[vue-indexdb-sync] Invalid sync result entry', item)
    }
  }

  return operations.map((op) => {
    const existing = byKey.get(op.key)
    if (existing) return existing
    return {
      key: op.key,
      success: false,
      error: INCOMPLETE_RESPONSE_ERROR,
    }
  })
}
