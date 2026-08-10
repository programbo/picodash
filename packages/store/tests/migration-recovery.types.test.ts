import { expectTypeOf, test } from 'vite-plus/test'
import {
  createPicodashStore,
  type PicodashMetadataRecovery,
  type PicodashSchemaMigrationPayload,
} from '../src/index.ts'

test('identified Store roots expose shared metadata recovery while ephemeral roots do not', () => {
  const identified = createPicodashStore({
    valueOwner: 'store',
    storeId: 'identified-types',
    schemaVersion: 1,
    fields: { value: { defaultValue: 0 } },
  })
  expectTypeOf(identified.metadataRecovery).toEqualTypeOf<PicodashMetadataRecovery>()
  expectTypeOf(identified.scope('scope').metadataRecovery).toEqualTypeOf<PicodashMetadataRecovery>()
  identified.destroy()

  const ephemeral = createPicodashStore({
    valueOwner: 'store',
    fields: { value: { defaultValue: 0 } },
  })
  if (globalThis.process?.env.PICODASH_TYPE_TESTS === '1') {
    // @ts-expect-error Ephemeral roots do not expose metadata recovery.
    void ephemeral.metadataRecovery
  }
  ephemeral.destroy()
})

test('migration payload remains a strict JSON public type', () => {
  expectTypeOf<PicodashSchemaMigrationPayload['schemaVersion']>().toEqualTypeOf<number>()
  expectTypeOf<PicodashSchemaMigrationPayload['scopes']>().toMatchTypeOf<
    readonly (readonly [string, unknown])[]
  >()
})
