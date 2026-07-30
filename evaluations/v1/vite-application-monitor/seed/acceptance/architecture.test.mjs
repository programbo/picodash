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

test('uses one native Store and public Picodash composition surfaces', async () => {
  const packageJson = JSON.parse(await readFile('package.json', 'utf8'))
  const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies }
  assert.ok(dependencies['@picodash/panel'], 'add @picodash/panel')
  assert.ok(dependencies['@picodash/store'], 'add @picodash/store')

  const source = await sourceText('src')
  assert.match(source, /\bcreatePicodashStore\s*[<(]/)
  assert.match(source, /@picodash\/panel\/style\.css/)
  assert.match(source, /@picodash\/panel\/dashlet/)
  assert.match(source, /\bfields\s*=\s*\{\{/s, 'Service health must bind multiple fields')
  assert.doesNotMatch(source, /@picodash\/panel\/src|@picodash\/store\/src/)
})

test('does not mirror Store values through a synchronization effect', async () => {
  const source = await sourceText('src')
  assert.doesNotMatch(
    source,
    /useEffect\s*\([^)]*(?:setValues|setValue|setState|setMonitor)/s,
    'do not synchronize a second state record from an effect',
  )
})
