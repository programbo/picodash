import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const legacyPackageName = ['@picodash', 'panel'].join('/')

const artifactContracts = {
  'README.md': [
    '@picodash/dashpanel',
    '@picodash/dashlist',
    '@picodash/picodash',
    '@picodash/nexus',
  ],
  'SKILL.md': ['@picodash/dashpanel', '@picodash/dashlist', '@picodash/picodash'],
  'llms.txt': ['@picodash/dashpanel', '@picodash/dashlist', '@picodash/picodash'],
  'PRODUCT.md': ['AI coding agent', 'WCAG 2.2 Level AA'],
  'CONTEXT.md': ['Compound Dashlet', 'Picodash Nexus', 'Root Nexus', 'Scoped Nexus'],
}

const packageExportContracts = {
  'packages/nexus/package.json': [
    '.',
    './react',
    './integration',
    './web-storage',
    './package.json',
  ],
  'packages/ui/package.json': ['.', './package.json', './style.css'],
  'packages/dashpanel/package.json': ['.', './integration', './package.json', './style.css'],
  'packages/dashlist/package.json': ['.', './package.json', './style.css'],
  'packages/picodash/package.json': ['.', './package.json', './style.css', './ui'],
}

const activePaths = [
  'package.json',
  'apps/web/package.json',
  'apps/web/src',
  'apps/lab/package.json',
  'apps/lab/src',
  'packages/nexus',
  'packages/ui',
  'packages/dashpanel',
  'packages/dashlist',
  'packages/picodash',
  'scripts',
]

const errors = []

for (const [relativePath, requiredTerms] of Object.entries(artifactContracts)) {
  const contents = await readFile(path.join(repositoryRoot, relativePath), 'utf8').catch(() => null)
  if (contents === null) {
    errors.push(`${relativePath}: required documentation artifact is missing`)
    continue
  }
  for (const term of requiredTerms) {
    if (!contents.includes(term)) errors.push(`${relativePath}: expected ${JSON.stringify(term)}`)
  }
}

for (const [relativePath, expectedExports] of Object.entries(packageExportContracts)) {
  const packageJson = JSON.parse(await readFile(path.join(repositoryRoot, relativePath), 'utf8'))
  const actualExports = Object.keys(packageJson.exports ?? {}).sort()
  const expected = [...expectedExports].sort()
  if (JSON.stringify(actualExports) !== JSON.stringify(expected)) {
    errors.push(
      `${relativePath}: export manifest drifted; expected ${expected.join(', ')}, received ${actualExports.join(', ')}`,
    )
  }
}

for (const relativePath of activePaths) {
  const absolutePath = path.join(repositoryRoot, relativePath)
  const contents = await readFile(absolutePath, 'utf8').catch(async () => {
    const entries = await import('node:fs/promises').then(({ readdir }) =>
      readdir(absolutePath, { recursive: true, withFileTypes: true }),
    )
    return entries
      .filter((entry) => entry.isFile() && !entry.name.endsWith('.map'))
      .map((entry) => path.join(entry.parentPath, entry.name))
      .join('\n')
  })
  if (contents.includes(legacyPackageName)) {
    errors.push(`${relativePath}: active surface still references the legacy panel package`)
  }
}

if (errors.length > 0) {
  console.error(`Agent artifact validation failed:\n- ${errors.join('\n- ')}`)
  process.exitCode = 1
} else {
  console.log(
    `Agent artifacts match ${Object.keys(artifactContracts).length} documentation contracts and ${Object.keys(packageExportContracts).length} package export manifests.`,
  )
}
