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
assert.equal(manifest.name, '@picodash/dashstack')
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
  '@picodash/nexus': 'workspace:*',
  '@picodash/ui': 'workspace:*',
  motion: 'catalog:',
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

// Verify the shipped declarations and styles as well as runtime export names.
for (const file of ['index.mjs', 'index.d.mts', 'ui.d.mts', 'catalog.mjs', 'style.css']) {
  assert.doesNotMatch(await readFile(path.join(packageRoot, 'dist', file), 'utf8'), /dash[-]?list/i)
}

const runtime = await import(
  `${pathToFileURL(path.join(packageRoot, 'dist/index.mjs')).href}?dashstack-artifact`
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
    'DashStack',
    'DashStackActionItems',
    'DashStackCollapseAllItem',
    'DashStackExpandAllItem',
    'DashStackResetStackItem',
    'DashStackResetSubmenu',
    'DashStackResetValuesItem',
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
    'useDashStackActions',
    'useDashStackOrder',
  ].sort(),
)
const ui = await import(
  `${pathToFileURL(path.join(packageRoot, 'dist/ui.mjs')).href}?dashstack-ui-artifact`
)
const charts = await import(
  `${pathToFileURL(path.join(packageRoot, 'dist/charts.mjs')).href}?dashstack-charts-artifact`
)
assert.deepEqual(Object.keys(charts).sort(), ['ChartDashlet', 'SparklineDashlet'])
const catalog = await import(
  `${pathToFileURL(path.join(packageRoot, 'dist/catalog.mjs')).href}?dashstack-catalog-artifact`
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
]
const actionNames = [
  'DashStackActionItems',
  'DashStackExpandAllItem',
  'DashStackCollapseAllItem',
  'DashStackResetSubmenu',
  'DashStackResetValuesItem',
  'DashStackResetStackItem',
]
assert.equal(catalogEntries.length, 16)
assert.deepEqual(
  catalogEntries.map((entry) => entry.id),
  [
    'dashstack',
    'dashgroup',
    'dashlet',
    ...stableDashletNames.map((name) => `dashlet.${name}`),
    ...actionNames.map((name) => `action.${name}`),
  ],
)
assert.deepEqual(
  catalogEntries.map((entry) => entry.exportName),
  ['DashStack', 'DashGroup', 'Dashlet', ...stableDashletNames, ...actionNames],
)
assert.equal(new Set(catalogEntries.map((entry) => entry.id)).size, catalogEntries.length)
for (const entry of catalogEntries) {
  assert.equal(entry.owner, '@picodash/dashstack')
  assert.equal(entry.entrypoint, '@picodash/dashstack')
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
assert.equal(catalogEntries.find((entry) => entry.exportName === 'DashStack').kind, 'stack')
const actionEntries = catalogEntries.filter((entry) => entry.kind === 'action-composition')
assert.deepEqual(
  actionEntries.map((entry) => entry.exportName),
  actionNames,
)
for (const entry of actionEntries) {
  assert.deepEqual(entry.field, { cardinality: 'none', valueKinds: [] })
  assert.deepEqual(entry.composition, { allowedParents: [], recommendedParents: [] })
  assert.equal(entry.reference, 'docs/reference/dashstack.md#stack-behavior-actions')
}
assert.equal(
  catalogEntries.find((entry) => entry.exportName === 'DashStackActionItems').accessibleName,
  'none',
)
for (const exportName of [
  'DashStackExpandAllItem',
  'DashStackCollapseAllItem',
  'DashStackResetSubmenu',
  'DashStackResetValuesItem',
  'DashStackResetStackItem',
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
for (const exportName of [
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
]) {
  assert.equal(exportName in runtime, true, `missing evaluation export: ${exportName}`)
  assert.equal(
    catalogEntries.some((entry) => entry.exportName === exportName),
    false,
  )
}
assert.equal(catalogEntries.filter((entry) => entry.exportName === 'ChartDashlet').length, 0)
assert.equal(catalogEntries.filter((entry) => entry.exportName === 'SparklineDashlet').length, 0)
for (const deferred of ['DashStackDocumentItems', 'DashStackExportItem', 'DashStackImportItem'])
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
  'DashStack',
  'DashStackProps',
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
  'DashStackActions',
  'DashStackActionController',
  'DashStackActionExecutionResult',
  'DashStackActionNexusResult',
  'DashStackActionProps',
  'DashStackActionAvailability',
  'DashStackActionItems',
  'DashStackExpandAllItem',
  'DashStackCollapseAllItem',
  'DashStackResetSubmenu',
  'DashStackResetValuesItem',
  'DashStackResetStackItem',
  'useDashStackActions',
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
assert.match(css, /@picodash\/ui\/style\.css|picodash-dashstack/)
assert.match(css, /--picodash-dashlet-label-width/)
assert.doesNotMatch(css, /picodash-panel|picodash-dock|zustand/)

const ssrNexus = createPicodashNexus({
  valueOwner: 'nexus',
  fields: { value: { defaultValue: 0 } },
})
const html = renderToString(
  React.createElement(runtime.DashStack, {
    id: 'artifact-ssr',
    nexus: ssrNexus,
    children: React.createElement(runtime.Dashlet, { id: 'item', label: 'Item' }),
  }),
)
assert.match(html, /role="list"/)
assert.doesNotThrow(() => ssrNexus.destroy())
console.log('@picodash/dashstack package artifact contract passed')
