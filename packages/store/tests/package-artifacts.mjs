import assert from 'node:assert/strict'
import { access, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  readJson,
  readText,
  resolveRelativeImport,
  runtimeImports,
} from './fixtures/package-artifacts.mjs'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const expectedExports = {
  '.': './dist/index.mjs',
  './react': './dist/react.mjs',
  './integration': './dist/integration.mjs',
  './package.json': './package.json',
}

async function exists(filePath) {
  return access(filePath).then(
    () => true,
    () => false,
  )
}

export async function checkStorePackage(root = packageRoot) {
  const errors = []
  const manifest = await readJson(path.join(root, 'package.json'))
  if (manifest.description !== 'Typed state foundation for configurable React interfaces.') {
    errors.push('description does not match Store package positioning')
  }
  if (
    JSON.stringify(
      Object.fromEntries(
        Object.entries(manifest.exports ?? {}).sort(([a], [b]) => a.localeCompare(b)),
      ),
    ) !==
    JSON.stringify(
      Object.fromEntries(Object.entries(expectedExports).sort(([a], [b]) => a.localeCompare(b))),
    )
  ) {
    errors.push(`exports drifted: ${JSON.stringify(manifest.exports)}`)
  }
  if (manifest.peerDependenciesMeta?.react?.optional !== true) {
    errors.push('react peer dependency must be optional')
  }
  if (manifest.peerDependencies?.react !== '>=19') {
    errors.push('react peer dependency must declare the accepted >=19 range')
  }
  for (const target of Object.values(expectedExports)) {
    if (target.startsWith('./dist/') && !(await exists(path.join(root, target)))) {
      errors.push(`missing dist entry: ${target}`)
    }
  }

  const entry = path.join(root, 'dist/index.mjs')
  const visited = new Set()
  const queue = [entry]
  while (queue.length) {
    const importer = queue.pop()
    if (visited.has(importer)) continue
    visited.add(importer)
    if (!(await exists(importer))) {
      errors.push(`unresolved runtime entry: ${path.relative(root, importer)}`)
      continue
    }
    const source = await readText(importer)
    for (const specifier of runtimeImports(source)) {
      if (
        /^(?:react|react-dom)(?:\/|$)/.test(specifier) ||
        specifier === 'zustand' ||
        (specifier.startsWith('zustand/') && !/^zustand\/vanilla(?:\/|$)/.test(specifier))
      ) {
        errors.push(`React-facing runtime import reachable from index: ${specifier}`)
      }
      const relative = resolveRelativeImport(importer, specifier)
      if (relative) queue.push(relative)
    }
  }
  return errors
}

if (import.meta.main) {
  const errors = await checkStorePackage()
  assert.deepEqual(
    errors,
    [],
    `Store package artifact validation failed:\n- ${errors.join('\n- ')}`,
  )

  const reactModule = await import(
    `${pathToFileURL(path.join(packageRoot, 'dist/react.mjs')).href}?artifact-check`
  )
  assert.deepEqual(Object.keys(reactModule).sort(), ['shallowEqual', 'usePicodashStoreSelector'])
  for (const retired of [
    'usePicodashStateAdapter',
    'usePicodashReducerAdapter',
    'PicodashReactAdapterOptions',
  ]) {
    assert.equal(retired in reactModule, false, `retired React export remains present: ${retired}`)
  }

  // Exercise the negative boundary with a temporary reachable React import.
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'picodash-store-artifact-'))
  try {
    await mkdir(path.join(temporaryRoot, 'dist'), { recursive: true })
    await writeFile(
      path.join(temporaryRoot, 'package.json'),
      JSON.stringify({
        description: 'Typed state foundation for configurable React interfaces.',
        exports: expectedExports,
        peerDependencies: { react: '>=19' },
        peerDependenciesMeta: { react: { optional: true } },
      }),
    )
    await writeFile(path.join(temporaryRoot, 'dist/index.mjs'), "import './reachable.mjs'\n")
    await writeFile(
      path.join(temporaryRoot, 'dist/reachable.mjs'),
      "import 'zustand/vanilla-react'\n",
    )
    const negativeErrors = await checkStorePackage(temporaryRoot)
    assert.ok(negativeErrors.some((error) => error.includes('zustand/vanilla-react')))
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true })
  }

  console.log(
    'Store package artifacts are valid; reachable React-facing import rejection is covered.',
  )
}
