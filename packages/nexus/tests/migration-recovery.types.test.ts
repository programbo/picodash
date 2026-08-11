import { expectTypeOf, test } from 'vite-plus/test'
import {
  createPicodashNexus,
  type PicodashMetadataRecovery,
  type PicodashSchemaMigrationPayload,
} from '../src/index.ts'

test('identified Nexus roots expose shared metadata recovery while ephemeral roots do not', () => {
  const identified = createPicodashNexus({
    valueOwner: 'nexus',
    nexusId: 'identified-types',
    schemaVersion: 1,
    fields: { value: { defaultValue: 0 } },
  })
  expectTypeOf(identified.metadataRecovery).toEqualTypeOf<PicodashMetadataRecovery>()
  expectTypeOf(identified.scope('scope').metadataRecovery).toEqualTypeOf<PicodashMetadataRecovery>()
  identified.destroy()

  const ephemeral = createPicodashNexus({
    valueOwner: 'nexus',
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
