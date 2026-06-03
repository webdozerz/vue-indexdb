import { describe, it, expect } from 'vitest'
import { ref, reactive } from 'vue'
import { toPlainData } from '../src/utils/toPlainData'

describe('toPlainData', () => {
  it('should unwrap ref', () => {
    expect(toPlainData(ref('hello'))).toBe('hello')
  })

  it('should unwrap reactive object', () => {
    const obj = reactive({ a: 1, nested: { b: 2 } })
    expect(toPlainData(obj)).toEqual({ a: 1, nested: { b: 2 } })
    expect(toPlainData(obj)).not.toBe(obj)
  })

  it('should unwrap reactive array with reactive items', () => {
    const todos = ref([{ id: 1, text: 'a', done: false }])
    const plain = toPlainData([...todos.value])
    expect(plain).toEqual([{ id: 1, text: 'a', done: false }])
    expect(plain[0]).not.toBe(todos.value[0])
  })
})
