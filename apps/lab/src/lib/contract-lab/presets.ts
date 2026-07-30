export const CONTRACT_LAB_PRESET_IDS = [
  'placement',
  'interaction',
  'composition',
  'overlays',
  'documents',
  'themes',
] as const

export type ContractLabPresetId = (typeof CONTRACT_LAB_PRESET_IDS)[number]

export interface ContractLabPreset {
  readonly description: string
  readonly id: ContractLabPresetId
  readonly label: string
}

export const DEFAULT_CONTRACT_LAB_PRESET_ID = 'placement' satisfies ContractLabPresetId

export const CONTRACT_LAB_PRESETS = [
  {
    description: 'Placement modes, boundaries, snapping, docking, persistence, and detachment.',
    id: 'placement',
    label: 'Placement',
  },
  {
    description: 'Pointer and keyboard ordering, panel lifecycle, focus, and activation.',
    id: 'interaction',
    label: 'Interaction',
  },
  {
    description: 'Built-in, custom, compound, grouped, streaming, and stateful Dashlets.',
    id: 'composition',
    label: 'Composition',
  },
  {
    description: 'Menus, dialogs, tooltips, selects, portals, stacking, and dismissal.',
    id: 'overlays',
    label: 'Overlays',
  },
  {
    description:
      'Documents, drafts, atomic writes, repair, adapters, persistence, and diagnostics.',
    id: 'documents',
    label: 'Documents',
  },
  {
    description: 'Theme recipes, overrides, semantic states, contrast, zoom, and reduced motion.',
    id: 'themes',
    label: 'Themes',
  },
] as const satisfies readonly ContractLabPreset[]

const contractLabPresetIds = new Set<string>(CONTRACT_LAB_PRESET_IDS)

export function isContractLabPresetId(value: unknown): value is ContractLabPresetId {
  return typeof value === 'string' && contractLabPresetIds.has(value)
}

export function assertContractLabPresetId(value: unknown): asserts value is ContractLabPresetId {
  if (!isContractLabPresetId(value)) {
    throw new RangeError(`Unknown Picodash Contract Lab preset: ${JSON.stringify(value)}`)
  }
}
