import type {
  ControlConfig,
  ControlKind,
  NormalizedControl,
  PrimitiveValue,
  RegisterOptions,
} from "./types.js";

export const defaultSection = "Controls";

export function labelFromKey(key: string) {
  return key
    .replace(/[-_]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (char) => char.toUpperCase());
}

export function clamp(value: number, min?: number, max?: number) {
  let next = value;
  if (typeof min === "number") next = Math.max(min, next);
  if (typeof max === "number") next = Math.min(max, next);
  return next;
}

function normalizeOptions(options: readonly string[] | Record<string, string>) {
  if (Array.isArray(options)) {
    return options.map((value) => ({ label: labelFromKey(value), value }));
  }

  return Object.entries(options).map(([label, value]) => ({ label, value }));
}

export function createControlId(storeId: string, section: string, key: string) {
  return `${storeId}:${section}:${String(key)}`;
}

export function defaultValueForControl(config: ControlConfig): PrimitiveValue {
  return typeof config === "object" ? config.value : config;
}

function normalizeOpacity(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return clamp(value, 0, 1);
}

function normalizeBlur(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return Math.max(0, value);
}

export function normalizePanelEffects(options: RegisterOptions) {
  return {
    opacity: normalizeOpacity(options.opacity),
    hoverOpacity: normalizeOpacity(options.hoverOpacity),
    backgroundBlur: normalizeBlur(options.backgroundBlur),
    hoverBackgroundBlur: normalizeBlur(options.hoverBackgroundBlur),
  };
}

function controlBase(
  storeId: string,
  section: string,
  key: string,
  sortable: boolean,
  opacity?: number,
  hoverOpacity?: number,
  backgroundBlur?: number,
  hoverBackgroundBlur?: number,
) {
  const effects = normalizePanelEffects({
    opacity,
    hoverOpacity,
    backgroundBlur,
    hoverBackgroundBlur,
  });

  return {
    id: createControlId(storeId, section, key),
    key,
    section,
    sortable,
    ...effects,
  };
}

export function normalizeControl(
  storeId: string,
  section: string,
  key: string,
  config: ControlConfig,
  sortable = true,
  opacity?: number,
  hoverOpacity?: number,
  backgroundBlur?: number,
  hoverBackgroundBlur?: number,
): NormalizedControl {
  const fallbackLabel = labelFromKey(key);
  const base = controlBase(
    storeId,
    section,
    key,
    sortable,
    opacity,
    hoverOpacity,
    backgroundBlur,
    hoverBackgroundBlur,
  );

  if (typeof config === "number") {
    return {
      ...base,
      kind: "number",
      label: fallbackLabel,
      value: config,
      defaultValue: config,
    };
  }

  if (typeof config === "boolean") {
    return {
      ...base,
      kind: "checkbox",
      label: fallbackLabel,
      value: config,
      defaultValue: config,
    };
  }

  if (typeof config === "string") {
    return {
      ...base,
      kind: "select",
      label: fallbackLabel,
      value: config,
      defaultValue: config,
      options: [{ label: labelFromKey(config), value: config }],
    };
  }

  if ("options" in config) {
    return {
      ...base,
      kind: "select",
      label: config.label ?? fallbackLabel,
      value: config.value,
      defaultValue: config.value,
      options: normalizeOptions(config.options),
    };
  }

  if (typeof config.value === "boolean") {
    return {
      ...base,
      kind: "checkbox",
      label: config.label ?? fallbackLabel,
      value: config.value,
      defaultValue: config.value,
    };
  }

  const hasSliderBounds =
    config.type === "slider" ||
    (config.type !== "number" && typeof config.min === "number" && typeof config.max === "number");
  const kind: ControlKind = hasSliderBounds ? "slider" : "number";

  return {
    ...base,
    kind,
    label: config.label ?? fallbackLabel,
    value: config.value,
    defaultValue: config.value,
    min: config.min,
    max: config.max,
    step: config.step,
  };
}

export function valuesForControls(
  controls: NormalizedControl[],
  values: Record<string, PrimitiveValue>,
): NormalizedControl[] {
  return controls.map((control) => ({
    ...control,
    value: values[control.id] ?? control.defaultValue,
  }));
}

export function sectionOrderFor(controls: NormalizedControl[]) {
  return Array.from(new Set(controls.map((control) => control.section)));
}
