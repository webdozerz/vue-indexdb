import { describe, it, expect, beforeEach } from 'vitest'
import { initIDB, idbGet, idbPut, idbDelete, idbGetAll, idbGetAllKeys, idbClear } from '../src/services/idb'

let dbCounter = 0

beforeEach(async () => {
  dbCounter++
  await initIDB(`test-db-${dbCounter}`, `test-store-${dbCounter}`)
})

describe('idb service', () => {
  it('should put and get data', async () => {
    await idbPut('key1', { name: 'John' })
    const data = await idbGet('key1')
    expect(data).toEqual({ name: 'John' })
  })

  it('should return null for missing key', async () => {
    const data = await idbGet('nonexistent')
    expect(data).toBeNull()
  })

  it('should delete data', async () => {
    await idbPut('key1', { name: 'John' })
    await idbDelete('key1')
    const data = await idbGet('key1')
    expect(data).toBeNull()
  })

  it('should get all entries', async () => {
    await idbPut('key1', 'a')
    await idbPut('key2', 'b')
    const all = await idbGetAll()
    expect(all).toHaveLength(2)
    expect(all.map((e) => e.key).sort()).toEqual(['key1', 'key2'])
  })

  it('should get all keys', async () => {
    await idbPut('key1', 'a')
    await idbPut('key2', 'b')
    const keys = await idbGetAllKeys()
    expect(keys.sort()).toEqual(['key1', 'key2'])
  })

  it('should clear all data', async () => {
    await idbPut('key1', 'a')
    await idbPut('key2', 'b')
    await idbClear()
    const all = await idbGetAll()
    expect(all).toHaveLength(0)
  })

  it('should overwrite existing key', async () => {
    await idbPut('key1', 'old')
    await idbPut('key1', 'new')
    const data = await idbGet('key1')
    expect(data).toBe('new')
  })

  it('should store any type of data', async () => {
    await idbPut('string', 'hello')
    await idbPut('number', 42)
    await idbPut('boolean', true)
    await idbPut('null', null)
    await idbPut('array', [1, 2, 3])

    expect(await idbGet('string')).toBe('hello')
    expect(await idbGet('number')).toBe(42)
    expect(await idbGet('boolean')).toBe(true)
    expect(await idbGet('null')).toBeNull()
    expect(await idbGet('array')).toEqual([1, 2, 3])
  })
})
