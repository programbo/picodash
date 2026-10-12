import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
test('Lab launcher resolves its worktree and uses the supported package host with Next-specific plumbing only', async () => {
  const launcher = await readFile(new URL('./dev.mjs', import.meta.url), 'utf8')
  assert.match(
    launcher,
    /resolve\(dirname\(fileURLToPath\(import\.meta\.url\)\), '\.\.\/\.\.\/\.\.'\)/,
  )
  const adapter = await readFile(new URL('./dev-host.mjs', import.meta.url), 'utf8')
  assert.match(adapter, /@picodash\/dev-bridge\/host/)
  assert.match(adapter, /NEXT_PUBLIC_PICODASH_DEV_BRIDGE_CREDENTIAL_URL/)
  assert.doesNotMatch(adapter, /createServer|startPicodashDevBridgeRelay|writeFile/)
})
