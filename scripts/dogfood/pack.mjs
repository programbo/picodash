import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export const names = ['nexus', 'ui', 'dashpanel', 'dashstack', 'picodash']
export const validVersion = (version) => /^0\.\d+\.\d+-dogfood\.[1-9]\d*$/.test(version)
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

export function distributionManifest(source, version, catalog) {
  const manifest = { ...source, version }
  delete manifest.scripts
  delete manifest.devDependencies
  for (const section of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
    if (!manifest[section]) continue
    manifest[section] = Object.fromEntries(
      Object.entries(manifest[section]).map(([name, spec]) => {
        if (spec.startsWith('workspace:')) {
          if (!names.some((part) => name === `@picodash/${part}`))
            throw new Error(`Unshipped dependency: ${name}`)
          return [name, version]
        }
        if (spec === 'catalog:') {
          if (!catalog[name]) throw new Error(`Missing catalog dependency: ${name}`)
          return [name, catalog[name]]
        }
        if (/^(catalog:|file:|link:)/.test(spec)) throw new Error(`Nonportable dependency: ${name}`)
        return [name, spec]
      }),
    )
  }
  return manifest
}

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' })
  if (result.status !== 0)
    throw new Error(result.error?.message ?? result.stderr ?? `${command} failed`)
  return result.stdout.trim()
}

async function main() {
  const [version, flag, ...extra] = process.argv.slice(2)
  if (!validVersion(version) || extra.length || (flag && flag !== '--allow-dirty')) {
    throw new Error('Usage: bun run dogfood:pack 0.1.0-dogfood.1 [--allow-dirty]')
  }
  const dirty = Boolean(run('git', ['status', '--porcelain']))
  if (dirty && flag !== '--allow-dirty')
    throw new Error(
      'Commit source changes first, or explicitly use --allow-dirty for a trial bundle.',
    )
  const sourceCommit = run('git', ['rev-parse', 'HEAD'])
  const catalog = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).workspaces.catalog
  const output = join(root, 'output/dogfood', version)
  await mkdir(dirname(output), { recursive: true })
  await mkdir(output) // Never overwrite a version.
  const staging = await mkdtemp(join(tmpdir(), 'picodash-pack-'))
  try {
    const packages = []
    for (const name of names) {
      const sourceDir = join(root, 'packages', name)
      const source = JSON.parse(await readFile(join(sourceDir, 'package.json'), 'utf8'))
      const destination = join(staging, name)
      await mkdir(destination)
      for (const path of source.files)
        await cp(join(sourceDir, path), join(destination, path), { recursive: true })
      for (const optional of ['README.md', 'THIRD_PARTY_NOTICES.md']) {
        try {
          await cp(join(sourceDir, optional), join(destination, optional))
        } catch (error) {
          if (error.code !== 'ENOENT') throw error
        }
      }
      await cp(join(root, 'LICENSE'), join(destination, 'LICENSE'))
      await writeFile(
        join(destination, 'package.json'),
        JSON.stringify(distributionManifest(source, version, catalog), null, 2) + '\n',
      )
      const file = `picodash-${name}-${version}.tgz`
      run('bun', ['pm', 'pack', '--ignore-scripts', '--filename', join(output, file)], destination)
      packages.push({ name: source.name, file, sha256: sha256(await readFile(join(output, file))) })
    }
    await cp(join(root, 'scripts/dogfood/install.mjs'), join(output, 'install.mjs'))
    await cp(join(root, 'docs/development/dogfooding.md'), join(output, 'GUIDE.md'))
    await cp(
      join(root, 'docs/development/consumer-recipes.md'),
      join(output, 'consumer-recipes.md'),
    )
    await cp(join(root, 'docs/development/numeric-targets.md'), join(output, 'numeric-targets.md'))
    await writeFile(
      join(output, 'linked-controls.md'),
      (await readFile(join(root, 'docs/development/linked-controls.md'), 'utf8')).replace(
        '(dogfooding.md)',
        '(GUIDE.md)',
      ),
    )
    await cp(
      join(root, 'docs/development/open-ended-ranges.md'),
      join(output, 'open-ended-ranges.md'),
    )
    await mkdir(join(output, 'example'))
    for (const file of [
      'Controls.tsx',
      'Designer.tsx',
      'designer-model.ts',
      'NumericTarget.tsx',
      'OpenCountRange.tsx',
      'Emphasis.tsx',
      'LinkedControls.tsx',
      'Detachable.tsx',
      'GroupedControls.tsx',
      'SubgroupPriorities.tsx',
    ]) {
      await cp(join(root, 'packages/picodash/tests/dogfood', file), join(output, 'example', file))
    }
    await writeFile(
      join(output, 'snapshot.json'),
      JSON.stringify(
        {
          schemaVersion: 1,
          version,
          sourceCommit,
          dirty,
          createdAt: new Date().toISOString(),
          packages,
        },
        null,
        2,
      ) + '\n',
    )
    process.stdout.write(
      `Snapshot: ${output}\nSource: ${sourceCommit}${dirty ? ' (dirty trial)' : ''}\n`,
    )
  } catch (error) {
    await rm(output, { recursive: true, force: true })
    throw error
  } finally {
    await rm(staging, { recursive: true, force: true })
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
