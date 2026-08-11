import { cp, mkdir, mkdtemp, rm } from 'node:fs/promises'
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
const nextScenarios = new Set(['next-creative-controls', 'next-debug-feature-controls'])
const cacheRoot = path.join(repositoryRoot, '.cache', 'evaluation-seeds')

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

    if (nextScenarios.has(scenario)) {
      const persistentCache = path.join(cacheRoot, scenario)
      const buildCache = path.join(destination, '.next', 'cache')
      await mkdir(buildCache, { recursive: true })
      await cp(persistentCache, buildCache, { recursive: true, force: true }).catch((error) => {
        if (error.code !== 'ENOENT') throw error
      })
    }

    console.log(`\nBuilding clean evaluation seed: ${scenario}`)
    run('bun', ['install', '--frozen-lockfile'], destination)
    run('bun', ['run', 'build'], destination)

    if (nextScenarios.has(scenario)) {
      await mkdir(path.join(cacheRoot, scenario), { recursive: true })
      await cp(path.join(destination, '.next', 'cache'), path.join(cacheRoot, scenario), {
        recursive: true,
        force: true,
      })
    }
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
