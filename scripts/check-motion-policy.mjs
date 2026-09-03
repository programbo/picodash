import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const implementationRoots = ['apps/lab/src', 'apps/web/src', 'packages']
const errors = []

for (const root of implementationRoots) {
  for (const relativePath of await implementationFiles(path.join(repositoryRoot, root))) {
    const repositoryPath = path.join(root, relativePath)
    const contents = await readFile(path.join(repositoryRoot, repositoryPath), 'utf8')

    if (/\.[\t ]*animate[\t ]*\(/u.test(contents)) {
      errors.push(`${repositoryPath}: call Motion animate() instead of Element.animate()`)
    }

    if (/from\s+['"](?:framer-motion|motion-dom)(?:\/[^'"]*)?['"]/u.test(contents)) {
      errors.push(`${repositoryPath}: import the public motion package rather than its internals`)
    }

    if (/from\s+['"]motion(?:\/[^'"]*)?['"]/u.test(contents)) {
      const manifestPath = await owningPackageManifest(
        path.dirname(path.join(repositoryRoot, repositoryPath)),
      )
      if (!manifestPath) {
        errors.push(`${repositoryPath}: Motion import has no owning package.json`)
      } else {
        const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
        if (!Object.hasOwn(manifest.dependencies ?? {}, 'motion')) {
          errors.push(
            `${repositoryPath}: owning package must declare Motion as a runtime dependency`,
          )
        }
      }
    }

    if (repositoryPath.endsWith('.css')) checkStylesheet(repositoryPath, contents)
    if (/\.[jt]sx$/u.test(repositoryPath)) checkStaticTailwindTransitions(repositoryPath, contents)
  }
}

if (errors.length > 0) {
  console.error(`Motion policy validation failed:\n- ${errors.join('\n- ')}`)
  process.exitCode = 1
} else {
  console.log(
    'Motion policy passed: imperative animation uses Motion; CSS transitions are tokenized, reduced-motion safe, and limited to declarative state styling.',
  )
}

function checkStylesheet(relativePath, contents) {
  const transitionDeclarations = [
    ...contents.matchAll(/\btransition(?:-duration)?\s*:\s*([^;]+);/gu),
  ]
  if (transitionDeclarations.length === 0) return

  if (!/@media\s*\(prefers-reduced-motion:\s*reduce\)/u.test(contents)) {
    errors.push(`${relativePath}: transitions require a reduced-motion rule in the same stylesheet`)
  }

  for (const declaration of transitionDeclarations) {
    const value = declaration[1] ?? ''
    const nonZeroLiteralTime = [...value.matchAll(/(?:^|\s)(\d*\.?\d+)(m?s)\b/gu)].find(
      (match) => Number(match[1]) !== 0,
    )
    if (nonZeroLiteralTime) {
      errors.push(
        `${relativePath}: transition timings must use theme tokens, found ${nonZeroLiteralTime[0].trim()}`,
      )
    }
    if (/\ball\b/u.test(value)) {
      errors.push(`${relativePath}: transition explicit properties instead of all`)
    }
    if (
      /\b(?:block-size|height|inline-size|width|inset|left|top|right|bottom|margin|padding)\b/u.test(
        value,
      )
    ) {
      errors.push(`${relativePath}: CSS transition animates a layout property`)
    }
  }

  if (/@keyframes\b|\banimation\s*:/u.test(contents)) {
    errors.push(
      `${relativePath}: CSS keyframes require a reviewed policy exception; use Motion for orchestrated animation`,
    )
  }
}

function checkStaticTailwindTransitions(relativePath, contents) {
  for (const className of contents.matchAll(/className\s*=\s*['"]([^'"]+)['"]/gu)) {
    const value = className[1] ?? ''
    if (
      /\btransition(?:-[\w-]+)?\b/u.test(value) &&
      !/\bmotion-reduce:transition-none\b/u.test(value)
    ) {
      errors.push(`${relativePath}: Tailwind transition requires motion-reduce:transition-none`)
    }
  }
}

async function implementationFiles(root, prefix = '') {
  const files = []
  for (const entry of await readdir(path.join(root, prefix), { withFileTypes: true })) {
    const relativePath = path.join(prefix, entry.name)
    if (entry.isDirectory()) {
      if (!['dist', 'node_modules'].includes(entry.name)) {
        files.push(...(await implementationFiles(root, relativePath)))
      }
    } else if (
      entry.isFile() &&
      /\.(?:[cm]?[jt]sx?|css)$/u.test(entry.name) &&
      !/\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(entry.name)
    ) {
      files.push(relativePath)
    }
  }
  return files
}

async function owningPackageManifest(startDirectory) {
  let directory = startDirectory
  while (directory.startsWith(repositoryRoot)) {
    const candidate = path.join(directory, 'package.json')
    const exists = await readFile(candidate, 'utf8').then(
      () => true,
      () => false,
    )
    if (exists) return candidate
    if (directory === repositoryRoot) return null
    directory = path.dirname(directory)
  }
  return null
}
