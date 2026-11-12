import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cp, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
if (args.length > 1) throw new Error('Usage: bun run package:local:verify [bundle-directory]')
const latest = args[0]
  ? null
  : JSON.parse(
      await readFile(path.join(homedir(), '.local/share/picodash/packages/latest.json'), 'utf8'),
    )
const bundle = path.resolve(args[0] ?? latest.directory)
const manifest = JSON.parse(await readFile(path.join(bundle, 'manifest.json'), 'utf8'))
const workspace = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
const fixture = await mkdtemp(path.join(tmpdir(), 'picodash-consumer-'))
const dependencies = {
  react: workspace.workspaces.catalog.react,
  'react-dom': workspace.workspaces.catalog['react-dom'],
}
for (const pkg of manifest.packages) {
  const archive = path.join(bundle, pkg.file)
  assert.equal(
    createHash('sha256')
      .update(await readFile(archive))
      .digest('hex'),
    pkg.sha256,
  )
  dependencies[pkg.name] = `file:${archive}`
}
await cp(path.join(root, 'packages/picodash/tests/local-consumer'), fixture, { recursive: true })
await writeFile(
  path.join(fixture, 'package.json'),
  JSON.stringify(
    {
      name: 'picodash-local-consumer-proof',
      private: true,
      type: 'module',
      dependencies,
      devDependencies: {
        typescript: workspace.workspaces.catalog.typescript,
        '@types/react': workspace.workspaces.catalog['@types/react'],
        '@types/react-dom': workspace.workspaces.catalog['@types/react-dom'],
        '@types/node': workspace.workspaces.catalog['@types/node'],
        jsdom: workspace.workspaces.catalog.jsdom,
      },
    },
    null,
    2,
  ),
)
await writeFile(path.join(fixture, 'bunfig.toml'), '[install]\nglobalStore = false\n')
await writeFile(
  path.join(fixture, 'tsconfig.json'),
  JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'Bundler',
        jsx: 'react-jsx',
        strict: true,
        skipLibCheck: true,
        noEmit: true,
        allowImportingTsExtensions: true,
      },
      include: ['app.tsx', 'entry.tsx', 'styles.d.ts'],
    },
    null,
    2,
  ),
)
const run = (args) => execFileSync('bun', args, { cwd: fixture, stdio: 'inherit' })
execFileSync('node', [path.join(bundle, 'install.mjs'), fixture], {
  cwd: fixture,
  stdio: 'inherit',
})
run(['run', 'tsc', '--noEmit'])
run(['build', './entry.tsx', '--outdir', './dist', '--target', 'browser'])
run(['run', './smoke.mjs'])
const verification = {
  revision: manifest.revision,
  fixture,
  verifiedAt: new Date().toISOString(),
  checks: [
    'archive checksums',
    'isolated installation',
    'public TypeScript imports',
    'browser JS/CSS bundle',
    'standalone and integrated React mount',
  ],
}
await writeFile(
  path.join(bundle, 'verification.json'),
  `${JSON.stringify(verification, null, 2)}\n`,
)
console.log(`\nVerified ${bundle}\nConsumer evidence: ${fixture}`)
