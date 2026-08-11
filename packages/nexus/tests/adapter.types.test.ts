import { expectTypeOf, test } from 'vite-plus/test'
import {
  createPicodashNexus,
  type AdapterHealthDiagnostic,
  type AdapterWriteContext,
  type ExternalOwnedConfig,
  type ExternalOwnedPersistenceConfig,
  type PicodashInitializationErrorCode,
  type PicodashInitializationErrorReasonByCode,
  type PicodashValueAdapter,
  type NexusOwnedConfig,
  type TransactionIssue,
} from '../src/index.ts'

type Fields = {
  readonly count: { readonly defaultValue: number }
  readonly label: { readonly defaultValue: string }
}
type Values = { readonly count: number; readonly label: string }

const adapter: PicodashValueAdapter<Values> = {
  getSnapshot: () => ({ count: 1, label: 'one' }),
  subscribe: () => () => undefined,
  setValues: (_values, context) => {
    expectTypeOf(context).toEqualTypeOf<AdapterWriteContext>()
    expectTypeOf(context.source).toEqualTypeOf<AdapterWriteContext['source']>()
    expectTypeOf(context.targetScopeIds).toEqualTypeOf<readonly string[]>()
    expectTypeOf(context.changedFields).toEqualTypeOf<readonly string[]>()
  },
}

test('external configuration infers the complete value record and preserves ownership', () => {
  const config: ExternalOwnedConfig<Fields> = {
    valueOwner: 'external',
    fields: { count: { defaultValue: 1 }, label: { defaultValue: 'one' } },
    adapter,
  }
  const nexus = createPicodashNexus(config)
  expectTypeOf(nexus.getState().values).toEqualTypeOf<Values>()
  nexus.destroy()
})

test('adapter diagnostics and initialization errors retain correlated reason types', () => {
  expectTypeOf<TransactionIssue['reason']>().toEqualTypeOf<string | undefined>()
  expectTypeOf<AdapterHealthDiagnostic['code']>().toEqualTypeOf<'adapter_unhealthy'>()
  expectTypeOf<AdapterHealthDiagnostic['identity']>().toEqualTypeOf<{ readonly kind: 'adapter' }>()
  expectTypeOf<PicodashInitializationErrorCode>().toEqualTypeOf<
    | 'adapter-initialization-failed'
    | 'persistence-driver-unavailable'
    | 'invalid-persistence-envelope'
    | 'hydration-source-conflict'
    | 'schema-migration-failed'
  >()
  expectTypeOf<
    PicodashInitializationErrorReasonByCode['adapter-initialization-failed']
  >().toEqualTypeOf<
    'read_threw' | 'async_snapshot' | 'invalid_snapshot' | 'subscribe_threw' | 'invalid_teardown'
  >()
})

test('nexus-owned and external-owned configuration surfaces remain disjoint', () => {
  const storeConfig: NexusOwnedConfig<Fields> = {
    valueOwner: 'nexus',
    fields: { count: { defaultValue: 1 }, label: { defaultValue: 'one' } },
  }
  void storeConfig
  if (globalThis.process?.env.PICODASH_TYPE_TESTS === '1') {
    // @ts-expect-error Nexus-owned values cannot delegate to an external adapter.
    const invalidNexus: NexusOwnedConfig<Fields> = { ...storeConfig, adapter }
    const invalidExternal: ExternalOwnedConfig<Fields> = {
      valueOwner: 'external',
      fields: storeConfig.fields,
      adapter,
      // @ts-expect-error External-owned values cannot declare initial values.
      initialValues: { count: 1 },
    }
    void invalidNexus
    void invalidExternal
  }
})

test('identified external configuration accepts metadata persistence without a values policy', () => {
  const persistence: ExternalOwnedPersistenceConfig = {
    storageKey: 'metadata',
    driver: {
      identity: {},
      read: () => null,
      write: () => undefined,
      remove: () => undefined,
    },
  }
  const config: ExternalOwnedConfig<Fields> = {
    valueOwner: 'external',
    nexusId: 'external-config',
    schemaVersion: 1,
    fields: { count: { defaultValue: 1 }, label: { defaultValue: 'one' } },
    adapter,
    persistence,
  }
  void config
})
