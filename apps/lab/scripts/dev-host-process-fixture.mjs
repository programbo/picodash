import { EventEmitter } from 'node:events'
import { createDevHostRuntime, installSignalHandlers } from './dev-host.mjs'
const directory = process.env.PICODASH_TEST_DIRECTORY
const child = new EventEmitter()
child.killed = false
child.kill = () => {
  child.killed = true
  return true
}
const runtime = createDevHostRuntime({
  directory,
  worktree: directory,
  labPort: 0,
  stdio: 'ignore',
  logCredential: false,
  spawnChild: () => child,
})
installSignalHandlers(runtime, process.exit)
await runtime.start()
console.log('ready')
