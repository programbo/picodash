import { devices, expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createPicodashDevBridgeClient } from '@picodash/dev-bridge'

const consoleErrors = new WeakMap<Page, string[]>()
const persistenceProbeStorageKey = 'picodash-contract-lab-web-storage-probe-v1'

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
  ['composition', 'Style lab'],
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
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('Web Storage blocked', 'SecurityError')
      },
    })
  })
  await openLab(page)

  await expect(page.locator('[data-product-route="contract-lab"]')).toHaveCount(1)
  await expect(page.locator('[data-contract-lab-persistence-status]')).toHaveText(
    'Persistence status: unavailable',
  )
  await expect(page.getByRole('button', { name: 'Write metadata probe' })).toBeDisabled()
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
  await expect(page.getByRole('region', { name: 'Contract Lab status' })).toContainText(
    /Diagnostics\s*clear/,
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

test('renders the two-panel Dashlet style lab with the accepted groups and lanes', async ({
  page,
}) => {
  await openLab(page)
  await page.getByRole('button', { name: /^Style lab:/ }).click()

  const basicsPanel = page.getByRole('complementary', { name: 'Basics & readout' })
  const choicesPanel = page.getByRole('complementary', { name: 'Choices & temporal' })
  await expect(page.locator('[data-style-lab-panel]')).toHaveCount(2)
  await expect(page.locator('[data-picodash-dashlet^="style-lab-"]')).toHaveCount(22)
  await expect(basicsPanel).toHaveAttribute('data-picodash-placement', 'hybrid-docked')
  await expect(choicesPanel).toHaveAttribute('data-picodash-placement', 'hybrid-docked')
  await expect(
    page.locator('[data-contract-lab-status] dt', { hasText: 'Diagnostics' }).locator('..'),
  ).toContainText('1')

  const basicsList = basicsPanel.getByRole('list', { name: 'Basics and readout Dashlets' })
  const choicesList = choicesPanel.getByRole('list', { name: 'Choices and temporal Dashlets' })
  await expect(basicsList.getByRole('group', { name: 'Basics' })).toBeVisible()
  await expect(basicsList.getByRole('group', { name: 'Readout' })).toBeVisible()
  await expect(choicesList.getByRole('group', { name: 'Choices' })).toBeVisible()
  await expect(choicesList.getByRole('group', { name: 'Temporal' })).toBeVisible()

  await expect(basicsList.locator('[data-style-lab-lane="start"]')).toHaveAttribute(
    'data-picodash-dashlet',
    'style-lab-search',
  )
  await expect(choicesList.locator('[data-style-lab-lane="auto"]')).toHaveAttribute(
    'data-picodash-dashlet',
    'style-lab-color',
  )
  await expect(
    basicsList
      .getByRole('group', { name: 'Basics' })
      .locator('[data-picodash-dashlet="style-lab-range"]'),
  ).toBeVisible()

  const gallery = page.getByRole('list', { name: 'Dashlet gallery' })
  for (const group of [
    'Common inputs',
    'Direct manipulation',
    'Media and files',
    'Charts',
    'Readouts',
    'Compound recipes',
  ]) {
    await expect(gallery.getByRole('group', { name: group, exact: true })).toBeVisible()
  }
  await expect(page.getByRole('img', { name: 'Request trend' })).toBeVisible()

  const collapseBasics = basicsPanel.getByRole('button', {
    name: 'Collapse panel Basics & readout',
  })
  await collapseBasics.focus()
  await collapseBasics.press('Enter')
  const expandBasics = basicsPanel.getByRole('button', {
    name: 'Expand panel Basics & readout',
  })
  await expect(expandBasics).toBeFocused()
  await expect(expandBasics).toHaveAttribute('aria-expanded', 'false')
  await expect(basicsList).toBeHidden()
  await expandBasics.press('Enter')
  await expect(collapseBasics).toBeFocused()
  await expect(collapseBasics).toHaveAttribute('aria-expanded', 'true')
  await expect(basicsList).toBeVisible()
})

test('opens, cancels, and restores focus for the landed shared AlertDialog', async ({ page }) => {
  await openLab(page)
  await page.getByRole('button', { name: /^Overlays:/ }).click()

  const trigger = page.getByRole('button', { name: 'Open shared AlertDialog' })
  await trigger.focus()
  await trigger.press('Enter')
  const dialog = page.getByRole('alertdialog', { name: 'Contract Lab confirmation' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

test('proves regular and compact UI geometry plus coarse-pointer hit targets', async ({
  page,
  browser,
}) => {
  await openLab(page)
  const standalonePanel = page.getByRole('complementary', { name: 'Standalone Panel' })
  const portalTarget = page.locator('[data-contract-lab-standalone-portal-target]')
  await expect(standalonePanel).toBeVisible()
  await expect(portalTarget.locator('[data-contract-lab-standalone-panel]')).toHaveCount(1)
  const specimenBoundary = page.locator('[data-contract-lab-specimen]')
  const boundaryBox = (await specimenBoundary.boundingBox())!
  const moveControl = standalonePanel.getByRole('button', {
    name: 'Move panel Standalone Panel',
  })
  await page.getByRole('button', { name: 'Close panel Primary Panel' }).press('Enter')
  const beforePointer = (await standalonePanel.boundingBox())!
  const moveBox = (await moveControl.boundingBox())!
  await page.mouse.move(moveBox.x + moveBox.width / 2, moveBox.y + moveBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(moveBox.x + moveBox.width / 2 + 48, moveBox.y + moveBox.height / 2 + 32)
  await page.mouse.up()
  const afterPointer = (await standalonePanel.boundingBox())!
  expect(afterPointer.x).not.toBe(beforePointer.x)
  expect(afterPointer.y).not.toBe(beforePointer.y)
  expect(afterPointer.x).toBeGreaterThanOrEqual(boundaryBox.x)
  expect(afterPointer.y).toBeGreaterThanOrEqual(boundaryBox.y)
  expect(afterPointer.x + afterPointer.width).toBeLessThanOrEqual(boundaryBox.x + boundaryBox.width)
  expect(afterPointer.y + afterPointer.height).toBeLessThanOrEqual(
    boundaryBox.y + boundaryBox.height,
  )

  await portalTarget.evaluate((target) => document.body.append(target))
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
      ),
  )
  const beforeBoundaryTranslation = (await standalonePanel.boundingBox())!
  await specimenBoundary.evaluate((boundary) => {
    boundary.style.transform = 'translate(20px, 12px)'
  })
  await expect
    .poll(async () => (await standalonePanel.boundingBox())?.x)
    .toBeCloseTo(beforeBoundaryTranslation.x + 20, 0)
  await expect
    .poll(async () => (await standalonePanel.boundingBox())?.y)
    .toBeCloseTo(beforeBoundaryTranslation.y + 12, 0)
  await specimenBoundary.evaluate((boundary) => {
    boundary.style.transform = ''
  })
  await portalTarget.evaluate((target) => {
    document.querySelector('[data-contract-lab-specimen]')?.append(target)
  })
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
      ),
  )

  await moveControl.focus()
  const beforeKeyboard = (await standalonePanel.boundingBox())!
  await moveControl.press('Enter')
  await moveControl.press('Shift+ArrowRight')
  await moveControl.press('Enter')
  const afterKeyboard = (await standalonePanel.boundingBox())!
  expect(afterKeyboard.x).not.toBe(beforeKeyboard.x)
  await expect(moveControl).toBeFocused()
  await expect(
    standalonePanel.locator('[data-contract-lab-standalone-panel-placement]'),
  ).toHaveText('floating-free')
  await standalonePanel.getByRole('button', { name: 'Reset panel layout' }).click()
  await expect(
    standalonePanel.locator('[data-contract-lab-standalone-panel-placement]'),
  ).toHaveText('floating-snapped')
  await page.getByRole('button', { name: /^Overlays:/ }).click()
  const regularTrigger = page.getByRole('button', { name: 'Open shared AlertDialog' })
  const regular = await regularTrigger.evaluate((element) => {
    const style = getComputedStyle(element)
    const rect = element.getBoundingClientRect()
    return {
      density: element.closest('[data-picodash-density]')?.getAttribute('data-picodash-density'),
      height: rect.height,
      width: rect.width,
      controlHeight: style.getPropertyValue('--picodash-control-height-md').trim(),
      fontSize: style.fontSize,
    }
  })
  expect(regular.density).toBe('regular')
  expect(regular.height).toBe(32)
  expect(regular.controlHeight).toBe('2rem')

  await page.getByRole('button', { name: /^Themes:/ }).click()
  const compactTrigger = page.getByRole('button', { name: 'Open shared AlertDialog' })
  const compact = await compactTrigger.evaluate((element) => {
    const style = getComputedStyle(element)
    const rect = element.getBoundingClientRect()
    return {
      density: element.closest('[data-picodash-density]')?.getAttribute('data-picodash-density'),
      height: rect.height,
      width: rect.width,
      controlHeight: style.getPropertyValue('--picodash-control-height-md').trim(),
      fontSize: style.fontSize,
    }
  })
  expect(compact.density).toBe('compact')
  expect(compact.height).toBe(28)
  expect(compact.height).toBeLessThan(regular.height)
  expect(compact.controlHeight).toBe('1.75rem')
  expect(compact.fontSize).toBe(regular.fontSize)

  const coarseContext = await browser.newContext({
    ...devices['iPhone 13'],
    baseURL: new URL(page.url()).origin,
  })
  try {
    const coarseErrors: string[] = []
    const coarsePage = await coarseContext.newPage()
    coarsePage.on('console', (message) => {
      if (message.type() === 'error') coarseErrors.push(message.text())
    })
    coarsePage.on('pageerror', (error) => coarseErrors.push(error.message))
    await openLab(coarsePage)
    await coarsePage.addStyleTag({ content: ':root { font-size: 12px; }' })
    await expect
      .poll(() => coarsePage.evaluate(() => getComputedStyle(document.documentElement).fontSize))
      .toBe('12px')
    await coarsePage.getByRole('button', { name: 'Close panel Primary Panel' }).press('Enter')
    await coarsePage.getByRole('button', { name: /^Style lab:/ }).press('Enter')
    const coarseReorder = coarsePage.getByRole('button', { name: 'Reorder Basics' })
    const coarseReorderBounds = await coarseReorder.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return { width: rect.width, height: rect.height }
    })
    expect(coarseReorderBounds.width).toBeGreaterThanOrEqual(44)
    expect(coarseReorderBounds.height).toBeGreaterThanOrEqual(44)

    const multiSelectDashlet = coarsePage.locator(
      '[data-picodash-dashlet="style-lab-multi-select"]',
    )
    const removeTag = multiSelectDashlet.locator('[data-picodash-dashlist-tag-remove]').first()
    await removeTag.scrollIntoViewIfNeeded()
    const removeTagBounds = await removeTag.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return { width: rect.width, height: rect.height }
    })
    expect(removeTagBounds.width).toBeGreaterThanOrEqual(44)
    expect(removeTagBounds.height).toBeGreaterThanOrEqual(44)

    const selectDashlet = coarsePage.locator('[data-picodash-dashlet="style-lab-select"]')
    const selectTrigger = selectDashlet.getByRole('button', {
      name: 'Option B SelectDashlet',
      exact: true,
    })
    await selectTrigger.press('Enter')
    const popupOption = coarsePage.locator(".picodash-dashlist-listbox [role='option']").first()
    await expect(popupOption).toBeVisible()
    const popupOptionBounds = await popupOption.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return { width: rect.width, height: rect.height }
    })
    expect(popupOptionBounds.width).toBeGreaterThanOrEqual(44)
    expect(popupOptionBounds.height).toBeGreaterThanOrEqual(44)
    await selectTrigger.press('Escape')
    await expect(popupOption).toHaveCount(0)

    await coarsePage.getByRole('button', { name: /^Themes:/ }).press('Enter')
    const coarseTrigger = coarsePage.getByRole('button', { name: 'Open shared AlertDialog' })
    const coarse = await coarseTrigger.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return {
        coarsePointer: matchMedia('(pointer: coarse)').matches,
        width: rect.width,
        height: rect.height,
      }
    })
    expect(coarse.coarsePointer).toBe(true)
    expect(coarse.width).toBeGreaterThanOrEqual(44)
    expect(coarse.height).toBeGreaterThanOrEqual(44)

    await coarsePage.getByRole('button', { name: 'Open shared ActionMenu' }).press('Enter')
    for (const menuItem of [
      coarsePage.getByRole('menuitem', { name: 'Inspect shared action' }),
      coarsePage.getByRole('menuitem', { name: 'More shared actions' }),
    ]) {
      const bounds = await menuItem.evaluate((element) => {
        const rect = element.getBoundingClientRect()
        return { width: rect.width, height: rect.height }
      })
      expect(bounds.width).toBeGreaterThanOrEqual(44)
      expect(bounds.height).toBeGreaterThanOrEqual(44)
    }
    expect(coarseErrors).toEqual([])
  } finally {
    await coarseContext.close()
  }
})

test('connects the real browser specimen through the dev bridge and rejects the retired generation', async ({
  page,
}) => {
  await openLab(page)
  await page.evaluate((key) => localStorage.removeItem(key), persistenceProbeStorageKey)
  await page.reload()
  await expect(page.locator('[data-contract-lab-status]')).toHaveAttribute('data-ready', 'true')
  const persistencePage = await page.context().newPage()
  await persistencePage.goto('/lab')
  await expect(persistencePage.locator('[data-contract-lab-status]')).toHaveAttribute(
    'data-ready',
    'true',
  )
  const persistenceStatus = page.locator('[data-contract-lab-persistence-status]')
  const persistenceStatusPeer = persistencePage.locator('[data-contract-lab-persistence-status]')
  await expect(persistenceStatus).toHaveText('Persistence status: clean')
  await expect(persistenceStatusPeer).toHaveText('Persistence status: clean')
  await page.getByRole('button', { name: 'Write metadata probe' }).press('Enter')
  await expect(page.locator('[data-contract-lab-persistence-command]')).toHaveText(
    'Metadata write accepted.',
  )
  await expect(persistenceStatusPeer).toHaveText('Persistence status: conflict')
  const peerStatusBeforeUnrelated = await persistenceStatusPeer.textContent()
  const peerCommandBeforeUnrelated = await persistencePage
    .locator('[data-contract-lab-persistence-command]')
    .textContent()
  await page.evaluate(() => localStorage.setItem('contract-lab-unrelated-key', 'ignored'))
  await expect(persistenceStatusPeer).toHaveText(peerStatusBeforeUnrelated ?? '')
  await expect(persistencePage.locator('[data-contract-lab-persistence-command]')).toHaveText(
    peerCommandBeforeUnrelated ?? '',
  )
  await persistencePage.close()
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
  expect(initialSnapshot.snapshot.diagnostics).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        code: 'metadata_quarantined',
        identity: { kind: 'scope-metadata', scopeId: 'quarantined-panel' },
      }),
    ]),
  )
  await expect(
    page.locator('[data-contract-lab-status] dt', { hasText: 'Diagnostics' }).locator('..'),
  ).toContainText('1')
  await expect(page.locator('[data-contract-lab-migration]')).toContainText('legacyMetric')
  await expect(page.locator('[data-contract-lab-quarantine-default]')).toContainText(
    'current defaults',
  )
  await page.getByRole('button', { name: 'Replace quarantined metadata' }).press('Enter')
  await expect(page.locator('[data-contract-lab-quarantine-state]')).toHaveText(
    'Quarantined metadata replaced.',
  )
  const recoveredSnapshot = await client.inspect(matches(await client.listSessions())!)
  expect(recoveredSnapshot.snapshot.diagnostics ?? []).not.toEqual(
    expect.arrayContaining([expect.objectContaining({ code: 'metadata_quarantined' })]),
  )
  await expect(
    page.locator('[data-contract-lab-status] dt', { hasText: 'Diagnostics' }).locator('..'),
  ).toContainText('clear')
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

  await page.getByRole('button', { name: 'Capture document' }).press('Enter')
  await expect(page.locator('[data-contract-lab-document-status]')).toHaveText(
    'Document captured for local restore.',
  )
  const beforeDocumentMutation = matches(await client.listSessions())!
  const documentMutation = await client.setValues(beforeDocumentMutation, {
    type: 'set_values',
    requestId: 'lab-document-mutation-33',
    values: { specimenMetric: 33 },
  })
  expect(documentMutation.type).toBe('command_result')
  await expect(page.locator('[data-contract-lab-bound-display]')).toHaveText('33')
  await page.getByRole('button', { name: 'Restore captured document' }).press('Enter')
  await expect(page.locator('[data-contract-lab-document-status]')).toHaveText(
    'Captured document restored.',
  )
  await expect(page.locator('[data-contract-lab-bound-display]')).toHaveText('42')
  await expect(page.locator('[data-contract-lab-bound-input]')).toHaveValue('42')
  const restoredSession = matches(await client.listSessions())!
  const restoredSnapshot = await client.inspect(restoredSession)
  expect(restoredSnapshot.snapshot.values?.specimenMetric).toBe(42)
  const restoredWait = await client.wait(restoredSession, {
    type: 'wait',
    requestId: 'lab-wait-document-restore-42',
    timeoutMs: 1000,
    condition: {
      type: 'value_equals',
      field: 'specimenMetric',
      value: 42,
      afterSequence: beforeDocumentMutation.sequence,
    },
  })
  expect(restoredWait.type).toBe('wait_result')
  expect((restoredWait as { outcome: string }).outcome).toBe('satisfied')

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

  await page.getByRole('button', { name: 'Close panel Primary Panel' }).press('Enter')
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
  await page.getByRole('button', { name: 'Show primary panel' }).press('Enter')
  await expect(specimenPanel).toBeVisible()
  await expect(page.getByRole('button', { name: 'Collapse panel Primary Panel' })).toBeFocused()
  await expect(page.locator('[data-contract-lab-bound-display]')).toHaveText('42')
  await expect(boundInput).toHaveValue('not-a-number')
  await expect(boundInput).toHaveAttribute('data-stale', 'true')
  expect(matches(await client.listSessions())!).toMatchObject({
    sessionId: beforeReopen.sessionId,
    generation: beforeReopen.generation,
  })
  await boundInput.fill('37')
  await expect(boundInput).toHaveAttribute('data-stale', 'true')
  const beforeOverwriteSession = matches(await client.listSessions())!
  await page.getByRole('button', { name: 'Overwrite value…' }).press('Enter')
  const overwriteDialog = page.getByRole('alertdialog', { name: 'Overwrite the current value?' })
  await expect(overwriteDialog).toBeVisible()
  await overwriteDialog.getByRole('button', { name: 'Cancel' }).press('Enter')
  await expect(overwriteDialog).toHaveCount(0)
  await expect(boundInput).toHaveValue('37')
  await expect(boundInput).toHaveAttribute('data-stale', 'true')
  expect(
    (await client.inspect(matches(await client.listSessions())!)).snapshot.values?.specimenMetric,
  ).toBe(42)
  await page.getByRole('button', { name: 'Overwrite value…' }).press('Enter')
  await expect(overwriteDialog).toBeVisible()
  const changedWhileConfirming = await client.setValues(matches(await client.listSessions())!, {
    type: 'set_values',
    requestId: 'lab-stale-overwrite-plan',
    values: { specimenMetric: 39 },
  })
  expect(changedWhileConfirming.type).toBe('command_result')
  await overwriteDialog.getByRole('button', { name: 'Overwrite value' }).press('Enter')
  await expect(boundInput).toHaveValue('37')
  await expect(boundInput).toHaveAttribute('data-stale', 'true')
  await expect(
    page.locator('[data-picodash-dashlist] div[role="status"]').filter({
      hasText: 'Stale overwrite plan is stale.',
    }),
  ).toContainText('Stale overwrite plan is stale.')
  expect(
    (await client.inspect(matches(await client.listSessions())!)).snapshot.values?.specimenMetric,
  ).toBe(39)
  await page.getByRole('button', { name: 'Overwrite value…' }).press('Enter')
  await expect(overwriteDialog).toBeVisible()
  await overwriteDialog.getByRole('button', { name: 'Overwrite value' }).press('Enter')
  await expect(boundInput).toHaveValue('37')
  await expect(boundInput).toHaveAttribute('data-stale', 'false')
  await expect
    .poll(async () => {
      const session = matches(await client.listSessions())!
      return (await client.inspect(session)).snapshot.values?.specimenMetric
    })
    .toBe(37)
  const finalSession = matches(await client.listSessions())!
  const finalSnapshot = await client.inspect(finalSession)
  expect(finalSnapshot.snapshot.values?.specimenMetric).toBe(37)
  const finalWait = await client.wait(finalSession, {
    type: 'wait',
    requestId: 'lab-wait-overwrite-37',
    timeoutMs: 1000,
    condition: {
      type: 'value_equals',
      field: 'specimenMetric',
      value: 37,
      afterSequence: beforeOverwriteSession.sequence,
    },
  })
  expect(finalWait.type).toBe('wait_result')
  expect((finalWait as { outcome: string }).outcome).toBe('satisfied')
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
  await page.evaluate((key) => {
    localStorage.removeItem(key)
    localStorage.removeItem('contract-lab-unrelated-key')
  }, persistenceProbeStorageKey)
})
