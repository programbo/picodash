import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const expectedExports = {
  '.': './dist/index.mjs',
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
  assert.deepEqual(manifest.files, ['dist'])
  assert.deepEqual(manifest.sideEffects, ['**/*.css'])
  assert.deepEqual(manifest.peerDependencies, { react: '>=19', 'react-dom': '>=19' })
  assert.deepEqual(manifest.dependencies, {
    'react-aria': 'catalog:',
    'react-aria-components': 'catalog:',
  })

  for (const file of ['dist/index.mjs', 'dist/index.d.mts', 'dist/style.css']) {
    assert.equal(await exists(path.join(packageRoot, file)), true, `missing ${file}`)
  }

  const runtime = await import(
    `${pathToFileURL(path.join(packageRoot, 'dist/index.mjs')).href}?artifact-check`
  )
  assert.deepEqual(Object.keys(runtime).sort(), [
    'Button',
    'PicodashOverlayProvider',
    'PicodashThemeProvider',
    'usePicodashDensity',
    'usePicodashOverlayDefaults',
    'usePicodashTheme',
  ])

  const declarations = await readFile(path.join(packageRoot, 'dist/index.d.mts'), 'utf8')
  for (const name of [
    'PicodashTheme',
    'PicodashThemeOption',
    'PicodashResolvedTheme',
    'PicodashDensity',
    'PicodashThemeProviderProps',
    'PicodashOverlayProviderProps',
    'PicodashOverlayDefaults',
    'ButtonProps',
    'ButtonVariant',
    'ButtonSize',
  ]) {
    assert.match(declarations, new RegExp(`\\b${name}\\b`))
  }
  for (const retired of [
    'PicodashThemeContextProvider',
    'resolvePicodashTheme',
    'readPicodashSystemTheme',
    'PicodashThemeProviderPropsWithPortal',
  ]) {
    assert.doesNotMatch(declarations, new RegExp(`\\b${retired}\\b`))
  }
}

if (import.meta.main) {
  await main()
  console.log('@picodash/ui package artifact contract passed')
}
