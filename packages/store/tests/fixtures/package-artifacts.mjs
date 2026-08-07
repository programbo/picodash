import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

export async function readText(filePath) {
  return readFile(filePath, 'utf8')
}

export async function readJson(filePath) {
  return JSON.parse(await readText(filePath))
}

export async function walkFiles(directory) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await walkFiles(entryPath)))
    else if (entry.isFile()) files.push(entryPath)
  }
  return files
}

export function runtimeImports(source) {
  const imports = []
  const pattern =
    /\b(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)/g
  for (const match of source.matchAll(pattern)) imports.push(match[1] ?? match[2])
  return imports
}

export function resolveRelativeImport(importer, specifier) {
  if (!specifier.startsWith('.')) return null
  const candidate = path.resolve(path.dirname(importer), specifier)
  return path.extname(candidate) ? candidate : `${candidate}.mjs`
}
