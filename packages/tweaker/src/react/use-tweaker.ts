import { isValidElement, useCallback, useEffect, useMemo } from "react";
import { useStore } from "zustand";
import { defaultSection, defaultValueForControl, statusForControl } from "../control.js";
import type {
  ControlConfig,
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

function reactTypeName(type: unknown) {
  if (typeof type === "string") return type;
  if (typeof type === "function") {
    const component = type as { displayName?: string; name?: string };
    return component.displayName ?? component.name ?? "anonymous";
  }
  if (typeof type === "symbol") return String(type);
  return stableStringify(type);
}

export function stableStringify(value: unknown): string {
  if (isValidElement(value)) {
    return `{${[
      `"reactElement":${JSON.stringify(reactTypeName(value.type))}`,
      `"key":${stableStringify(value.key)}`,
      `"props":${stableStringify(value.props)}`,
    ].join(",")}}`;
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }

  if (typeof value === "function") {
    return JSON.stringify(`[function:${value.name || "anonymous"}]`);
  }

  if (typeof value === "symbol") {
    return JSON.stringify(String(value));
  }

  return JSON.stringify(value);
}

function controlRegistrationConfig(config: ControlConfig): unknown {
  if (!config || typeof config !== "object") return config;
  const registrationConfig = { ...config };
  delete registrationConfig.status;
  return registrationConfig;
}

export function registrationSignatureForSchema(schema: TweakerSchema): string {
  return stableStringify(
    Object.fromEntries(
      Object.entries(schema).map(([key, config]) => [key, controlRegistrationConfig(config)]),
    ),
  );
}

export function statusSignatureForSchema(schema: TweakerSchema): string {
  return stableStringify(
    Object.fromEntries(
      Object.entries(schema).map(([key, config]) => [key, statusForControl(config)]),
    ),
  );
}

export function useTweaker<T extends TweakerSchema>(
  schema: T,
  options: RegisterOptions = {},
): [TweakerValues<T>, SetTweakerValue<T>] {
  const store = useTweakerStoreApi();
  const section = options.section ?? defaultSection;
  const sortable = options.sortable ?? true;
  const { opacity, hoverOpacity, backgroundBlur, hoverBackgroundBlur, tooltipForeground } = options;
  const controls = useStore(store, (state) => state.controls);
  const valuesById = useStore(store, (state) => state.values);
  const registrationSignature = registrationSignatureForSchema(schema);
  const statusSignature = statusSignatureForSchema(schema);

  useEffect(
    () => store.getState().register(schema, { section, sortable }),
    [store, registrationSignature, section, sortable],
  );

  useEffect(
    () =>
      store.getState().updatePanelEffects(schema, {
        section,
        opacity,
        hoverOpacity,
        backgroundBlur,
        hoverBackgroundBlur,
        tooltipForeground,
      }),
    [
      store,
      registrationSignature,
      section,
      opacity,
      hoverOpacity,
      backgroundBlur,
      hoverBackgroundBlur,
      tooltipForeground,
    ],
  );

  useEffect(
    () => store.getState().updateControlStatuses(schema, { section }),
    [store, statusSignature, section],
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
