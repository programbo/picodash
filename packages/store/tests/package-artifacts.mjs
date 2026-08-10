import assert from 'node:assert/strict'
import { access, mkdtemp, mkdir, writeFile, rm, readdir } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

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
  './web-storage': './dist/web-storage.mjs',
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
  const integrationModule = await import(
    `${pathToFileURL(path.join(packageRoot, 'dist/integration.mjs')).href}?artifact-check-integration`
  )
  assert.deepEqual(Object.keys(integrationModule).sort(), [
    'PicodashStoreEntityBoundary',
    'PicodashStoreProviderBoundary',
    'acquireBindingLease',
    'acquireDashListNodeLease',
    'acquireEntityLease',
    'acquireProviderLease',
    'acquireRelationshipLease',
  ])
  assert.equal('acquireProviderLease' in reactModule, false)
  assert.equal('acquireEntityLease' in reactModule, false)
  const rootModule = await import(
    `${pathToFileURL(path.join(packageRoot, 'dist/index.mjs')).href}?artifact-check-root`
  )
  const webStorageModule = await import(
    `${pathToFileURL(path.join(packageRoot, 'dist/web-storage.mjs')).href}?artifact-check-web-storage`
  )
  assert.deepEqual(Object.keys(webStorageModule), ['createWebStoragePersistenceDriver'])
  const webStorageTypes = await readText(path.join(packageRoot, 'dist/web-storage.d.mts'))
  assert.match(webStorageTypes, /interface PicodashWebStorage/)
  assert.match(webStorageTypes, /type PicodashWebStorageSource/)
  assert.match(webStorageTypes, /createWebStoragePersistenceDriver/)
  const rootDeclaration = (await readdir(path.join(packageRoot, 'dist'))).find((name) =>
    /^index-.*\.d\.mts$/.test(name),
  )
  assert.ok(rootDeclaration)
  const rootTypes = await readText(path.join(packageRoot, 'dist', rootDeclaration))
  assert.match(rootTypes, /destroy\(options\?: DestroyRootOptions\): void/)
  assert.match(rootTypes, /readonly diagnostics: PicodashDiagnostics/)
  assert.match(rootTypes, /PicodashValueAdapter/)
  assert.match(rootTypes, /ExternalOwnedConfig/)
  assert.match(rootTypes, /ExternalOwnedPersistenceConfig/)
  assert.match(rootTypes, /PersistentTransactionResult/)
  assert.match(rootTypes, /InvalidResetOptionsReason/)
  assert.match(rootTypes, /resetRegisteredValues\(options: RootResetRegisteredValuesOptions\)/)
  assert.match(rootTypes, /resetRegisteredValues\(options\?: ResetRegisteredValuesOptions\)/)
  assert.match(
    rootTypes,
    /inspectRegisteredValueReset\(options: RootResetRegisteredValuesOptions\)/,
  )
  assert.match(rootTypes, /inspectRegisteredValueReset\(options\?: ResetRegisteredValuesOptions\)/)
  assert.match(rootTypes, /PicodashPersistenceState/)
  assert.match(rootTypes, /PicodashPersistenceConflictResolutionPlan/)
  assert.match(rootTypes, /PicodashDocument/)
  assert.match(rootTypes, /readonly documents: DocumentNamespace/)
  assert.match(rootTypes, /createExportPlan\(options\?: PicodashRootExportOptions/)
  assert.match(rootTypes, /createExportPlan\(options\?: PicodashScopedExportOptions/)
  assert.match(
    rootTypes,
    /executeExport\(plan: PicodashExportPlan, options\?: PicodashExportExecutionOptions/,
  )
  assert.match(rootTypes, /PicodashPersistenceErasePlan/)
  assert.match(rootTypes, /SerializedDurableScopeMetadata/)
  assert.match(rootTypes, /adapter_initialization_failed/)
  const integrationDeclaration = (await readdir(path.join(packageRoot, 'dist'))).find((name) =>
    /^integration(?:-.*)?\.d\.mts$/.test(name),
  )
  assert.ok(integrationDeclaration)
  const integrationTypes = await readText(path.join(packageRoot, 'dist', integrationDeclaration))
  assert.match(integrationTypes, /allowStandalone\?: never/)
  assert.match(integrationTypes, /allowStandalone\?: boolean/)
  const scopedMarker = rootTypes.includes('interface ScopedStoreBase')
    ? 'interface ScopedStoreBase'
    : 'interface ScopedStore'
  const scopedSection = rootTypes.slice(rootTypes.indexOf(scopedMarker))
  assert.doesNotMatch(scopedSection, /destroy\(options\?: DestroyRootOptions\)/)
  assert.match(scopedSection, /readonly diagnostics: PicodashDiagnostics/)
  assert.deepEqual(Object.keys(rootModule).sort(), [
    'PicodashContractError',
    'PicodashDocumentError',
    'PicodashDocumentOptionsError',
    'PicodashTransactionError',
    'buildPicodashDocumentOverlay',
    'createPicodashStore',
    'decodePicodashDocument',
    'documentFromSchemaMigrationPayload',
    'documentToSchemaMigrationPayload',
    'encodePicodashDocument',
    'migratePicodashDocument',
    'normalizePicodashDocument',
    'normalizePicodashExportExecutionOptions',
    'normalizePicodashExportOptions',
    'normalizePicodashExportPolicy',
    'normalizePicodashFieldMap',
    'normalizePicodashImportOptions',
    'normalizePicodashScopeMap',
    'stripRedactedPicodashDocumentFields',
  ])
  for (const integrationExport of [
    'acquireBindingLease',
    'acquireProviderLease',
    'acquireEntityLease',
    'acquireRelationshipLease',
  ]) {
    assert.equal(integrationExport in rootModule, false)
  }
  assert.deepEqual(Object.keys(reactModule).sort(), [
    'shallowEqual',
    'usePicodashRootSelector',
    'usePicodashRootStore',
    'usePicodashScope',
    'usePicodashScopeSelector',
    'usePicodashStore',
    'usePicodashStoreSelector',
  ])
  for (const retired of [
    'usePicodashStateAdapter',
    'usePicodashReducerAdapter',
    'PicodashReactAdapterOptions',
  ]) {
    assert.equal(retired in reactModule, false, `retired React export remains present: ${retired}`)
  }
  const artifactStore = rootModule.createPicodashStore({
    valueOwner: 'store',
    fields: { value: { defaultValue: 1 } },
  })
  const artifactScoped = artifactStore.scope('artifact')
  assert.equal(typeof artifactStore.diagnostics.getState, 'function')
  assert.equal(typeof artifactScoped.diagnostics.subscribe, 'function')
  artifactStore.destroy()
  assert.throws(() => artifactStore.getState(), /use-after-destroy/)
  assert.throws(() => artifactScoped.getState(), /use-after-destroy/)

  const builtBoundaryStore = rootModule.createPicodashStore({
    valueOwner: 'store',
    fields: { value: { defaultValue: 1 } },
  })
  function BuiltContextProbe() {
    return createElement(
      'output',
      null,
      reactModule.usePicodashRootStore() === builtBoundaryStore ? 'same-root' : 'different-root',
    )
  }
  const builtContextMarkup = renderToStaticMarkup(
    createElement(integrationModule.PicodashStoreProviderBoundary, {
      store: builtBoundaryStore,
      children: createElement(BuiltContextProbe),
    }),
  )
  assert.equal(builtContextMarkup, '<output>same-root</output>')
  builtBoundaryStore.destroy()

  const builtStandaloneStore = rootModule.createPicodashStore({
    valueOwner: 'store',
    fields: { value: { defaultValue: 1 } },
  })
  function BuiltStandaloneProbe() {
    return createElement('output', null, reactModule.usePicodashScope().scopeId)
  }
  const builtStandaloneMarkup = renderToStaticMarkup(
    createElement(integrationModule.PicodashStoreEntityBoundary, {
      store: builtStandaloneStore.scope('artifact-standalone'),
      kind: 'dashList',
      allowStandalone: true,
      children: createElement(BuiltStandaloneProbe),
    }),
  )
  assert.equal(builtStandaloneMarkup, '<output>artifact-standalone</output>')
  builtStandaloneStore.destroy()

  let externalValue = 1
  let releaseCalls = 0
  const externalListeners = new Set()
  const externalAdapter = {
    getSnapshot() {
      return { value: externalValue }
    },
    subscribe(listener) {
      externalListeners.add(listener)
      return () => {
        releaseCalls += 1
        externalListeners.delete(listener)
      }
    },
    setValues(values) {
      externalValue = values.value
      for (const listener of externalListeners) listener()
    },
  }
  const externalStore = rootModule.createPicodashStore({
    valueOwner: 'external',
    fields: { value: { defaultValue: 1 } },
    adapter: externalAdapter,
  })
  assert.equal(externalStore.setValues({ value: 2 }).ok, true)
  assert.equal(externalStore.getState().values.value, 2)
  externalStore.destroy()
  assert.equal(releaseCalls, 1)

  const webValues = new Map()
  const webDriver = webStorageModule.createWebStoragePersistenceDriver({
    getItem: (key) => webValues.get(key) ?? null,
    setItem: (key, value) => webValues.set(key, value),
    removeItem: (key) => webValues.delete(key),
  })
  assert.equal(webDriver.read('state'), null)
  webDriver.write('state', 'opaque')
  assert.equal(webDriver.read('state'), 'opaque')

  const persistentValues = new Map()
  const persistentListeners = new Set()
  let removeCalls = 0
  const persistentDriver = {
    identity: {},
    read(key) {
      return persistentValues.get(key) ?? null
    },
    write(key, payload) {
      persistentValues.set(key, payload)
      for (const listener of persistentListeners) listener()
    },
    remove() {
      removeCalls += 1
    },
    subscribe(_key, listener) {
      persistentListeners.add(listener)
      return () => persistentListeners.delete(listener)
    },
  }
  const persistentStore = rootModule.createPicodashStore({
    valueOwner: 'store',
    storeId: 'artifact-persistence',
    schemaVersion: 1,
    fields: { value: { defaultValue: 1 } },
    persistence: {
      storageKey: 'state',
      driver: persistentDriver,
      values: { defaultFieldPolicy: 'include' },
    },
  })
  assert.equal(persistentStore.setValues({ value: 2 }).persistence, 'saved')
  assert.equal(persistentStore.persistence.getState().status, 'clean')
  persistentStore.destroy()
  assert.equal(removeCalls, 0)

  let externalPersistentValue = 1
  const externalPersistentListeners = new Set()
  const externalPersistentStore = rootModule.createPicodashStore({
    valueOwner: 'external',
    storeId: 'artifact-external-persistence',
    schemaVersion: 1,
    fields: { value: { defaultValue: 1 } },
    adapter: {
      getSnapshot: () => ({ value: externalPersistentValue }),
      subscribe(listener) {
        externalPersistentListeners.add(listener)
        return () => externalPersistentListeners.delete(listener)
      },
      setValues(values) {
        externalPersistentValue = values.value
        for (const listener of externalPersistentListeners) listener()
      },
    },
    persistence: {
      storageKey: 'external-state',
      driver: persistentDriver,
    },
  })
  assert.equal(externalPersistentStore.setValues({ value: 2 }).persistence, 'unchanged')
  assert.equal(
    externalPersistentStore.setDashListRootOrder('artifact', ['item']).persistence,
    'saved',
  )
  const externalPersistentEnvelope = JSON.parse(persistentValues.get('external-state'))
  assert.equal(externalPersistentEnvelope.valueOwner, 'external')
  assert.equal(Object.hasOwn(externalPersistentEnvelope, 'values'), false)
  externalPersistentStore.destroy()

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
