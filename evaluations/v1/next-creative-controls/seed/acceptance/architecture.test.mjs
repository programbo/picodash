import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

async function sourceText(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const contents = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name)
      if (entry.isDirectory()) return sourceText(entryPath)
      if (!/\.[cm]?[jt]sx?$/.test(entry.name)) return ''
      return readFile(entryPath, 'utf8')
    }),
  )
  return contents.join('\n')
}

test('uses public Picodash surfaces and a manual whole-record adapter', async () => {
  const packageJson = JSON.parse(await readFile('package.json', 'utf8'))
  const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies }
  assert.ok(dependencies['@picodash/picodash'], 'add @picodash/picodash')
  assert.ok(dependencies['@picodash/dashlist'], 'add @picodash/dashlist for public anatomy')
  assert.ok(dependencies['@picodash/nexus'], 'add @picodash/nexus')

  const source = await sourceText('app')
  assert.match(source, /@picodash\/picodash\/style\.css/)
  assert.match(source, /@picodash\/dashlist\/dashlet/)
  assert.match(source, /\bPicodashValueAdapter\b/)
  assert.match(source, /\bgetSnapshot\s*[:(]/)
  assert.match(source, /\bsubscribe\s*[:(]/)
  assert.match(source, /\bsetValues\s*[:(]/)
  assert.match(source, /\bfields\s*=\s*\{\{/s, 'Atmosphere must bind multiple fields')
  assert.doesNotMatch(source, /@picodash\/(?:dashlist|picodash|nexus)\/src/)
  assert.doesNotMatch(source, /@picodash\/picodash\/dashlet/)
  assert.doesNotMatch(
    source,
    /useEffect\s*\([^)]*(?:setValues|setValue|setState|setScene)/s,
    'do not synchronize a second state record from an effect',
  )
})

test('keeps an explicit production exposure gate', async () => {
  const source = await sourceText('app')
  assert.match(source, /NODE_ENV\s*!==?\s*['"]production['"]/)
})
