import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const expectedExports = {
  '.': './dist/index.mjs',
  './integration': './dist/integration.mjs',
  './package.json': './package.json',
  './style.css': './dist/style.css',
}

async function exists(filePath) {
  return access(filePath).then(
    () => true,
    () => false,
  )
}

async function main() {
  const manifest = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8'))
  assert.deepEqual(manifest.exports, expectedExports)
  assert.deepEqual(manifest.dependencies, {
    '@picodash/nexus': 'workspace:*',
    '@picodash/ui': 'workspace:*',
  })
  assert.deepEqual(manifest.peerDependencies, { react: '>=19', 'react-dom': '>=19' })
  for (const file of [
    'dist/index.mjs',
    'dist/index.d.mts',
    'dist/integration.mjs',
    'dist/integration.d.mts',
    'dist/style.css',
  ])
    assert.equal(await exists(path.join(packageRoot, file)), true, `missing ${file}`)

  const runtime = await import(
    `${pathToFileURL(path.join(packageRoot, 'dist/index.mjs')).href}?artifact-check`
  )
  assert.deepEqual(Object.keys(runtime).sort(), [
    'ActionMenu',
    'ActionMenuItem',
    'ActionMenuSeparator',
    'ActionSubmenu',
    'DashHeader',
    'DashPanel',
    'DashPanelActionItems',
    'DashPanelLauncher',
    'DashPanelPlacementSubmenu',
    'DashPanelProvider',
    'DashPanelRequestRemoveItem',
    'DashPanelResetLayoutItem',
    'DashPanelTrigger',
    'useDashPanel',
  ])
  const integration = await import(
    `${pathToFileURL(path.join(packageRoot, 'dist/integration.mjs')).href}?artifact-check`
  )
  assert.deepEqual(Object.keys(integration).sort(), ['DashPanelIntegrationProvider'])
  for (const retired of ['PicodashPanel', 'PicodashProvider', 'Button', 'AlertDialog'])
    assert.equal(retired in runtime, false, `retired export remains: ${retired}`)

  const declarations = await readFile(path.join(packageRoot, 'dist/index.d.mts'), 'utf8')
  for (const name of [
    'DashPanelProvider',
    'DashPanelProviderProps',
    'DashPanel',
    'DashPanelProps',
    'DashPanelTrigger',
    'DashPanelTriggerProps',
    'DashPanelLauncher',
    'DashPanelLauncherItem',
    'DashPanelLauncherProps',
    'DashPanelStyle',
    'DashPanelBoundary',
    'DashPanelBoundaryInset',
    'DashPanelSnapPosition',
    'DashPanelDockPosition',
    'DashPanelPlacement',
    'DashPanelDefaultLayout',
    'DashPanelPlacementOptions',
    'DashPanelPresentation',
    'DashHeader',
    'DashHeaderProps',
    'DashHeaderSlots',
    'ActionMenu',
    'ActionMenuItem',
    'ActionMenuSeparator',
    'ActionSubmenu',
    'ActionMenuConfirmation',
    'ActionMenuItemProps',
    'ActionMenuItemVariant',
    'ActionMenuProps',
    'ActionMenuSeparatorProps',
    'ActionSubmenuProps',
    'DashPanelActionItems',
    'DashPanelPlacementSubmenu',
    'DashPanelRemoveRequest',
    'DashPanelRequestRemoveItem',
    'DashPanelResetLayoutItem',
  ])
    assert.match(declarations, new RegExp(`\\b${name}\\b`))
  const integrationDeclarations = await readFile(
    path.join(packageRoot, 'dist/integration.d.mts'),
    'utf8',
  )
  for (const name of [
    'DashPanelIntegrationProvider',
    'DashPanelIntegrationProviderProps',
    'DashPanelDefaultActionItems',
    'DashPanelDefaultActionItemsProps',
  ])
    assert.match(integrationDeclarations, new RegExp(`\\b${name}\\b`))
  for (const retired of ['PicodashPanel', 'PicodashProvider'])
    assert.doesNotMatch(declarations, new RegExp(`\\b${retired}\\b`))

  const css = await readFile(path.join(packageRoot, 'dist/style.css'), 'utf8')
  assert.match(css, /--picodash-panel-width/)
  assert.match(css, /picodash-dashpanel/)
  assert.match(css, /data-active/)
  assert.doesNotMatch(css, /@picodash\/dashpanel\/src/)
  console.log('@picodash/dashpanel package artifact contract passed')
}

if (import.meta.main) await main()
