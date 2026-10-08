import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { consumerManifest, readSnapshot } from './install.mjs'
import { distributionManifest, names, sha256, validVersion } from './pack.mjs'

const snapshot = (version = '0.1.0-dogfood.1') => ({
  schemaVersion: 1,
  version,
  sourceCommit: 'a'.repeat(40),
  dirty: false,
  packages: names.map((name) => ({
    name: `@picodash/${name}`,
    file: `picodash-${name}-${version}.tgz`,
    sha256: sha256(name),
  })),
})

test('distribution resolves local dependencies without leaking workspace build tools', () => {
  const result = distributionManifest(
    {
      name: '@picodash/dashstack',
      scripts: { prepare: 'vp config' },
      devDependencies: { vite: 'catalog:' },
      dependencies: { '@picodash/nexus': 'workspace:*', motion: 'catalog:' },
      peerDependencies: { react: '>=19' },
    },
    '0.1.0-dogfood.1',
    { motion: '^13.2.0' },
  )
  assert.deepEqual(result.dependencies, { '@picodash/nexus': '0.1.0-dogfood.1', motion: '^13.2.0' })
  assert.equal(result.scripts, undefined)
  assert.equal(result.devDependencies, undefined)
  assert.throws(
    () => distributionManifest({ dependencies: { private: 'workspace:*' } }, '0.1.0-dogfood.1', {}),
    /Unshipped/,
  )
  assert.throws(
    () => distributionManifest({ dependencies: { missing: 'catalog:' } }, '0.1.0-dogfood.1', {}),
    /Missing/,
  )
})

test('install, update, rollback preserve unrelated application configuration', () => {
  const original = {
    dependencies: { react: '^19', 'react-dom': '^19', other: '1' },
    devDependencies: { '@picodash/nexus': 'link:old', tool: '2' },
    overrides: { other: '1.2.3' },
    scripts: { build: 'vite build' },
  }
  const first = consumerManifest(original, snapshot())
  const second = consumerManifest(first, snapshot('0.1.0-dogfood.2'))
  assert.match(second.overrides['@picodash/nexus'], /dogfood\.2/)
  assert.deepEqual(consumerManifest(second, snapshot()), first)
  assert.deepEqual(consumerManifest(first, snapshot()), first)
  assert.deepEqual(first.scripts, original.scripts)
  assert.equal(first.overrides.other, '1.2.3')
  assert.equal(first.dependencies.other, '1')
  assert.equal(first.devDependencies.tool, '2')
  assert.equal(first.devDependencies['@picodash/nexus'], undefined)
  assert.equal(original.devDependencies['@picodash/nexus'], 'link:old')
  assert.throws(
    () => consumerManifest({ ...original, workspaces: ['apps/*'] }, snapshot()),
    /standalone/,
  )
  assert.throws(() => consumerManifest({}, snapshot()), /React/)
})

test('snapshot validates all hashes and rejects unsafe paths before consumer writes', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'picodash-manifest-'))
  const manifest = snapshot()
  const save = () => writeFile(join(dir, 'snapshot.json'), JSON.stringify(manifest))
  try {
    for (const [i, pkg] of manifest.packages.entries())
      await writeFile(join(dir, pkg.file), names[i])
    await save()
    assert.deepEqual(await readSnapshot(dir), manifest)
    await writeFile(join(dir, manifest.packages[0].file), 'corrupt')
    await assert.rejects(readSnapshot(dir), /Checksum/)
    manifest.packages[0].file = '../outside.tgz'
    await save()
    await assert.rejects(readSnapshot(dir), /Invalid snapshot package/)
    assert.equal(await readFile(join(dir, 'snapshot.json'), 'utf8'), JSON.stringify(manifest))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('versions are immutable prerelease directory names', () => {
  assert.equal(validVersion('0.1.0-dogfood.1'), true)
  for (const version of ['../unsafe', '1.0.0', '0.1.0-dogfood.0', undefined])
    assert.equal(validVersion(version), false)
})
