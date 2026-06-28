import {
  defaultPanelId,
  defaultSectionId,
  defaultSectionLabel,
  type ControlConfig,
  type ControlKind,
  type ControlStatus,
  type JsonValue,
  type NormalizedControl,
  type PanelAppearance,
  type RegisterOptions,
  type SectionConfig,
} from "./types.js";

const standardControlKeys = new Set([
  "id",
  "type",
  "value",
  "defaultValue",
  "label",
  "min",
  "max",
  "step",
  "options",
  "status",
  "help",
  "formatOptions",
  "readOnly",
  "hidden",
]);

export const defaultSection = defaultSectionLabel;

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

export interface SliderKeyboardIncrement {
  /** Magnitude applied on a plain Arrow key press. */
  step: number;
  /** Magnitude applied on Shift + Arrow. */
  shiftStep: number;
}

/**
 * Returns the keyboard nudge magnitudes for a slider. Sliders whose step is
 * fractional (or unset, defaulting to a fractional step) are treated as
 * "decimal": plain arrows move 0.1 and Shift arrows move 1. Integer-step
 * sliders move 1 and 10 respectively. These magnitudes are independent of the
 * slider's drag/precision step.
 */
export function sliderKeyboardIncrement(step: number | undefined): SliderKeyboardIncrement {
  const isDecimal = step === undefined || !Number.isInteger(step);
  return isDecimal ? { step: 0.1, shiftStep: 1 } : { step: 1, shiftStep: 10 };
}

function normalizeOptions(options: readonly string[] | Record<string, string>) {
  if (Array.isArray(options)) {
    return options.map((value) => ({ label: labelFromKey(value), value }));
  }

  return Object.entries(options).map(([label, value]) => ({ label, value }));
}

function safeId(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "control"
  );
}

export function normalizePanelId(panel?: string) {
  return panel?.trim() || defaultPanelId;
}

export function normalizeSection(section?: string | SectionConfig): SectionConfig {
  if (!section) return { id: defaultSectionId, label: defaultSectionLabel };
  if (typeof section === "string") return { id: section, label: section };
  return {
    id: section.id.trim() || defaultSectionId,
    label: section.label.trim() || labelFromKey(section.id),
    hidden: section.hidden === true ? true : undefined,
  };
}

export function createControlPersistId(
  storeId: string,
  panelId: string,
  section: SectionConfig,
  key: string,
  explicitControlId?: string,
) {
  const controlId = explicitControlId ?? key;
  if (!explicitControlId && panelId === defaultPanelId && section.id === section.label) {
    return `${storeId}:${section.label}:${key}`;
  }

  return `${storeId}:${panelId}:${section.id}:${controlId}`;
}

export function createControlId(storeId: string, section: string, key: string) {
  return createControlPersistId(storeId, defaultPanelId, { id: section, label: section }, key);
}

export function createControlDomId(
  storeId: string,
  panelId: string,
  sectionId: string,
  controlId: string,
) {
  return `tw-${safeId(storeId)}-${safeId(panelId)}-${safeId(sectionId)}-${safeId(controlId)}`;
}

export function defaultValueForControl(config: ControlConfig): JsonValue {
  if (typeof config !== "object" || config === null) return config;
  if ("defaultValue" in config && config.defaultValue !== undefined) return config.defaultValue;
  if ("value" in config && config.value !== undefined) return config.value;
  return null;
}

function normalizeOpacity(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return clamp(value, 0, 1);
}

function normalizeBlur(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return Math.max(0, value);
}

export function statusForControl(config: ControlConfig): ControlStatus | undefined {
  if (typeof config !== "object" || config === null) return undefined;
  const value = config.status;
  return value === "info" || value === "alert" || value === "error" ? value : undefined;
}

function helpForControl(config: ControlConfig) {
  if (typeof config !== "object" || config === null) return undefined;
  const value = config.help;
  return typeof value === "string" && value.trim() ? value : undefined;
}

function readOnlyForControl(config: ControlConfig) {
  if (typeof config !== "object" || config === null) return undefined;
  return config.readOnly === true ? true : undefined;
}

function hiddenForControl(config: ControlConfig) {
  if (typeof config !== "object" || config === null) return undefined;
  return config.hidden === true ? true : undefined;
}

function formatForControl(config: ControlConfig) {
  if (typeof config !== "object" || config === null) return undefined;
  const value = (config as Record<string, unknown>).format;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function normalizePanelEffects(options: RegisterOptions): PanelAppearance {
  return {
    surfaceOpacity: normalizeOpacity(options.opacity),
    activeSurfaceOpacity: normalizeOpacity(options.hoverOpacity),
    backdropBlur: normalizeBlur(options.backgroundBlur),
    activeBackdropBlur: normalizeBlur(options.hoverBackgroundBlur),
  };
}

export function hasPanelEffects(options: RegisterOptions) {
  return (
    options.opacity !== undefined ||
    options.hoverOpacity !== undefined ||
    options.backgroundBlur !== undefined ||
    options.hoverBackgroundBlur !== undefined
  );
}

export function normalizePanelAppearance(appearance: PanelAppearance = {}): PanelAppearance {
  return {
    surfaceOpacity: normalizeOpacity(appearance.surfaceOpacity),
    activeSurfaceOpacity: normalizeOpacity(appearance.activeSurfaceOpacity),
    backdropBlur: normalizeBlur(appearance.backdropBlur),
    activeBackdropBlur: normalizeBlur(appearance.activeBackdropBlur),
  };
}

function customSettings(config: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(config).filter(([key]) => !standardControlKeys.has(key)),
  );
}

function numberProperty(config: ControlConfig, key: "min" | "max" | "step") {
  if (typeof config !== "object" || config === null) return undefined;
  const value = (config as Record<string, unknown>)[key];
  return typeof value === "number" ? value : undefined;
}

function formatOptionsProperty(config: ControlConfig): Intl.NumberFormatOptions | undefined {
  if (typeof config !== "object" || config === null) return undefined;
  const value = (config as Record<string, unknown>).formatOptions;
  if (!value || typeof value !== "object") return undefined;
  return value as Intl.NumberFormatOptions;
}

interface NormalizeControlEntryOptions {
  storeId: string;
  panelId: string;
  section: SectionConfig;
  key: string;
  config: ControlConfig;
  reorderable?: boolean;
}

export function normalizeControlEntry({
  storeId,
  panelId,
  section,
  key,
  config,
  reorderable = true,
}: NormalizeControlEntryOptions): NormalizedControl {
  const fallbackLabel = labelFromKey(key);
  const objectConfig = typeof config === "object" && config !== null ? config : null;
  const explicitControlId =
    objectConfig && typeof objectConfig.id === "string" ? objectConfig.id : undefined;
  const controlId = explicitControlId ?? key;
  const persistId = createControlPersistId(storeId, panelId, section, key, explicitControlId);
  const status = statusForControl(config);
  const help = helpForControl(config);
  const readOnly = readOnlyForControl(config);
  const hidden = hiddenForControl(config);
  const base = {
    id: persistId,
    persistId,
    domId: createControlDomId(storeId, panelId, section.id, controlId),
    key,
    controlId,
    panelId,
    sectionId: section.id,
    sectionLabel: section.label,
    section: section.label,
    reorderable,
    sortable: reorderable,
    status,
    help,
    readOnly,
    hidden,
  };

  if (typeof config === "number") {
    return {
      ...base,
      kind: "number",
      type: "number",
      label: fallbackLabel,
      value: config,
      defaultValue: config,
    };
  }

  if (typeof config === "boolean") {
    return {
      ...base,
      kind: "checkbox",
      type: "checkbox",
      label: fallbackLabel,
      value: config,
      defaultValue: config,
    };
  }

  if (typeof config === "string") {
    return {
      ...base,
      kind: "select",
      type: "select",
      label: fallbackLabel,
      value: config,
      defaultValue: config,
      options: [{ label: labelFromKey(config), value: config }],
    };
  }

  const defaultValue = defaultValueForControl(config);

  if (config.type === "display") {
    const rawValue =
      typeof defaultValue === "number" || typeof defaultValue === "string" ? defaultValue : "";
    return {
      ...base,
      kind: "display",
      type: "display",
      label: config.label ?? fallbackLabel,
      value: rawValue,
      defaultValue: rawValue,
      formatOptions: formatOptionsProperty(config),
      format: formatForControl(config),
    };
  }

  if ("options" in config) {
    const options = (config as { options: readonly string[] | Record<string, string> }).options;
    const value = typeof defaultValue === "string" ? defaultValue : "";
    return {
      ...base,
      kind: "select",
      type: "select",
      label: config.label ?? fallbackLabel,
      value,
      defaultValue: value,
      options: normalizeOptions(options),
    };
  }

  if (config.type && !["number", "slider", "checkbox"].includes(config.type)) {
    return {
      ...base,
      kind: "custom",
      type: config.type,
      label: config.label ?? fallbackLabel,
      value: defaultValue,
      defaultValue,
      settings: customSettings(config as Record<string, unknown>),
    };
  }

  if (typeof defaultValue === "boolean") {
    return {
      ...base,
      kind: "checkbox",
      type: "checkbox",
      label: config.label ?? fallbackLabel,
      value: defaultValue,
      defaultValue,
    };
  }

  const min = numberProperty(config, "min");
  const max = numberProperty(config, "max");
  const step = numberProperty(config, "step");
  const formatOptions = formatOptionsProperty(config);
  const numericValue = typeof defaultValue === "number" ? defaultValue : 0;
  const hasSliderBounds =
    config.type === "slider" ||
    (config.type !== "number" && min !== undefined && max !== undefined);
  const kind: ControlKind = hasSliderBounds ? "slider" : "number";

  return {
    ...base,
    kind,
    type: kind,
    label: config.label ?? fallbackLabel,
    value: numericValue,
    defaultValue: numericValue,
    min,
    max,
    step,
    formatOptions,
  };
}

export function normalizeControl(
  storeId: string,
  section: string,
  key: string,
  config: ControlConfig,
  reorderable = true,
): NormalizedControl {
  return normalizeControlEntry({
    storeId,
    panelId: defaultPanelId,
    section: { id: section, label: section },
    key,
    config,
    reorderable,
  });
}

function hasValue(values: Record<string, JsonValue>, id: string) {
  return Object.prototype.hasOwnProperty.call(values, id);
}

/**
 * Returns a value that is valid for the control's current configuration.
 *
 * Numbers/sliders are clamped to [min, max] so dynamic bounds changes can never
 * leave an out-of-range value. Selects whose current value is no longer in the
 * options list fall back to the default value (if still valid) or the first
 * option. Checkbox values are coerced to boolean. Custom controls are
 * JSON-opaque and returned unchanged.
 */
export function sanitizeValueForControl(control: NormalizedControl, value: JsonValue): JsonValue {
  if (control.kind === "number" || control.kind === "slider") {
    const fallback = typeof control.defaultValue === "number" ? control.defaultValue : 0;
    const numeric = typeof value === "number" && Number.isFinite(value) ? value : fallback;
    return clamp(numeric, control.min, control.max);
  }

  if (control.kind === "select") {
    const options = control.options ?? [];
    const isValid = (candidate: unknown): candidate is string =>
      typeof candidate === "string" && options.some((option) => option.value === candidate);
    if (isValid(value)) return value;
    if (isValid(control.defaultValue)) return control.defaultValue;
    return options[0]?.value ?? "";
  }

  if (control.kind === "checkbox") {
    return typeof value === "boolean" ? value : Boolean(control.defaultValue);
  }

  if (control.kind === "display") {
    if (typeof value === "number" || typeof value === "string") return value;
    return typeof control.defaultValue === "number" || typeof control.defaultValue === "string"
      ? control.defaultValue
      : "";
  }

  return value;
}

export function valuesForControls(
  controls: NormalizedControl[],
  values: Record<string, JsonValue>,
): NormalizedControl[] {
  return controls.map((control) => {
    // Display values are derived: always reflect the latest defaultValue from
    // registration and ignore any stale persisted entry.
    const value =
      control.kind === "display"
        ? control.defaultValue
        : hasValue(values, control.persistId)
          ? values[control.persistId]!
          : control.defaultValue;
    return { ...control, value };
  });
}

/**
 * Formats a display control's value for rendering. Numbers honor the control's
 * `formatOptions` (Intl.NumberFormatOptions); strings are used verbatim. A
 * `format` template (e.g. "Total: {value}") then wraps the result if present.
 */
export function formatDisplayValue(control: NormalizedControl): string {
  const value = control.value;
  let formatted: string;
  if (typeof value === "number") {
    formatted = control.formatOptions
      ? new Intl.NumberFormat(undefined, control.formatOptions).format(value)
      : String(value);
  } else {
    formatted = typeof value === "string" ? value : "";
  }
  return control.format ? control.format.replace("{value}", formatted) : formatted;
}

export function sectionOrderFor(controls: NormalizedControl[]) {
  return Array.from(new Set(controls.map((control) => control.sectionId)));
}

export function sectionOrderByPanel(controls: NormalizedControl[]) {
  const order: Record<string, string[]> = {};
  for (const control of controls) {
    order[control.panelId] ??= [];
    if (!order[control.panelId]!.includes(control.sectionId)) {
      order[control.panelId]!.push(control.sectionId);
    }
  }
  return order;
}
