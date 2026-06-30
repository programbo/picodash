import { isValidElement, useCallback, useEffect, useMemo } from 'react'
import { useStore } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import {
  createControlPersistId,
  defaultValueForControl,
  normalizePanelId,
  normalizeSection,
} from '../control.js'
import type {
  ControlConfig,
  JsonValue,
  NormalizedControl,
  RegisterOptions,
  SectionConfig,
  SetTweakerValue,
  TweakerControlRegistry,
  TweakerSchema,
  TweakerValues,
} from '../types.js'
import { useTweakerCustomControls, useTweakerStoreApi } from './context.js'

function explicitControlId(config: TweakerSchema[string]) {
  return typeof config === 'object' && config !== null && typeof config.id === 'string'
    ? config.id
    : undefined
}

function hasValue(values: Record<string, JsonValue>, id: string) {
  return Object.prototype.hasOwnProperty.call(values, id)
}

export function resolveTweakerValues<T extends TweakerSchema>(
  schema: T,
  storeId: string,
  panelId: string,
  section: SectionConfig,
  controls: NormalizedControl[],
  values: Record<string, JsonValue>,
): TweakerValues<T> {
  const controlsById = new Map(controls.map((control) => [control.persistId, control]))
  const output: Partial<TweakerValues<T>> = {}

  for (const key of Object.keys(schema) as Array<keyof T>) {
    const config = schema[key]
    const id = createControlPersistId(
      storeId,
      panelId,
      section,
      String(key),
      explicitControlId(config),
    )
    const value = controlsById.get(id)?.value ?? values[id] ?? defaultValueForControl(config)
    output[key] = value as TweakerValues<T>[typeof key]
  }

  return output as TweakerValues<T>
}

function stableStringify(value: unknown, seen = new WeakSet<object>()): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item, seen)).join(',')}]`
  }

  if (isValidElement(value)) {
    const element = value as { type: unknown; key: unknown; props: unknown }
    return `{${[
      `"$$react":true`,
      `"type":${stableStringify(element.type, seen)}`,
      `"key":${stableStringify(element.key, seen)}`,
      `"props":${stableStringify(element.props, seen)}`,
    ].join(',')}}`
  }

  if (value && typeof value === 'object') {
    if (seen.has(value)) return '"[Circular]"'
    seen.add(value)
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item, seen)}`)
      .join(',')}}`
  }

  if (typeof value === 'function') return `"[Function:${value.name || 'anonymous'}]"`
  if (typeof value === 'symbol') return JSON.stringify(String(value))
  if (value === undefined) return '"[Undefined]"'
  return JSON.stringify(value)
}

export function registrationSignatureForSchema(schema: TweakerSchema): string {
  return stableStringify(schema)
}

export function useTweaker<T extends TweakerSchema>(
  schema: T,
  options: RegisterOptions = {},
): [TweakerValues<T>, SetTweakerValue<T>] {
  const store = useTweakerStoreApi()
  const registry = useTweakerCustomControls()
  const panelId = normalizePanelId(options.panel)
  const section = normalizeSection(options.section)
  const reorderable = options.reorderable ?? options.sortable ?? true
  const schemaSignature = useMemo(() => registrationSignatureForSchema(schema), [schema])
  const storeId = store.getState().id
  const controlIds = useMemo(
    () =>
      (Object.keys(schema) as Array<keyof T>).map((key) =>
        createControlPersistId(
          storeId,
          panelId,
          section,
          String(key),
          explicitControlId(schema[key]),
        ),
      ),
    [schema, storeId, panelId, section.id, section.label],
  )
  const controlIdSet = useMemo(() => new Set(controlIds), [controlIds])
  const controls = useStore(
    store,
    useShallow((state) => state.controls.filter((control) => controlIdSet.has(control.persistId))),
  )
  const valuesById = useStore(
    store,
    useShallow((state) => {
      const selectedValues: Record<string, JsonValue> = {}
      for (const id of controlIds) {
        if (hasValue(state.values, id)) selectedValues[id] = state.values[id]!
      }
      return selectedValues
    }),
  )

  useEffect(
    () =>
      store.getState().register(schema, {
        panel: panelId,
        section,
        reorderable,
        registry,
      } as RegisterOptions & {
        registry: TweakerControlRegistry
      }),
    [
      store,
      schemaSignature,
      panelId,
      section.id,
      section.label,
      section.hidden,
      reorderable,
      registry,
    ],
  )

  useEffect(
    () =>
      store.getState().updatePanelEffects(schema, {
        panel: panelId,
        section,
        opacity: options.opacity,
        hoverOpacity: options.hoverOpacity,
        backgroundBlur: options.backgroundBlur,
        hoverBackgroundBlur: options.hoverBackgroundBlur,
      }),
    [
      store,
      schemaSignature,
      panelId,
      section.id,
      section.label,
      section.hidden,
      options.opacity,
      options.hoverOpacity,
      options.backgroundBlur,
      options.hoverBackgroundBlur,
    ],
  )

  const values = useMemo(() => {
    return resolveTweakerValues(schema, storeId, panelId, section, controls, valuesById)
  }, [schema, storeId, panelId, section, controls, valuesById])

  const setValue = useCallback<SetTweakerValue<T>>(
    (key, value) => {
      const config = schema[key] as ControlConfig
      const id = createControlPersistId(
        storeId,
        panelId,
        section,
        String(key),
        explicitControlId(config),
      )
      store.getState().setValue(id, value)
    },
    [panelId, schema, section, store, storeId],
  )

  return [values, setValue]
}
