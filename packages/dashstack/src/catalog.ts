export interface PicodashCatalogEntry {
  readonly id: string
  readonly owner: '@picodash/dashpanel' | '@picodash/dashstack' | '@picodash/picodash'
  readonly entrypoint: string
  readonly exportName: string
  readonly kind:
    | 'provider'
    | 'panel'
    | 'stack'
    | 'group'
    | 'dashlet'
    | 'anatomy'
    | 'action-composition'
  readonly summary: string
  readonly capabilities: readonly string[]
  readonly field: {
    readonly cardinality: 'none' | 'optional' | 'one' | 'many'
    readonly valueKinds: readonly ('boolean' | 'number' | 'string' | 'string-or-number' | 'json')[]
  }
  readonly composition: {
    readonly allowedParents: readonly string[]
    readonly recommendedParents: readonly string[]
  }
  readonly accessibleName: 'visible-label' | 'required' | 'inherited' | 'none'
  readonly reference: string
}

export interface PicodashCatalogReexport {
  readonly entryId: string
  readonly entrypoint: string
  readonly exportName: string
}

export interface PicodashComponentCatalog {
  readonly schemaVersion: 1
  readonly entries: readonly PicodashCatalogEntry[]
  readonly reexports: readonly PicodashCatalogReexport[]
}

const owner = '@picodash/dashstack' as const
const entrypoint = '@picodash/dashstack'
const stackParent = 'dashstack'
const groupParent = 'dashgroup'
const readyMadeReference = 'docs/reference/dashstack.md#stable-ready-made-inventory'
const actionReference = 'docs/reference/dashstack.md#stack-behavior-actions'

const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value as Record<string, unknown>)) freeze(child)
  }
  return value
}

const makeEntry = (
  id: string,
  exportName: string,
  kind: PicodashCatalogEntry['kind'],
  summary: string,
  capabilities: readonly string[],
  field: PicodashCatalogEntry['field'],
  accessibleName: PicodashCatalogEntry['accessibleName'],
  allowedParents: readonly string[],
  reference = readyMadeReference,
): PicodashCatalogEntry => ({
  id,
  owner,
  entrypoint,
  exportName,
  kind,
  summary,
  capabilities,
  field,
  composition: {
    allowedParents,
    recommendedParents: allowedParents,
  },
  accessibleName,
  reference,
})

const stableReadyMade = [
  ['TextDashlet', 'Binds a string field to a text editor.', ['edit'], ['string']],
  ['NumberDashlet', 'Binds a number field to a numeric editor.', ['edit'], ['number']],
  ['SliderDashlet', 'Binds a number field to a slider editor.', ['edit'], ['number']],
  [
    'TargetSliderDashlet',
    'Edits a numeric target alongside an application-supplied achieved result.',
    ['edit', 'read'],
    ['number'],
  ],
  ['SwitchDashlet', 'Binds a boolean field to a switch control.', ['edit'], ['boolean']],
  ['SelectDashlet', 'Binds one choice field to a select control.', ['edit'], ['string-or-number']],
  [
    'SegmentedDashlet',
    'Binds one choice field to a segmented control.',
    ['edit'],
    ['string-or-number'],
  ],
  ['DisplayDashlet', 'Renders the current value of a field as a readout.', ['read'], ['json']],
] as const

const entries: PicodashCatalogEntry[] = [
  makeEntry(
    stackParent,
    'DashStack',
    'stack',
    'Orders and groups Dashlets in an application-owned collection.',
    ['compose', 'reorder', 'collapse'],
    { cardinality: 'none', valueKinds: [] },
    'inherited',
    [],
    'docs/reference/dashstack.md#dashstack-root-api',
  ),
  makeEntry(
    groupParent,
    'DashGroup',
    'group',
    'Groups ordered controls; root groups may collapse or pin, and subgroups organize.',
    ['compose', 'reorder', 'collapse'],
    { cardinality: 'none', valueKinds: [] },
    'required',
    [stackParent, groupParent],
    'docs/reference/dashstack.md#stack-node-declarations',
  ),
  makeEntry(
    'dashlet',
    'Dashlet',
    'dashlet',
    'Provides the leaf shell for a control, readout, or composition.',
    ['compose'],
    {
      cardinality: 'many',
      valueKinds: ['boolean', 'number', 'string', 'string-or-number', 'json'],
    },
    'required',
    [stackParent, groupParent],
    'docs/reference/dashstack.md#dashlet-model',
  ),
  ...stableReadyMade.map(([exportName, summary, capabilities, valueKinds]) =>
    makeEntry(
      `dashlet.${exportName}`,
      exportName,
      'dashlet',
      summary,
      capabilities,
      { cardinality: 'one', valueKinds },
      'visible-label',
      [stackParent, groupParent],
    ),
  ),
  makeEntry(
    'action.DashStackActionItems',
    'DashStackActionItems',
    'action-composition',
    'Composes available DashStack actions into an existing action menu.',
    ['compose'],
    { cardinality: 'none', valueKinds: [] },
    'none',
    [],
    actionReference,
  ),
  makeEntry(
    'action.DashStackExpandAllItem',
    'DashStackExpandAllItem',
    'action-composition',
    'Adds the fixed “Expand all” action to an action menu.',
    ['compose', 'collapse'],
    { cardinality: 'none', valueKinds: [] },
    'visible-label',
    [],
    actionReference,
  ),
  makeEntry(
    'action.DashStackCollapseAllItem',
    'DashStackCollapseAllItem',
    'action-composition',
    'Adds the fixed “Collapse all” action to an action menu.',
    ['compose', 'collapse'],
    { cardinality: 'none', valueKinds: [] },
    'visible-label',
    [],
    actionReference,
  ),
  makeEntry(
    'action.DashStackResetSubmenu',
    'DashStackResetSubmenu',
    'action-composition',
    'Adds the fixed “Reset” submenu for DashStack reset actions.',
    ['compose', 'reset'],
    { cardinality: 'none', valueKinds: [] },
    'visible-label',
    [],
    actionReference,
  ),
  makeEntry(
    'action.DashStackResetValuesItem',
    'DashStackResetValuesItem',
    'action-composition',
    'Adds the fixed “Reset values…” action to an action menu.',
    ['compose', 'reset'],
    { cardinality: 'none', valueKinds: [] },
    'visible-label',
    [],
    actionReference,
  ),
  makeEntry(
    'action.DashStackResetStackItem',
    'DashStackResetStackItem',
    'action-composition',
    'Adds the fixed “Reset stack…” action to an action menu.',
    ['compose', 'reset'],
    { cardinality: 'none', valueKinds: [] },
    'visible-label',
    [],
    actionReference,
  ),
]

export const catalog: PicodashComponentCatalog = freeze({
  schemaVersion: 1,
  entries,
  reexports: [],
})
