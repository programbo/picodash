import type { TweakerPanelStore, TweakerValue } from './tweaker-panel-types.js'

export interface TweakerControlValueReference {
  field?: string
  value?: unknown
}

export function synchronizeTweakerFieldValue<TValue extends TweakerValue>(
  control: TweakerControlValueReference,
  normalize: (value: unknown) => TValue | undefined,
  isCanonical: (value: unknown, normalizedValue: TValue) => boolean,
  store: TweakerPanelStore,
) {
  synchronizeTweakerFieldValueInternal(control, normalize, isCanonical, store, false)
}

export function synchronizeOptionalTweakerFieldValue<TValue extends TweakerValue>(
  control: TweakerControlValueReference,
  normalize: (value: unknown) => TValue | undefined,
  isCanonical: (value: unknown, normalizedValue: TValue) => boolean,
  store: TweakerPanelStore,
) {
  synchronizeTweakerFieldValueInternal(control, normalize, isCanonical, store, true)
}

function synchronizeTweakerFieldValueInternal<TValue extends TweakerValue>(
  control: TweakerControlValueReference,
  normalize: (value: unknown) => TValue | undefined,
  isCanonical: (value: unknown, normalizedValue: TValue) => boolean,
  store: TweakerPanelStore,
  removeWhenUndefined: boolean,
) {
  const field = control.field
  if (field === undefined) return

  store.setState((state) => {
    if (!Object.prototype.hasOwnProperty.call(state.values, field)) return state
    const currentValue = state.values[field]
    const normalizedValue = normalize(currentValue)
    if (normalizedValue === undefined) {
      if (!removeWhenUndefined) return state
      const values = { ...state.values }
      delete values[field]
      return { values }
    }
    if (isCanonical(currentValue, normalizedValue)) return state
    return { values: { ...state.values, [field]: normalizedValue } }
  })
}

export function exactTweakerObjectValue<TValue extends object>(
  value: unknown,
  normalizedValue: TValue,
  keys: readonly (keyof TValue & string)[],
) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return (
    Object.keys(record).length === keys.length &&
    keys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(record, key) && record[key] === normalizedValue[key],
    )
  )
}

export function exactTweakerTupleValue<TValue extends readonly TweakerValue[]>(
  value: unknown,
  normalizedValue: TValue,
) {
  return (
    Array.isArray(value) &&
    value.length === normalizedValue.length &&
    value.every((entry, index) => entry === normalizedValue[index])
  )
}

export function exactTweakerObjectArrayValue<TValue extends object>(
  value: unknown,
  normalizedValue: readonly TValue[],
  keys: readonly (keyof TValue & string)[],
) {
  return (
    Array.isArray(value) &&
    value.length === normalizedValue.length &&
    value.every((entry, index) => {
      const normalizedEntry = normalizedValue[index]
      return normalizedEntry !== undefined && exactTweakerObjectValue(entry, normalizedEntry, keys)
    })
  )
}
