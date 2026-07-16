import {
  defaultPanelId,
  defaultSectionId,
  defaultSectionLabel,
  type ControlConfig,
  type JsonValue,
  type SectionConfig,
} from '../types.js'

export const defaultSection = defaultSectionLabel

export function labelFromKey(key: string) {
  return key
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (char) => char.toUpperCase())
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
