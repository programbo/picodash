import { execFile } from 'node:child_process'
import { open, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const worktreeDir = path.resolve(process.env.PICODASH_WORKTREE_DIR ?? process.cwd())
const envFile = process.env.PICODASH_WORKTREE_ENV_FILE ?? path.join(worktreeDir, '.env.local')
const availablePorts = [6034, 6035, 6036, 6037, 6038, 6039]

async function resolvePortsFile() {
  if (process.env.PICODASH_WORKTREE_PORTS_FILE) {
    return path.resolve(process.env.PICODASH_WORKTREE_PORTS_FILE)
  }

  const { stdout } = await execFileAsync(
    'git',
    ['-C', worktreeDir, 'rev-parse', '--git-common-dir'],
    { encoding: 'utf8' },
  )
  const gitCommonDir = path.resolve(worktreeDir, stdout.trim())

  return path.join(path.dirname(gitCommonDir), '.worktree-ports')
}

const portsFile = await resolvePortsFile()
const lockFile = `${portsFile}.lock`

function usage() {
  console.error('Usage: node scripts/worktree-ports.mjs <reserve|release>')
  process.exitCode = 1
}

function parseReservation(line) {
  const firstSeparator = line.indexOf(':')
  const lastSeparator = line.lastIndexOf(':')

  if (
    firstSeparator <= 0 ||
    lastSeparator <= firstSeparator + 1 ||
    lastSeparator === line.length - 1
  ) {
    throw new Error(`Invalid reservation line: ${line}`)
  }

  const port = Number(line.slice(0, firstSeparator))
  const datetime = line.slice(firstSeparator + 1, lastSeparator)
  const reservedWorktreeDir = line.slice(lastSeparator + 1)

  if (!availablePorts.includes(port) || !datetime || !path.isAbsolute(reservedWorktreeDir)) {
    throw new Error(`Invalid reservation line: ${line}`)
  }

  return { port, datetime, worktreeDir: reservedWorktreeDir }
}

function parseReservations(contents) {
  return contents
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map(parseReservation)
}

function splitEnv(contents) {
  const newline = contents.includes('\r\n') ? '\r\n' : '\n'
  const hasTrailingNewline = /\r?\n$/.test(contents)
  const lines = contents ? contents.split(/\r?\n/) : []

  if (hasTrailingNewline) lines.pop()

  return { lines, newline, hasTrailingNewline }
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

async function clearEnvPorts() {
  let contents

  try {
    contents = await readFile(envFile, 'utf8')
  } catch (error) {
    if (error.code === 'ENOENT') return
    throw error
  }

  const { lines, newline, hasTrailingNewline } = splitEnv(contents)
  const filteredLines = lines.filter((line) => !/^\s*(WEBSITE_PORT|LAB_PORT)\s*=/.test(line))
  const nextContents = filteredLines.length
    ? `${filteredLines.join(newline)}${hasTrailingNewline ? newline : ''}`
    : ''

  if (nextContents !== contents) await writeFile(envFile, nextContents)
}

async function withLock(action) {
  let lockHandle

  try {
    lockHandle = await open(lockFile, 'wx')
  } catch (error) {
    if (error.code === 'EEXIST') {
      throw new Error(`Could not reserve a port because ${lockFile} already exists`)
    }
    throw error
  }

  try {
    return await action()
  } finally {
    await lockHandle.close()
    await unlink(lockFile).catch(() => {})
  }
}

async function reserve() {
  await withLock(async () => {
    let contents = ''

    try {
      contents = await readFile(portsFile, 'utf8')
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }

    const reservations = parseReservations(contents)
    const existing = reservations.find((reservation) => reservation.worktreeDir === worktreeDir)
    const port =
      existing?.port ??
      availablePorts.find(
        (candidate) => !reservations.some((reservation) => reservation.port === candidate),
      )

    if (!port) throw new Error('No available worktree ports remain in 6034-6039')

    if (!existing) {
      const separator = contents && !contents.endsWith('\n') ? '\n' : ''
      await writeFile(
        portsFile,
        `${contents}${separator}${port}:${new Date().toISOString()}:${worktreeDir}\n`,
      )
    }

    await updateEnv(port)
    console.log(
      existing
        ? `Worktree port ${port} is already reserved for ${worktreeDir}`
        : `Reserved worktree port ${port} for ${worktreeDir}`,
    )
  })
}

async function release() {
  await withLock(async () => {
    let contents

    try {
      contents = await readFile(portsFile, 'utf8')
    } catch (error) {
      if (error.code === 'ENOENT') {
        await clearEnvPorts()
        console.log(`No reservation found for ${worktreeDir}`)
        return
      }
      throw error
    }

    const lines = contents.split(/\r?\n/)
    const matchingLines = lines.filter(
      (line) => line.trim() && parseReservation(line).worktreeDir === worktreeDir,
    )
    const remainingLines = lines.filter(
      (line) => !line.trim() || parseReservation(line).worktreeDir !== worktreeDir,
    )
    const nextContents = remainingLines
      .join('\n')
      .replace(/\n+$/, (trailingNewlines) => (trailingNewlines ? '\n' : ''))

    if (matchingLines.length) await writeFile(portsFile, nextContents)
    await clearEnvPorts()
    console.log(
      matchingLines.length
        ? `Released worktree port ${parseReservation(matchingLines[0]).port} for ${worktreeDir}`
        : `No reservation found for ${worktreeDir}`,
    )
  })
}

const command = process.argv[2]

if (command === 'reserve') await reserve()
else if (command === 'release') await release()
else usage()
