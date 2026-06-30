import {
  defaultPanelId,
  defaultSectionId,
  defaultSectionLabel,
  type ControlLayout,
  type ControlConfig,
  type ControlKind,
  type ControlStatus,
  type ControlValueMode,
  type JsonValue,
  type NormalizedControl,
  type PanelAppearance,
  type RegisterOptions,
  type SectionConfig,
  type TweakerControlDefinition,
  type TweakerControlNormalizeContext,
  type TweakerControlRegistry,
} from './types.js'

const standardControlKeys = new Set([
  'id',
  'type',
  'value',
  'defaultValue',
  'label',
  'min',
  'max',
  'step',
  'options',
  'status',
  'help',
  'description',
  'formatOptions',
  'readOnly',
  'hidden',
  'valueMode',
  'layout',
  'height',
  'minHeight',
  'settings',
])

export const defaultSection = defaultSectionLabel

export function labelFromKey(key: string) {
  return key
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (char) => char.toUpperCase())
}

export function clamp(value: number, min?: number, max?: number) {
  let next = value
  if (typeof min === 'number') next = Math.max(min, next)
  if (typeof max === 'number') next = Math.min(max, next)
  return next
}

function normalizeOptions(options: readonly string[] | Record<string, string>) {
  if (Array.isArray(options)) {
    return options.map((value) => ({ label: labelFromKey(value), value }))
  }

  return Object.entries(options).map(([label, value]) => ({ label, value }))
}

function safeId(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'control'
  )
}

export function normalizePanelId(panel?: string) {
  return panel?.trim() || defaultPanelId
}

export function normalizeSection(section?: string | SectionConfig): SectionConfig {
  if (!section) return { id: defaultSectionId, label: defaultSectionLabel }
  if (typeof section === 'string') return { id: section, label: section }
  // An explicitly empty label marks the section as headerless: keep it as ""
  // rather than generating a label from the id. Only an absent label falls back.
  const label = typeof section.label === 'string' ? section.label.trim() : labelFromKey(section.id)
  return {
    id: section.id.trim() || defaultSectionId,
    label,
    hidden: section.hidden === true ? true : undefined,
  }
}

export function createControlPersistId(
  storeId: string,
  panelId: string,
  section: SectionConfig,
  key: string,
  explicitControlId?: string,
) {
  const controlId = explicitControlId ?? key
  if (!explicitControlId && panelId === defaultPanelId && section.id === section.label) {
    return `${storeId}:${section.label}:${key}`
  }

  return `${storeId}:${panelId}:${section.id}:${controlId}`
}

export function createControlId(storeId: string, section: string, key: string) {
  return createControlPersistId(storeId, defaultPanelId, { id: section, label: section }, key)
}

export function createControlDomId(
  storeId: string,
  panelId: string,
  sectionId: string,
  controlId: string,
) {
  return `tw-${safeId(storeId)}-${safeId(panelId)}-${safeId(sectionId)}-${safeId(controlId)}`
}

export function defaultValueForControl(config: ControlConfig): JsonValue {
  if (typeof config !== 'object' || config === null) return config
  if ('defaultValue' in config && config.defaultValue !== undefined) return config.defaultValue
  if ('value' in config && config.value !== undefined) return config.value
  return null
}

function normalizeOpacity(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return undefined
  return clamp(value, 0, 1)
}

function normalizeBlur(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return undefined
  return Math.max(0, value)
}

export function statusForControl(config: ControlConfig): ControlStatus | undefined {
  if (typeof config !== 'object' || config === null) return undefined
  const value = config.status
  return value === 'info' || value === 'alert' || value === 'error' ? value : undefined
}

function helpForControl(config: ControlConfig) {
  if (typeof config !== 'object' || config === null) return undefined
  const value = config.help
  if (typeof value === 'string') return value.trim() ? value : undefined
  if (value === null || value === undefined || typeof value === 'boolean') return undefined
  return value
}

function descriptionForControl(config: ControlConfig) {
  if (typeof config !== 'object' || config === null) return undefined
  return config.description
}

function readOnlyForControl(config: ControlConfig) {
  if (typeof config !== 'object' || config === null) return undefined
  return config.readOnly === true ? true : undefined
}

function hiddenForControl(config: ControlConfig) {
  if (typeof config !== 'object' || config === null) return undefined
  return config.hidden === true ? true : undefined
}

function formatForControl(config: ControlConfig) {
  if (typeof config !== 'object' || config === null) return undefined
  const value = (config as Record<string, unknown>).format
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

export function normalizePanelAppearance(appearance: PanelAppearance = {}): PanelAppearance {
  return {
    surfaceOpacity: normalizeOpacity(appearance.surfaceOpacity),
    activeSurfaceOpacity: normalizeOpacity(appearance.activeSurfaceOpacity),
    backdropBlur: normalizeBlur(appearance.backdropBlur),
    activeBackdropBlur: normalizeBlur(appearance.activeBackdropBlur),
  }
}

export function normalizePanelEffects(options: RegisterOptions): PanelAppearance {
  return {
    surfaceOpacity: normalizeOpacity(options.opacity),
    activeSurfaceOpacity: normalizeOpacity(options.hoverOpacity),
    backdropBlur: normalizeBlur(options.backgroundBlur),
    activeBackdropBlur: normalizeBlur(options.hoverBackgroundBlur),
  }
}

export function hasPanelEffects(options: RegisterOptions) {
  return (
    options.opacity !== undefined ||
    options.hoverOpacity !== undefined ||
    options.backgroundBlur !== undefined ||
    options.hoverBackgroundBlur !== undefined
  )
}

function customSettings(config: Record<string, unknown>) {
  const inlineSettings = Object.fromEntries(
    Object.entries(config).filter(([key]) => !standardControlKeys.has(key)),
  )
  const settings = config.settings
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return inlineSettings
  return { ...inlineSettings, ...(settings as Record<string, unknown>) }
}

function numberProperty(config: ControlConfig, key: 'min' | 'max' | 'step') {
  if (typeof config !== 'object' || config === null) return undefined
  const value = (config as Record<string, unknown>)[key]
  return typeof value === 'number' ? value : undefined
}

function formatOptionsProperty(config: ControlConfig): Intl.NumberFormatOptions | undefined {
  if (typeof config !== 'object' || config === null) return undefined
  const value = (config as Record<string, unknown>).formatOptions
  if (!value || typeof value !== 'object') return undefined
  return value as Intl.NumberFormatOptions
}

function valueModeForControl(
  config: ControlConfig,
  fallback: ControlValueMode = 'input',
): ControlValueMode {
  if (typeof config !== 'object' || config === null) return fallback
  const value = (config as Record<string, unknown>).valueMode
  return value === 'input' || value === 'display' || value === 'transient' ? value : fallback
}

function layoutForControl(
  config: ControlConfig,
  fallback: ControlLayout = 'inline',
): ControlLayout {
  if (typeof config !== 'object' || config === null) return fallback
  const value = (config as Record<string, unknown>).layout
  return value === 'inline' || value === 'block' || value === 'full' ? value : fallback
}

function dimensionProperty(config: ControlConfig, key: 'height' | 'minHeight') {
  if (typeof config !== 'object' || config === null) return undefined
  const value = (config as Record<string, unknown>)[key]
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : undefined
  if (typeof value === 'string') return value.trim() || undefined
  return undefined
}

interface NormalizeControlEntryOptions {
  storeId: string
  panelId: string
  section: SectionConfig
  key: string
  config: ControlConfig
  reorderable?: boolean
  registry?: TweakerControlRegistry
}

function definitionForControl(
  control: NormalizedControl,
  registry: TweakerControlRegistry | undefined,
): TweakerControlDefinition | undefined {
  return registry?.[control.rendererType] ?? registry?.[control.type]
}

function applyDefinition(
  control: NormalizedControl,
  config: ControlConfig,
  registry: TweakerControlRegistry | undefined,
  context: TweakerControlNormalizeContext,
): NormalizedControl {
  const definition = definitionForControl(control, registry)
  if (!definition) return control

  const normalized = definition.normalize?.(config as never, context) ?? {}
  const settings =
    control.settings || normalized.settings
      ? { ...control.settings, ...normalized.settings }
      : undefined
  const merged = {
    ...control,
    ...normalized,
    settings,
  }

  return {
    ...merged,
    valueMode: valueModeForControl(config, definition.valueMode ?? merged.valueMode),
    layout: layoutForControl(config, definition.layout ?? merged.layout),
  }
}

export function normalizeControlEntry({
  storeId,
  panelId,
  section,
  key,
  config,
  reorderable = true,
  registry,
}: NormalizeControlEntryOptions): NormalizedControl {
  const fallbackLabel = labelFromKey(key)
  const normalizeContext = { key, fallbackLabel }
  const objectConfig = typeof config === 'object' && config !== null ? config : null
  const explicitControlId =
    objectConfig && typeof objectConfig.id === 'string' ? objectConfig.id : undefined
  const controlId = explicitControlId ?? key
  const persistId = createControlPersistId(storeId, panelId, section, key, explicitControlId)
  const status = statusForControl(config)
  const help = helpForControl(config)
  const description = descriptionForControl(config)
  const readOnly = readOnlyForControl(config)
  const hidden = hiddenForControl(config)
  const layout = layoutForControl(config)
  const height = dimensionProperty(config, 'height')
  const minHeight = dimensionProperty(config, 'minHeight')
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
    description,
    readOnly,
    hidden,
    layout,
    height,
    minHeight,
  }

  if (typeof config === 'number') {
    return applyDefinition(
      {
        ...base,
        kind: 'number',
        type: 'number',
        rendererType: 'number',
        valueMode: 'input',
        label: fallbackLabel,
        value: config,
        defaultValue: config,
      },
      config,
      registry,
      normalizeContext,
    )
  }

  if (typeof config === 'boolean') {
    return applyDefinition(
      {
        ...base,
        kind: 'checkbox',
        type: 'checkbox',
        rendererType: 'checkbox',
        valueMode: 'input',
        label: fallbackLabel,
        value: config,
        defaultValue: config,
      },
      config,
      registry,
      normalizeContext,
    )
  }

  if (typeof config === 'string') {
    return applyDefinition(
      {
        ...base,
        kind: 'select',
        type: 'select',
        rendererType: 'select',
        valueMode: 'input',
        label: fallbackLabel,
        value: config,
        defaultValue: config,
        options: [{ label: labelFromKey(config), value: config }],
      },
      config,
      registry,
      normalizeContext,
    )
  }

  const defaultValue = defaultValueForControl(config)

  if (config.type === 'display') {
    const rawValue =
      typeof defaultValue === 'number' || typeof defaultValue === 'string' ? defaultValue : ''
    return applyDefinition(
      {
        ...base,
        kind: 'display',
        type: 'display',
        rendererType: 'display',
        valueMode: valueModeForControl(config, 'display'),
        label: config.label ?? fallbackLabel,
        value: rawValue,
        defaultValue: rawValue,
        formatOptions: formatOptionsProperty(config),
        format: formatForControl(config),
      },
      config,
      registry,
      normalizeContext,
    )
  }

  if ('options' in config) {
    const options = (config as { options: readonly string[] | Record<string, string> }).options
    const value = typeof defaultValue === 'string' ? defaultValue : ''
    return applyDefinition(
      {
        ...base,
        kind: 'select',
        type: 'select',
        rendererType: 'select',
        valueMode: valueModeForControl(config),
        label: config.label ?? fallbackLabel,
        value,
        defaultValue: value,
        options: normalizeOptions(options),
      },
      config,
      registry,
      normalizeContext,
    )
  }

  if (config.type && !['number', 'slider', 'checkbox'].includes(config.type)) {
    return applyDefinition(
      {
        ...base,
        kind: 'custom',
        type: config.type,
        rendererType: config.type,
        valueMode: valueModeForControl(config),
        label: config.label ?? fallbackLabel,
        value: defaultValue,
        defaultValue,
        settings: customSettings(config as Record<string, unknown>),
      },
      config,
      registry,
      normalizeContext,
    )
  }

  if (typeof defaultValue === 'boolean') {
    return applyDefinition(
      {
        ...base,
        kind: 'checkbox',
        type: 'checkbox',
        rendererType: 'checkbox',
        valueMode: valueModeForControl(config),
        label: config.label ?? fallbackLabel,
        value: defaultValue,
        defaultValue,
      },
      config,
      registry,
      normalizeContext,
    )
  }

  const min = numberProperty(config, 'min')
  const max = numberProperty(config, 'max')
  const step = numberProperty(config, 'step')
  const formatOptions = formatOptionsProperty(config)
  const numericValue = typeof defaultValue === 'number' ? defaultValue : 0
  const hasSliderBounds =
    config.type === 'slider' || (config.type !== 'number' && min !== undefined && max !== undefined)
  const kind: ControlKind = hasSliderBounds ? 'slider' : 'number'

  return applyDefinition(
    {
      ...base,
      kind,
      type: kind,
      rendererType: kind,
      valueMode: valueModeForControl(config),
      label: config.label ?? fallbackLabel,
      value: numericValue,
      defaultValue: numericValue,
      min,
      max,
      step,
      formatOptions,
    },
    config,
    registry,
    normalizeContext,
  )
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
  })
}

function hasValue(values: Record<string, JsonValue>, id: string) {
  return Object.prototype.hasOwnProperty.call(values, id)
}

export function jsonValuesEqual(left: JsonValue, right: JsonValue) {
  return Object.is(left, right) || JSON.stringify(left) === JSON.stringify(right)
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
  return sanitizeValueWithRegistry(control, value)
}

export function sanitizeValueWithRegistry(
  control: NormalizedControl,
  value: JsonValue,
  registry?: TweakerControlRegistry,
): JsonValue {
  const definition = definitionForControl(control, registry)
  if (definition?.sanitize) return definition.sanitize(value, control)

  if (control.kind === 'number' || control.kind === 'slider') {
    const fallback = typeof control.defaultValue === 'number' ? control.defaultValue : 0
    const numeric = typeof value === 'number' && Number.isFinite(value) ? value : fallback
    return clamp(numeric, control.min, control.max)
  }

  if (control.kind === 'select') {
    const options = control.options ?? []
    const isValid = (candidate: unknown): candidate is string =>
      typeof candidate === 'string' && options.some((option) => option.value === candidate)
    if (isValid(value)) return value
    if (isValid(control.defaultValue)) return control.defaultValue
    return options[0]?.value ?? ''
  }

  if (control.kind === 'checkbox') {
    return typeof value === 'boolean' ? value : Boolean(control.defaultValue)
  }

  if (control.kind === 'display') {
    if (typeof value === 'number' || typeof value === 'string') return value
    return typeof control.defaultValue === 'number' || typeof control.defaultValue === 'string'
      ? control.defaultValue
      : ''
  }

  return value
}

export function valuesForControls(
  controls: NormalizedControl[],
  values: Record<string, JsonValue>,
): NormalizedControl[] {
  return controls.map((control) => {
    const value = valueForControl(control, values)
    return jsonValuesEqual(control.value, value) ? control : { ...control, value }
  })
}

export function valueForControl(
  control: NormalizedControl,
  values: Record<string, JsonValue>,
): JsonValue {
  // Display and transient values ignore stale persisted entries. Display values
  // derive from registration; transient values keep their in-memory state.
  if (control.valueMode === 'display') {
    return control.defaultValue
  }
  if (control.valueMode === 'transient') return control.value
  return hasValue(values, control.persistId) ? values[control.persistId]! : control.defaultValue
}

const numberFormatCache = new Map<string, Intl.NumberFormat>()
const maxNumberFormatCacheSize = 64

function numberFormatKey(formatOptions: Intl.NumberFormatOptions) {
  return Object.entries(formatOptions)
    .filter(([, value]) => value !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}:${String(value)}`)
    .join('|')
}

function formatNumber(value: number, formatOptions: Intl.NumberFormatOptions) {
  const key = numberFormatKey(formatOptions)
  let formatter = numberFormatCache.get(key)
  if (!formatter) {
    formatter = new Intl.NumberFormat(undefined, formatOptions)
    if (numberFormatCache.size >= maxNumberFormatCacheSize) {
      const oldestKey = numberFormatCache.keys().next().value
      if (oldestKey !== undefined) numberFormatCache.delete(oldestKey)
    }
    numberFormatCache.set(key, formatter)
  }
  return formatter.format(value)
}

/**
 * Formats a display control's value for rendering. Numbers honor the control's
 * `formatOptions` (Intl.NumberFormatOptions); strings are used verbatim. A
 * `format` template (e.g. "Total: {value}") then wraps the result if present.
 */
export function formatDisplayValue(control: NormalizedControl): string {
  const value = control.value
  let formatted: string
  if (typeof value === 'number') {
    formatted = control.formatOptions ? formatNumber(value, control.formatOptions) : String(value)
  } else {
    formatted = typeof value === 'string' ? value : ''
  }
  return control.format ? control.format.replace('{value}', formatted) : formatted
}

export function formatSliderValue(control: NormalizedControl): string {
  const value = typeof control.value === 'number' ? control.value : Number(control.value)
  const digits = fractionDigitsForStep(control.step ?? 0.01)
  const formatOptions = sliderFormatOptions(control.formatOptions, digits)

  return formatNumber(Number.isFinite(value) ? value : 0, formatOptions)
}

function sliderFormatOptions(
  formatOptions: Intl.NumberFormatOptions | undefined,
  inferredFractionDigits: number,
) {
  const next = { ...formatOptions }
  if (next.minimumFractionDigits === undefined && next.maximumFractionDigits === undefined) {
    next.minimumFractionDigits = inferredFractionDigits
    next.maximumFractionDigits = inferredFractionDigits
  } else if (next.minimumFractionDigits !== undefined && next.maximumFractionDigits === undefined) {
    next.maximumFractionDigits = Math.max(next.minimumFractionDigits, inferredFractionDigits)
  }
  return next
}

function fractionDigitsForStep(step: number) {
  if (!Number.isFinite(step) || step <= 0) return 2

  const text = String(step).toLowerCase()
  const [coefficient, exponentPart] = text.split('e-')
  if (exponentPart) {
    const exponent = Number(exponentPart)
    const coefficientDigits = coefficient.includes('.') ? coefficient.split('.')[1]!.length : 0
    return Math.min(20, Math.max(0, exponent + coefficientDigits))
  }

  if (!text.includes('.')) return 0
  return Math.min(20, text.split('.')[1]!.length)
}

export function sectionOrderFor(controls: NormalizedControl[]) {
  return Array.from(new Set(controls.map((control) => control.sectionId)))
}

export function sectionOrderByPanel(controls: NormalizedControl[]) {
  const order: Record<string, string[]> = {}
  for (const control of controls) {
    order[control.panelId] ??= []
    if (!order[control.panelId]!.includes(control.sectionId)) {
      order[control.panelId]!.push(control.sectionId)
    }
  }
  return order
}

export function preserveSectionOrderByPanel(
  currentOrder: Record<string, string[]>,
  controls: NormalizedControl[],
) {
  const liveOrder = sectionOrderByPanel(controls)
  const panelIds = new Set([...Object.keys(currentOrder), ...Object.keys(liveOrder)])
  const nextOrder: Record<string, string[]> = {}

  for (const panelId of panelIds) {
    const liveSectionIds = liveOrder[panelId] ?? []
    const next = [...(currentOrder[panelId] ?? [])]
    for (const sectionId of liveSectionIds) {
      if (!next.includes(sectionId)) next.push(sectionId)
    }
    if (next.length > 0) nextOrder[panelId] = next
  }

  return nextOrder
}
