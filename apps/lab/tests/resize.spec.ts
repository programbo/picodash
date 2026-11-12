import { expect, test, type Locator, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  createPicodashDevBridgeClient,
  type PicodashDevBridgeClient,
  type PicodashDevBridgeSessionDescriptor,
} from '@picodash/dev-bridge'

const scopeId = 'contract-lab-resize-panel'
const errors = new WeakMap<Page, string[]>()

test.beforeEach(async ({ page }) => {
  const messages: string[] = []
  errors.set(page, messages)
  page.on('pageerror', (error) => messages.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') messages.push(message.text())
  })
  await page.setViewportSize({ width: 1600, height: 1100 })
})

test.afterEach(async ({ page }) => {
  expect(errors.get(page) ?? [], 'unexpected browser errors').toEqual([])
})

async function openResizeLab(page: Page) {
  await page.goto('/lab')
  await expect(page.locator('[data-contract-lab-status]')).toHaveAttribute('data-ready', 'true')
  await page.getByRole('button', { name: 'Reset lab', exact: true }).click()
  await page.getByRole('button', { name: 'Resize lab', exact: true }).click()
  await expect(page.getByLabel('Resize measurement readiness')).toHaveText('Ready')
  return page.getByRole('complementary', { name: 'Resize Panel', exact: true })
}

async function bridgeFor(page: Page) {
  const raw: unknown = JSON.parse(
    await readFile(resolve(process.cwd(), '../../.picodash/dev-bridge.json'), 'utf8'),
  )
  if (
    !raw ||
    typeof raw !== 'object' ||
    !('url' in raw) ||
    typeof raw.url !== 'string' ||
    !('token' in raw) ||
    typeof raw.token !== 'string'
  )
    throw new Error('Expected private Lab Bridge credentials.')
  const client = createPicodashDevBridgeClient({ baseUrl: raw.url, token: raw.token })
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem('picodash-dev-bridge-tab')))
    .toEqual(expect.any(String))
  const tabId = await page.evaluate(() => sessionStorage.getItem('picodash-dev-bridge-tab'))
  const session = async () =>
    (await client.listSessions()).find(
      (candidate) =>
        candidate.registrationId === 'contract-lab-resize' && candidate.browserTabId === tabId,
    )
  await expect.poll(session).toBeTruthy()
  return {
    client,
    session: async () => {
      const found = await session()
      if (!found) throw new Error('Resize Lab Bridge session is unavailable.')
      return found
    },
  }
}

async function metadata(
  client: PicodashDevBridgeClient,
  session: PicodashDevBridgeSessionDescriptor,
) {
  return (await client.inspect(session)).snapshot.scopes?.find((scope) => scope.id === scopeId)
    ?.metadata
}

async function box(panel: Locator) {
  const result = await panel.boundingBox()
  if (!result) throw new Error('Expected visible Panel geometry.')
  return result
}

async function dragTarget(
  page: Page,
  panel: Locator,
  target: string,
  x: number,
  y: number,
  release = true,
  steps = 8,
) {
  const handle = panel.getByRole('button', {
    name: `Resize panel Resize Panel from ${target}`,
    exact: true,
  })
  // A real hover checks hit testing and scrolls past the sticky Lab status strip.
  // Measuring immediately after minimal scrolling can capture a still-moving portal rectangle.
  await handle.hover()
  const start = await box(handle)
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2)
  await page.mouse.down()
  await page.mouse.move(start.x + start.width / 2 + x, start.y + start.height / 2 + y, { steps })
  if (release) await page.mouse.up()
}

test('retains manual intent through resize, contracted reload, expansion and header restoration', async ({
  page,
}, testInfo) => {
  const panel = await openResizeLab(page)
  await page.getByLabel('Requested manual width').fill('480')
  await page.getByLabel('Requested manual height').fill('320')
  await page.getByRole('button', { name: 'Set manual size', exact: true }).click()
  await expect(page.getByLabel('Manual panel size')).toHaveText('480 × 320')
  const move = panel.getByRole('button', { name: 'Move panel Resize Panel', exact: true })
  await move.press('Enter')
  await move.press('Shift+ArrowRight')
  await move.press('Shift+ArrowDown')
  await move.press('Enter')
  const bridge = await bridgeFor(page)
  const session = await bridge.session()
  const baseline = await bridge.client.readEvents(session, {
    type: 'read_events',
    requestId: 'resize-baseline',
  })
  if (baseline.type !== 'events_result') throw new Error('Expected an event cursor baseline.')
  const beforeResize = await metadata(bridge.client, session)
  await dragTarget(page, panel, 'e', 48, 0, false)
  await expect(panel).toHaveAttribute('data-picodash-resizing', 'e')
  expect(await metadata(bridge.client, session)).toEqual(beforeResize)
  await page.mouse.up()
  await expect(page.getByLabel('Manual panel size')).toHaveText('528 × 320')
  const saved = await metadata(bridge.client, session)
  expect(saved).toMatchObject({
    dashPanel: {
      version: 2,
      manualSize: { width: 528, height: 320 },
      preferredPosition: { x: 34, y: 34 },
    },
  })
  const observed = await bridge.client.readEvents(session, {
    type: 'read_events',
    requestId: 'resize-observed',
    cursor: baseline.cursor,
    timeoutMs: 1000,
  })
  if (observed.type !== 'events_result') throw new Error('Expected disclosed resize events.')
  expect(observed.outcome).toBe('available')
  expect(observed.events.map((entry) => entry.event.event)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ type: 'hover', phase: 'enter' }),
      expect.objectContaining({ type: 'pointer', phase: 'down' }),
      expect.objectContaining({ type: 'pointer', phase: 'up' }),
    ]),
  )
  const resizeEvents = observed.events
    .map((entry) => entry.event)
    .filter(({ event }) => 'operation' in event && event.operation === 'resize')
  expect(resizeEvents.map(({ event }) => event.type)).toEqual(
    expect.arrayContaining(['drag.start', 'drag.update', 'drag.end']),
  )
  const ended = resizeEvents.find(({ event }) => event.type === 'drag.end')
  expect(ended?.event).toMatchObject({
    outcome: 'accepted',
    geometry: { delta: { width: 48, height: 0 } },
  })
  expect(resizeEvents.every(({ source }) => source.scopeId === scopeId)).toBe(true)
  const full = await box(panel)
  await page.getByRole('button', { name: 'Shrink container', exact: true }).click()
  await expect.poll(async () => (await box(panel)).width).toBeLessThan(full.width)
  expect(await metadata(bridge.client, session)).toEqual(saved)
  await page.reload()
  await expect(page.getByLabel('Resize measurement readiness')).toHaveText('Ready')
  await expect(page.getByRole('button', { name: 'Restore container', exact: true })).toBeVisible()
  await expect(page.getByLabel('Manual panel size')).toHaveText('528 × 320')
  const restoredSession = await bridge.session()
  expect(restoredSession.generation).toBeGreaterThan(session.generation)
  const stale = await bridge.client.readEvents(restoredSession, {
    type: 'read_events',
    requestId: 'stale-resize-cursor',
    cursor: baseline.cursor,
  })
  expect(stale.type).toBe('bridge_error')
  await page.getByRole('button', { name: 'Restore container', exact: true }).click()
  await expect.poll(async () => Math.round((await box(panel)).width)).toBe(528)
  await expect.poll(async () => Math.round((await box(panel)).height)).toBe(320)
  expect(await metadata(bridge.client, restoredSession)).toEqual(saved)
  await testInfo.attach('manual-size-restored', {
    body: await panel.screenshot(),
    contentType: 'image/png',
  })
  await panel.getByRole('button', { name: 'Restore preferred size', exact: true }).click()
  await expect(page.getByLabel('Manual panel size')).toHaveText('Automatic on both axes')
  expect(await metadata(bridge.client, restoredSession)).toMatchObject({
    dashPanel: { preferredPosition: { x: 34, y: 34 } },
  })
  await page.reload()
  await expect(page.getByLabel('Manual panel size')).toHaveText('Automatic on both axes')
})

test('measures animated natural content while manual height scrolls and cancelled resize writes nothing', async ({
  page,
}, testInfo) => {
  const panel = await openResizeLab(page)
  await page.getByLabel('Resize recipe').selectOption('accordion')
  const initialPanelHeight = (await box(panel)).height
  const item = panel.getByRole('button', { name: 'Accordion item 2', exact: true })
  const transitionSamples = await item.evaluate(
    (button) =>
      new Promise<{ content: number; panel: number }[]>((resolveSamples) => {
        if (!(button instanceof HTMLButtonElement))
          throw new Error('Expected the accordion disclosure button.')
        const regionId = button.getAttribute('aria-controls')
        const region = regionId ? button.ownerDocument.getElementById(regionId) : null
        const shell = button.closest('aside')
        const samples: { content: number; panel: number }[] = []
        if (!region || !shell) throw new Error('Accordion region or Panel shell is unavailable.')
        const sample = () => {
          samples.push({
            content: region.getBoundingClientRect().height,
            panel: shell.getBoundingClientRect().height,
          })
          if (samples.length < 30) requestAnimationFrame(sample)
          else resolveSamples(samples)
        }
        button.click()
        requestAnimationFrame(sample)
      }),
  )
  expect(new Set(transitionSamples.map(({ content }) => Math.round(content))).size).toBeGreaterThan(
    3,
  )
  expect(
    new Set(transitionSamples.map(({ panel: height }) => Math.round(height))).size,
  ).toBeGreaterThan(3)
  await expect(item).toHaveAttribute('aria-expanded', 'true')
  const grownPanel = await box(panel)
  const contentBoundary = await box(
    page.getByRole('region', { name: 'Resize Panel boundary', exact: true }),
  )
  expect(grownPanel.height).toBeGreaterThan(initialPanelHeight + 20)
  expect(grownPanel.y + grownPanel.height).toBeLessThanOrEqual(
    contentBoundary.y + contentBoundary.height - 16 + 1,
  )
  await expect(page.getByLabel('Manual panel size')).toHaveText('Automatic on both axes')
  await page.getByText('Content and accordion', { exact: true }).click()
  const beforeAdd = (await box(panel)).height
  await page.getByRole('button', { name: 'Add tall item', exact: true }).click()
  await expect.poll(async () => (await box(panel)).height).toBeGreaterThanOrEqual(beforeAdd)
  await page.getByLabel('Requested manual width').fill('360')
  await page.getByLabel('Requested manual height').fill('240')
  await page.getByRole('button', { name: 'Set manual size', exact: true }).click()
  await expect(page.getByLabel('Manual panel size')).toHaveText('360 × 240')
  await page.getByRole('button', { name: 'Add tall item', exact: true }).click()
  await expect.poll(async () => Math.round((await box(panel)).height)).toBe(240)
  const body = panel.locator('[data-picodash-panel-body]')
  await expect
    .poll(() => body.evaluate((element) => element.scrollHeight > element.clientHeight))
    .toBe(true)
  const bridge = await bridgeFor(page)
  const session = await bridge.session()
  const fastBaseline = await bridge.client.readEvents(session, {
    type: 'read_events',
    requestId: 'fast-resize-baseline',
  })
  if (fastBaseline.type !== 'events_result') throw new Error('Expected a fast-resize baseline.')
  await body.evaluate((element) => {
    element.scrollTop = 100
  })
  await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBe(100)
  // One native move followed immediately by release: no preview/Bridge assertion between them.
  await dragTarget(page, panel, 'se', 32, 24, true, 1)
  await expect(page.getByLabel('Manual panel size')).toHaveText('392 × 264')
  await expect.poll(async () => Math.round((await box(panel)).width)).toBe(392)
  await expect.poll(async () => Math.round((await box(panel)).height)).toBe(264)
  await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBe(100)
  expect(await metadata(bridge.client, session)).toMatchObject({
    dashPanel: { manualSize: { width: 392, height: 264 } },
  })
  const fastResult = await bridge.client.readEvents(session, {
    type: 'read_events',
    requestId: 'fast-resize-observed',
    cursor: fastBaseline.cursor,
    timeoutMs: 1000,
  })
  if (fastResult.type !== 'events_result') throw new Error('Expected fast resize events.')
  const fastTerminal = fastResult.events
    .map(({ event }) => event.event)
    .filter((event) => event.type === 'drag.end' || event.type === 'drag.cancel')
  expect(fastTerminal).toEqual([
    expect.objectContaining({
      type: 'drag.end',
      operation: 'resize',
      outcome: 'accepted',
      geometry: expect.objectContaining({
        delta: { x: 0, y: 0, width: 32, height: 24 },
      }),
    }),
  ])
  const saved = await metadata(bridge.client, session)
  const baseline = await bridge.client.readEvents(session, {
    type: 'read_events',
    requestId: 'cancel-baseline',
  })
  if (baseline.type !== 'events_result') throw new Error('Expected an event cursor baseline.')
  await dragTarget(page, panel, 'se', 32, 24, false)
  await expect(panel).toHaveAttribute('data-picodash-resizing', 'se')
  await page.keyboard.press('Escape')
  await page.mouse.up()
  await expect(panel).not.toHaveAttribute('data-picodash-resizing')
  expect(await metadata(bridge.client, session)).toEqual(saved)
  const cancellation = await bridge.client.readEvents(session, {
    type: 'read_events',
    requestId: 'cancel-observed',
    cursor: baseline.cursor,
    timeoutMs: 1000,
  })
  if (cancellation.type !== 'events_result')
    throw new Error('Expected disclosed resize cancellation.')
  expect(cancellation.events.map((entry) => entry.event.event)).toContainEqual(
    expect.objectContaining({ type: 'drag.cancel', operation: 'resize' }),
  )
  await page.getByRole('button', { name: 'Remove last item', exact: true }).click()
  await page.getByRole('button', { name: 'Close all items', exact: true }).click()
  await page
    .getByRole('button', { name: 'Restore preferred size from custom control', exact: true })
    .click()
  await expect(page.getByLabel('Panel size source')).toHaveText(
    'Width: preferred; height: preferred',
  )
  await testInfo.attach('accordion-manual-scroll-and-restore', {
    body: await panel.screenshot(),
    contentType: 'image/png',
  })
  const contentSettings = page.getByText('Content and accordion', { exact: true })
  if (!(await contentSettings.evaluate((element) => element.closest('details')?.open)))
    await contentSettings.click()
  await page.getByRole('combobox', { name: 'Panel content', exact: true }).selectOption('list')
  await page.getByRole('button', { name: 'Apply configuration', exact: true }).click()
  await page.getByLabel('Requested manual width').fill('480')
  await page.getByLabel('Requested manual height').fill('320')
  await page.getByRole('button', { name: 'Set manual size', exact: true }).click()
  await expect.poll(async () => Math.round((await box(panel)).height)).toBe(320)
  const list = panel.getByRole('list', { name: 'Resize Lab pinned bands', exact: true })
  const startBand = list.locator(':scope > [data-picodash-dashlist-band="start"]')
  const automaticBand = list.locator(':scope > [data-picodash-dashlist-band="automatic"]')
  const endBand = list.locator(':scope > [data-picodash-dashlist-band="end"]')
  await expect
    .poll(() => body.evaluate((element) => element.scrollHeight <= element.clientHeight + 1))
    .toBe(true)
  await expect
    .poll(() => automaticBand.evaluate((element) => element.scrollHeight > element.clientHeight))
    .toBe(true)
  const startBefore = await box(startBand)
  const endBefore = await box(endBand)
  const panelBefore = await box(panel)
  await automaticBand.evaluate((element) => {
    element.scrollTop = 120
  })
  await expect.poll(() => automaticBand.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
  await dragTarget(page, panel, 'e', 32, 0, true, 1)
  await expect(page.getByLabel('Manual panel size')).toHaveText('512 × 320')
  await expect.poll(() => automaticBand.evaluate((element) => element.scrollTop)).toBe(120)
  const panelAfter = await box(panel)
  expect((await box(startBand)).y - panelAfter.y).toBeCloseTo(startBefore.y - panelBefore.y, 1)
  expect((await box(endBand)).y - panelAfter.y).toBeCloseTo(endBefore.y - panelBefore.y, 1)
  await testInfo.attach('pinned-band-scroll-owner', {
    body: await panel.screenshot(),
    contentType: 'image/png',
  })
  await automaticBand.evaluate((element) => {
    element.scrollTop = 0
  })
  const reorderSession = await bridge.session()
  const reorderBaseline = await bridge.client.readEvents(reorderSession, {
    type: 'read_events',
    requestId: 'list-reorder-baseline',
  })
  if (reorderBaseline.type !== 'events_result')
    throw new Error('Expected a List reorder event baseline.')
  const detailOrder = () =>
    list
      .locator('[data-picodash-dashlet]')
      .evaluateAll((elements) =>
        elements.map((element) => element.getAttribute('data-picodash-dashlet')),
      )
  const beforeOrder = await detailOrder()
  const reorder = list.getByRole('button', { name: 'Reorder Detail 1', exact: true })
  await reorder.press('Enter')
  await reorder.press('ArrowDown')
  await reorder.press('Enter')
  await expect.poll(detailOrder).not.toEqual(beforeOrder)
  const reordered = await bridge.client.readEvents(reorderSession, {
    type: 'read_events',
    requestId: 'list-reorder-observed',
    cursor: reorderBaseline.cursor,
    timeoutMs: 1000,
  })
  if (reordered.type !== 'events_result') throw new Error('Expected disclosed List reorder events.')
  const listEvents = reordered.events
    .map((entry) => entry.event)
    .filter(
      ({ source, event }) =>
        source.kind === 'dashList' && 'operation' in event && event.operation === 'reorder',
    )
  expect(listEvents.map(({ event }) => event.type)).toEqual(
    expect.arrayContaining(['drag.start', 'drag.update', 'drag.end']),
  )
  expect(
    listEvents.some(({ event }) => event.type === 'drag.end' && event.outcome === 'accepted'),
  ).toBe(true)
})

test('supports numeric and keyboard sizing, placement-aware grips, and retained close/reopen', async ({
  page,
}) => {
  const panel = await openResizeLab(page)
  await panel.getByRole('button', { name: 'Actions for Resize Panel', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Resize panel…', exact: true }).click()
  const editor = page.getByRole('form', { name: 'Resize panel Resize Panel', exact: true })
  await expect(editor.getByLabel('Width (px)')).toBeFocused()
  await editor.getByLabel('Width (px)').fill('420')
  await editor.getByLabel('Height (px)').fill('280')
  await editor.getByRole('button', { name: 'Apply size', exact: true }).click()
  await expect(page.getByLabel('Manual panel size')).toHaveText('420 × 280')
  const grip = panel.getByRole('button', { name: 'Resize panel Resize Panel from se', exact: true })
  await grip.press('Enter')
  await grip.press('Shift+ArrowRight')
  await grip.press('Shift+ArrowDown')
  await grip.press('Enter')
  await expect(page.getByLabel('Manual panel size')).toHaveText('430 × 290')
  await panel.getByRole('button', { name: 'Close panel Resize Panel', exact: true }).click()
  await expect(panel).toBeHidden()
  await page.getByRole('button', { name: 'Reopen Resize Panel', exact: true }).click()
  await expect(panel).toBeVisible()
  await expect(page.getByLabel('Manual panel size')).toHaveText('430 × 290')
  await page.getByText('Panel dimensions and input', { exact: true }).click()
  await page.getByLabel('Declared placement').selectOption('dock-right')
  await page.getByLabel('Resize grips').selectOption('always')
  await page.getByRole('button', { name: 'Apply configuration', exact: true }).click()
  await expect(panel).toHaveAttribute('data-picodash-placement', 'fixed-docked')
  await expect(panel.locator('[data-picodash-panel-resize-target]')).toHaveCount(1)
  await expect(
    panel.getByRole('button', { name: 'Resize panel Resize Panel from w', exact: true }),
  ).toBeVisible()
  await panel.getByRole('button', { name: 'Restore preferred size', exact: true }).click()
  await expect(page.getByLabel('Manual panel size')).toHaveText('Automatic on both axes')
  const dimensions = page.getByText('Panel dimensions and input', { exact: true })
  if (!(await dimensions.evaluate((element) => element.closest('details')?.open)))
    await dimensions.click()
  await page.getByRole('combobox', { name: 'Declared placement', exact: true }).selectOption('free')
  await page.getByLabel('Preferred height', { exact: true }).fill('50%')
  await page.getByRole('button', { name: 'Apply configuration', exact: true }).click()
  await expect(panel).toHaveAttribute('data-picodash-placement', 'floating-free')
  await expect(page.getByLabel('Manual panel size')).toHaveText('Automatic on both axes')
  const percentageBoundary = await box(
    page.getByRole('region', { name: 'Resize Panel boundary', exact: true }),
  )
  await expect
    .poll(async () => (await box(panel)).height)
    .toBeCloseTo((percentageBoundary.height - 2 * 16) / 2, 1)
  await expect(page.getByRole('region', { name: 'Contract Lab status', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Take specimen offline', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Reopen primary specimen', exact: true }),
  ).toBeVisible()
})
