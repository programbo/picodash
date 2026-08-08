import { describe, expect, test } from 'vite-plus/test'
import * as ts from 'typescript'

function diagnosticsFor(source: string) {
  const fileName = '/tmp/picodash-dev-bridge-type-surface.ts'
  const compilerOptions: ts.CompilerOptions = {
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    target: ts.ScriptTarget.ESNext,
    strict: true,
    skipLibCheck: true,
    noEmit: true,
  }
  const host = ts.createCompilerHost(compilerOptions)
  const original = host.getSourceFile.bind(host)
  host.getSourceFile = (name, languageVersion, onError, shouldCreateNewSourceFile) =>
    name === fileName
      ? ts.createSourceFile(fileName, source, languageVersion, true)
      : original(name, languageVersion, onError, shouldCreateNewSourceFile)
  const program = ts.createProgram([fileName], compilerOptions, host)
  return ts.getPreEmitDiagnostics(program)
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
    expect(valid).toHaveLength(0)

    const compact = diagnosticsFor(`
      import type { Disclosure, Command } from '${process.cwd()}/src/index.js'
      void ({} as Disclosure)
      void ({} as Command)
    `)
    expect(compact.length).toBeGreaterThan(0)
  })
})
