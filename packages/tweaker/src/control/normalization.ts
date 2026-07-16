import {
  type ControlLayout,
  type ControlConfig,
  type ControlKind,
  type ControlStatus,
  type ControlValueMode,
  defaultPanelId,
  type NormalizedControl,
  type PanelAppearance,
  type RegisterOptions,
  type SectionConfig,
  type TweakerControlNormalizeContext,
  type TweakerControlRegistry,
} from '../types.js'
import { definitionForControl } from './definition.js'
import {
  createControlDomId,
  createControlPersistId,
  defaultValueForControl,
  labelFromKey,
} from './identity.js'
import { clamp } from './values.js'

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

function normalizeOptions(options: readonly string[] | Record<string, string>) {
  if (Array.isArray(options)) {
    return options.map((value) => ({ label: labelFromKey(value), value }))
  }

  return Object.entries(options).map(([label, value]) => ({ label, value }))
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
