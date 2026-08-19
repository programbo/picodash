import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const exists = (file) =>
  access(file).then(
    () => true,
    () => false,
  )

const manifest = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8'))
assert.deepEqual(manifest.exports, {
  '.': './dist/index.mjs',
  './catalog': './dist/catalog.mjs',
  './ui': './dist/ui.mjs',
  './charts': './dist/charts.mjs',
  './package.json': './package.json',
  './style.css': './dist/style.css',
})
assert.deepEqual(manifest.dependencies, {
  '@internationalized/date': 'catalog:',
  '@internationalized/number': 'catalog:',
  '@picodash/nexus': 'workspace:*',
  '@picodash/ui': 'workspace:*',
  'react-aria-components': 'catalog:',
})
assert.deepEqual(manifest.devDependencies['@tanstack/charts'], 'catalog:')
assert.deepEqual(manifest.peerDependencies, {
  '@tanstack/charts': '0.12.0',
  react: '>=19',
  'react-dom': '>=19',
})
assert.deepEqual(manifest.peerDependenciesMeta, { '@tanstack/charts': { optional: true } })
for (const file of [
  'dist/index.mjs',
  'dist/index.d.mts',
  'dist/catalog.mjs',
  'dist/catalog.d.mts',
  'dist/ui.mjs',
  'dist/ui.d.mts',
  'dist/charts.mjs',
  'dist/charts.d.mts',
  'dist/style.css',
])
  assert.equal(await exists(path.join(packageRoot, file)), true, `missing ${file}`)

const runtime = await import(
  `${pathToFileURL(path.join(packageRoot, 'dist/index.mjs')).href}?dashlist-artifact`
)
const React = await import('react')
const { renderToString } = await import('react-dom/server')
const { createPicodashNexus } = await import('@picodash/nexus')
assert.deepEqual(
  Object.keys(runtime).sort(),
  [
    'ActionMenu',
    'ActionMenuItem',
    'ActionMenuSeparator',
    'ActionSubmenu',
    'DashGroup',
    'DashHeader',
    'DashList',
    'DashListActionItems',
    'DashListCollapseAllItem',
    'DashListExpandAllItem',
    'DashListResetListItem',
    'DashListResetSubmenu',
    'DashListResetValuesItem',
    'Dashlet',
    'CheckboxDashlet',
    'CheckboxGroupDashlet',
    'ColorDashlet',
    'ComboboxDashlet',
    'DateDashlet',
    'DateRangeDashlet',
    'DateTimeDashlet',
    'DisplayDashlet',
    'MeterDashlet',
    'MultiSelectDashlet',
    'NumberDashlet',
    'ProgressDashlet',
    'RadioGroupDashlet',
    'RangeDashlet',
    'SearchDashlet',
    'SegmentedDashlet',
    'SelectDashlet',
    'SliderDashlet',
    'StatusDashlet',
    'SwitchDashlet',
    'TextDashlet',
    'TimeDashlet',
    'useDashListActions',
  ].sort(),
)
const ui = await import(
  `${pathToFileURL(path.join(packageRoot, 'dist/ui.mjs')).href}?dashlist-ui-artifact`
)
const charts = await import(
  `${pathToFileURL(path.join(packageRoot, 'dist/charts.mjs')).href}?dashlist-charts-artifact`
)
assert.deepEqual(Object.keys(charts).sort(), ['ChartDashlet', 'SparklineDashlet'])
const catalog = await import(
  `${pathToFileURL(path.join(packageRoot, 'dist/catalog.mjs')).href}?dashlist-catalog-artifact`
)
assert.equal(catalog.catalog.schemaVersion, 1)
const catalogEntries = catalog.catalog.entries
const stableDashletNames = [
  'TextDashlet',
  'NumberDashlet',
  'SliderDashlet',
  'SwitchDashlet',
  'SelectDashlet',
  'SegmentedDashlet',
  'DisplayDashlet',
  'CheckboxDashlet',
  'RadioGroupDashlet',
  'ComboboxDashlet',
  'CheckboxGroupDashlet',
  'MultiSelectDashlet',
  'SearchDashlet',
  'RangeDashlet',
  'MeterDashlet',
  'ProgressDashlet',
  'StatusDashlet',
  'DateDashlet',
  'TimeDashlet',
  'DateTimeDashlet',
  'DateRangeDashlet',
  'ColorDashlet',
]
const actionNames = [
  'DashListActionItems',
  'DashListExpandAllItem',
  'DashListCollapseAllItem',
  'DashListResetSubmenu',
  'DashListResetValuesItem',
  'DashListResetListItem',
]
assert.equal(catalogEntries.length, 31)
assert.deepEqual(
  catalogEntries.map((entry) => entry.id),
  [
    'dashlist',
    'dashgroup',
    'dashlet',
    ...stableDashletNames.map((name) => `dashlet.${name}`),
    ...actionNames.map((name) => `action.${name}`),
  ],
)
assert.deepEqual(
  catalogEntries.map((entry) => entry.exportName),
  ['DashList', 'DashGroup', 'Dashlet', ...stableDashletNames, ...actionNames],
)
assert.equal(new Set(catalogEntries.map((entry) => entry.id)).size, catalogEntries.length)
for (const entry of catalogEntries) {
  assert.equal(entry.owner, '@picodash/dashlist')
  assert.equal(entry.entrypoint, '@picodash/dashlist')
  assert.equal(entry.exportName in runtime, true, `missing root export: ${entry.exportName}`)
  for (const parent of [
    ...entry.composition.allowedParents,
    ...entry.composition.recommendedParents,
  ])
    assert.equal(
      catalogEntries.some((candidate) => candidate.id === parent),
      true,
    )
}
const actionEntries = catalogEntries.filter((entry) => entry.kind === 'action-composition')
assert.deepEqual(
  actionEntries.map((entry) => entry.exportName),
  actionNames,
)
for (const entry of actionEntries) {
  assert.deepEqual(entry.field, { cardinality: 'none', valueKinds: [] })
  assert.deepEqual(entry.composition, { allowedParents: [], recommendedParents: [] })
  assert.equal(entry.reference, 'docs/reference/dashlist.md#list-behavior-actions')
}
assert.equal(
  catalogEntries.find((entry) => entry.exportName === 'DashListActionItems').accessibleName,
  'none',
)
for (const exportName of [
  'DashListExpandAllItem',
  'DashListCollapseAllItem',
  'DashListResetSubmenu',
  'DashListResetValuesItem',
  'DashListResetListItem',
])
  assert.equal(
    catalogEntries.find((entry) => entry.exportName === exportName).accessibleName,
    'visible-label',
  )
assert.equal(
  catalogEntries.find((entry) => entry.exportName === 'Dashlet').accessibleName,
  'required',
)
const assertDeepFrozen = (value) => {
  assert.equal(Object.isFrozen(value), true)
  if (value && typeof value === 'object')
    for (const child of Object.values(value)) assertDeepFrozen(child)
}
assertDeepFrozen(catalog.catalog)
assert.deepEqual(JSON.parse(JSON.stringify(catalog.catalog)), catalog.catalog)
assert.deepEqual(catalog.catalog.reexports, [])
for (const exportName of ['CheckboxGroupDashlet', 'MultiSelectDashlet']) {
  const entry = catalogEntries.find((candidate) => candidate.exportName === exportName)
  assert.ok(entry, `missing catalog entry: ${exportName}`)
  assert.equal(entry.field.cardinality, 'one')
  assert.deepEqual(entry.field.valueKinds, ['json'])
}
assert.equal(catalogEntries.filter((entry) => entry.exportName === 'ChartDashlet').length, 0)
assert.equal(catalogEntries.filter((entry) => entry.exportName === 'SparklineDashlet').length, 0)
for (const deferred of ['DashListDocumentItems', 'DashListExportItem', 'DashListImportItem'])
  assert.equal(
    catalogEntries.some((entry) => entry.exportName === deferred),
    false,
  )
assert.deepEqual(
  Object.keys(ui).sort(),
  [
    'Checkbox',
    'CheckboxGroup',
    'ColorField',
    'Combobox',
    'DateField',
    'DateRangeField',
    'DateTimeField',
    'Display',
    'Meter',
    'MultiSelect',
    'NumberField',
    'ProgressBar',
    'RadioGroup',
    'RangeSlider',
    'SearchField',
    'SegmentedControl',
    'Select',
    'Slider',
    'Status',
    'Switch',
    'TextField',
    'TimeField',
  ].sort(),
)
for (const retired of [
  'Dashlist',
  'PicodashList',
  'PicodashGroup',
  'PicodashItem',
  'DashletGroup',
  'ReactiveProp',
  'useRegisterDashlet',
  'Actions',
  'catalog',
])
  assert.equal(retired in runtime, false, `retired export remains: ${retired}`)

const declarations = await readFile(path.join(packageRoot, 'dist/index.d.mts'), 'utf8')
const rootBundle = await readFile(path.join(packageRoot, 'dist/index.mjs'), 'utf8')
assert.doesNotMatch(rootBundle, /@tanstack\/charts|\.\/charts\.mjs/)
for (const name of [
  'DashList',
  'DashListProps',
  'DashGroup',
  'DashGroupProps',
  'Dashlet',
  'DashletProps',
  'CompoundDashletProps',
  'DashletFieldBinding',
  'DashletFields',
  'DashletRenderContext',
  'DashletBindingContext',
  'DashletInputBindingContext',
  'DashletDisplayBindingContext',
  'DashletBindingContextFor',
  'SingleFieldDashletRenderContext',
  'CompoundDashletRenderContext',
  'DashHeader',
  'ActionMenu',
  'ActionMenuItem',
  'ActionMenuSeparator',
  'ActionSubmenu',
  'DashListActions',
  'DashListActionController',
  'DashListActionExecutionResult',
  'DashListActionNexusResult',
  'DashListActionProps',
  'DashListActionAvailability',
  'DashListActionItems',
  'DashListExpandAllItem',
  'DashListCollapseAllItem',
  'DashListResetSubmenu',
  'DashListResetValuesItem',
  'DashListResetListItem',
  'useDashListActions',
  'TextDashletProps',
  'NumberDashletProps',
  'SliderDashletProps',
  'SwitchDashletProps',
  'SelectDashletProps',
  'SegmentedDashletProps',
  'DisplayDashletProps',
  'CheckboxDashletProps',
  'CheckboxGroupDashletProps',
  'ColorDashletProps',
  'ComboboxDashletProps',
  'DateDashletProps',
  'DateRangeDashletProps',
  'DateTimeDashletProps',
  'MeterDashletProps',
  'MultiSelectDashletProps',
  'ProgressDashletProps',
  'RadioGroupDashletProps',
  'RangeDashletProps',
  'SearchDashletProps',
  'StatusDashletProps',
  'TimeDashletProps',
])
  assert.match(declarations, new RegExp(`\\b${name}\\b`))
assert.match(declarations, /PicodashFieldOf/)
assert.match(declarations, /PicodashExactFieldOf/)
assert.doesNotMatch(declarations, /DashletProps<any/)
for (const retired of [
  'ReactiveProp',
  'DashletStates',
  'DashletStatus',
  'Dashlist',
  'PicodashList',
  'PicodashItem',
])
  assert.doesNotMatch(declarations, new RegExp(`\\b${retired}\\b`))

const chartDeclarations = await readFile(path.join(packageRoot, 'dist/charts.d.mts'), 'utf8')
for (const name of [
  'ChartDashlet',
  'ChartDashletProps',
  'SparklineDashlet',
  'SparklineDashletProps',
  'SparklineSource',
])
  assert.match(chartDeclarations, new RegExp(`\\b${name}\\b`))
assert.match(chartDeclarations, /'aria-label'\?: string/)

const css = await readFile(path.join(packageRoot, 'dist/style.css'), 'utf8')
assert.match(css, /@picodash\/ui\/style\.css|picodash-dashlist/)
assert.match(css, /--picodash-dashlet-label-width/)
assert.doesNotMatch(css, /picodash-panel|picodash-dock|zustand/)

const ssrNexus = createPicodashNexus({
  valueOwner: 'nexus',
  fields: { value: { defaultValue: 0 } },
})
const html = renderToString(
  React.createElement(runtime.DashList, {
    id: 'artifact-ssr',
    nexus: ssrNexus,
    children: React.createElement(runtime.Dashlet, { id: 'item', label: 'Item' }),
  }),
)
assert.match(html, /role="list"/)
assert.doesNotThrow(() => ssrNexus.destroy())
console.log('@picodash/dashlist package artifact contract passed')
