export const picodashCatalogEntrypoints = Object.freeze([
  '@picodash/panel',
  '@picodash/panel/dashlet',
  '@picodash/panel/ui',
] as const)

export type PicodashCatalogEntrypoint = (typeof picodashCatalogEntrypoints)[number]

export const picodashCatalogCategories = Object.freeze([
  'input',
  'display',
  'visualization',
  'anatomy',
  'readout',
  'structured-data',
  'state',
  'action',
  'foundation',
] as const)

export type PicodashCatalogCategory = (typeof picodashCatalogCategories)[number]

export const picodashCatalogValueKinds = Object.freeze([
  'none',
  'boolean',
  'number',
  'string',
  'string-union',
  'number-tuple',
  'object',
  'array',
  'media',
  'visualization',
  'json',
] as const)

export type PicodashCatalogValueKind = (typeof picodashCatalogValueKinds)[number]

export const picodashCatalogRecipeIds = Object.freeze([
  'basic-control',
  'choice-control',
  'spatial-control',
  'media-inspector',
  'live-monitor',
  'application-health',
  'structured-summary',
  'visualization-card',
  'async-state',
  'action-strip',
] as const)

export type PicodashCatalogRecipeId = (typeof picodashCatalogRecipeIds)[number]

export type PicodashCatalogCapability = 'action' | 'display' | 'input' | 'streaming'

export type PicodashAccessibleNameRequirement =
  | 'accessible-name'
  | 'inherited'
  | 'none'
  | 'visible-label'

export type PicodashCatalogEntry = Readonly<{
  id: string
  exportName: string
  entrypoint: PicodashCatalogEntrypoint
  category: PicodashCatalogCategory
  compatibleValueKinds: readonly PicodashCatalogValueKind[]
  capabilities: Readonly<Record<PicodashCatalogCapability, boolean>>
  nesting: Readonly<{
    allowedParents: readonly string[]
    recommendedParents: readonly string[]
  }>
  accessibility: Readonly<{
    nameRequirement: PicodashAccessibleNameRequirement
    labelProp: string | null
  }>
  importantProps: readonly string[]
  variants: readonly string[]
  theme: Readonly<{
    requirements: readonly string[]
    semanticTokens: readonly string[]
  }>
  referenceAnchor: string
  recipeIds: readonly PicodashCatalogRecipeId[]
}>

export type PicodashCatalogFilter = Readonly<{
  entrypoint?: PicodashCatalogEntrypoint
  category?: PicodashCatalogCategory
  valueKind?: PicodashCatalogValueKind
  capability?: PicodashCatalogCapability
  accessibleNameRequirement?: PicodashAccessibleNameRequirement
  recipeId?: PicodashCatalogRecipeId
}>

type CatalogEntryInput = Omit<
  PicodashCatalogEntry,
  'accessibility' | 'capabilities' | 'nesting' | 'theme'
> & {
  accessibility?: Partial<PicodashCatalogEntry['accessibility']>
  capabilities?: Partial<PicodashCatalogEntry['capabilities']>
  nesting?: Partial<PicodashCatalogEntry['nesting']>
  theme?: Partial<PicodashCatalogEntry['theme']>
}

const commonThemeRequirements = ['inherits-provider-theme', 'supports-custom-theme-recipes']
const commonThemeTokens = [
  '--picodash-color-text',
  '--picodash-color-text-muted',
  '--picodash-color-border',
  '--picodash-radius-surface',
  '--picodash-color-focus',
]
const controlThemeTokens = [
  ...commonThemeTokens,
  '--picodash-color-control',
  '--picodash-color-surface-muted',
  '--picodash-color-accent',
]
const dataThemeTokens = [
  ...commonThemeTokens,
  '--picodash-color-well',
  '--picodash-color-data-1',
  '--picodash-color-data-2',
  '--picodash-color-data-3',
  '--picodash-color-data-4',
  '--picodash-color-data-5',
]

const catalogReferencePaths = {
  '@picodash/panel': '/docs/reference/dashlets',
  '@picodash/panel/dashlet': '/docs/reference/dashlet-components',
  '@picodash/panel/ui': '/docs/reference/ui',
} as const satisfies Record<PicodashCatalogEntrypoint, string>

function referenceAnchor(entrypoint: PicodashCatalogEntrypoint, id: string) {
  return `${catalogReferencePaths[entrypoint]}#${id}`
}

function entry(input: CatalogEntryInput): PicodashCatalogEntry {
  return {
    ...input,
    capabilities: {
      input: false,
      display: false,
      streaming: false,
      action: false,
      ...input.capabilities,
    },
    nesting: {
      allowedParents: [],
      recommendedParents: [],
      ...input.nesting,
    },
    accessibility: {
      nameRequirement: 'inherited',
      labelProp: null,
      ...input.accessibility,
    },
    theme: {
      requirements: commonThemeRequirements,
      semanticTokens: commonThemeTokens,
      ...input.theme,
    },
  }
}

const builtInEntries: PicodashCatalogEntry[] = [
  entry({
    id: 'built-in.text',
    exportName: 'PicodashText',
    entrypoint: '@picodash/panel',
    category: 'input',
    compatibleValueKinds: ['string'],
    capabilities: { input: true },
    nesting: { allowedParents: ['PicodashPanel', 'PicodashGroup'] },
    accessibility: { nameRequirement: 'visible-label', labelProp: 'label' },
    importantProps: ['field', 'label', 'multiline', 'placeholder'],
    variants: ['single-line', 'multiline'],
    theme: { semanticTokens: controlThemeTokens },
    referenceAnchor: referenceAnchor('@picodash/panel', 'picodash-text'),
    recipeIds: ['basic-control'],
  }),
  entry({
    id: 'built-in.number',
    exportName: 'PicodashNumber',
    entrypoint: '@picodash/panel',
    category: 'input',
    compatibleValueKinds: ['number'],
    capabilities: { input: true },
    nesting: { allowedParents: ['PicodashPanel', 'PicodashGroup'] },
    accessibility: { nameRequirement: 'visible-label', labelProp: 'label' },
    importantProps: ['field', 'label', 'min', 'max', 'step', 'format'],
    variants: [],
    theme: { semanticTokens: controlThemeTokens },
    referenceAnchor: referenceAnchor('@picodash/panel', 'picodash-number'),
    recipeIds: ['basic-control'],
  }),
  entry({
    id: 'built-in.slider',
    exportName: 'PicodashSlider',
    entrypoint: '@picodash/panel',
    category: 'input',
    compatibleValueKinds: ['number'],
    capabilities: { input: true },
    nesting: { allowedParents: ['PicodashPanel', 'PicodashGroup'] },
    accessibility: { nameRequirement: 'visible-label', labelProp: 'label' },
    importantProps: ['field', 'label', 'min', 'max', 'step', 'marks', 'format'],
    variants: [],
    theme: { semanticTokens: controlThemeTokens },
    referenceAnchor: referenceAnchor('@picodash/panel', 'picodash-slider'),
    recipeIds: ['basic-control'],
  }),
  entry({
    id: 'built-in.switch',
    exportName: 'PicodashSwitch',
    entrypoint: '@picodash/panel',
    category: 'input',
    compatibleValueKinds: ['boolean'],
    capabilities: { input: true },
    nesting: { allowedParents: ['PicodashPanel', 'PicodashGroup'] },
    accessibility: { nameRequirement: 'visible-label', labelProp: 'label' },
    importantProps: ['field', 'label', 'description'],
    variants: [],
    theme: { semanticTokens: controlThemeTokens },
    referenceAnchor: referenceAnchor('@picodash/panel', 'picodash-switch'),
    recipeIds: ['basic-control'],
  }),
  entry({
    id: 'built-in.select',
    exportName: 'PicodashSelect',
    entrypoint: '@picodash/panel',
    category: 'input',
    compatibleValueKinds: ['string', 'string-union'],
    capabilities: { input: true },
    nesting: { allowedParents: ['PicodashPanel', 'PicodashGroup'] },
    accessibility: { nameRequirement: 'visible-label', labelProp: 'label' },
    importantProps: ['field', 'label', 'options', 'placeholder'],
    variants: [],
    theme: { semanticTokens: controlThemeTokens },
    referenceAnchor: referenceAnchor('@picodash/panel', 'picodash-select'),
    recipeIds: ['choice-control'],
  }),
  entry({
    id: 'built-in.segmented',
    exportName: 'PicodashSegmented',
    entrypoint: '@picodash/panel',
    category: 'input',
    compatibleValueKinds: ['string', 'string-union'],
    capabilities: { input: true },
    nesting: { allowedParents: ['PicodashPanel', 'PicodashGroup'] },
    accessibility: { nameRequirement: 'visible-label', labelProp: 'label' },
    importantProps: ['field', 'label', 'options', 'orientation'],
    variants: ['horizontal', 'vertical'],
    theme: { semanticTokens: controlThemeTokens },
    referenceAnchor: referenceAnchor('@picodash/panel', 'picodash-segmented'),
    recipeIds: ['choice-control'],
  }),
  entry({
    id: 'built-in.vector-3',
    exportName: 'PicodashVector3',
    entrypoint: '@picodash/panel',
    category: 'input',
    compatibleValueKinds: ['object'],
    capabilities: { input: true },
    nesting: { allowedParents: ['PicodashPanel', 'PicodashGroup'] },
    accessibility: { nameRequirement: 'visible-label', labelProp: 'label' },
    importantProps: ['field', 'label', 'min', 'max', 'step'],
    variants: [],
    theme: { semanticTokens: controlThemeTokens },
    referenceAnchor: referenceAnchor('@picodash/panel', 'picodash-vector-3'),
    recipeIds: ['spatial-control'],
  }),
  entry({
    id: 'built-in.range',
    exportName: 'PicodashRange',
    entrypoint: '@picodash/panel',
    category: 'input',
    compatibleValueKinds: ['number-tuple'],
    capabilities: { input: true },
    nesting: { allowedParents: ['PicodashPanel', 'PicodashGroup'] },
    accessibility: { nameRequirement: 'visible-label', labelProp: 'label' },
    importantProps: ['field', 'label', 'min', 'max', 'step'],
    variants: [],
    theme: { semanticTokens: controlThemeTokens },
    referenceAnchor: referenceAnchor('@picodash/panel', 'picodash-range'),
    recipeIds: ['spatial-control'],
  }),
  entry({
    id: 'built-in.xy-pad',
    exportName: 'PicodashXYPad',
    entrypoint: '@picodash/panel',
    category: 'input',
    compatibleValueKinds: ['object'],
    capabilities: { input: true },
    nesting: { allowedParents: ['PicodashPanel', 'PicodashGroup'] },
    accessibility: { nameRequirement: 'visible-label', labelProp: 'label' },
    importantProps: ['field', 'label', 'bounds'],
    variants: [],
    theme: { semanticTokens: [...controlThemeTokens, '--picodash-color-well'] },
    referenceAnchor: referenceAnchor('@picodash/panel', 'picodash-xy-pad'),
    recipeIds: ['spatial-control'],
  }),
  entry({
    id: 'built-in.alignment',
    exportName: 'PicodashAlignment',
    entrypoint: '@picodash/panel',
    category: 'input',
    compatibleValueKinds: ['string-union'],
    capabilities: { input: true },
    nesting: { allowedParents: ['PicodashPanel', 'PicodashGroup'] },
    accessibility: { nameRequirement: 'visible-label', labelProp: 'label' },
    importantProps: ['field', 'label'],
    variants: [],
    theme: { semanticTokens: controlThemeTokens },
    referenceAnchor: referenceAnchor('@picodash/panel', 'picodash-alignment'),
    recipeIds: ['spatial-control'],
  }),
  entry({
    id: 'built-in.matrix-2d',
    exportName: 'PicodashMatrix2D',
    entrypoint: '@picodash/panel',
    category: 'input',
    compatibleValueKinds: ['string', 'string-union', 'number'],
    capabilities: { input: true },
    nesting: { allowedParents: ['PicodashPanel', 'PicodashGroup'] },
    accessibility: { nameRequirement: 'visible-label', labelProp: 'label' },
    importantProps: ['field', 'label', 'options', 'selectionRole'],
    variants: ['radio', 'toggle'],
    theme: { semanticTokens: controlThemeTokens },
    referenceAnchor: referenceAnchor('@picodash/panel', 'picodash-matrix-2d'),
    recipeIds: ['choice-control'],
  }),
  entry({
    id: 'built-in.dropzone',
    exportName: 'PicodashDropzone',
    entrypoint: '@picodash/panel',
    category: 'input',
    compatibleValueKinds: ['media', 'array'],
    capabilities: { input: true, display: true },
    nesting: { allowedParents: ['PicodashPanel', 'PicodashGroup'] },
    accessibility: { nameRequirement: 'visible-label', labelProp: 'label' },
    importantProps: ['field', 'label', 'accept', 'maxFiles', 'maxSize'],
    variants: [],
    theme: { semanticTokens: [...controlThemeTokens, '--picodash-color-well'] },
    referenceAnchor: referenceAnchor('@picodash/panel', 'picodash-dropzone'),
    recipeIds: ['media-inspector'],
  }),
  entry({
    id: 'built-in.media-preview',
    exportName: 'PicodashMediaPreview',
    entrypoint: '@picodash/panel',
    category: 'display',
    compatibleValueKinds: ['media', 'string'],
    capabilities: { display: true },
    nesting: { allowedParents: ['PicodashPanel', 'PicodashGroup'] },
    accessibility: { nameRequirement: 'accessible-name', labelProp: 'alt' },
    importantProps: ['field', 'label', 'alt', 'objectFit'],
    variants: ['contain', 'cover', 'fill', 'none', 'scale-down'],
    theme: { semanticTokens: dataThemeTokens },
    referenceAnchor: referenceAnchor('@picodash/panel', 'picodash-media-preview'),
    recipeIds: ['media-inspector'],
  }),
  entry({
    id: 'built-in.display',
    exportName: 'PicodashDisplay',
    entrypoint: '@picodash/panel',
    category: 'display',
    compatibleValueKinds: ['json'],
    capabilities: { display: true },
    nesting: { allowedParents: ['PicodashPanel', 'PicodashGroup'] },
    accessibility: { nameRequirement: 'visible-label', labelProp: 'label' },
    importantProps: ['id', 'label', 'value', 'format'],
    variants: [],
    referenceAnchor: referenceAnchor('@picodash/panel', 'picodash-display'),
    recipeIds: ['structured-summary'],
  }),
  entry({
    id: 'built-in.sparkline',
    exportName: 'PicodashSparkline',
    entrypoint: '@picodash/panel',
    category: 'visualization',
    compatibleValueKinds: ['number', 'array', 'visualization'],
    capabilities: { display: true, streaming: true },
    nesting: { allowedParents: ['PicodashPanel', 'PicodashGroup'] },
    accessibility: { nameRequirement: 'visible-label', labelProp: 'label' },
    importantProps: ['id', 'label', 'data', 'series', 'maxPoints', 'continuous', 'autoscale'],
    variants: [],
    theme: { semanticTokens: dataThemeTokens },
    referenceAnchor: referenceAnchor('@picodash/panel', 'picodash-sparkline'),
    recipeIds: ['live-monitor'],
  }),
  entry({
    id: 'built-in.chart',
    exportName: 'PicodashChart',
    entrypoint: '@picodash/panel',
    category: 'visualization',
    compatibleValueKinds: ['array', 'visualization'],
    capabilities: { display: true },
    nesting: { allowedParents: ['PicodashPanel', 'PicodashGroup'] },
    accessibility: { nameRequirement: 'visible-label', labelProp: 'label' },
    importantProps: ['id', 'label', 'type', 'data'],
    variants: ['area', 'bar', 'line', 'pie', 'radar', 'radial'],
    theme: { semanticTokens: dataThemeTokens },
    referenceAnchor: referenceAnchor('@picodash/panel', 'picodash-chart'),
    recipeIds: ['visualization-card', 'live-monitor'],
  }),
  entry({
    id: 'built-in.gradient',
    exportName: 'PicodashGradient',
    entrypoint: '@picodash/panel',
    category: 'input',
    compatibleValueKinds: ['array'],
    capabilities: { input: true, display: true },
    nesting: { allowedParents: ['PicodashPanel', 'PicodashGroup'] },
    accessibility: { nameRequirement: 'visible-label', labelProp: 'label' },
    importantProps: ['field', 'label', 'rotationField', 'maxStops'],
    variants: [],
    theme: { semanticTokens: [...controlThemeTokens, ...dataThemeTokens] },
    referenceAnchor: referenceAnchor('@picodash/panel', 'picodash-gradient'),
    recipeIds: ['spatial-control'],
  }),
]

const dashletDefinitions = [
  ['Frame', 'anatomy', ['none'], ['PicodashItem'], [], ['density'], 'structured-summary'],
  ['Header', 'anatomy', ['none'], ['Frame'], ['Frame'], [], 'structured-summary'],
  ['Heading', 'anatomy', ['string'], ['Header'], ['Header'], [], 'structured-summary'],
  ['Description', 'anatomy', ['string'], ['Header'], ['Header'], [], 'structured-summary'],
  ['Actions', 'action', ['none'], ['Header'], ['Header'], ['alignment'], 'action-strip'],
  ['Body', 'anatomy', ['json'], ['Frame'], ['Frame'], ['density'], 'structured-summary'],
  ['Footer', 'anatomy', ['none'], ['Frame'], ['Frame'], ['alignment'], 'action-strip'],
  [
    'Toolbar',
    'action',
    ['none'],
    ['Frame', 'Header', 'Footer'],
    ['Footer'],
    ['orientation'],
    'action-strip',
  ],
  [
    'Metric',
    'readout',
    ['number', 'string'],
    ['Body'],
    ['Body'],
    ['emphasis'],
    'application-health',
  ],
  ['MetricLabel', 'readout', ['string'], ['Metric'], ['Metric'], [], 'application-health'],
  [
    'MetricValue',
    'readout',
    ['number', 'string'],
    ['Metric'],
    ['Metric'],
    ['emphasis'],
    'application-health',
  ],
  [
    'MetricTrend',
    'readout',
    ['number', 'string'],
    ['Metric'],
    ['Metric'],
    ['tone'],
    'application-health',
  ],
  [
    'Status',
    'readout',
    ['boolean', 'string', 'string-union'],
    ['Body'],
    ['Body'],
    ['tone'],
    'application-health',
  ],
  [
    'StatusIndicator',
    'readout',
    ['boolean', 'string-union'],
    ['Status'],
    ['Status'],
    ['tone'],
    'application-health',
  ],
  [
    'DataList',
    'structured-data',
    ['object', 'array', 'json'],
    ['Body'],
    ['Body'],
    ['density'],
    'structured-summary',
  ],
  [
    'DataRow',
    'structured-data',
    ['json'],
    ['DataList'],
    ['DataList'],
    ['orientation'],
    'structured-summary',
  ],
  ['DataLabel', 'structured-data', ['string'], ['DataRow'], ['DataRow'], [], 'structured-summary'],
  [
    'DataValue',
    'structured-data',
    ['json'],
    ['DataRow'],
    ['DataRow'],
    ['emphasis'],
    'structured-summary',
  ],
  [
    'Surface',
    'visualization',
    ['visualization'],
    ['Body'],
    ['Body'],
    ['aspect', 'tone'],
    'visualization-card',
  ],
  [
    'Caption',
    'visualization',
    ['string'],
    ['Surface'],
    ['Surface'],
    ['alignment'],
    'visualization-card',
  ],
  [
    'Legend',
    'visualization',
    ['array', 'visualization'],
    ['Surface'],
    ['Surface'],
    ['orientation'],
    'visualization-card',
  ],
  ['LegendItem', 'visualization', ['object'], ['Legend'], ['Legend'], [], 'visualization-card'],
  [
    'LegendSwatch',
    'visualization',
    ['string'],
    ['LegendItem'],
    ['LegendItem'],
    ['tone'],
    'visualization-card',
  ],
  ['EmptyState', 'state', ['none'], ['Body'], ['Body'], ['tone'], 'async-state'],
  ['LoadingState', 'state', ['none'], ['Body'], ['Body'], ['tone'], 'async-state'],
  ['ErrorState', 'state', ['none'], ['Body'], ['Body'], ['tone'], 'async-state'],
] as const

const dashletEntries: PicodashCatalogEntry[] = dashletDefinitions.map(
  ([exportName, category, valueKinds, allowedParents, recommendedParents, variants, recipeId]) =>
    entry({
      id: `dashlet.${exportName.replaceAll(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()}`,
      exportName,
      entrypoint: '@picodash/panel/dashlet',
      category,
      compatibleValueKinds: valueKinds,
      capabilities: {
        display: category !== 'action',
        action: category === 'action',
      },
      nesting: { allowedParents, recommendedParents },
      accessibility: {
        nameRequirement:
          exportName === 'Toolbar' || exportName === 'Surface'
            ? 'accessible-name'
            : exportName === 'Heading' || exportName === 'MetricLabel' || exportName === 'DataLabel'
              ? 'visible-label'
              : 'inherited',
        labelProp: exportName === 'Toolbar' || exportName === 'Surface' ? 'aria-label' : null,
      },
      importantProps: ['children', 'className', ...variants],
      variants,
      theme: {
        semanticTokens:
          category === 'visualization' || category === 'readout'
            ? dataThemeTokens
            : commonThemeTokens,
      },
      referenceAnchor: referenceAnchor(
        '@picodash/panel/dashlet',
        `dashlet-${exportName.replaceAll(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()}`,
      ),
      recipeIds: [recipeId],
    }),
)

const uiDefinitions = [
  [
    'Button',
    'action',
    ['none'],
    ['Actions', 'Toolbar', 'Footer'],
    ['Actions'],
    ['variant', 'size'],
    'action-strip',
    'accessible-name',
  ],
  [
    'LinkButton',
    'action',
    ['none'],
    ['Actions', 'Toolbar', 'Footer'],
    ['Actions'],
    ['variant', 'size'],
    'action-strip',
    'accessible-name',
  ],
  [
    'Badge',
    'display',
    ['string'],
    ['Body', 'Metric', 'Status'],
    ['Status'],
    ['variant'],
    'application-health',
    'inherited',
  ],
  ['Input', 'input', ['string'], ['Body'], ['Body'], ['size'], 'basic-control', 'accessible-name'],
  [
    'Textarea',
    'input',
    ['string'],
    ['Body'],
    ['Body'],
    ['size'],
    'basic-control',
    'accessible-name',
  ],
  ['Label', 'foundation', ['string'], ['Body'], ['Body'], [], 'basic-control', 'visible-label'],
  [
    'Slider',
    'input',
    ['number', 'number-tuple'],
    ['Body'],
    ['Body'],
    ['orientation'],
    'basic-control',
    'accessible-name',
  ],
  ['Switch', 'input', ['boolean'], ['Body'], ['Body'], [], 'basic-control', 'accessible-name'],
  [
    'Select',
    'input',
    ['string', 'string-union'],
    ['Body'],
    ['Body'],
    [],
    'choice-control',
    'accessible-name',
  ],
  [
    'Toggle',
    'input',
    ['boolean'],
    ['Body', 'Toolbar'],
    ['Toolbar'],
    ['variant', 'size'],
    'choice-control',
    'accessible-name',
  ],
  [
    'ToggleGroup',
    'input',
    ['string', 'string-union', 'array'],
    ['Body', 'Toolbar'],
    ['Toolbar'],
    ['orientation'],
    'choice-control',
    'accessible-name',
  ],
  [
    'Tabs',
    'foundation',
    ['string', 'string-union'],
    ['Body'],
    ['Body'],
    ['orientation'],
    'structured-summary',
    'accessible-name',
  ],
  [
    'Tooltip',
    'foundation',
    ['string'],
    ['Actions', 'Toolbar', 'Body'],
    ['Actions'],
    [],
    'action-strip',
    'inherited',
  ],
  [
    'Meter',
    'display',
    ['number'],
    ['Body', 'Metric'],
    ['Metric'],
    [],
    'application-health',
    'visible-label',
  ],
  [
    'MeterTrack',
    'display',
    ['number'],
    ['Meter'],
    ['Meter'],
    [],
    'application-health',
    'inherited',
  ],
  [
    'MeterFill',
    'display',
    ['number'],
    ['MeterTrack'],
    ['MeterTrack'],
    [],
    'application-health',
    'inherited',
  ],
  [
    'ProgressBar',
    'display',
    ['number'],
    ['Body', 'Metric'],
    ['Metric'],
    [],
    'application-health',
    'visible-label',
  ],
  [
    'ProgressTrack',
    'display',
    ['number'],
    ['ProgressBar'],
    ['ProgressBar'],
    [],
    'application-health',
    'inherited',
  ],
  [
    'ProgressFill',
    'display',
    ['number'],
    ['ProgressTrack'],
    ['ProgressTrack'],
    [],
    'application-health',
    'inherited',
  ],
  [
    'Toolbar',
    'action',
    ['none'],
    ['Body', 'Header', 'Footer'],
    ['Footer'],
    ['orientation'],
    'action-strip',
    'accessible-name',
  ],
  [
    'Separator',
    'foundation',
    ['none'],
    ['Body', 'Toolbar'],
    ['Body'],
    ['orientation'],
    'structured-summary',
    'none',
  ],
  [
    'ScrollArea',
    'foundation',
    ['none'],
    ['Body', 'Surface'],
    ['Body'],
    ['orientation'],
    'structured-summary',
    'accessible-name',
  ],
  ['Card', 'foundation', ['json'], ['Body'], ['Body'], [], 'structured-summary', 'inherited'],
  [
    'Dialog',
    'action',
    ['none'],
    ['Actions', 'Toolbar', 'Body'],
    ['Actions'],
    [],
    'action-strip',
    'accessible-name',
  ],
  [
    'DropdownMenu',
    'action',
    ['none'],
    ['Actions', 'Toolbar'],
    ['Actions'],
    [],
    'action-strip',
    'accessible-name',
  ],
  [
    'AlertDialog',
    'action',
    ['none'],
    ['Actions', 'Toolbar'],
    ['Actions'],
    [],
    'action-strip',
    'accessible-name',
  ],
] as const

const uiEntries: PicodashCatalogEntry[] = uiDefinitions.map(
  ([
    exportName,
    category,
    valueKinds,
    allowedParents,
    recommendedParents,
    variants,
    recipeId,
    nameRequirement,
  ]) =>
    entry({
      id: `ui.${exportName.replaceAll(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()}`,
      exportName,
      entrypoint: '@picodash/panel/ui',
      category,
      compatibleValueKinds: valueKinds,
      capabilities: {
        input: category === 'input',
        display: category === 'display',
        action: category === 'action',
      },
      nesting: { allowedParents, recommendedParents },
      accessibility: {
        nameRequirement,
        labelProp:
          nameRequirement === 'accessible-name'
            ? 'aria-label'
            : nameRequirement === 'visible-label'
              ? 'children'
              : null,
      },
      importantProps: ['children', 'className', ...variants],
      variants,
      theme: {
        semanticTokens:
          category === 'display'
            ? dataThemeTokens
            : category === 'input' || category === 'action'
              ? controlThemeTokens
              : commonThemeTokens,
      },
      referenceAnchor: referenceAnchor(
        '@picodash/panel/ui',
        `ui-${exportName.replaceAll(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()}`,
      ),
      recipeIds: [recipeId],
    }),
)

function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child)
    Object.freeze(value)
  }
  return value
}

export const picodashCatalog = deepFreeze([
  ...builtInEntries,
  ...dashletEntries,
  ...uiEntries,
]) as readonly PicodashCatalogEntry[]

const entriesById = new Map(picodashCatalog.map((catalogEntry) => [catalogEntry.id, catalogEntry]))
const entriesByExportName = new Map<string, PicodashCatalogEntry[]>()

for (const catalogEntry of picodashCatalog) {
  const matches = entriesByExportName.get(catalogEntry.exportName) ?? []
  matches.push(catalogEntry)
  entriesByExportName.set(catalogEntry.exportName, matches)
}

export function getPicodashCatalogEntry(id: string): PicodashCatalogEntry | undefined {
  return entriesById.get(id)
}

export function getPicodashCatalogEntriesByExportName(
  exportName: string,
): readonly PicodashCatalogEntry[] {
  return Object.freeze([...(entriesByExportName.get(exportName) ?? [])])
}

export function filterPicodashCatalog(
  filter: PicodashCatalogFilter = {},
): readonly PicodashCatalogEntry[] {
  return Object.freeze(
    picodashCatalog.filter(
      (catalogEntry) =>
        (filter.entrypoint === undefined || catalogEntry.entrypoint === filter.entrypoint) &&
        (filter.category === undefined || catalogEntry.category === filter.category) &&
        (filter.valueKind === undefined ||
          catalogEntry.compatibleValueKinds.includes(filter.valueKind)) &&
        (filter.capability === undefined || catalogEntry.capabilities[filter.capability]) &&
        (filter.accessibleNameRequirement === undefined ||
          catalogEntry.accessibility.nameRequirement === filter.accessibleNameRequirement) &&
        (filter.recipeId === undefined || catalogEntry.recipeIds.includes(filter.recipeId)),
    ),
  )
}
