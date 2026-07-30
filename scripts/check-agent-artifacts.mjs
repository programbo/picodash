import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const catalogModuleUrl = new URL('../packages/panel/src/catalog.ts', import.meta.url)
const { picodashCatalog, picodashCatalogEntrypoints, picodashCatalogRecipeIds } = await import(
  catalogModuleUrl
)

const artifactContracts = {
  'README.md': ['@picodash/store', '@picodash/panel/dashlet'],
  'packages/store/README.md': ['createPicodashStore', '@picodash/store/react'],
  'packages/panel/README.md': ['@picodash/store', '@picodash/panel/dashlet'],
  'SKILL.md': ['@picodash/store', '@picodash/panel/dashlet'],
  'llms.txt': ['@picodash/store', '@picodash/panel/dashlet'],
  'PRODUCT.md': ['AI coding agent', 'WCAG 2.2 Level AA'],
  'CONTEXT.md': ['Compound Dashlet', 'Picodash Store'],
  'docs/adr/0001-agent-first-store-and-dashlet-boundaries.md': [
    '@picodash/store',
    '@picodash/panel/dashlet',
  ],
}

const retiredArtifactTerms = [
  '/lab/state/',
  '/lab/panel-geometry',
  '/lab/panel-interaction',
  '/lab/dashlets',
]

const retiredApiTerms = ['createPicodashPanelStore', 'usePicodashPanelStoreSelector']
const typedFieldExampleArtifacts = ['README.md', 'packages/panel/README.md', 'SKILL.md']
const catalogDocumentationArtifacts = [
  'README.md',
  'packages/panel/README.md',
  'SKILL.md',
  'llms.txt',
]
const catalogReferencePaths = {
  '@picodash/panel': '/docs/reference/dashlets',
  '@picodash/panel/dashlet': '/docs/reference/dashlet-components',
  '@picodash/panel/ui': '/docs/reference/ui',
}

const errors = []
const artifactContents = new Map()

for (const [relativePath, requiredTerms] of Object.entries(artifactContracts)) {
  const contents = await readFile(path.join(repositoryRoot, relativePath), 'utf8').catch(() => null)
  if (contents === null) {
    errors.push(`${relativePath}: required agent/documentation artifact is missing`)
    continue
  }
  artifactContents.set(relativePath, contents)

  for (const term of requiredTerms) {
    if (!contents.includes(term)) {
      errors.push(`${relativePath}: expected ${JSON.stringify(term)}`)
    }
  }

  for (const term of retiredArtifactTerms) {
    if (contents.includes(term)) {
      errors.push(`${relativePath}: still references retired surface ${JSON.stringify(term)}`)
    }
  }

  for (const retiredApi of retiredApiTerms) {
    if (contents.includes(retiredApi)) {
      errors.push(`${relativePath}: still recommends retired API ${JSON.stringify(retiredApi)}`)
    }
  }

  if (typedFieldExampleArtifacts.includes(relativePath)) {
    for (const retiredExample of ['field="', 'defaultValue=']) {
      if (contents.includes(retiredExample)) {
        errors.push(
          `${relativePath}: example still uses retired component contract ${JSON.stringify(retiredExample)}`,
        )
      }
    }
  }
}

function containsExactPackageToken(contents, packageName) {
  const escapedPackageName = packageName.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?<![\\w@/.-])${escapedPackageName}(?![\\w/.-])`).test(contents)
}

for (const relativePath of catalogDocumentationArtifacts) {
  const contents = artifactContents.get(relativePath)
  if (contents === undefined) continue

  for (const entrypoint of picodashCatalogEntrypoints) {
    if (!containsExactPackageToken(contents, entrypoint)) {
      errors.push(
        `${relativePath}: does not document catalog entrypoint ${JSON.stringify(entrypoint)}`,
      )
    }
  }
}

const catalogEntrypoints = new Set(picodashCatalogEntrypoints)
const catalogRecipeIds = new Set(picodashCatalogRecipeIds)
const catalogAnchors = new Set()

for (const catalogEntry of picodashCatalog) {
  if (!catalogEntrypoints.has(catalogEntry.entrypoint)) {
    errors.push(
      `packages/panel/src/catalog.ts: ${catalogEntry.id} uses undeclared entrypoint ${JSON.stringify(catalogEntry.entrypoint)}`,
    )
  }

  const expectedReferencePath = catalogReferencePaths[catalogEntry.entrypoint]
  if (!catalogEntry.referenceAnchor.startsWith(`${expectedReferencePath}#`)) {
    errors.push(
      `packages/panel/src/catalog.ts: ${catalogEntry.id} must reference ${expectedReferencePath}`,
    )
  }

  if (catalogAnchors.has(catalogEntry.referenceAnchor)) {
    errors.push(
      `packages/panel/src/catalog.ts: duplicate reference anchor ${catalogEntry.referenceAnchor}`,
    )
  }
  catalogAnchors.add(catalogEntry.referenceAnchor)

  for (const recipeId of catalogEntry.recipeIds) {
    if (!catalogRecipeIds.has(recipeId)) {
      errors.push(
        `packages/panel/src/catalog.ts: ${catalogEntry.id} uses undeclared recipe ${JSON.stringify(recipeId)}`,
      )
    }
  }
}

for (const referencePath of new Set(Object.values(catalogReferencePaths))) {
  const pagePath = path.join(repositoryRoot, 'apps/web/src/app', referencePath.slice(1), 'page.tsx')
  const pageExists = await readFile(pagePath, 'utf8').then(
    () => true,
    () => false,
  )
  if (!pageExists) {
    errors.push(`${referencePath}: catalog reference page is missing`)
  }
}

const packageExportContracts = {
  'packages/store/package.json': ['.', './react', './package.json'],
  'packages/panel/package.json': [
    '.',
    './advanced',
    './catalog',
    './dashlet',
    './ui',
    './package.json',
    './style.css',
  ],
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

if (errors.length > 0) {
  console.error(`Agent artifact validation failed:\n- ${errors.join('\n- ')}`)
  process.exitCode = 1
} else {
  console.log(
    `Agent artifacts match ${Object.keys(artifactContracts).length} documentation contracts, ${picodashCatalog.length} catalog entries, and ${Object.keys(packageExportContracts).length} package export manifests.`,
  )
}
