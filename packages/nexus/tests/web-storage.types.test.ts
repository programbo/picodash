import { expectTypeOf, test } from 'vite-plus/test'
import type { PicodashPersistenceDriver } from '../src/index.ts'
import {
  createWebStoragePersistenceDriver,
  type PicodashWebStorage,
  type PicodashWebStorageSource,
} from '../src/web-storage.ts'

test('Web Storage entry exposes the structural source and persistence driver', () => {
  const storage: PicodashWebStorage = {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  }
  expectTypeOf<PicodashWebStorageSource>().toEqualTypeOf<'local' | 'session' | PicodashWebStorage>()
  expectTypeOf(
    createWebStoragePersistenceDriver(storage),
  ).toEqualTypeOf<PicodashPersistenceDriver>()
  expectTypeOf(
    createWebStoragePersistenceDriver('local'),
  ).toEqualTypeOf<PicodashPersistenceDriver>()
  expectTypeOf(
    createWebStoragePersistenceDriver('session'),
  ).toEqualTypeOf<PicodashPersistenceDriver>()
  if (globalThis.process?.env.PICODASH_TYPE_TESTS === '1') {
    // @ts-expect-error Web Storage selection is always explicit.
    createWebStoragePersistenceDriver()
  }
})
