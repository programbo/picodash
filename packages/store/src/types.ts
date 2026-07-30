import type { StoreApi } from 'zustand/vanilla'

export type PicodashJsonPrimitive = boolean | null | number | string

export type PicodashJsonValue =
  | PicodashJsonPrimitive
  | readonly PicodashJsonValue[]
  | { readonly [key: string]: PicodashJsonValue }

export interface PicodashFieldDefinition<TValue> {
  readonly defaultValue: JsonCompatible<TValue>
}

export interface PicodashField<
  TValues extends object,
  TKey extends Extract<keyof TValues, string>,
> {
  readonly key: TKey
  readonly store: PicodashStore<TValues>
}

export interface PicodashStoreState<TValues extends object> {
  panelId: string
  values: TValues
}

export type PicodashStore<TValues extends object> = StoreApi<PicodashStoreState<TValues>> & {
  readonly fields: PicodashFields<TValues>
}

export type PicodashFieldDefinitions<TValues extends object> = {
  readonly [TKey in keyof TValues]-?: PicodashFieldDefinition<TValues[TKey]>
}

export type PicodashFields<TValues extends object> = {
  readonly [TKey in Extract<keyof TValues, string>]: PicodashField<TValues, TKey>
}

export interface PicodashStoreOptions<TValues extends object> {
  readonly fields: PicodashFieldDefinitions<TValues>
  readonly initialValues?: Partial<JsonCompatibleRecord<TValues>>
  readonly panelId: string
}

export interface PicodashInferredStoreOptions<
  TDefinitions extends Record<string, PicodashFieldDefinition<PicodashJsonValue>>,
> {
  readonly fields: TDefinitions
  readonly initialValues?: Partial<PicodashValuesFromDefinitions<TDefinitions>>
  readonly panelId: string
}

export type PicodashValuesFromDefinitions<
  TDefinitions extends Record<string, PicodashFieldDefinition<PicodashJsonValue>>,
> = {
  -readonly [TKey in keyof TDefinitions]: WidenJsonValue<
    TDefinitions[TKey] extends { readonly defaultValue: infer TValue } ? TValue : never
  >
}

type JsonCompatibleRecord<TValues extends object> = {
  [TKey in keyof TValues]: JsonCompatible<TValues[TKey]>
}

type JsonCompatible<TValue> = TValue extends PicodashJsonPrimitive
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
