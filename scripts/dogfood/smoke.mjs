import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { readSnapshot } from './install.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const bundle = resolve(process.argv[2] ?? '')
if (!process.argv[2]) throw new Error('Usage: bun run dogfood:check /path/to/bundle')
const snapshot = await readSnapshot(bundle)
const alternative = process.argv[3] ? resolve(process.argv[3]) : undefined
const alternativeSnapshot = alternative ? await readSnapshot(alternative) : undefined
const catalog = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).workspaces.catalog
const consumer = await mkdtemp(join(tmpdir(), 'picodash-consumer-'))
function run(command, args) {
  const result = spawnSync(command, args, { cwd: consumer, stdio: 'inherit' })
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed`)
}
try {
  await writeFile(
    join(consumer, 'package.json'),
    JSON.stringify(
      {
        name: 'picodash-consumer-smoke',
        private: true,
        type: 'module',
        dependencies: { react: catalog.react, 'react-dom': catalog['react-dom'] },
        devDependencies: {
          'vite-plus': catalog['vite-plus'],
          typescript: catalog.typescript,
          '@types/react': catalog['@types/react'],
          '@types/react-dom': catalog['@types/react-dom'],
          jsdom: catalog.jsdom,
          '@testing-library/react': catalog['@testing-library/react'],
          '@types/node': catalog['@types/node'],
        },
      },
      null,
      2,
    ),
  )
  await writeFile(join(consumer, 'bunfig.toml'), '[install]\nglobalStore = false\n')
  run('bun', [join(bundle, 'install.mjs'), consumer])
  // Repeating installation must remain usable; no absolute paths back into this checkout.
  run('bun', [join(bundle, 'install.mjs'), consumer])
  if (alternative) {
    run('bun', [join(alternative, 'install.mjs'), consumer])
    for (const pkg of alternativeSnapshot.packages) {
      const installed = JSON.parse(
        await readFile(join(consumer, 'node_modules', pkg.name, 'package.json'), 'utf8'),
      )
      assert.equal(installed.version, alternativeSnapshot.version)
    }
    run('bun', [join(consumer, 'vendor/picodash', snapshot.version, 'install.mjs'), consumer])
  }
  // Assert the delivered guides and examples, not merely the source checkout's fixtures.
  const vendor = join(consumer, 'vendor/picodash', snapshot.version)
  for (const entry of await readdir(bundle, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.md'))
      assert.deepEqual(
        await readFile(join(vendor, entry.name)),
        await readFile(join(bundle, entry.name)),
      )
  }
  for (const name of await readdir(join(bundle, 'example')))
    assert.deepEqual(
      await readFile(join(vendor, 'example', name)),
      await readFile(join(bundle, 'example', name)),
    )
  await rm(join(consumer, 'node_modules'), { recursive: true, force: true })
  run('bun', ['install', '--frozen-lockfile'])
  for (const pkg of snapshot.packages) {
    const path = join(consumer, 'node_modules', pkg.name, 'package.json')
    assert.ok((await realpath(path)).startsWith(await realpath(consumer)))
    const installed = JSON.parse(await readFile(path, 'utf8'))
    assert.equal(installed.version, snapshot.version)
    assert.doesNotMatch(JSON.stringify(installed), /workspace:|catalog:/)
    assert.equal(installed.scripts, undefined)
  }
  await cp(join(root, 'packages/picodash/tests/dogfood'), consumer, { recursive: true })
  await cp(join(vendor, 'example'), consumer, { recursive: true })
  await cp(join(root, 'test/setup.ts'), join(consumer, 'setup.ts'))
  await writeFile(
    join(consumer, 'vite.config.mjs'),
    "import { defineConfig } from 'vite-plus'; export default defineConfig({test:{setupFiles:['./setup.ts']}})\n",
  )
  await writeFile(
    join(consumer, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'Bundler',
        jsx: 'react-jsx',
        strict: true,
        skipLibCheck: true,
        noEmit: true,
        types: ['vite-plus/client'],
      },
      include: [
        'Controls.tsx',
        'main.tsx',
        'Designer.tsx',
        'designer-model.ts',
        'NumericTarget.tsx',
        'OpenCountRange.tsx',
        'Emphasis.tsx',
        'LinkedControls.tsx',
        'Detachable.tsx',
        'GroupedControls.tsx',
        'SubgroupPriorities.tsx',
      ],
    }),
  )
  await writeFile(
    join(consumer, 'main.tsx'),
    "import { createRoot } from 'react-dom/client'; import { Controls, createSettings } from './Controls'; import '@picodash/picodash/style.css'; const container = document.getElementById('root'); if (container) createRoot(container).render(<Controls nexus={createSettings()} />);\n",
  )
  await writeFile(
    join(consumer, 'index.html'),
    '<!doctype html><html><head><title>Picodash package check</title></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>',
  )
  run('bun', ['x', '--no-install', 'tsc', '--noEmit'])
  run('bun', ['x', '--no-install', 'vp', 'test'])
  run('bun', ['x', '--no-install', 'vp', 'build'])
  const assets = await readdir(join(consumer, 'dist/assets'))
  const styles = await Promise.all(
    assets
      .filter((file) => file.endsWith('.css'))
      .map((file) => readFile(join(consumer, 'dist/assets', file), 'utf8')),
  )
  assert.match(styles.join('\n'), /picodash-dashstack/)
  assert.match(styles.join('\n'), /picodash-panel/)
  // The same public component must also survive a Next client/server build boundary.
  const nextVersion = JSON.parse(await readFile(join(root, 'apps/web/package.json'), 'utf8'))
    .dependencies.next
  run('bun', ['add', `next@${nextVersion}`])
  await mkdir(join(consumer, 'app'))
  await writeFile(
    join(consumer, 'app/layout.tsx'),
    "import '@picodash/picodash/style.css'; import type { ReactNode } from 'react'; export default function Layout({children}: {children: ReactNode}) { return <html lang='en'><body>{children}</body></html> }\n",
  )
  await writeFile(
    join(consumer, 'app/page.tsx'),
    "'use client'; import { useState } from 'react'; import { Controls, createSettings } from '../Controls'; export default function Page() { const [nexus] = useState(createSettings); return <Controls nexus={nexus} /> }\n",
  )
  await writeFile(
    join(consumer, 'next.config.mjs'),
    'export default { turbopack: { root: import.meta.dirname } }\n',
  )
  run('bun', ['x', '--no-install', 'next', 'build'])
  const nextAssets = join(consumer, '.next/static')
  const nextFiles = await readdir(nextAssets, { recursive: true })
  const nextStyles = await Promise.all(
    nextFiles
      .filter((file) => file.endsWith('.css'))
      .map((file) => readFile(join(nextAssets, file), 'utf8')),
  )
  assert.match(nextStyles.join('\n'), /picodash-dashstack/)
  assert.match(nextStyles.join('\n'), /picodash-panel/)
  process.stdout.write(
    `Isolated install, repeat install, frozen reinstall, types, component interaction and Vite/Next CSS builds passed: ${snapshot.version}\n`,
  )
} finally {
  await rm(consumer, { recursive: true, force: true })
}
