export interface PicodashCatalogEntry {
  readonly id: string
  readonly owner: '@picodash/dashpanel' | '@picodash/dashlist' | '@picodash/picodash'
  readonly entrypoint: string
  readonly exportName: string
  readonly kind:
    | 'provider'
    | 'panel'
    | 'list'
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

const owner = '@picodash/dashlist' as const
const entrypoint = '@picodash/dashlist'
const listParent = 'dashlist'
const groupParent = 'dashgroup'
const readyMadeReference = 'docs/reference/dashlist.md#stable-ready-made-inventory'

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
  ['SwitchDashlet', 'Binds a boolean field to a switch control.', ['edit'], ['boolean']],
  ['SelectDashlet', 'Binds one choice field to a select control.', ['edit'], ['string-or-number']],
  [
    'SegmentedDashlet',
    'Binds one choice field to a segmented control.',
    ['edit'],
    ['string-or-number'],
  ],
  ['DisplayDashlet', 'Renders the current value of a field as a readout.', ['read'], ['json']],
  ['CheckboxDashlet', 'Binds a boolean field to a checkbox control.', ['edit'], ['boolean']],
  ['RadioGroupDashlet', 'Binds one choice field to a radio group.', ['edit'], ['string-or-number']],
  [
    'ComboboxDashlet',
    'Binds one choice field to a searchable combobox.',
    ['edit'],
    ['string-or-number'],
  ],
  [
    'CheckboxGroupDashlet',
    'Binds one field containing multiple choices to checkboxes.',
    ['edit'],
    ['string-or-number'],
  ],
  [
    'MultiSelectDashlet',
    'Binds one field containing multiple choices to a multiselect.',
    ['edit'],
    ['string-or-number'],
  ],
  ['SearchDashlet', 'Binds a string field to a search editor.', ['edit'], ['string']],
  ['RangeDashlet', 'Binds one range object field to a two-thumb slider.', ['edit'], ['json']],
  ['MeterDashlet', 'Renders a bounded numeric field as a meter.', ['read'], ['number']],
  ['ProgressDashlet', 'Renders a numeric field as determinate progress.', ['read'], ['number']],
  [
    'StatusDashlet',
    'Renders a field through an explicit status option map.',
    ['read'],
    ['string-or-number'],
  ],
  ['DateDashlet', 'Binds an ISO date field to a date editor.', ['edit'], ['string']],
  ['TimeDashlet', 'Binds an ISO time field to a time editor.', ['edit'], ['string']],
  ['DateTimeDashlet', 'Binds an RFC 3339 field to a date-time editor.', ['edit'], ['string']],
  [
    'DateRangeDashlet',
    'Binds one date-range object field to a date-range editor.',
    ['edit'],
    ['json'],
  ],
  ['ColorDashlet', 'Binds a CSS color field to a color editor.', ['edit'], ['string']],
] as const

const entries: PicodashCatalogEntry[] = [
  makeEntry(
    listParent,
    'DashList',
    'list',
    'Orders and groups Dashlets in an application-owned collection.',
    ['compose', 'reorder', 'collapse'],
    { cardinality: 'none', valueKinds: [] },
    'inherited',
    [],
    'docs/reference/dashlist.md#dashlist-root-api',
  ),
  makeEntry(
    groupParent,
    'DashGroup',
    'group',
    'Groups Dashlets into a collapsible ordered section.',
    ['compose', 'reorder', 'collapse'],
    { cardinality: 'none', valueKinds: [] },
    'visible-label',
    [listParent],
    'docs/reference/dashlist.md#list-node-declarations',
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
    'inherited',
    [listParent, groupParent],
    'docs/reference/dashlist.md#dashlet-model',
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
      [listParent, groupParent],
    ),
  ),
]

export const catalog: PicodashComponentCatalog = freeze({
  schemaVersion: 1,
  entries,
  reexports: [],
})
