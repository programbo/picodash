import type { StandardSchemaV1 } from '@standard-schema/spec'
export type PicodashJsonPrimitive = boolean | null | number | string

export type PicodashJsonValue =
  | PicodashJsonPrimitive
  | readonly PicodashJsonValue[]
  | { readonly [key: string]: PicodashJsonValue }

export type PicodashValidationSource =
  | 'adapter'
  | 'default'
  | 'import'
  | 'initial'
  | 'interactive'
  | 'programmatic'
  | 'repair'
  | 'reset'

export interface PicodashValidationContext<TValue = PicodashJsonValue> {
  readonly currentValue?: TValue
  readonly defaultValue: TValue
  readonly field: PicodashField<Record<string, TValue>, string>
  readonly source: PicodashValidationSource
}

export type PicodashFieldOutput<TValue, TAllowUnset extends boolean = boolean> =
  | { readonly value: JsonCompatible<TValue> }
  | (TAllowUnset extends true ? { readonly unset: true } : never)

export type PicodashParseResult<TValue, TAllowUnset extends boolean = boolean> =
  | {
      readonly output: PicodashFieldOutput<TValue, TAllowUnset>
      readonly success: true
    }
  | {
      readonly errors: readonly string[]
      readonly repair?: PicodashFieldOutput<TValue, TAllowUnset>
      readonly success: false
    }

export type PicodashValidationResult =
  | { readonly success: true }
  | { readonly errors: readonly string[]; readonly success: false }

export type PicodashParser<TValue, TAllowUnset extends boolean = boolean> = (
  input: unknown,
  context: PicodashValidationContext<TValue>,
) => PicodashParseResult<TValue, TAllowUnset>

export type PicodashFunctionValidator<TValue> = (
  value: TValue,
  context: PicodashValidationContext<TValue>,
) => PicodashValidationResult

export type PicodashStandardSchemaValidator<TValue> = StandardSchemaV1<unknown, TValue>

export type PicodashValidator<TValue> =
  | PicodashFunctionValidator<TValue>
  | PicodashStandardSchemaValidator<TValue>

interface PicodashFieldDefinitionBase<TValue> {
  readonly defaultValue: JsonCompatible<TValue>
  readonly validate?: PicodashValidator<TValue>
}

export type PicodashFieldDefinition<TValue> =
  | (PicodashFieldDefinitionBase<TValue> & {
      readonly allowUnset?: false
      readonly parse?: PicodashParser<TValue, false>
    })
  | (PicodashFieldDefinitionBase<TValue> & {
      readonly allowUnset: true
      readonly parse?: PicodashParser<TValue, true>
    })

export interface PicodashField<
  TValues extends object,
  TKey extends Extract<keyof TValues, string>,
> {
  readonly key: TKey
}

export interface PicodashStoreState<TValues extends object> {
  readonly diagnostics: readonly import('./errors.js').PicodashDiagnostic[]
  readonly fieldStates: PicodashFieldStates<TValues>
  readonly interaction: PicodashInteractionState
  readonly itemMetadata: PicodashItemMetadata
  readonly items: Readonly<Record<string, PicodashRegisteredItem<TValues>>>
  readonly panelId: string
  /** Stable Store identity, independent of a rendered Panel. */
  readonly storeId: string
  /** Optional application scope for namespaced Store metadata. */
  readonly scopeId?: string
  readonly repairProposal: PicodashRepairProposal<TValues> | null
  readonly values: TValues
  analyzePanelDocument: (
    document: unknown,
  ) => import('./documents.js').PicodashPanelImportAnalysis<TValues>
  applyPanelImport: (
    analysis: Exclude<
      import('./documents.js').PicodashPanelImportAnalysis<TValues>,
      { status: 'invalid' }
    >,
  ) => import('./documents.js').PicodashPanelImportApplyResult<TValues>
  abortRepairProposal: () => void
  acceptRepairProposal: () => PicodashWriteResult<TValues>
  resetFieldValue: <TKey extends Extract<keyof TValues, string>>(
    field: PicodashField<TValues, TKey>,
  ) => PicodashWriteResult<TValues>
  resetFields: () => PicodashWriteResult<TValues>
  resetRegisteredFields: () => PicodashWriteResult<TValues>
  registerItem: (item: PicodashItemRegistration<TValues>) => PicodashItemRegistrationResult
  moveItemRelativeTo: (itemId: string, overId: string, position: 'after' | 'before') => void
  moveItemToIndex: (itemId: string, index: number) => void
  setAllCollapsibleItemsCollapsed: (collapsed: boolean) => void
  setFieldInput: <TKey extends Extract<keyof TValues, string>>(
    field: PicodashField<TValues, TKey>,
    input: unknown,
  ) => PicodashWriteResult<TValues>
  setFieldValue: <TKey extends Extract<keyof TValues, string>>(
    field: PicodashField<TValues, TKey>,
    value: TValues[TKey],
  ) => PicodashWriteResult<TValues>
  setFieldValues: (values: Partial<TValues>) => PicodashWriteResult<TValues>
  setFocusedItem: (itemId: string | null) => void
  setHoveredItem: (itemId: string | null) => void
  setInteractionActive: (interactionId: string, active: boolean) => void
  setItemCollapsed: (itemId: string, collapsed: boolean) => void
  setDraggingItem: (itemId: string | null) => void
  setItemOrder: (parentId: string, itemIds: readonly string[]) => void
  unregisterItem: (itemId: string) => void
}

export interface PicodashStore<TValues extends object> {
  readonly diagnostics: import('./diagnostics.js').PicodashDiagnosticChannel
  readonly fields: PicodashFields<TValues>
  getInitialState: () => PicodashStoreState<TValues>
  getState: () => PicodashStoreState<TValues>
  ownsField: (field: unknown) => field is PicodashOwnedField<TValues>
  subscribe: (
    listener: (
      state: PicodashStoreState<TValues>,
      previousState: PicodashStoreState<TValues>,
    ) => void,
  ) => () => void
}

export type PicodashFieldDefinitions<TValues extends object> = {
  readonly [TKey in keyof TValues]-?: PicodashFieldDefinition<TValues[TKey]>
}

export type PicodashFields<TValues extends object> = {
  readonly [TKey in Extract<keyof TValues, string>]: PicodashField<TValues, TKey>
}

export type PicodashOwnedField<TValues extends object> = PicodashFields<TValues>[Extract<
  keyof TValues,
  string
>]

export interface PicodashFieldState<TValue> {
  readonly defaultValue: TValue
  readonly dirty: boolean
  readonly draftValue?: unknown
  readonly errors: readonly string[]
  readonly touched: boolean
}

export type PicodashFieldStates<TValues extends object> = {
  readonly [TKey in keyof TValues]-?: PicodashFieldState<TValues[TKey]>
}

export type PicodashWriteErrors<TValues extends object> = Partial<{
  readonly [TKey in Extract<keyof TValues, string>]: readonly string[]
}>

export type PicodashWriteResult<TValues extends object = Record<string, PicodashJsonValue>> =
  | { readonly success: true }
  | {
      readonly diagnostic?: import('./errors.js').PicodashDiagnostic
      readonly errors: PicodashWriteErrors<TValues>
      readonly success: false
    }

export type PicodashRepairChange<TValues extends object> = {
  [TKey in Extract<keyof TValues, string>]: {
    readonly after: PicodashFieldOutput<TValues[TKey]>
    readonly before: PicodashFieldOutput<TValues[TKey]>
    readonly errors: readonly string[]
    readonly field: PicodashField<TValues, TKey>
  }
}[Extract<keyof TValues, string>]

export interface PicodashRepairProposal<TValues extends object> {
  readonly changes: readonly PicodashRepairChange<TValues>[]
  readonly source: 'adapter' | 'initial'
}

export type PicodashItemBindingMode = 'display' | 'input'
export type PicodashItemPin = 'end' | 'start'
export type PicodashItemOrderBand = 'auto' | PicodashItemPin
export type PicodashItemKind = 'group' | 'item'

/**
 * A serializable, intentionally shallow description of values a mounted
 * presentation can render or edit. Durable parsing and validation belong to
 * the field definition; this descriptor only checks presentation
 * compatibility.
 *
 * `media` and `visualization` distinguish semantic object consumers. They
 * validate only that the value is a JSON object; object shape remains the
 * field validator's responsibility.
 */
export type PicodashPresentationValueContract<TValue = PicodashJsonValue> = TValue extends boolean
  ? { readonly allowUnset?: boolean; readonly kind: 'boolean' }
  : TValue extends number
    ? { readonly allowUnset?: boolean; readonly finite?: boolean; readonly kind: 'number' }
    : TValue extends string
      ? {
          readonly allowUnset?: boolean
          readonly kind: 'string'
          readonly values?: readonly TValue[]
        }
      : TValue extends null
        ? { readonly allowUnset?: boolean; readonly kind: 'null' }
        : TValue extends readonly unknown[]
          ?
              | {
                  readonly allowUnset?: boolean
                  readonly kind: 'array'
                }
              | {
                  readonly allowUnset?: boolean
                  readonly kind: 'tuple'
                  readonly length: number
                }
          : TValue extends object
            ? {
                readonly allowUnset?: boolean
                readonly kind: 'media' | 'object' | 'visualization'
              }
            : never

export interface PicodashPresentationContract<TValue = PicodashJsonValue> {
  readonly accepts: PicodashPresentationValueContract<TValue>
  /** Stable package-qualified component identity, for example `@picodash/dashpanel/Slider`. */
  readonly component: string
  /** Stable versioned identity for this component constraint, for example `slider:number:v1`. */
  readonly id: string
}

export type PicodashItemBinding<TValues extends object> =
  | PicodashOwnedField<TValues>
  | {
      [TKey in Extract<keyof TValues, string>]: {
        readonly field: PicodashField<TValues, TKey>
        readonly mode?: PicodashItemBindingMode
        readonly presentation?: PicodashPresentationContract<TValues[TKey]>
      }
    }[Extract<keyof TValues, string>]

interface PicodashItemRegistrationBase {
  readonly collapsible?: boolean
  readonly defaultCollapsed?: boolean
  readonly hidden?: boolean
  readonly id: string
  readonly kind?: PicodashItemKind
  readonly label?: string
  readonly parentId?: string
  readonly pin?: PicodashItemPin
  readonly reorderable?: boolean
}

export type PicodashItemRegistration<TValues extends object> = PicodashItemRegistrationBase &
  (
    | {
        readonly field: PicodashItemBinding<TValues>
        readonly fields?: never
      }
    | {
        readonly field?: never
        readonly fields: Readonly<Record<string, PicodashItemBinding<TValues>>>
      }
    | {
        readonly field?: never
        readonly fields?: never
      }
  )

export interface PicodashRegisteredItemBinding<TValues extends object> {
  readonly alias: string
  readonly field: PicodashOwnedField<TValues>
  readonly mode: PicodashItemBindingMode
  readonly presentation?: PicodashPresentationContract
}

export interface PicodashRegisteredItem<TValues extends object> extends Required<
  Pick<
    PicodashItemRegistrationBase,
    'collapsible' | 'defaultCollapsed' | 'hidden' | 'id' | 'kind' | 'parentId' | 'reorderable'
  >
> {
  readonly bindings: readonly PicodashRegisteredItemBinding<TValues>[]
  readonly label?: string
  readonly pin?: PicodashItemPin
}

export type PicodashItemRegistrationErrorCode =
  | 'conflicting-field-mode'
  | 'conflicting-presentation-contract'
  | 'duplicate-field-binding'
  | 'duplicate-item-id'
  | 'foreign-field'
  | 'incompatible-field-presentation'
  | 'invalid-presentation-contract'

export interface PicodashItemRegistrationError {
  readonly alias?: string
  readonly code: PicodashItemRegistrationErrorCode
  readonly diagnostic?: import('./errors.js').PicodashDiagnostic
  readonly field?: string
  readonly itemId: string
  readonly message: string
}

export type PicodashItemRegistrationResult =
  | { readonly success: true }
  | {
      readonly errors: readonly PicodashItemRegistrationError[]
      readonly success: false
    }

export interface PicodashInteractionState {
  readonly activeIds: Readonly<Record<string, true>>
  readonly draggingId: string | null
  readonly focusedId: string | null
  readonly hoveredId: string | null
}

export interface PicodashItemMetadata {
  readonly collapsed: Readonly<Record<string, boolean>>
  readonly order: Readonly<Record<string, readonly string[]>>
}

export interface PicodashStoreOptions<TValues extends object> {
  readonly adapter?: import('./adapter.js').PicodashValueAdapter<TValues>
  readonly fields: PicodashFieldDefinitions<TValues>
  readonly initialItemMetadata?: PicodashItemMetadata
  readonly initialValues?: Partial<JsonCompatibleRecord<TValues>>
  /** Optional rendering identity. Store fields do not require a Panel. */
  readonly panelId?: string
  /** Stable identity for this Store when no rendered Panel owns it. */
  readonly storeId?: string
  /** Optional application scope for namespaced metadata and registries. */
  readonly scopeId?: string
}

export interface PicodashInferredStoreOptions<
  TDefinitions extends Record<string, PicodashInferredFieldDefinition>,
> {
  readonly adapter?: import('./adapter.js').PicodashValueAdapter<
    PicodashValuesFromDefinitions<TDefinitions>
  >
  readonly fields: TDefinitions
  readonly initialItemMetadata?: PicodashItemMetadata
  readonly initialValues?: Partial<PicodashValuesFromDefinitions<TDefinitions>>
  readonly panelId?: string
  readonly storeId?: string
  readonly scopeId?: string
}

export interface PicodashInferredFieldDefinition {
  readonly allowUnset?: boolean
  readonly defaultValue: PicodashJsonValue
  readonly parse?: unknown
  readonly validate?: unknown
}

export type PicodashValuesFromDefinitions<
  TDefinitions extends Record<string, PicodashInferredFieldDefinition>,
> = {
  -readonly [TKey in keyof TDefinitions]: ValueFromDefinition<TDefinitions[TKey]>
}

type JsonCompatibleRecord<TValues extends object> = {
  [TKey in keyof TValues]: JsonCompatible<TValues[TKey]>
}

export type JsonCompatible<TValue> = TValue extends PicodashJsonPrimitive
  ? TValue
  : TValue extends readonly (infer TEntry)[]
    ? readonly JsonCompatible<TEntry>[]
    : TValue extends object
      ? { [TKey in keyof TValue]: JsonCompatible<TValue[TKey]> }
      : never

type WidenJsonValue<TValue> = TValue extends boolean
  ? boolean
  : TValue extends number
    ? number
    : TValue extends string
      ? string
      : TValue extends null
        ? null
        : TValue extends readonly (infer TEntry)[]
          ? WidenJsonValue<TEntry>[]
          : TValue extends object
            ? { -readonly [TKey in keyof TValue]: WidenJsonValue<TValue[TKey]> }
            : never

type ValueFromDefinition<TDefinition> = TDefinition extends {
  readonly validate: StandardSchemaV1<unknown, infer TOutput>
}
  ? TOutput extends PicodashJsonValue
    ? TOutput
    : never
  : WidenJsonValue<TDefinition extends { readonly defaultValue: infer TValue } ? TValue : never>
