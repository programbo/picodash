import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
if (args.length !== 0 && (args.length !== 2 || args[0] !== '--output'))
  throw new Error('Usage: bun run package:local [--output <parent-directory>]')
const revision = execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], {
  cwd: root,
  encoding: 'utf8',
}).trim()
const dirty =
  execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim() !== ''
const stamp = new Date().toISOString().replaceAll(/[:.]/g, '-')
const parent = args[1]
  ? path.resolve(args[1])
  : path.join(homedir(), '.local/share/picodash/packages')
const destination = path.join(parent, `${stamp}-${revision}${dirty ? '-dirty' : ''}`)
await mkdir(destination, { recursive: true })
const packages = []
const run = (command, commandArgs, cwd = root) =>
  execFileSync(command, commandArgs, { cwd, stdio: 'inherit' })
const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`

for (const name of ['nexus', 'ui', 'dashpanel', 'dashstack', 'picodash']) {
  const cwd = path.join(root, 'packages', name)
  const source = JSON.parse(await readFile(path.join(cwd, 'package.json'), 'utf8'))
  run('bun', ['run', '--filter', source.name, 'build'])
  run('bun', ['run', '--filter', source.name, 'test:package'])
  const file = `picodash-${name}-${source.version}.tgz`
  run('bun', ['pm', 'pack', '--ignore-scripts', '--filename', path.join(destination, file)], cwd)
  const archive = path.join(destination, file)
  const packed = JSON.parse(
    execFileSync('tar', ['-xOf', archive, 'package/package.json'], { encoding: 'utf8' }),
  )
  assert.equal(packed.name, source.name)
  assert.equal(packed.version, source.version)
  for (const section of [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ]) {
    for (const value of Object.values(packed[section] ?? {}))
      assert.ok(!/^(?:workspace|catalog):/.test(value), `${source.name} retains ${value}`)
  }
  const files = new Set(
    execFileSync('tar', ['-tf', archive], { encoding: 'utf8' }).trim().split('\n'),
  )
  for (const target of Object.values(packed.exports)) {
    assert.equal(typeof target, 'string', 'Expected a documented flat export map')
    assert.ok(files.has(`package/${target.slice(2)}`), `${source.name} is missing ${target}`)
  }
  packages.push({
    name: source.name,
    version: source.version,
    file,
    sha256: createHash('sha256')
      .update(await readFile(archive))
      .digest('hex'),
  })
}
const manifest = { revision, dirty, createdAt: new Date().toISOString(), packages }
await writeFile(path.join(destination, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
await copyFile(
  path.join(root, 'scripts/install-local-bundle.mjs'),
  path.join(destination, 'install.mjs'),
)
const install = `node ${quote(path.join(destination, 'install.mjs'))} /path/to/app`
await writeFile(
  path.join(destination, 'README.md'),
  `# Local Picodash packages\n\nBuilt from ${revision}${dirty ? ' with working-tree changes' : ''}. Install this bundle into an existing React app. The installer adds dependencies and matching overrides so transitive packages resolve from these archives:\n\n\`\`\`sh\n${install}\n\`\`\`\n\nUse React 19 or later. Import \`@picodash/dashpanel/style.css\` for standalone Panels, or \`@picodash/picodash/style.css\` for the integrated composition. Import \`@picodash/dashpanel/resize-handles.css\` after the main stylesheet for the optional handle recipes.\n`,
)
await writeFile(
  path.join(parent, 'latest.json'),
  `${JSON.stringify({ directory: destination, ...manifest }, null, 2)}\n`,
)
console.log(`\nLocal packages: ${destination}\n\n${install}`)
