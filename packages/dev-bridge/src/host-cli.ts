#!/usr/bin/env node
import { createPicodashDevBridgeHost } from './host.js'

const args = process.argv.slice(2)
const separator = args.indexOf('--')
if (separator !== 2 || args[0] !== '--origin' || !args[1] || !args[3]) {
  process.stderr.write(
    'Usage: picodash-dev-bridge-host --origin http://127.0.0.1:PORT -- COMMAND [ARGS...]\n',
  )
  process.exitCode = 2
} else {
  try {
    const host = createPicodashDevBridgeHost({
      origin: args[1],
      command: { file: args[3], args: args.slice(4), cwd: process.cwd() },
    })
    const abort = () => {
      void host.stop()
    }
    for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP'] as const) process.once(signal, abort)
    try {
      const result = await host.start()
      process.stdout.write(`Picodash Dev Bridge credential: ${result.credentialPath}\n`)
      const finished = await host.finished
      await host.stop()
      process.exitCode = finished.code
    } finally {
      await host.stop()
      for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP'] as const)
        process.removeListener(signal, abort)
    }
  } catch {
    process.stderr.write('Picodash Dev Bridge host failed; credentials redacted.\n')
    process.exitCode = 3
  }
}
