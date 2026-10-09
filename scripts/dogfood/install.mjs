// Standalone: this file travels with the bundle and uses only Node built-ins.
import { createHash } from 'node:crypto'
import { cp, mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const names = ['nexus', 'ui', 'dashpanel', 'dashstack', 'picodash'].map(
  (name) => `@picodash/${name}`,
)
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

export async function readSnapshot(bundle) {
  const manifest = JSON.parse(await readFile(join(bundle, 'snapshot.json'), 'utf8'))
  if (
    !object(manifest) ||
    manifest.schemaVersion !== 1 ||
    typeof manifest.version !== 'string' ||
    typeof manifest.sourceCommit !== 'string' ||
    !/^0\.\d+\.\d+-dogfood\.[1-9]\d*$/.test(manifest.version) ||
    !/^[a-f0-9]{40}$/.test(manifest.sourceCommit) ||
    typeof manifest.dirty !== 'boolean' ||
    !Array.isArray(manifest.packages) ||
    manifest.packages.length !== names.length
  )
    throw new Error('Invalid snapshot manifest')
  const seen = new Set()
  for (const pkg of manifest.packages) {
    if (
      !object(pkg) ||
      !names.includes(pkg.name) ||
      seen.has(pkg.name) ||
      pkg.file !== `${pkg.name.replace('@', '').replace('/', '-')}-${manifest.version}.tgz` ||
      !/^[a-f0-9]{64}$/.test(pkg.sha256)
    )
      throw new Error('Invalid snapshot package')
    seen.add(pkg.name)
    if (hash(await readFile(join(bundle, pkg.file))) !== pkg.sha256)
      throw new Error(`Checksum mismatch: ${pkg.name}`)
  }
  return manifest
}

export function consumerManifest(source, snapshot) {
  if (!object(source) || source.workspaces)
    throw new Error(
      'Target must be a standalone project package.json; workspace installation is not supported yet.',
    )
  for (const key of ['dependencies', 'devDependencies', 'optionalDependencies', 'overrides']) {
    if (source[key] !== undefined && !object(source[key])) throw new Error(`Invalid ${key}`)
  }
  if (!source.dependencies?.react || !source.dependencies?.['react-dom'])
    throw new Error(
      'Install React 19+ and React DOM 19+ as dependencies in the target project first.',
    )
  const result = structuredClone(source)
  result.dependencies ??= {}
  result.overrides ??= {}
  for (const pkg of snapshot.packages) {
    const path = `file:./vendor/picodash/${snapshot.version}/${pkg.file}`
    result.dependencies[pkg.name] = path
    result.overrides[pkg.name] = path
    if (result.devDependencies) delete result.devDependencies[pkg.name]
    if (result.optionalDependencies) delete result.optionalDependencies[pkg.name]
  }
  return result
}

async function main() {
  const [target, ...extra] = process.argv.slice(2)
  if (!target || extra.length)
    throw new Error('Usage: bun /path/to/bundle/install.mjs /path/to/consumer')
  const bundle = dirname(fileURLToPath(import.meta.url))
  const snapshot = await readSnapshot(bundle)
  const consumer = resolve(target)
  // Bun can otherwise discover an enclosing workspace and modify its lockfile.
  for (let parent = dirname(consumer); parent !== dirname(parent); parent = dirname(parent)) {
    try {
      const ancestor = JSON.parse(await readFile(join(parent, 'package.json'), 'utf8'))
      if (ancestor.workspaces)
        throw new Error(
          'Target is inside a workspace; use a standalone consumer project for this installer.',
        )
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
  }
  const manifestPath = join(consumer, 'package.json')
  const source = JSON.parse(await readFile(manifestPath, 'utf8'))
  const next = consumerManifest(source, snapshot)
  const vendor = join(consumer, 'vendor/picodash', snapshot.version)
  // Refuse silently replacing a previously installed version with different bytes.
  try {
    const existing = JSON.parse(await readFile(join(vendor, 'snapshot.json'), 'utf8'))
    if (JSON.stringify(existing) !== JSON.stringify(snapshot))
      throw new Error(
        'This version already exists with different provenance; create a new snapshot version.',
      )
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  await mkdir(vendor, { recursive: true })
  const sameDirectory = (await realpath(bundle)) === (await realpath(vendor))
  for (const pkg of snapshot.packages)
    if (!sameDirectory) await cp(join(bundle, pkg.file), join(vendor, pkg.file))
  if (!sameDirectory) {
    const guides = (await readdir(bundle, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
      .map((entry) => entry.name)
    for (const file of ['snapshot.json', 'install.mjs', ...guides, 'example'])
      await cp(join(bundle, file), join(vendor, file), { recursive: true })
  }
  await writeFile(manifestPath, JSON.stringify(next, null, 2) + '\n')
  const installed = spawnSync('bun', ['install'], { cwd: consumer, stdio: 'inherit' })
  if (installed.status !== 0)
    throw new Error(
      'Bun install failed. package.json and vendor files are retained for inspection. Fix the install error and rerun, or follow GUIDE.md to roll back.',
    )
  process.stdout.write(
    `Installed Picodash ${snapshot.version} from ${snapshot.sourceCommit}${snapshot.dirty ? ' (dirty trial)' : ''}\nCommit package.json, bun.lock, and vendor/picodash to reproduce this install.\n`,
  )
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
