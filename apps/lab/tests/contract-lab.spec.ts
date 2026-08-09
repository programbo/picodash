import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createPicodashDevBridgeClient } from '@picodash/dev-bridge'

const consoleErrors = new WeakMap<Page, string[]>()

test.beforeEach(async ({ page }) => {
  const errors: string[] = []
  consoleErrors.set(page, errors)
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => {
    errors.push(error.message)
  })
})

test.afterEach(async ({ page }) => {
  expect(consoleErrors.get(page) ?? [], 'unexpected browser errors').toEqual([])
})

const presets = [
  ['placement', 'Placement'],
  ['interaction', 'Interaction'],
  ['composition', 'Composition'],
  ['overlays', 'Overlays'],
  ['documents', 'Documents'],
  ['themes', 'Themes'],
] as const

async function openLab(page: Page) {
  await page.goto('/lab')
  await expect(page.locator('[data-contract-lab-status]')).toHaveAttribute('data-ready', 'true')
  await expect(page.getByRole('region', { name: 'Contract Lab status' })).toContainText(
    'Diagnostics',
  )
}

test('keeps the versioned driver, Console, and status available while the specimen is offline', async ({
  page,
}) => {
  await openLab(page)

  await expect(page.locator('[data-product-route="contract-lab"]')).toHaveCount(1)
  await expect(page.locator('[data-contract-lab-console]')).toBeVisible()
  await expect(page.locator('[data-contract-lab-specimen]')).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as Window & {
              __PICODASH_LAB__?: { version: number; loadPreset(value: string): void; reset(): void }
            }
          ).__PICODASH_LAB__?.version,
      ),
    )
    .toBe(1)

  await page.getByRole('button', { name: 'Take specimen offline' }).click()
  await expect(page.locator('[data-contract-lab-console]')).toBeVisible()
  await expect(page.locator('[data-contract-lab-status]')).toBeVisible()
  await expect(page.locator('[data-contract-lab-specimen]')).toHaveCount(0)
  await expect(page.locator('[data-contract-lab-specimen-offline]')).toContainText(
    'The Lab Console and status remain available.',
  )
  await expect(page.getByRole('button', { name: 'Reopen primary specimen' })).toBeVisible()
  await page.getByRole('button', { name: 'Reopen primary specimen' }).click()
  await expect(page.locator('[data-contract-lab-specimen]')).toBeVisible()
})

test('loads all six accepted presets, persists the selection for the session, and resets to placement', async ({
  page,
}) => {
  await openLab(page)

  for (const [id, label] of presets) {
    await page.getByRole('button', { name: new RegExp(`^${label}:`) }).click()
    await expect(page.locator('[data-contract-lab-specimen]')).toHaveAttribute('data-preset', id)
    await expect(page.getByRole('region', { name: 'Contract Lab status' })).toContainText(label)
  }

  await page.reload()
  await expect(page.locator('[data-contract-lab-status]')).toHaveAttribute('data-ready', 'true')
  await expect(page.locator('[data-contract-lab-specimen]')).toHaveAttribute(
    'data-preset',
    'themes',
  )

  await page.getByRole('button', { name: 'Reset lab' }).click()
  await expect(page.locator('[data-contract-lab-specimen]')).toHaveAttribute(
    'data-preset',
    'placement',
  )
  await expect(page.getByRole('region', { name: 'Contract Lab status' })).toContainText('Placement')
})

test('renders the landed same-scope Panel and List composition and reports collapse state', async ({
  page,
}) => {
  await openLab(page)
  await page.getByRole('button', { name: /^Composition:/ }).click()

  const specimen = page.locator('[data-contract-lab-specimen]')
  await expect(specimen.locator('[data-picodash-panel]')).toBeVisible()
  await expect(specimen.locator('[data-picodash-dashlist]')).toBeVisible()
  await expect(specimen.locator('[data-picodash-dashgroup="specimen-group"]')).toBeVisible()
  await expect(specimen.locator('[data-picodash-dashlet]')).toHaveCount(3)

  await specimen.getByRole('button', { name: 'Collapse panel Primary Panel' }).click()
  await expect(page.getByRole('region', { name: 'Contract Lab status' })).toContainText('collapsed')
  await specimen.getByRole('button', { name: 'Expand panel Primary Panel' }).click()
  await expect(page.getByRole('region', { name: 'Contract Lab status' })).toContainText('expanded')
})

test('opens, cancels, and restores focus for the landed shared AlertDialog', async ({ page }) => {
  await openLab(page)
  await page.getByRole('button', { name: /^Overlays:/ }).click()

  const trigger = page.getByRole('button', { name: 'Open shared AlertDialog' })
  await trigger.focus()
  await trigger.click()
  const dialog = page.getByRole('alertdialog', { name: 'Contract Lab confirmation' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

test('connects the real browser specimen through the dev bridge and rejects the retired generation', async ({
  page,
}) => {
  await openLab(page)
  await expect
    .poll(() => page.evaluate(() => window.sessionStorage.getItem('picodash-dev-bridge-tab')))
    .toEqual(expect.any(String))
  const browserTabId = await page.evaluate(() =>
    window.sessionStorage.getItem('picodash-dev-bridge-tab'),
  )
  const credential = JSON.parse(
    await readFile(resolve(process.cwd(), '../../.picodash/dev-bridge.json'), 'utf8'),
  ) as { url: string; token: string }
  const client = createPicodashDevBridgeClient({ baseUrl: credential.url, token: credential.token })
  const matches = (items: Awaited<ReturnType<typeof client.listSessions>>) =>
    items.find(
      (item) =>
        item.registrationId === 'contract-lab-specimen' && item.browserTabId === browserTabId,
    )
  await expect.poll(async () => matches(await client.listSessions())).toBeTruthy()
  const initial = matches(await client.listSessions())!
  const initialSnapshot = await client.inspect(initial)
  expect(initialSnapshot.snapshot.values?.specimenMetric).toBe(24)
  expect(initialSnapshot.snapshot.values?.specimenUnit).toBe('requests/minute')
  const write = await client.setValues(initial, {
    type: 'set_values',
    requestId: 'lab-set-42',
    values: { specimenMetric: 42 },
  })
  expect(write.type).toBe('command_result')
  await expect(page.locator('[data-contract-lab-bound-display]')).toHaveText('42')
  await expect(page.locator('[data-contract-lab-bound-input]')).toHaveValue('42')
  await expect
    .poll(async () =>
      (await client.listSessions()).find((item) => item.sessionId === initial.sessionId),
    )
    .toBeTruthy()
  const current = (await client.listSessions()).find(
    (item) => item.sessionId === initial.sessionId,
  )!
  const wait = await client.wait(current, {
    type: 'wait',
    requestId: 'lab-wait-42',
    timeoutMs: 1000,
    condition: { type: 'value_equals', field: 'specimenMetric', value: 42 },
  })
  expect(wait.type).toBe('wait_result')
  expect((wait as { outcome: string }).outcome).toBe('satisfied')

  const boundInput = page.locator('[data-contract-lab-bound-input]')
  const specimenPanel = page.getByRole('complementary', { name: 'Primary Panel' })
  await boundInput.fill('37')
  await expect
    .poll(async () => {
      const session = matches(await client.listSessions())!
      const snapshot = await client.inspect(session)
      return snapshot.snapshot.values?.specimenMetric
    })
    .toBe(37)
  await boundInput.fill('not-a-number')
  await expect(page.locator('[data-picodash-dashlet-binding-issues="metric"]')).toContainText(
    'Metric must be a finite number.',
  )
  expect(
    (await client.inspect(matches(await client.listSessions())!)).snapshot.values?.specimenMetric,
  ).toBe(37)

  await page.getByRole('button', { name: 'Close panel Primary Panel' }).click()
  await expect(specimenPanel).toBeHidden()
  const hiddenSession = matches(await client.listSessions())!
  const hiddenWrite = await client.setValues(hiddenSession, {
    type: 'set_values',
    requestId: 'lab-hidden-set-42',
    values: { specimenMetric: 42 },
  })
  expect(hiddenWrite.type).toBe('command_result')
  await expect
    .poll(
      async () =>
        (await client.inspect(matches(await client.listSessions())!)).snapshot.values
          ?.specimenMetric,
    )
    .toBe(42)
  const beforeReopen = matches(await client.listSessions())!
  await page.getByRole('button', { name: 'Show primary panel' }).click()
  await expect(specimenPanel).toBeVisible()
  await expect(page.getByRole('button', { name: 'Collapse panel Primary Panel' })).toBeFocused()
  await expect(page.locator('[data-contract-lab-bound-display]')).toHaveText('42')
  await expect(boundInput).toHaveValue('not-a-number')
  await expect(boundInput).toHaveAttribute('data-stale', 'true')
  expect(matches(await client.listSessions())!).toMatchObject({
    sessionId: beforeReopen.sessionId,
    generation: beforeReopen.generation,
  })
  await page.getByRole('button', { name: 'Discard changes' }).click()
  await expect(boundInput).toHaveValue('42')
  await expect(boundInput).toHaveAttribute('data-stale', 'false')
  await page.getByRole('button', { name: 'Close panel Primary Panel' }).click()
  await expect(page.getByRole('button', { name: 'Show primary panel' })).toBeFocused()

  await page.reload()
  await expect(page.locator('[data-contract-lab-status]')).toHaveAttribute('data-ready', 'true')
  await expect
    .poll(
      async () =>
        matches(await client.listSessions())?.sessionId === initial.sessionId &&
        matches(await client.listSessions())!.generation > initial.generation,
    )
    .toBeTruthy()
  const next = matches(await client.listSessions())!
  expect(next.sessionId).toBe(initial.sessionId)
  expect(next.generation).toBeGreaterThan(initial.generation)
  const old = await client.setValues(initial, {
    type: 'set_values',
    requestId: 'lab-old-generation',
    values: { specimenMetric: 43 },
  })
  expect(old.type).toBe('bridge_error')
  expect(['generation_mismatch', 'session_not_found']).toContain(
    (old as { error: { code: string } }).error.code,
  )
  await expect(page.locator('[data-contract-lab-bound-display]')).toHaveText('24')
})
