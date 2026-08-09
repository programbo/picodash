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
  './package.json': './package.json',
  './style.css': './dist/style.css',
})
assert.deepEqual(manifest.dependencies, {
  '@picodash/store': 'workspace:*',
  '@picodash/ui': 'workspace:*',
})
assert.deepEqual(manifest.peerDependencies, { react: '>=19', 'react-dom': '>=19' })
for (const file of ['dist/index.mjs', 'dist/index.d.mts', 'dist/style.css'])
  assert.equal(await exists(path.join(packageRoot, file)), true, `missing ${file}`)

const runtime = await import(
  `${pathToFileURL(path.join(packageRoot, 'dist/index.mjs')).href}?dashlist-artifact`
)
const React = await import('react')
const { renderToString } = await import('react-dom/server')
const { createPicodashStore } = await import('@picodash/store')
assert.deepEqual(Object.keys(runtime).sort(), [
  'ActionMenu',
  'ActionMenuItem',
  'ActionMenuSeparator',
  'ActionSubmenu',
  'DashGroup',
  'DashHeader',
  'DashList',
  'Dashlet',
])
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
])
  assert.match(declarations, new RegExp(`\\b${name}\\b`))
for (const retired of [
  'ReactiveProp',
  'DashletStates',
  'DashletStatus',
  'Dashlist',
  'PicodashList',
  'PicodashItem',
])
  assert.doesNotMatch(declarations, new RegExp(`\\b${retired}\\b`))

const css = await readFile(path.join(packageRoot, 'dist/style.css'), 'utf8')
assert.match(css, /@picodash\/ui\/style\.css|picodash-dashlist/)
assert.match(css, /--picodash-dashlet-label-width/)
assert.doesNotMatch(css, /picodash-panel|picodash-dock|zustand/)

const ssrStore = createPicodashStore({
  valueOwner: 'store',
  fields: { value: { defaultValue: 0 } },
})
const html = renderToString(
  React.createElement(runtime.DashList, {
    id: 'artifact-ssr',
    store: ssrStore,
    children: React.createElement(runtime.Dashlet, { id: 'item', label: 'Item' }),
  }),
)
assert.match(html, /role="list"/)
assert.doesNotThrow(() => ssrStore.destroy())
console.log('@picodash/dashlist package artifact contract passed')
