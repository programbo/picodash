import { execFile } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const worktreeDir = path.resolve(process.env.PICODASH_WORKTREE_DIR ?? process.cwd())
const envFile = process.env.PICODASH_WORKTREE_ENV_FILE ?? path.join(worktreeDir, '.env.local')
const availablePorts = [6034, 6035, 6036, 6037, 6038, 6039]

function splitEnv(contents) {
  const newline = contents.includes('\r\n') ? '\r\n' : '\n'
  const lines = contents ? contents.split(/\r?\n/) : []

  if (/\r?\n$/.test(contents)) lines.pop()

  return { lines, newline }
}

async function updateEnv(port) {
  let contents = ''

  try {
    contents = await readFile(envFile, 'utf8')
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }

  const { lines, newline } = splitEnv(contents)
  for (const key of ['WEBSITE_PORT', 'LAB_PORT']) {
    const index = lines.findIndex((line) => new RegExp(`^\\s*${key}\\s*=`).test(line))
    if (index === -1) lines.push(`${key}=${port}`)
    else lines[index] = lines[index].replace(/=.*/, `=${port}`)
  }

  await writeFile(envFile, `${lines.join(newline)}${newline}`)
}

async function isLinkedWorktree() {
  const [{ stdout: gitDir }, { stdout: gitCommonDir }] = await Promise.all([
    execFileAsync('git', ['-C', worktreeDir, 'rev-parse', '--git-dir'], { encoding: 'utf8' }),
    execFileAsync('git', ['-C', worktreeDir, 'rev-parse', '--git-common-dir'], {
      encoding: 'utf8',
    }),
  ])

  return path.resolve(worktreeDir, gitDir.trim()) !== path.resolve(worktreeDir, gitCommonDir.trim())
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = createServer()

    server.once('error', () => resolve(false))
    server.listen({ host: '127.0.0.1', port }, () => {
      server.close((error) => resolve(!error))
    })
  })
}

if (await isLinkedWorktree()) {
  let selectedPort

  for (const port of availablePorts) {
    if (!(await isPortAvailable(port))) continue

    selectedPort = port
    break
  }

  if (!selectedPort) throw new Error('No available worktree ports remain in 6034-6039')

  await updateEnv(selectedPort)
  console.log(`Configured worktree port ${selectedPort} in ${envFile}`)
} else {
  console.log('Primary checkout uses the default server ports')
}
