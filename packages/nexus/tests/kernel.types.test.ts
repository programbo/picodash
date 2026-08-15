import { expectTypeOf, test } from 'vite-plus/test'
import { z } from 'zod'
import type { StandardSchemaV1 } from '@standard-schema/spec'
import {
  createPicodashNexus,
  type DashListCollapseOverrideUpdate,
  type DashListMetadataRecord,
  type DashPanelDockPositionRecord,
  type DashPanelLayoutRecord,
  type DashPanelPlacementRecord,
  type DashPanelSnapPositionRecord,
  type DurableScopeMetadata,
  type PicodashField,
  type PicodashFieldOf,
  type PicodashExactFieldOf,
  type PicodashFieldDefinition,
  type PicodashFieldDefinitions,
  type PicodashJsonValue,
  type PicodashIssueInput,
  type PicodashParseResult,
  type CoreTransactionResult,
  type DestroyRootOptions,
  type RootNexus,
  type RegisteredValueResetInspection,
  type ScopedNexus,
  type RootNexusSnapshot,
  type NexusOwnedConfig,
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
  const nexus = createPicodashNexus({
    valueOwner: 'nexus',
    fields: {
      count: { defaultValue: 1 },
      mode: { defaultValue: 'safe', schema: z.enum(['safe', 'fast']) },
    },
  })
  const inferred: { readonly count: number; readonly mode: 'safe' | 'fast' } =
    nexus.getState().values
  expectTypeOf<DestroyRootOptions>().toEqualTypeOf<{ readonly discardUnpersisted: true }>()
  expectTypeOf<typeof nexus.destroy>().toMatchTypeOf<(options?: DestroyRootOptions) => void>()
  void inferred
  expectTypeOf(nexus.getState().values).toEqualTypeOf<{
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
  const emptyNexus = createPicodashNexus({ valueOwner: 'nexus', fields: {} })
  expectTypeOf(emptyNexus.getState().values).toEqualTypeOf<{}>()
  expectTypeOf(emptyNexus.setValues({})).toEqualTypeOf<CoreTransactionResult>()

  if (globalThis.process?.env.PICODASH_TYPE_TESTS === '1') {
    const bareParser: PicodashFieldDefinition<number> = {
      defaultValue: 1,
      // @ts-expect-error Parsers return PicodashParseResult, not a bare candidate.
      parse: (input) => Number(input),
    }
    void bareParser
    const badCode: PicodashIssueInput = {
      message: 'invalid',
      // @ts-expect-error Nexus-owned issue codes are not callback inputs.
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

test('keeps NexusOwnedConfig and aggregate field definitions usable and strict', () => {
  type GoodFields = {
    readonly value: {
      readonly defaultValue: number
      readonly schema: StandardSchemaV1<unknown, number>
      readonly parse: (input: unknown) => PicodashParseResult<number>
    }
  }
  const goodConfig: NexusOwnedConfig<GoodFields> = {
    valueOwner: 'nexus',
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
    // @ts-expect-error NexusOwnedConfig parser declarations cannot return a bare value.
    type BareParserConfig = NexusOwnedConfig<{
      readonly value: {
        readonly defaultValue: number
        readonly parse: (input: unknown) => number
      }
    }>
    void (null as unknown as BareParserConfig)

    type DateSchema = StandardSchemaV1<unknown, Date>
    // @ts-expect-error NexusOwnedConfig schemas must produce strict JSON values.
    type DateSchemaConfig = NexusOwnedConfig<{
      readonly value: { readonly defaultValue: number; readonly schema: DateSchema }
    }>
    void (null as unknown as DateSchemaConfig)
  }
})

test('context callbacks see the complete inferred value record', () => {
  const nexus = createPicodashNexus({
    valueOwner: 'nexus',
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
    nexus.setValue({ key: 'count' }, 2)
    // @ts-expect-error Unknown batch keys are rejected.
    nexus.setValues({ missing: true })
    // @ts-expect-error The setter has no origin argument.
    nexus.setValues({ count: 2 }, 'legacy-origin')
  }
  expectTypeOf(nexus.setValues({ count: 2 })).toMatchTypeOf<
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
    createPicodashNexus({ valueOwner: 'nexus', fields: { date: { defaultValue: new Date() } } })
    createPicodashNexus({
      valueOwner: 'nexus',
      fields: { value: { defaultValue: 1 } },
      // @ts-expect-error Schema migrations require an identified Nexus.
      migrations: { 1: (input: unknown) => input },
    })
    // @ts-expect-error Document export policy requires an identified Nexus.
    createPicodashNexus({
      valueOwner: 'nexus',
      fields: { value: { defaultValue: 1 } },
      export: { documents: { defaultFieldPolicy: 'include' } },
    })
    createPicodashNexus({
      valueOwner: 'nexus',
      fields: {
        // @ts-expect-error Legacy allowUnset is removed.
        value: {
          defaultValue: null,
          allowUnset: true,
        },
      },
    })
    createPicodashNexus({
      valueOwner: 'nexus',
      fields: { value: { defaultValue: 1 } },
      // @ts-expect-error Legacy per-panel configuration is removed.
      panelId: 'old',
    })
    const dateSchema = null as unknown as StandardSchemaV1<unknown, Date>
    createPicodashNexus({
      valueOwner: 'nexus',
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
  expectTypeOf<RootNexusSnapshot<{ readonly value: number }>>().toMatchTypeOf<{
    readonly values: Readonly<{ readonly value: number }>
    readonly scopes: ReadonlyMap<string, DurableScopeMetadata>
  }>()
  expectTypeOf<DashListMetadataRecord>().toMatchTypeOf<{
    readonly groupOrders: ReadonlyMap<string, readonly string[]>
    readonly collapseOverrides: ReadonlyMap<string, boolean>
  }>()
  expectTypeOf<DashListCollapseOverrideUpdate>().toEqualTypeOf<readonly [string, boolean | null]>()
  expectTypeOf<RegisteredValueResetInspection>().toEqualTypeOf<{
    readonly registeredFields: readonly string[]
    readonly changedFields: readonly string[]
  }>()
  expectTypeOf<DashPanelSnapPositionRecord>().toEqualTypeOf<
    'top-left' | 'top' | 'top-right' | 'right' | 'bottom-right' | 'bottom' | 'bottom-left' | 'left'
  >()
  expectTypeOf<DashPanelDockPositionRecord>().toMatchTypeOf<string>()
  expectTypeOf<DashPanelPlacementRecord>().toMatchTypeOf<object>()
  expectTypeOf<DashPanelLayoutRecord>().toMatchTypeOf<object>()
  expectTypeOf<PicodashField<{ readonly value: number }, 'value'>>().toHaveProperty('key')
})

test('retains field value types through the nominal type-only brand', () => {
  type Fields = {
    readonly text: string
    readonly count: number
  }
  expectTypeOf<PicodashField<Fields, 'text'>>().toMatchTypeOf<{ readonly key: 'text' }>()
  expectTypeOf<PicodashField<Fields, 'text'>>().not.toMatchTypeOf<PicodashField<Fields, 'count'>>()
})

test('projects nominal field value domains without changing field ownership or runtime shape', () => {
  type Fields = {
    readonly count: number
    readonly label: string
    readonly range: { readonly start: number; readonly end: number }
    readonly extendedRange: {
      readonly start: number
      readonly end: number
      readonly unit: string
    }
    readonly literalRange: { readonly start: 0; readonly end: 1 }
  }
  const count = null as unknown as PicodashField<Fields, 'count'>
  const label = null as unknown as PicodashField<Fields, 'label'>
  const projected = createPicodashNexus({
    valueOwner: 'nexus',
    fields: {
      range: { defaultValue: { start: 0 as number, end: 1 as number } },
      extendedRange: { defaultValue: { start: 0, end: 1, unit: 'px' } },
      literalRange: {
        defaultValue: { start: 0 as const, end: 1 as const },
        schema: z.object({ start: z.literal(0), end: z.literal(1) }),
      },
      boolean: { defaultValue: false },
      literalBoolean: { defaultValue: true as const, schema: z.literal(true) },
      nestedRange: {
        defaultValue: {
          config: { bounds: { start: 0 as number, end: 1 as number } },
        },
      },
      nestedExtendedRange: {
        defaultValue: {
          config: { bounds: { start: 0, end: 1, unit: 'px' } },
        },
      },
      points: {
        defaultValue: [{ x: 0 as number, y: 1 as number }],
      },
      extendedPoints: {
        defaultValue: [{ x: 0, y: 1, label: 'origin' }],
      },
      tuple: {
        defaultValue: [0, 1] as [number, number],
        schema: z.tuple([z.number(), z.number()]),
      },
    },
  })

  const numericView: PicodashFieldOf<number> = count
  const jsonView: PicodashFieldOf<PicodashJsonValue> = count
  const exactRange: PicodashExactFieldOf<{
    readonly start: number
    readonly end: number
  }> = projected.fields.range
  const exactNestedRange: PicodashExactFieldOf<{
    readonly config: {
      readonly bounds: { readonly start: number; readonly end: number }
    }
  }> = projected.fields.nestedRange
  const exactPoints: PicodashExactFieldOf<readonly { readonly x: number; readonly y: number }[]> =
    projected.fields.points
  const exactReadonlyTuple: PicodashExactFieldOf<readonly [number, number]> = projected.fields.tuple
  const exactBoolean: PicodashExactFieldOf<boolean> = projected.fields.boolean
  const exactNestedExtendedRange: PicodashExactFieldOf<{
    readonly config: {
      readonly bounds: {
        readonly start: number
        readonly end: number
        readonly unit: string
      }
    }
  }> = projected.fields.nestedExtendedRange
  expectTypeOf(projected.getState().values.nestedExtendedRange).toEqualTypeOf<{
    readonly config: {
      readonly bounds: {
        readonly start: number
        readonly end: number
        readonly unit: string
      }
    }
  }>()
  type ExactValueOf<Field> = Field extends PicodashExactFieldOf<infer Value> ? Value : never
  expectTypeOf<ExactValueOf<typeof projected.fields.nestedExtendedRange>>().toEqualTypeOf<{
    readonly config: {
      readonly bounds: {
        readonly start: number
        readonly end: number
        readonly unit: string
      }
    }
  }>()
  void numericView
  void jsonView
  void exactRange
  void exactNestedRange
  void exactPoints
  void exactReadonlyTuple
  void exactBoolean
  void exactNestedExtendedRange

  if (globalThis.process?.env.PICODASH_TYPE_TESTS === '1') {
    // @ts-expect-error A string-valued field is not assignable to a numeric field view.
    const wrongValue: PicodashFieldOf<number> = label
    // @ts-expect-error Exact field views reject additional members.
    const extraMember: PicodashExactFieldOf<{
      readonly start: number
      readonly end: number
    }> = projected.fields.extendedRange
    // @ts-expect-error Exact field views reject a value domain narrower than the emitted value.
    const narrowedMember: PicodashExactFieldOf<{
      readonly start: number
      readonly end: number
    }> = projected.fields.literalRange
    // @ts-expect-error Exact field views recursively reject additional nested object members.
    const nestedExtraMember: PicodashExactFieldOf<{
      readonly config: {
        readonly bounds: { readonly start: number; readonly end: number }
      }
    }> = projected.fields.nestedExtendedRange
    const nestedExtraView = null as unknown as PicodashExactFieldOf<{
      readonly config: {
        readonly bounds: {
          readonly start: number
          readonly end: number
          readonly unit: string
        }
      }
    }>
    // @ts-expect-error Public exact views recursively reject additional nested object members.
    const nestedExtraViewAsBase: PicodashExactFieldOf<{
      readonly config: {
        readonly bounds: { readonly start: number; readonly end: number }
      }
    }> = nestedExtraView
    // @ts-expect-error Exact field views recursively reject additional array element members.
    const nestedArrayExtraMember: PicodashExactFieldOf<
      readonly { readonly x: number; readonly y: number }[]
    > = projected.fields.extendedPoints
    // @ts-expect-error A tuple value domain is narrower than a general readonly array domain.
    const tupleAsArray: PicodashExactFieldOf<readonly number[]> = projected.fields.tuple
    // @ts-expect-error A true-only field is narrower than a general boolean field domain.
    const literalBooleanAsBoolean: PicodashExactFieldOf<boolean> = projected.fields.literalBoolean

    type DeepDomain<Value> = {
      readonly one: {
        readonly two: {
          readonly three: {
            readonly four: {
              readonly five: {
                readonly six: { readonly value: Value }
              }
            }
          }
        }
      }
    }
    const deepLiteral = null as unknown as PicodashExactFieldOf<DeepDomain<1>>
    // @ts-expect-error The bounded terminal fingerprint remains invariant beyond recursion depth.
    const deepNarrowedMember: PicodashExactFieldOf<DeepDomain<number>> = deepLiteral
    // @ts-expect-error Field views remain nominal and cannot be forged from a key-only record.
    const structuralForgery: PicodashFieldOf<number> = { key: 'count' }
    void wrongValue
    void extraMember
    void narrowedMember
    void nestedExtraMember
    void nestedExtraViewAsBase
    void nestedArrayExtraMember
    void tupleAsArray
    void literalBooleanAsBoolean
    void deepNarrowedMember
    void structuralForgery
  }
})

test('preserves Fields and refined Result through root/scoped views and metadata commands', () => {
  type Fields = { readonly value: { readonly defaultValue: 1 } }
  type RefinedResult = CoreTransactionResult & { readonly tag: 'refined' }
  type Root = RootNexus<Fields, RefinedResult>
  type Scoped = ScopedNexus<Fields, RefinedResult>
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
  expectTypeOf<
    ReturnType<Root['inspectRegisteredValueReset']>
  >().toEqualTypeOf<RegisteredValueResetInspection>()
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
  expectTypeOf<
    ReturnType<Scoped['inspectRegisteredValueReset']>
  >().toEqualTypeOf<RegisteredValueResetInspection>()
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
  expectTypeOf<ReturnType<Root['updateDashListCollapseOverrides']>>().toEqualTypeOf<RefinedResult>()
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
  expectTypeOf<
    ReturnType<Scoped['updateDashListCollapseOverrides']>
  >().toEqualTypeOf<RefinedResult>()
  expectTypeOf<ReturnType<Scoped['resetDashListMetadata']>>().toEqualTypeOf<RefinedResult>()
})
