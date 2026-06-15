import { useCallback, useEffect, useMemo } from "react";
import { useStore } from "zustand";
import { defaultSection, defaultValueForControl } from "../control.js";
import type {
  NormalizedControl,
  PrimitiveValue,
  RegisterOptions,
  SetTweakerValue,
  TweakerSchema,
  TweakerValues,
} from "../types.js";
import { useTweakerStoreApi } from "./context.js";

export function resolveTweakerValues<T extends TweakerSchema>(
  schema: T,
  section: string,
  controls: NormalizedControl[],
  values: Record<string, PrimitiveValue>,
  getControlId: (section: string, key: string) => string,
): TweakerValues<T> {
  const controlsById = new Map(controls.map((control) => [control.id, control]));
  const output: Partial<TweakerValues<T>> = {};

  for (const key of Object.keys(schema) as Array<keyof T>) {
    const id = getControlId(section, String(key));
    const value = controlsById.get(id)?.value ?? values[id] ?? defaultValueForControl(schema[key]);
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

export function useTweaker<T extends TweakerSchema>(
  schema: T,
  options: RegisterOptions = {},
): [TweakerValues<T>, SetTweakerValue<T>] {
  const store = useTweakerStoreApi();
  const section = options.section ?? defaultSection;
  const sortable = options.sortable ?? true;
  const { opacity, hoverOpacity, backgroundBlur, hoverBackgroundBlur } = options;
  const controls = useStore(store, (state) => state.controls);
  const valuesById = useStore(store, (state) => state.values);
  const schemaSignature = stableStringify(schema);

  useEffect(
    () => store.getState().register(schema, { section, sortable }),
    [store, schemaSignature, section, sortable],
  );

  useEffect(
    () =>
      store.getState().updatePanelEffects(schema, {
        section,
        opacity,
        hoverOpacity,
        backgroundBlur,
        hoverBackgroundBlur,
      }),
    [store, schemaSignature, section, opacity, hoverOpacity, backgroundBlur, hoverBackgroundBlur],
  );

  const values = useMemo(() => {
    return resolveTweakerValues(
      schema,
      section,
      controls,
      valuesById,
      store.getState().getControlId,
    );
  }, [schema, section, controls, valuesById, store]);

  const setValue = useCallback<SetTweakerValue<T>>(
    (key, value) => {
      store.getState().setValue(store.getState().getControlId(section, String(key)), value);
    },
    [section, store],
  );

  return [values, setValue];
}
