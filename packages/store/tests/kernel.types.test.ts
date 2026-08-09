import { expectTypeOf, test } from 'vite-plus/test'
import { z } from 'zod'
import type { StandardSchemaV1 } from '@standard-schema/spec'
import {
  createPicodashStore,
  type DashListMetadataRecord,
  type DashPanelDockPositionRecord,
  type DashPanelLayoutRecord,
  type DashPanelPlacementRecord,
  type DashPanelSnapPositionRecord,
  type DurableScopeMetadata,
  type PicodashField,
  type PicodashFieldDefinition,
  type PicodashFieldDefinitions,
  type PicodashIssueInput,
  type PicodashParseResult,
  type CoreTransactionResult,
  type DestroyRootOptions,
  type RootStore,
  type ScopedStore,
  type RootSnapshot,
  type StoreOwnedConfig,
} from '../src/index.ts'

test('infers widened literal values and Standard Schema output', () => {
  type DeclaredFields = {
    readonly count: { readonly defaultValue: 1 }
    readonly mode: {
      readonly defaultValue: 'safe'
      readonly schema: StandardSchemaV1<unknown, 'safe' | 'fast'>
    }
  }
  type DeclaredValues = import('../src/index.ts').ValuesOf<DeclaredFields>
  const declared: DeclaredValues = { count: 1, mode: 'fast' }
  const widenedCount: number = declared.count
  const narrowedMode: 'safe' | 'fast' = declared.mode
  void widenedCount
  void narrowedMode
  const store = createPicodashStore({
    valueOwner: 'store',
    fields: {
      count: { defaultValue: 1 },
      mode: { defaultValue: 'safe', schema: z.enum(['safe', 'fast']) },
    },
  })
  const inferred: { readonly count: number; readonly mode: 'safe' | 'fast' } =
    store.getState().values
  expectTypeOf<DestroyRootOptions>().toEqualTypeOf<{ readonly discardUnpersisted: true }>()
  expectTypeOf<typeof store.destroy>().toMatchTypeOf<(options?: DestroyRootOptions) => void>()
  void inferred
  expectTypeOf(store.getState().values).toEqualTypeOf<{
    readonly count: number
    readonly mode: 'safe' | 'fast'
  }>()
  const parseOk: PicodashParseResult<number> = { ok: true, candidate: 1 }
  const parseFailure: PicodashParseResult<number> = {
    ok: false,
    issues: [{ message: 'invalid', code: 'app:test', path: ['value'] }],
  }
  void parseOk
  void parseFailure

  const parserField: PicodashFieldDefinition<number> = {
    defaultValue: 1,
    parse: (input) => ({ ok: true, candidate: Number(input) }),
  }
  void parserField
})

test('keeps parser and issue input boundaries exact', () => {
  const emptyStore = createPicodashStore({ valueOwner: 'store', fields: {} })
  expectTypeOf(emptyStore.getState().values).toEqualTypeOf<{}>()
  expectTypeOf(emptyStore.setValues({})).toEqualTypeOf<CoreTransactionResult>()

  if (globalThis.process?.env.PICODASH_TYPE_TESTS === '1') {
    const bareParser: PicodashFieldDefinition<number> = {
      defaultValue: 1,
      // @ts-expect-error Parsers return PicodashParseResult, not a bare candidate.
      parse: (input) => Number(input),
    }
    void bareParser
    const badCode: PicodashIssueInput = {
      message: 'invalid',
      // @ts-expect-error Store-owned issue codes are not callback inputs.
      code: 'validation_failed',
    }
    void badCode
    const badPath: PicodashIssueInput = {
      message: 'invalid',
      // @ts-expect-error Symbol path segments are not callback inputs.
      path: [Symbol('private')],
    }
    void badPath
  }
})

test('keeps StoreOwnedConfig and aggregate field definitions usable and strict', () => {
  type GoodFields = {
    readonly value: {
      readonly defaultValue: number
      readonly schema: StandardSchemaV1<unknown, number>
      readonly parse: (input: unknown) => PicodashParseResult<number>
    }
  }
  const goodConfig: StoreOwnedConfig<GoodFields> = {
    valueOwner: 'store',
    fields: {
      value: {
        defaultValue: 1,
        schema: z.number(),
        parse: (input) => ({ ok: true, candidate: Number(input) }),
        validate: (value, context) => {
          const valueCheck: number = value
          const completeValues: number = context.values.value
          void valueCheck
          void completeValues
          return []
        },
      },
    },
  }
  void goodConfig

  const aggregate: PicodashFieldDefinitions = {
    value: {
      defaultValue: 1,
      validate: (value, context) => {
        const valueCheck: import('../src/index.ts').PicodashJsonValue = value
        const valuesCheck: Readonly<Record<string, import('../src/index.ts').PicodashJsonValue>> =
          context.values
        void valueCheck
        void valuesCheck
        return []
      },
    },
  }
  void aggregate

  type MixedSchema = StandardSchemaV1<unknown, string | Date>
  type MixedDefinition = PicodashFieldDefinition<number, MixedSchema>
  type MixedValidatorValue = Parameters<NonNullable<MixedDefinition['validate']>>[0]
  expectTypeOf<MixedValidatorValue>().toEqualTypeOf<never>()

  if (globalThis.process?.env.PICODASH_TYPE_TESTS === '1') {
    // @ts-expect-error StoreOwnedConfig parser declarations cannot return a bare value.
    type BareParserConfig = StoreOwnedConfig<{
      readonly value: {
        readonly defaultValue: number
        readonly parse: (input: unknown) => number
      }
    }>
    void (null as unknown as BareParserConfig)

    type DateSchema = StandardSchemaV1<unknown, Date>
    // @ts-expect-error StoreOwnedConfig schemas must produce strict JSON values.
    type DateSchemaConfig = StoreOwnedConfig<{
      readonly value: { readonly defaultValue: number; readonly schema: DateSchema }
    }>
    void (null as unknown as DateSchemaConfig)
  }
})

test('context callbacks see the complete inferred value record', () => {
  const store = createPicodashStore({
    valueOwner: 'store',
    fields: {
      count: {
        defaultValue: 1,
        validate: (value, context) => {
          const valueCheck: number = value
          const countCheck: number = context.values.count
          const titleCheck: string = context.values.title
          const fieldKeyCheck: 'count' | 'title' = context.field!.key
          void valueCheck
          void countCheck
          void titleCheck
          void fieldKeyCheck
          return []
        },
      },
      title: { defaultValue: 'Title' },
    },
  })
  if (globalThis.process?.env.PICODASH_TYPE_TESTS === '1') {
    // @ts-expect-error A handle is nominally root-owned.
    store.setValue({ key: 'count' }, 2)
    // @ts-expect-error Unknown batch keys are rejected.
    store.setValues({ missing: true })
    // @ts-expect-error The setter has no origin argument.
    store.setValues({ count: 2 }, 'legacy-origin')
  }
  expectTypeOf(store.setValues({ count: 2 })).toMatchTypeOf<
    | {
        readonly ok: true
        readonly changedFields: readonly string[]
        readonly changedScopeIds: readonly string[]
      }
    | { readonly ok: false; readonly error: Error }
  >()
})

test('rejects non-JSON defaults and exact legacy configuration shapes', () => {
  if (globalThis.process?.env.PICODASH_TYPE_TESTS === '1') {
    // @ts-expect-error Date is not a strict JSON value.
    createPicodashStore({ valueOwner: 'store', fields: { date: { defaultValue: new Date() } } })
    createPicodashStore({
      valueOwner: 'store',
      fields: { value: { defaultValue: 1 } },
      // @ts-expect-error Schema migrations require an identified Store.
      migrations: { 1: (input: unknown) => input },
    })
    // @ts-expect-error Document export policy requires an identified Store.
    createPicodashStore({
      valueOwner: 'store',
      fields: { value: { defaultValue: 1 } },
      export: { documents: { defaultFieldPolicy: 'include' } },
    })
    createPicodashStore({
      valueOwner: 'store',
      fields: {
        // @ts-expect-error Legacy allowUnset is removed.
        value: {
          defaultValue: null,
          allowUnset: true,
        },
      },
    })
    createPicodashStore({
      valueOwner: 'store',
      fields: { value: { defaultValue: 1 } },
      // @ts-expect-error Legacy per-panel configuration is removed.
      panelId: 'old',
    })
    const dateSchema = null as unknown as StandardSchemaV1<unknown, Date>
    createPicodashStore({
      valueOwner: 'store',
      fields: {
        value: {
          defaultValue: 1,
          // @ts-expect-error Standard Schema output must be strict JSON.
          schema: dateSchema,
        },
      },
    })
  }
})

test('exports exact immutable metadata record declarations', () => {
  expectTypeOf<RootSnapshot<{ readonly value: number }>>().toMatchTypeOf<{
    readonly values: Readonly<{ readonly value: number }>
    readonly scopes: ReadonlyMap<string, DurableScopeMetadata>
  }>()
  expectTypeOf<DashListMetadataRecord>().toMatchTypeOf<{
    readonly groupOrders: ReadonlyMap<string, readonly string[]>
    readonly collapseOverrides: ReadonlyMap<string, boolean>
  }>()
  expectTypeOf<DashPanelSnapPositionRecord>().toEqualTypeOf<
    'top-left' | 'top' | 'top-right' | 'right' | 'bottom-right' | 'bottom' | 'bottom-left' | 'left'
  >()
  expectTypeOf<DashPanelDockPositionRecord>().toMatchTypeOf<string>()
  expectTypeOf<DashPanelPlacementRecord>().toMatchTypeOf<object>()
  expectTypeOf<DashPanelLayoutRecord>().toMatchTypeOf<object>()
  expectTypeOf<PicodashField<{ readonly value: number }, 'value'>>().toHaveProperty('key')
})

test('preserves Fields and refined Result through root/scoped views and metadata commands', () => {
  type Fields = { readonly value: { readonly defaultValue: 1 } }
  type RefinedResult = CoreTransactionResult & { readonly tag: 'refined' }
  type Root = RootStore<Fields, RefinedResult>
  type Scoped = ScopedStore<Fields, RefinedResult>
  expectTypeOf<Root['fields']['value']>().toHaveProperty('key')
  expectTypeOf<ReturnType<Root['getState']>['values']>().toEqualTypeOf<
    Readonly<{ readonly value: number }>
  >()
  expectTypeOf<ReturnType<Scoped['getState']>['values']>().toEqualTypeOf<
    Readonly<{ readonly value: number }>
  >()
  expectTypeOf<ReturnType<Root['scope']>>().toEqualTypeOf<Scoped>()
  expectTypeOf<Scoped['root']>().toEqualTypeOf<Root>()
  expectTypeOf<ReturnType<Scoped['scope']>>().toEqualTypeOf<Scoped>()
  expectTypeOf<ReturnType<Root['setValue']>>().toEqualTypeOf<RefinedResult>()
  expectTypeOf<ReturnType<Root['setValueOrThrow']>>().toEqualTypeOf<
    Extract<RefinedResult, { readonly ok: true }>
  >()
  expectTypeOf<ReturnType<Root['resetValue']>>().toEqualTypeOf<RefinedResult>()
  expectTypeOf<ReturnType<Root['resetValueOrThrow']>>().toEqualTypeOf<
    Extract<RefinedResult, { readonly ok: true }>
  >()
  expectTypeOf<ReturnType<Root['resetRegisteredValues']>>().toEqualTypeOf<RefinedResult>()
  expectTypeOf<ReturnType<Root['resetRegisteredValuesOrThrow']>>().toEqualTypeOf<
    Extract<RefinedResult, { readonly ok: true }>
  >()
  expectTypeOf<ReturnType<Scoped['setValue']>>().toEqualTypeOf<RefinedResult>()
  expectTypeOf<ReturnType<Scoped['setValueOrThrow']>>().toEqualTypeOf<
    Extract<RefinedResult, { readonly ok: true }>
  >()
  expectTypeOf<ReturnType<Scoped['resetValue']>>().toEqualTypeOf<RefinedResult>()
  expectTypeOf<ReturnType<Scoped['resetValueOrThrow']>>().toEqualTypeOf<
    Extract<RefinedResult, { readonly ok: true }>
  >()
  expectTypeOf<ReturnType<Scoped['resetRegisteredValues']>>().toEqualTypeOf<RefinedResult>()
  expectTypeOf<ReturnType<Scoped['resetRegisteredValuesOrThrow']>>().toEqualTypeOf<
    Extract<RefinedResult, { readonly ok: true }>
  >()
  if (globalThis.process?.env.PICODASH_TYPE_TESTS === 'never') {
    const root = undefined as unknown as Root
    const scoped = undefined as unknown as Scoped
    // @ts-expect-error Root aggregate reset requires a scopeId.
    root.resetRegisteredValues()
    // @ts-expect-error Root aggregate reset does not accept scoped-only options.
    root.resetRegisteredValues({ includeDescendants: true })
    scoped.resetRegisteredValues()
    scoped.resetRegisteredValues({ includeDescendants: true })
  }
  expectTypeOf<ReturnType<Root['setValues']>>().toEqualTypeOf<RefinedResult>()
  expectTypeOf<ReturnType<Root['setValuesOrThrow']>>().toEqualTypeOf<
    Extract<RefinedResult, { readonly ok: true }>
  >()
  expectTypeOf<ReturnType<Scoped['setValues']>>().toEqualTypeOf<RefinedResult>()
  expectTypeOf<ReturnType<Scoped['setValuesOrThrow']>>().toEqualTypeOf<
    Extract<RefinedResult, { readonly ok: true }>
  >()
  expectTypeOf<ReturnType<Root['setDashPanelLayout']>>().toEqualTypeOf<RefinedResult>()
  expectTypeOf<ReturnType<Root['resetDashPanelLayout']>>().toEqualTypeOf<RefinedResult>()
  expectTypeOf<ReturnType<Root['setDashListRootOrder']>>().toEqualTypeOf<RefinedResult>()
  expectTypeOf<ReturnType<Root['removeDashListRootOrder']>>().toEqualTypeOf<RefinedResult>()
  expectTypeOf<ReturnType<Root['setDashListGroupOrder']>>().toEqualTypeOf<RefinedResult>()
  expectTypeOf<ReturnType<Root['removeDashListGroupOrder']>>().toEqualTypeOf<RefinedResult>()
  expectTypeOf<ReturnType<Root['setDashListCollapseOverride']>>().toEqualTypeOf<RefinedResult>()
  expectTypeOf<ReturnType<Root['removeDashListCollapseOverride']>>().toEqualTypeOf<RefinedResult>()
  expectTypeOf<ReturnType<Root['resetDashListMetadata']>>().toEqualTypeOf<RefinedResult>()
  expectTypeOf<ReturnType<Scoped['setDashPanelLayout']>>().toEqualTypeOf<RefinedResult>()
  expectTypeOf<ReturnType<Scoped['resetDashPanelLayout']>>().toEqualTypeOf<RefinedResult>()
  expectTypeOf<ReturnType<Scoped['setDashListRootOrder']>>().toEqualTypeOf<RefinedResult>()
  expectTypeOf<ReturnType<Scoped['removeDashListRootOrder']>>().toEqualTypeOf<RefinedResult>()
  expectTypeOf<ReturnType<Scoped['setDashListGroupOrder']>>().toEqualTypeOf<RefinedResult>()
  expectTypeOf<ReturnType<Scoped['removeDashListGroupOrder']>>().toEqualTypeOf<RefinedResult>()
  expectTypeOf<ReturnType<Scoped['setDashListCollapseOverride']>>().toEqualTypeOf<RefinedResult>()
  expectTypeOf<
    ReturnType<Scoped['removeDashListCollapseOverride']>
  >().toEqualTypeOf<RefinedResult>()
  expectTypeOf<ReturnType<Scoped['resetDashListMetadata']>>().toEqualTypeOf<RefinedResult>()
})
