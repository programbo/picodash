import { useCallback, useEffect, useMemo } from "react";
import { useStore } from "zustand";
import {
  createControlPersistId,
  defaultValueForControl,
  normalizePanelId,
  normalizeSection,
} from "../control.js";
import type {
  ControlConfig,
  JsonValue,
  NormalizedControl,
  RegisterOptions,
  SectionConfig,
  SetTweakerValue,
  TweakerSchema,
  TweakerValues,
} from "../types.js";
import { useTweakerStoreApi } from "./context.js";

function explicitControlId(config: TweakerSchema[string]) {
  return typeof config === "object" && config !== null && typeof config.id === "string"
    ? config.id
    : undefined;
}

export function resolveTweakerValues<T extends TweakerSchema>(
  schema: T,
  storeId: string,
  panelId: string,
  section: SectionConfig,
  controls: NormalizedControl[],
  values: Record<string, JsonValue>,
): TweakerValues<T> {
  const controlsById = new Map(controls.map((control) => [control.persistId, control]));
  const output: Partial<TweakerValues<T>> = {};

  for (const key of Object.keys(schema) as Array<keyof T>) {
    const config = schema[key];
    const id = createControlPersistId(
      storeId,
      panelId,
      section,
      String(key),
      explicitControlId(config),
    );
    const value = controlsById.get(id)?.value ?? values[id] ?? defaultValueForControl(config);
    output[key] = value as TweakerValues<T>[typeof key];
  }

  return output as TweakerValues<T>;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

export function registrationSignatureForSchema(schema: TweakerSchema): string {
  return stableStringify(schema);
}

export function useTweaker<T extends TweakerSchema>(
  schema: T,
  options: RegisterOptions = {},
): [TweakerValues<T>, SetTweakerValue<T>] {
  const store = useTweakerStoreApi();
  const panelId = normalizePanelId(options.panel);
  const section = normalizeSection(options.section);
  const reorderable = options.reorderable ?? options.sortable ?? true;
  const controls = useStore(store, (state) => state.controls);
  const valuesById = useStore(store, (state) => state.values);
  const schemaSignature = registrationSignatureForSchema(schema);
  const storeId = store.getState().storeId;

  useEffect(
    () => store.getState().register(schema, { panel: panelId, section, reorderable }),
    [store, schemaSignature, panelId, section.id, section.label, section.hidden, reorderable],
  );

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
      options.opacity,
      options.hoverOpacity,
      options.backgroundBlur,
      options.hoverBackgroundBlur,
      section.hidden,
    ],
  );

  const values = useMemo(() => {
    return resolveTweakerValues(schema, storeId, panelId, section, controls, valuesById);
  }, [schema, storeId, panelId, section, controls, valuesById]);

  const setValue = useCallback<SetTweakerValue<T>>(
    (key, value) => {
      const config = schema[key] as ControlConfig;
      const id = createControlPersistId(
        storeId,
        panelId,
        section,
        String(key),
        explicitControlId(config),
      );
      store.getState().setValue(id, value);
    },
    [panelId, schema, section, store, storeId],
  );

  return [values, setValue];
}
