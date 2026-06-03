import 'fake-indexeddb/auto'
import { setActivePinia, createPinia } from 'pinia'
import { beforeEach } from 'vitest'

beforeEach(() => {
  setActivePinia(createPinia())
})
