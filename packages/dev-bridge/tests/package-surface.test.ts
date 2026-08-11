import { readFile } from 'node:fs/promises'
import { describe, expect, test } from 'vite-plus/test'
import * as bridge from '../src/index.js'

describe('dev bridge publication surface', () => {
  test('exports only the prefixed runtime bridge API', () => {
    expect(Object.keys(bridge).sort()).toEqual([
      'PICODASH_DEV_BRIDGE_PROTOCOL_VERSION',
      'PICODASH_DEV_BRIDGE_SUBPROTOCOL',
      'createPicodashDevBridgeClient',
      'startPicodashDevBridgeRelay',
    ])
    expect('Disclosure' in bridge).toBe(false)
    expect('Command' in bridge).toBe(false)
    expect('WireFrame' in bridge).toBe(false)
    expect(bridge.PICODASH_DEV_BRIDGE_PROTOCOL_VERSION).toBe(2)
    expect(bridge.PICODASH_DEV_BRIDGE_SUBPROTOCOL).toBe('picodash.dev-bridge.v2')
  })

  test('browser source and artifact do not import Node or ws modules', async () => {
    const source = await readFile(new URL('../src/browser.ts', import.meta.url), 'utf8')
    const artifact = await readFile(new URL('../dist/browser.mjs', import.meta.url), 'utf8')
    for (const text of [source, artifact]) {
      expect(text).not.toMatch(/node:(?:crypto|http|url)/)
      expect(text).not.toMatch(/(?:from|require\()\s*["']ws["']/)
    }
  })

  test('manifest keeps exact package entries and does not publish compact aliases', async () => {
    const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
    expect(manifest.bin).toEqual({ 'picodash-dev-bridge': 'dist/cli.mjs' })
    expect(manifest.exports).toEqual({
      '.': { types: './dist/index.d.mts', import: './dist/index.mjs' },
      './browser': { types: './dist/browser.d.mts', import: './dist/browser.mjs' },
      './package.json': './package.json',
    })
    expect(manifest.exports['./client']).toBeUndefined()
    expect(manifest.exports['./relay']).toBeUndefined()
    expect(manifest.exports['./cli']).toBeUndefined()
  })
})
