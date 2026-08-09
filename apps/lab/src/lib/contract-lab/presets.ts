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
  readonly implementation: 'Partial' | 'Planned'
  readonly label: string
}

export const DEFAULT_CONTRACT_LAB_PRESET_ID = 'placement' satisfies ContractLabPresetId

export const CONTRACT_LAB_PRESETS = [
  {
    description:
      'Browser placement, docking, snapping, dragging, and persisted layout remain planned.',
    id: 'placement',
    implementation: 'Planned',
    label: 'Placement',
  },
  {
    description:
      'Panel visibility, close/reopen, activation, and retained content are available; durable layout, removal, modal presentation, and reordering remain planned.',
    id: 'interaction',
    implementation: 'Partial',
    label: 'Interaction',
  },
  {
    description:
      'Named Dashlets and one-level DashGroups render typed input, display, and compound Store bindings; ordering, group collapse, stale confirmation, and ready-made Dashlets remain planned.',
    id: 'composition',
    implementation: 'Partial',
    label: 'Composition',
  },
  {
    description:
      'Shared UI AlertDialog behavior is available; Panel/List portal coordination and stacked overlay journeys remain planned.',
    id: 'overlays',
    implementation: 'Partial',
    label: 'Overlays',
  },
  {
    description:
      'Store documents and DashList import, export, repair, and reset actions remain planned.',
    id: 'documents',
    implementation: 'Planned',
    label: 'Documents',
  },
  {
    description:
      'Theme and density Providers are available; detached portal carriers and complete compact geometry remain planned.',
    id: 'themes',
    implementation: 'Partial',
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
