import { expect, test, type Locator, type Page } from '@playwright/test'
import { requiredBox } from './helpers'
import { labURL } from './urls'

const storageKey = 'picodash-panel-interaction-lab:layout:v1'
const initialRootOrder = 'interaction-core,interaction-layout,interaction-root-status'
const reorderedRootOrder = 'interaction-layout,interaction-core,interaction-root-status'

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 820 })
  await page.goto(`${labURL}/lab/panel-interaction`)
  await page.evaluate((key) => localStorage.removeItem(key), storageKey)
  await page.reload()
  await expect(page.locator('[data-panel-interaction-lab]')).toBeVisible()
})

test('drags a floating panel, snaps it to a peer, and rehydrates its observable layout', async ({
  page,
}) => {
  const floating = interactionPanel(page, 'floating')
  const peer = interactionPanel(page, 'peer')
  const savedLayout = page.getByLabel('Floating saved layout')
  const peerGeometry = page.getByLabel('Snap peer geometry')
  const initial = await requiredBox(floating)

  await expect(peerGeometry).not.toHaveText('unmeasured')

  const floatingHeader = floating.locator('[data-picodash-panel-header]')

  await dragPanel(page, floatingHeader, {
    x: -120,
    y: 100,
  })
  await expect.poll(async () => (await requiredBox(floating)).x).not.toBeCloseTo(initial.x, 0)

  await snapPanelToPeer(page, floating, floatingHeader, peer)
  await expect
    .poll(async () => {
      const [panelBox, targetBox] = await Promise.all([requiredBox(floating), requiredBox(peer)])
      return Math.abs(panelBox.x + panelBox.width - targetBox.x)
    })
    .toBeLessThanOrEqual(1)

  const layoutBeforeReload = await savedLayout.textContent()
  expect(layoutBeforeReload).not.toBe('default')

  await page.reload()
  await expect(floating).toBeVisible()
  await expect(savedLayout).not.toHaveText('default')
  const layoutAfterReload = JSON.parse((await savedLayout.textContent()) ?? '{}') as {
    x: number
    y: number
  }
  const restoredPosition = await requiredBox(floating)
  expect(restoredPosition.x).toBeCloseTo(layoutAfterReload.x, 0)
  expect(restoredPosition.y).toBeCloseTo(layoutAfterReload.y, 0)
})

test('switches floating, magnetic, and fixed placement and reopens a retracted fixed panel', async ({
  page,
}) => {
  const floating = interactionPanel(page, 'floating')
  const fixed = interactionPanel(page, 'fixed')

  await page.getByRole('button', { name: 'Make magnetic' }).click()
  await expect(floating.getByText('magnetic:top', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Dock floating panel' }).click()
  await expect(floating.getByText('fixed:right', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Make floating' }).click()
  await expect(floating.getByText('floating:top-right', { exact: true })).toBeVisible()

  const toggle = page.getByRole('button', { name: 'Collapse panel Fixed interaction panel' })
  await toggle.click()
  await expect(fixed).toHaveAttribute('data-collapsed', 'true')
  await expect(
    page.getByRole('button', { name: 'Expand panel Fixed interaction panel' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Expand panel Fixed interaction panel' }).click()
  await expect(fixed).toHaveAttribute('data-collapsed', 'false')
})

test('cancels pointer reorder and commits a nested pointer reorder', async ({ page }) => {
  const panel = interactionPanel(page, 'dashlets')
  const rootOrder = panel.getByLabel('Root Dashlet order')
  const coreOrder = panel.getByLabel('Core Dashlet order')
  const activePointerReorder = panel.getByLabel('Active pointer reorder')
  const layoutGrip = panel.getByRole('button', { name: 'Reorder Layout Dashlets', exact: true })
  const coreGrip = panel.getByRole('button', { name: 'Reorder Core Dashlets', exact: true })
  const alphaGrip = panel.getByRole('button', { name: 'Reorder Alpha', exact: true })
  const betaGrip = panel.getByRole('button', { name: 'Reorder Beta', exact: true })
  const alphaItem = alphaGrip.locator('xpath=ancestor::*[@data-item-id][1]')
  const betaItem = betaGrip.locator('xpath=ancestor::*[@data-item-id][1]')
  const initialAlphaItemY = (await requiredBox(alphaItem)).y

  await beginPointerReorder(page, layoutGrip, coreGrip)
  await expect(activePointerReorder).toHaveText('interaction-layout')
  await layoutGrip.dispatchEvent('pointercancel', {
    bubbles: true,
    pointerId: 1,
    pointerType: 'mouse',
  })
  await expect(activePointerReorder).toHaveText('none')
  await page.mouse.up()
  await expect(rootOrder).toHaveText(initialRootOrder)
  await expect
    .poll(async () => Math.abs((await requiredBox(alphaItem)).y - initialAlphaItemY))
    .toBeLessThanOrEqual(0.5)

  await beginNestedPointerReorder(page, alphaGrip, betaGrip)
  await expect(activePointerReorder).toHaveText('interaction-alpha')
  await expect
    .poll(async () => (await requiredBox(alphaItem)).y > (await requiredBox(betaItem)).y)
    .toBe(true)
  await page.mouse.up()
  await expect(coreOrder).toHaveText('label,interaction-beta,interaction-alpha')
})

test('pointer and keyboard root reorders produce the same lab-owned state', async ({ page }) => {
  const panel = interactionPanel(page, 'dashlets')
  const rootOrder = panel.getByLabel('Root Dashlet order')
  const layoutGrip = panel.getByRole('button', { name: 'Reorder Layout Dashlets', exact: true })

  await layoutGrip.press('Space')
  await layoutGrip.press('ArrowUp')
  await layoutGrip.press('Enter')
  await expect(rootOrder).toHaveText(reorderedRootOrder)
  const keyboardOrder = await rootOrder.textContent()

  await page.reload()
  await expect(rootOrder).toHaveText(initialRootOrder)
  await dragReorder(
    page,
    panel.getByRole('button', { name: 'Reorder Layout Dashlets', exact: true }),
    panel.getByRole('button', { name: 'Reorder Core Dashlets', exact: true }),
  )
  await expect(rootOrder).toHaveText(keyboardOrder ?? '')
})

test('collapses groups, resets values, runs custom actions, and carries theme through overlays', async ({
  context,
  page,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const panel = interactionPanel(page, 'dashlets')
  const trigger = panel.getByRole('button', { name: 'Open lab actions' })
  const coreToggle = panel.getByRole('button', { name: 'Core Dashlets', exact: true })
  const layoutToggle = panel.getByRole('button', { name: 'Layout Dashlets', exact: true })
  const label = panel.getByRole('textbox', { name: 'Label' })

  await expect(panel).toHaveAttribute('data-picodash-theme', 'light')
  await expect(page.locator('[data-picodash-provider-content]')).toHaveAttribute(
    'data-picodash-theme',
    'dark',
  )
  await trigger.click()
  const menu = page.getByRole('menu', { name: 'Lab actions' })
  await expect(menu).toHaveAttribute('data-picodash-theme', 'light')
  await menu.getByRole('menuitem', { name: 'Collapse all' }).click()
  await expect(coreToggle).toHaveAttribute('aria-expanded', 'false')
  await expect(layoutToggle).toHaveAttribute('aria-expanded', 'false')

  await trigger.click()
  await menu.getByRole('menuitem', { name: 'Expand all' }).click()
  await expect(coreToggle).toHaveAttribute('aria-expanded', 'true')

  await label.fill('Changed')
  await trigger.click()
  await menu.getByRole('menuitem', { name: 'Reset…' }).click()
  const resetDialog = page.getByRole('alertdialog', { name: 'Reset Interaction Dashlets?' })
  await expect(resetDialog).toHaveAttribute('data-picodash-theme', 'light')
  await resetDialog.getByRole('button', { name: 'Reset values' }).click()
  await expect(label).toHaveValue('Baseline')
  await expect(
    panel.getByRole('status').filter({ hasText: 'Reset all registered panel values.' }),
  ).toHaveText('Reset all registered panel values.')

  await openSubmenu(page, trigger, 'Copy')
  await page.getByRole('menuitem', { name: 'Copy JSON' }).click()
  await expect(
    panel.getByRole('status').filter({ hasText: 'Copied panel values as JSON.' }),
  ).toHaveText('Copied panel values as JSON.')
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain('Baseline')

  await openSubmenu(page, trigger, 'Export')
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('menuitem', { name: 'Export JSON' }).click(),
  ])
  expect(download.suggestedFilename()).toBe('interaction-dashlets.json')

  await trigger.click()
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    menu.getByRole('menuitem', { name: 'Import…' }).click(),
  ])
  await chooser.setFiles({
    buffer: Buffer.from('{"label":"Imported"}'),
    mimeType: 'application/json',
    name: 'interaction.json',
  })
  await expect(label).toHaveValue('Imported')

  await trigger.click()
  await menu.getByRole('menuitem', { name: 'Clear marker…' }).click()
  const dialog = page.getByRole('alertdialog', { name: 'Clear interaction marker?' })
  await expect(dialog).toHaveAttribute('data-picodash-theme', 'light')
  await dialog.getByRole('button', { name: 'Clear marker' }).click()
  await expect(dialog).toBeHidden()
  await expect(panel.getByText('cleared', { exact: true })).toBeVisible()
  await expect(interactionPanel(page, 'no-actions').getByRole('button')).toHaveCount(0)
})

test('hides by default close without losing state, then deregisters explicitly', async ({
  page,
}) => {
  const lifecycle = interactionPanel(page, 'lifecycle')
  const dashlets = interactionPanel(page, 'dashlets')
  const peer = interactionPanel(page, 'peer')

  await page.getByRole('button', { name: 'Show Lifecycle' }).click()
  await expect(lifecycle).toBeVisible()
  const lifecycleNote = lifecycle.getByRole('textbox', { name: 'Lifecycle note' })
  await lifecycleNote.fill('Retained after default close')
  await lifecycle.getByRole('button', { name: 'Close panel Lifecycle panel' }).click()
  await expect(lifecycle).toBeHidden()
  await expect(page.getByLabel('Lifecycle panel registration')).toHaveText('hidden')
  await expect(page.getByLabel('Last panel close')).toHaveText('interaction-lifecycle:hide')
  await page.getByRole('button', { name: 'Show Lifecycle' }).click()
  await expect(lifecycleNote).toHaveValue('Retained after default close')

  await page.getByRole('button', { name: 'Activate Dashlets' }).click()
  expect(await zIndex(dashlets)).toBeGreaterThan(await zIndex(peer))
  await page.getByRole('button', { name: 'Activate peer' }).click()
  expect(await zIndex(peer)).toBeGreaterThan(await zIndex(dashlets))

  const deregister = interactionPanel(page, 'deregister')
  await page.getByRole('button', { name: 'Show Deregistration' }).click()
  await expect(deregister).toBeVisible()
  await deregister.getByRole('button', { name: 'Close panel Deregistration panel' }).click()
  await expect(deregister).toHaveCount(0)
  await expect(page.getByLabel('Deregistration panel registration')).toHaveText('unregistered')
  await expect(page.getByLabel('Last panel close')).toHaveText('interaction-deregister:deregister')
  await page.getByRole('button', { name: 'Register deregistration panel' }).click()
  await expect(interactionPanel(page, 'deregister')).toBeHidden()
  await page.getByRole('button', { name: 'Show Deregistration' }).click()
  await expect(interactionPanel(page, 'deregister')).toBeVisible()
})

function interactionPanel(page: Page, fixture: string) {
  return page.locator(`[data-interaction-fixture="${fixture}"][data-picodash-panel]`)
}

async function dragPanel(page: Page, source: Locator, delta: { x: number; y: number }) {
  const box = await requiredBox(source)
  const startX = box.x + box.width / 2
  const startY = box.y + box.height / 2
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX + delta.x, startY + delta.y, { steps: 8 })
  await page.mouse.up()
}

async function snapPanelToPeer(page: Page, panel: Locator, header: Locator, peer: Locator) {
  const [panelBox, peerBox, headerBox] = await Promise.all([
    requiredBox(panel),
    requiredBox(peer),
    requiredBox(header),
  ])
  const startX = headerBox.x + headerBox.width / 2
  const startY = headerBox.y + headerBox.height / 2
  const peerEdgeDelta = peerBox.x - (panelBox.x + panelBox.width)
  let pointerX = startX + peerEdgeDelta - 40

  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(pointerX, startY, { steps: 12 })

  const intermediatePanel = await requiredBox(panel)
  pointerX += peerBox.x - (intermediatePanel.x + intermediatePanel.width)
  await page.mouse.move(pointerX, startY, { steps: 4 })

  await expect(panel).toHaveAttribute('data-picodash-panel-snapping', '')
  await page.mouse.up()
}

async function beginPointerReorder(page: Page, source: Locator, target: Locator) {
  const [sourceBox, targetBox] = await Promise.all([requiredBox(source), requiredBox(target)])
  const startX = sourceBox.x + sourceBox.width / 2
  const startY = sourceBox.y + sourceBox.height / 2
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX, targetBox.y + targetBox.height + 16, { steps: 8 })
}

async function dragReorder(page: Page, source: Locator, target: Locator) {
  await beginPointerReorder(page, source, target)
  await page.mouse.up()
}

async function beginNestedPointerReorder(page: Page, source: Locator, target: Locator) {
  const sourceItem = source.locator('xpath=ancestor::*[@data-item-id][1]')
  const targetItem = target.locator('xpath=ancestor::*[@data-item-id][1]')
  await source.scrollIntoViewIfNeeded()
  const sourceGripBox = await requiredBox(source)
  const startX = sourceGripBox.x + sourceGripBox.width / 2
  const startY = sourceGripBox.y + sourceGripBox.height / 2

  await page.mouse.move(startX, startY)
  await page.mouse.down()

  const [sourceItemBox, targetItemBox] = await Promise.all([
    requiredBox(sourceItem),
    requiredBox(targetItem),
  ])
  const direction = Math.sign(targetItemBox.y - sourceItemBox.y)
  expect(direction).not.toBe(0)

  const sourceLeadingEdge = direction > 0 ? sourceItemBox.y + sourceItemBox.height : sourceItemBox.y
  const targetMidpoint = targetItemBox.y + targetItemBox.height / 2
  const crossingOffset = targetMidpoint - sourceLeadingEdge + direction * 2
  const crossingY = startY + crossingOffset
  expect(crossingY).toBeGreaterThan(targetItemBox.y)
  expect(crossingY).toBeLessThan(targetItemBox.y + targetItemBox.height)

  await page.mouse.move(startX, crossingY, { steps: 4 })
}

async function openSubmenu(page: Page, trigger: Locator, name: string) {
  await trigger.click()
  const item = page.getByRole('menuitem', { name })
  await item.focus()
  await item.press('ArrowRight')
  await expect(page.getByRole('menu')).toHaveCount(2)
}

async function zIndex(locator: Locator) {
  return Number(
    await locator.evaluate((element) => getComputedStyle(element.parentElement!).zIndex),
  )
}
