import { cp, mkdtemp, rm } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import os from 'node:os'
import path from 'node:path'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const scenarios = [
  'next-creative-controls',
  'next-debug-feature-controls',
  'vite-application-monitor',
]

run('node', ['scripts/check-evaluations.mjs'], repositoryRoot)

const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'picodash-evaluation-seeds-'))

try {
  for (const scenario of scenarios) {
    const source = path.join(repositoryRoot, 'evaluations', 'v1', scenario, 'seed')
    const destination = path.join(temporaryRoot, scenario)
    await cp(source, destination, {
      recursive: true,
      filter: (sourcePath) =>
        !['node_modules', '.next', 'dist'].includes(path.basename(sourcePath)),
    })

    console.log(`\nBuilding clean evaluation seed: ${scenario}`)
    run('bun', ['install', '--frozen-lockfile'], destination)
    run('bun', ['run', 'build'], destination)
  }
} finally {
  await rm(temporaryRoot, { recursive: true, force: true })
}

console.log(`\nBuilt ${scenarios.length} isolated Next.js/Vite evaluation seeds.`)

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    env: {
      ...process.env,
      CI: '1',
      NEXT_TELEMETRY_DISABLED: '1',
    },
    stdio: 'inherit',
  })

  if (result.error) {
    throw result.error
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status ?? 1}`)
  }
}
