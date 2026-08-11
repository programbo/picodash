import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, test } from 'vite-plus/test'

const require = createRequire(import.meta.url)
const typescriptPackageRoot = dirname(require.resolve('typescript/package.json'))
const tscPath = join(typescriptPackageRoot, 'bin', 'tsc')

function diagnosticsFor(source: string) {
  const directory = mkdtempSync(join(tmpdir(), 'picodash-dev-bridge-type-surface-'))
  const fileName = join(directory, 'surface.mts')
  writeFileSync(fileName, source)

  try {
    const result = spawnSync(
      process.execPath,
      [
        tscPath,
        '--module',
        'NodeNext',
        '--moduleResolution',
        'NodeNext',
        '--target',
        'ESNext',
        '--strict',
        '--skipLibCheck',
        '--noEmit',
        '--ignoreConfig',
        '--pretty',
        'false',
        fileName,
      ],
      { encoding: 'utf8' },
    )
    if (result.error) throw result.error
    return {
      status: result.status,
      output: `${result.stdout}${result.stderr}`.trim(),
    }
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

describe('dev bridge type publication surface', () => {
  test('prefixed public types compile while compact aliases are unavailable', () => {
    const valid = diagnosticsFor(`
      import type { PicodashDevBridgeDisclosure, PicodashDevBridgeCommand } from '${process.cwd()}/src/index.js'
      const disclosure: PicodashDevBridgeDisclosure = { valueFields: [], scopeIds: [], diagnostics: false }
      const command: PicodashDevBridgeCommand = { type: 'set_values', requestId: 'x', values: {} }
      void disclosure
      void command
    `)
    expect(valid).toEqual({ status: 0, output: '' })

    const compact = diagnosticsFor(`
      import type { Disclosure, Command } from '${process.cwd()}/src/index.js'
      void ({} as Disclosure)
      void ({} as Command)
    `)
    expect(compact.status).not.toBe(0)
    expect(compact.output).toContain('has no exported member')
  })
})
