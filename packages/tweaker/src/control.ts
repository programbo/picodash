import type { ControlConfig, ControlKind, NormalizedControl, PrimitiveValue } from "./types.js";

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

export function normalizeControl(
  storeId: string,
  section: string,
  key: string,
  config: ControlConfig,
  sortable = true,
): NormalizedControl {
  const id = createControlId(storeId, section, key);
  const fallbackLabel = labelFromKey(key);

  if (typeof config === "number") {
    return {
      id,
      key,
      section,
      sortable,
      kind: "number",
      label: fallbackLabel,
      value: config,
      defaultValue: config,
    };
  }

  if (typeof config === "boolean") {
    return {
      id,
      key,
      section,
      sortable,
      kind: "checkbox",
      label: fallbackLabel,
      value: config,
      defaultValue: config,
    };
  }

  if (typeof config === "string") {
    return {
      id,
      key,
      section,
      sortable,
      kind: "select",
      label: fallbackLabel,
      value: config,
      defaultValue: config,
      options: [{ label: labelFromKey(config), value: config }],
    };
  }

  if ("options" in config) {
    return {
      id,
      key,
      section,
      sortable,
      kind: "select",
      label: config.label ?? fallbackLabel,
      value: config.value,
      defaultValue: config.value,
      options: normalizeOptions(config.options),
    };
  }

  if (typeof config.value === "boolean") {
    return {
      id,
      key,
      section,
      sortable,
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
    id,
    key,
    section,
    sortable,
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
