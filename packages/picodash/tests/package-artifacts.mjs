import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
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

assert.deepEqual(manifest.files, ['dist', 'style.css'])
assert.deepEqual(manifest.exports, {
  '.': './dist/index.mjs',
  './ui': './dist/ui.mjs',
  './style.css': './style.css',
  './package.json': './package.json',
})
assert.deepEqual(manifest.dependencies, {
  '@picodash/dashlist': 'workspace:*',
  '@picodash/dashpanel': 'workspace:*',
  '@picodash/store': 'workspace:*',
  '@picodash/ui': 'workspace:*',
})
assert.deepEqual(manifest.peerDependencies, { react: '>=19', 'react-dom': '>=19' })
assert.deepEqual(manifest.sideEffects, ['**/*.css'])
for (const file of [
  'dist/index.mjs',
  'dist/index.d.mts',
  'dist/ui.mjs',
  'dist/ui.d.mts',
  'style.css',
])
  assert.equal(await exists(path.join(packageRoot, file)), true, `missing ${file}`)
for (const retired of [
  'dist/advanced.mjs',
  'dist/advanced.d.mts',
  'dist/dashlet.mjs',
  'dist/dashlet.d.mts',
  'dist/catalog.mjs',
  'dist/catalog.d.mts',
])
  assert.equal(
    await exists(path.join(packageRoot, retired)),
    false,
    `retired artifact remains: ${retired}`,
  )

const runtime = await import(
  `${pathToFileURL(path.join(packageRoot, 'dist/index.mjs')).href}?facade-artifact`
)
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
    'DashPanel',
    'Dashlet',
    'PicodashProvider',
    'createPicodashStore',
    'usePicodashStoreSelector',
  ].sort(),
)
const uiRuntime = await import(
  `${pathToFileURL(path.join(packageRoot, 'dist/ui.mjs')).href}?facade-ui-artifact`
)
assert.deepEqual(
  Object.keys(uiRuntime).sort(),
  [
    'ActionMenu',
    'ActionMenuItem',
    'ActionMenuSeparator',
    'ActionSubmenu',
    'AlertDialog',
    'AlertDialogAction',
    'AlertDialogCancel',
    'AlertDialogContent',
    'AlertDialogDescription',
    'AlertDialogFooter',
    'AlertDialogHeader',
    'AlertDialogMedia',
    'AlertDialogOverlay',
    'AlertDialogTitle',
    'AlertDialogTrigger',
    'Button',
    'DashHeader',
    'PicodashOverlayProvider',
    'PicodashThemeProvider',
    'Tooltip',
    'TooltipContent',
    'TooltipProvider',
    'TooltipTrigger',
    'usePicodashDensity',
    'usePicodashOverlayDefaults',
    'usePicodashTheme',
  ].sort(),
)

const declarations = await readFile(path.join(packageRoot, 'dist/index.d.mts'), 'utf8')
for (const name of [
  'PicodashProvider',
  'PicodashProviderProps',
  'PicodashDockPosition',
  'DashPanel',
  'DashList',
  'DashGroup',
  'Dashlet',
])
  assert.match(declarations, new RegExp(`\\b${name}\\b`))
for (const retired of [
  'PicodashPanel',
  'PicodashList',
  'PicodashGroup',
  'PicodashItem',
  'Dashlist',
  'DashletGroup',
  'DashPanelProvider',
  'catalog',
])
  assert.doesNotMatch(declarations, new RegExp(`\\b${retired}\\b`))

const uiDeclarations = await readFile(path.join(packageRoot, 'dist/ui.d.mts'), 'utf8')
for (const name of [
  'ButtonProps',
  'PicodashThemeProviderProps',
  'PicodashOverlayProviderProps',
  'ActionMenuProps',
  'AlertDialogProps',
  'TooltipProps',
])
  assert.match(uiDeclarations, new RegExp(`\\b${name}\\b`))

const css = await readFile(path.join(packageRoot, 'style.css'), 'utf8')
assert.equal((css.match(/@import/g) ?? []).length, 3)
assert.match(css, /@picodash\/ui\/style\.css/)
assert.match(css, /@picodash\/dashpanel\/style\.css/)
assert.match(css, /@picodash\/dashlist\/style\.css/)
assert.doesNotMatch(css, /@picodash\/theme/)

const packed = spawnSync('bun', ['pm', 'pack', '--dry-run'], {
  cwd: packageRoot,
  encoding: 'utf8',
})
assert.equal(packed.status, 0, packed.stderr)
assert.doesNotMatch(`${packed.stdout}\n${packed.stderr}`, /dist\/(?:advanced|dashlet|catalog)\./)

console.log('@picodash/picodash package artifact contract passed')
