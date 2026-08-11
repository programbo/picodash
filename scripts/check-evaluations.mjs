import { readdir, readFile, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const evaluationsRoot = path.join(repositoryRoot, 'evaluations', 'v1')

const scenarios = [
  {
    id: 'next-creative-controls',
    framework: 'next-app-router',
    acceptanceFile: 'acceptance/creative-controls.spec.ts',
    seedFiles: ['app/layout.tsx', 'app/page.tsx', 'next.config.ts'],
  },
  {
    id: 'next-debug-feature-controls',
    framework: 'next-app-router',
    acceptanceFile: 'acceptance/debug-feature-controls.spec.ts',
    seedFiles: ['app/feature-store.ts', 'app/layout.tsx', 'app/page.tsx', 'next.config.ts'],
  },
  {
    id: 'vite-application-monitor',
    framework: 'vite-react',
    acceptanceFile: 'acceptance/application-monitor.spec.ts',
    seedFiles: ['index.html', 'src/app.tsx', 'src/main.tsx', 'vite.config.ts'],
  },
]

const requiredScenarioFiles = [
  'expected-decisions.md',
  'prompt.md',
  'rubric.md',
  'scenario.json',
  'seed/README.md',
  'seed/bun.lock',
  'seed/package.json',
  'seed/acceptance/architecture.test.mjs',
  'seed/acceptance/playwright.config.ts',
]

const errors = []
const expectedIds = scenarios.map(({ id }) => id)
const actualIds = (
  await Promise.all(
    (
      await readdir(evaluationsRoot, { withFileTypes: true })
    )
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => ({
        entry,
        hasManifest: await stat(path.join(evaluationsRoot, entry.name, 'scenario.json'))
          .then(() => true)
          .catch(() => false),
      })),
  )
)
  .filter(({ hasManifest }) => hasManifest)
  .map(({ entry }) => entry.name)
  .sort()

if (JSON.stringify(actualIds) !== JSON.stringify([...expectedIds].sort())) {
  errors.push(
    `expected exactly the three v1 scenarios ${expectedIds.join(', ')}; received ${actualIds.join(', ')}`,
  )
}

for (const scenario of scenarios) {
  const scenarioRoot = path.join(evaluationsRoot, scenario.id)
  const seedRoot = path.join(scenarioRoot, 'seed')

  for (const relativePath of [
    ...requiredScenarioFiles,
    `seed/${scenario.acceptanceFile}`,
    ...scenario.seedFiles.map((file) => `seed/${file}`),
  ]) {
    const exists = await stat(path.join(scenarioRoot, relativePath))
      .then((entry) => entry.isFile())
      .catch(() => false)
    if (!exists) {
      errors.push(`${scenario.id}: missing required file ${relativePath}`)
    }
  }

  const manifest = JSON.parse(await readFile(path.join(scenarioRoot, 'scenario.json'), 'utf8'))
  const expectedManifest = {
    schemaVersion: 1,
    id: scenario.id,
    version: '1.0.0',
    framework: scenario.framework,
    seedDirectory: 'seed',
    prompt: 'prompt.md',
    acceptanceCommand: 'bun run acceptance',
    rubric: 'rubric.md',
    expectedDecisions: 'expected-decisions.md',
  }

  if (JSON.stringify(manifest) !== JSON.stringify(expectedManifest)) {
    errors.push(`${scenario.id}: scenario.json drifted from the reviewed v1 manifest`)
  }

  const packageJson = JSON.parse(await readFile(path.join(seedRoot, 'package.json'), 'utf8'))
  if (packageJson.private !== true || typeof packageJson.scripts?.build !== 'string') {
    errors.push(`${scenario.id}: seed package must be private and define a build script`)
  }
  if (typeof packageJson.scripts?.acceptance !== 'string') {
    errors.push(`${scenario.id}: seed package must retain its deterministic acceptance command`)
  }
  if (packageJson.workspaces !== undefined) {
    errors.push(`${scenario.id}: seed package must not declare workspaces`)
  }

  const dependencyEntries = Object.entries({
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
    ...packageJson.peerDependencies,
    ...packageJson.optionalDependencies,
  })
  for (const [name, specifier] of dependencyEntries) {
    if (name.startsWith('@picodash/')) {
      errors.push(`${scenario.id}: clean seed must not depend on ${name}`)
    }
    if (/^(?:workspace|file|link|portal):/u.test(String(specifier))) {
      errors.push(`${scenario.id}: dependency ${name} couples the seed to another workspace`)
    }
  }

  for (const relativePath of await implementationFiles(seedRoot)) {
    const contents = await readFile(path.join(seedRoot, relativePath), 'utf8')
    if (/@picodash\/|from\s+['"]picodash|Picodash(?:Panel|Item|Nexus|Provider)/u.test(contents)) {
      errors.push(`${scenario.id}: seed implementation ${relativePath} already contains Picodash`)
    }
  }

  const lockfile = await readFile(path.join(seedRoot, 'bun.lock'), 'utf8')
  if (/@picodash\/|(?:workspace|file|link|portal):/u.test(lockfile)) {
    errors.push(`${scenario.id}: seed lockfile contains Picodash or workspace coupling`)
  }
}

if (errors.length > 0) {
  console.error(`Evaluation validation failed:\n- ${errors.join('\n- ')}`)
  process.exitCode = 1
} else {
  console.log(
    `Evaluation manifests and clean seeds match exactly ${scenarios.length} v1 scenarios.`,
  )
}

async function implementationFiles(root, prefix = '') {
  const files = []
  for (const entry of await readdir(path.join(root, prefix), { withFileTypes: true })) {
    const relativePath = path.join(prefix, entry.name)
    if (entry.isDirectory()) {
      if (!['acceptance', 'node_modules', '.next', 'dist'].includes(entry.name)) {
        files.push(...(await implementationFiles(root, relativePath)))
      }
    } else if (
      entry.isFile() &&
      !['README.md', 'package.json', 'bun.lock'].includes(entry.name) &&
      /\.(?:[cm]?[jt]sx?|css|html)$/u.test(entry.name)
    ) {
      files.push(relativePath)
    }
  }
  return files
}
