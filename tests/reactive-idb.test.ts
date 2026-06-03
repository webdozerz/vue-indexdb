import { describe, it, expect, beforeEach } from 'vitest'
import { ref } from 'vue'
import { initIDB, idbPut, idbGet } from '../src/services/idb'

let dbCounter = 0

beforeEach(async () => {
  dbCounter++
  await initIDB(`test-reactive-db-${dbCounter}`, `test-store-${dbCounter}`)
})

describe('idb with vue reactive data', () => {
  it('should store array spread from ref', async () => {
    const todos = ref([{ id: 1, text: 'a', done: false }])
    await idbPut('todos', [...todos.value])
    expect(await idbGet('todos')).toEqual([{ id: 1, text: 'a', done: false }])
  })

  it('should store array of reactive items from ref', async () => {
    const todos = ref([{ id: 1, text: 'a', done: false }])
    await idbPut('todos', todos.value)
    expect(await idbGet('todos')).toEqual([{ id: 1, text: 'a', done: false }])
  })
})
