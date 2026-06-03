import { isProxy, isReactive, isRef, toRaw, unref } from 'vue'

export function toPlainData<T>(value: T): T {
  if (isRef(value)) {
    return toPlainData(unref(value)) as T
  }

  let raw: unknown = value
  if (isReactive(value) || isProxy(value)) {
    raw = toRaw(value)
  }

  if (raw === null || typeof raw !== 'object') {
    return raw as T
  }

  if (raw instanceof Date) {
    return new Date(raw.getTime()) as T
  }

  if (Array.isArray(raw)) {
    return raw.map(item => toPlainData(item)) as T
  }

  const plain: Record<string, unknown> = {}
  for (const key of Object.keys(raw)) {
    plain[key] = toPlainData((raw as Record<string, unknown>)[key])
  }
  return plain as T
}
