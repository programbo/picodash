import { expect, test, type Locator, type Page } from '@playwright/test'

const storageKey = 'tweaker-geometry-lab:panel-layout:v1'
const safeInset = 8
const defaultPlacementInset = 16

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 600 })
  await page.goto('/panel-geometry-lab?fixture=drag')
  await expect(page.locator('[data-panel-geometry-lab]')).toBeVisible()
})

test('shrinks and restores a tall panel during a held drag while preserving its top', async ({
  page,
}) => {
  const panel = geometryPanel(page, 'tall')
  const header = panel.locator('[data-tweaker-panel-header]')
  const initial = await requiredBox(panel)
  const headerBox = await requiredBox(header)
  const start = {
    x: headerBox.x + headerBox.width / 2,
    y: headerBox.y + headerBox.height / 2,
  }

  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x, start.y + 240, { steps: 12 })

  await expectBottom(panel, 600 - safeInset)
  const reduced = await requiredBox(panel)
  expect(reduced.y).toBeGreaterThan(initial.y + 200)
  expect(reduced.height).toBeLessThan(initial.height - 200)

  await page.mouse.move(start.x, start.y + 120, { steps: 8 })

  await expectTop(panel, reduced.y - 120)
  await expectBottom(panel, 600 - safeInset)
  const restoredDuringDrag = await requiredBox(panel)
  expect(restoredDuringDrag.height).toBeGreaterThan(reduced.height + 100)
  await page.mouse.up()

  const body = panel.locator('[data-tweaker-reorder-list]').first()
  await body.hover()
  await page.mouse.wheel(0, 500)
  await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBeGreaterThan(100)

  const persistedTop = (await requiredBox(panel)).y
  await page.reload()
  await expect(page.locator('[data-panel-geometry-lab]')).toBeVisible()
  await expectTop(geometryPanel(page, 'tall'), persistedTop)

  const persisted = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) ?? 'null'),
    storageKey,
  )
  const persistedLayout = persisted?.state?.panelLayouts?.['geometry-tall']
  expect(Object.keys(persistedLayout).sort()).toEqual(['dock', 'x', 'y'])
  expect(persistedLayout.dock?.horizontal).toBe('left')
  expect(persistedLayout.y).toBe(Math.round(persistedTop))
  expect(JSON.stringify(persisted)).not.toMatch(/height|maxHeight/)
})

test('retains peer-edge snapping while projecting panel bounds', async ({ page }) => {
  await page.goto('/panel-geometry-lab?fixture=peer')
  const source = geometryPanel(page, 'snap-source')
  const peer = geometryPanel(page, 'snap-peer')
  const sourceBox = await requiredBox(source)
  const peerBox = await requiredBox(peer)
  const headerBox = await requiredBox(source.locator('[data-tweaker-panel-header]'))
  const deltaX = peerBox.x - (sourceBox.x + sourceBox.width)
  const startX = headerBox.x + headerBox.width / 2
  const startY = headerBox.y + headerBox.height / 2
  let pointerX = startX + deltaX - 40

  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(pointerX, startY, { steps: 12 })
  const intermediateSource = await requiredBox(source)
  pointerX += peerBox.x - (intermediateSource.x + intermediateSource.width)
  await page.mouse.move(pointerX, startY, { steps: 4 })

  await expect(source).toHaveAttribute('data-tweaker-panel-snapping', '')
  await expect
    .poll(async () => {
      const [nextSource, nextPeer] = await Promise.all([requiredBox(source), requiredBox(peer)])
      return Math.abs(nextSource.x + nextSource.width - nextPeer.x)
    })
    .toBeLessThanOrEqual(1)
  await page.mouse.up()
})

test('expanding a collapsed panel keeps its undocked top and contains its bottom', async ({
  page,
}) => {
  await page.goto('/panel-geometry-lab?fixture=panel-expansion')
  const panel = geometryPanel(page, 'panel-expansion')
  const initial = await requiredBox(panel)

  await panel.getByRole('button', { name: 'Expand panel Panel disclosure fixture' }).click()

  await expect(panel).toHaveAttribute('data-collapsed', 'false')
  await expectTop(panel, initial.y)
  await expectBottomAtMost(panel, 600 - safeInset)
  await expect
    .poll(async () => (await requiredBox(panel)).height)
    .toBeGreaterThan(initial.height + 300)
})

test('group, nested-group, and expand-all growth preserve an undocked top', async ({ page }) => {
  await page.goto('/panel-geometry-lab?fixture=groups')
  const panel = geometryPanel(page, 'groups')
  const initialTop = (await requiredBox(panel)).y
  const outer = panel.locator('[data-group-id="outer-group"]')
  const nested = panel.locator('[data-group-id="nested-group"]')

  await outer.getByRole('button', { name: 'Outer group', exact: true }).click()
  await expect(outer).toHaveAttribute('data-collapsed', 'false')
  await expect(nested).toBeVisible()
  await expectTop(panel, initialTop)
  await expectBottomAtMost(panel, 600 - safeInset)

  await nested.getByRole('button', { name: 'Nested group', exact: true }).click()
  await expect(nested).toHaveAttribute('data-collapsed', 'false')
  await expectTop(panel, initialTop)
  await expectBottomAtMost(panel, 600 - safeInset)

  await panel.getByRole('button', { name: 'Open actions for Group expansion fixture' }).click()
  await page.getByRole('menuitem', { name: 'Collapse all' }).click()
  await expect(outer).toHaveAttribute('data-collapsed', 'true')

  await panel.getByRole('button', { name: 'Open actions for Group expansion fixture' }).click()
  await page.getByRole('menuitem', { name: 'Expand all' }).click()
  await expect(outer).toHaveAttribute('data-collapsed', 'false')
  await expect(nested).toHaveAttribute('data-collapsed', 'false')
  await expect(panel.locator('[data-group-id="second-group"]')).toHaveAttribute(
    'data-collapsed',
    'false',
  )
  await expectTop(panel, initialTop)
  await expectBottomAtMost(panel, 600 - safeInset)
})

test('a bottom-docked panel grows upward and survives reduced motion', async ({ page }) => {
  await seedLayout(page, {
    'geometry-bottom': {
      dock: { horizontal: 'left', vertical: 'bottom' },
      x: safeInset,
      y: 500,
    },
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/panel-geometry-lab?fixture=bottom')
  const panel = geometryPanel(page, 'bottom')
  const initial = await requiredBox(panel)
  await expectBottom(panel, 600 - safeInset)

  await panel.getByRole('button', { name: 'Bottom group', exact: true }).click()

  await expect(panel.locator('[data-group-id="bottom-group"]')).toHaveAttribute(
    'data-collapsed',
    'false',
  )
  await expectBottom(panel, 600 - safeInset)
  await expect.poll(async () => (await requiredBox(panel)).y).toBeLessThan(initial.y - 250)
})

test('a fresh bottom-positioned panel expands upward before layout is persisted', async ({
  page,
}) => {
  await page.goto('/panel-geometry-lab?fixture=bottom')
  const panel = geometryPanel(page, 'bottom')
  const initial = await requiredBox(panel)
  await expectBottom(panel, 600 - defaultPlacementInset)

  await panel.getByRole('button', { name: 'Bottom group', exact: true }).click()

  await expect(panel.locator('[data-group-id="bottom-group"]')).toHaveAttribute(
    'data-collapsed',
    'false',
  )
  await expectBottom(panel, 600 - defaultPlacementInset)
  await expect.poll(async () => (await requiredBox(panel)).y).toBeLessThan(initial.y - 250)
})

test('viewport shrink and growth constrain an undocked panel without moving its top', async ({
  page,
}) => {
  await page.goto('/panel-geometry-lab?fixture=groups')
  const panel = geometryPanel(page, 'groups')
  await panel.getByRole('button', { name: 'Open actions for Group expansion fixture' }).click()
  await page.getByRole('menuitem', { name: 'Expand all' }).click()
  await expect.poll(async () => (await requiredBox(panel)).height).toBeGreaterThan(400)
  const expanded = await requiredBox(panel)

  await page.setViewportSize({ width: 900, height: 430 })
  await expectTop(panel, expanded.y)
  await expectBottomAtMost(panel, 430 - safeInset)
  const shrunk = await requiredBox(panel)
  expect(shrunk.height).toBeLessThan(expanded.height)

  await page.setViewportSize({ width: 900, height: 720 })
  await expectTop(panel, expanded.y)
  await expect
    .poll(async () => (await requiredBox(panel)).height)
    .toBeGreaterThan(shrunk.height + 200)
  await expectBottomAtMost(panel, 720 - safeInset)
})

test('preserves a caller-provided max-height while applying viewport containment', async ({
  page,
}) => {
  await page.setViewportSize({ width: 900, height: 800 })
  await page.goto('/panel-geometry-lab?fixture=caller-max-height')
  const panel = geometryPanel(page, 'caller-max-height')

  await expect.poll(async () => (await requiredBox(panel)).height).toBe(200)
  await expect
    .poll(() => panel.evaluate((element) => getComputedStyle(element).maxHeight))
    .toBe('200px')

  await page.setViewportSize({ width: 900, height: 160 })
  await expectBottomAtMost(panel, 160 - safeInset)
  expect((await requiredBox(panel)).height).toBeLessThan(200)

  await page.setViewportSize({ width: 900, height: 800 })
  await expect.poll(async () => (await requiredBox(panel)).height).toBe(200)
})

test('preserves a class-based max-height constraint', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 800 })
  await page.goto('/panel-geometry-lab?fixture=class-max-height')
  const panel = geometryPanel(page, 'class-max-height')

  await expect.poll(async () => (await requiredBox(panel)).height).toBe(192)
  await expect
    .poll(() => panel.evaluate((element) => getComputedStyle(element).maxHeight))
    .toBe('192px')
})

test('anchors a bottom-docked panel using its caller-capped height', async ({ page }) => {
  await seedLayout(page, {
    'geometry-bottom-capped': {
      dock: { horizontal: 'left', vertical: 'bottom' },
      x: safeInset,
      y: 500,
    },
  })
  await page.goto('/panel-geometry-lab?fixture=bottom-max-height')
  const panel = geometryPanel(page, 'bottom-max-height')

  await expect.poll(async () => (await requiredBox(panel)).height).toBe(200)
  await expectBottom(panel, 600 - safeInset)
})

test('rebases a bottom-positioned panel while shrinking during a held drag', async ({ page }) => {
  await page.goto('/panel-geometry-lab?fixture=bottom-drag')
  const panel = geometryPanel(page, 'bottom-drag')
  const initial = await requiredBox(panel)
  const header = await requiredBox(panel.locator('[data-tweaker-panel-header]'))
  const start = {
    x: header.x + header.width / 2,
    y: header.y + header.height / 2,
  }

  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x, start.y + 200, { steps: 12 })

  await expect
    .poll(async () => Math.abs((await requiredBox(panel)).y - initial.y - 200))
    .toBeLessThanOrEqual(20)
  await expectBottom(panel, 600 - safeInset)
  await expect
    .poll(async () => (await requiredBox(panel)).height)
    .toBeLessThan(initial.height - 180)
  await page.mouse.up()
})

function geometryPanel(page: Page, fixture: string) {
  return page.locator(`[data-geometry-fixture="${fixture}"]`)
}

async function requiredBox(locator: Locator) {
  const box = await locator.boundingBox()
  expect(box).not.toBeNull()
  return box!
}

async function expectTop(panel: Locator, expectedTop: number) {
  await expect
    .poll(async () => Math.abs((await requiredBox(panel)).y - expectedTop))
    .toBeLessThanOrEqual(1)
}

async function expectBottom(panel: Locator, expectedBottom: number) {
  await expect
    .poll(async () => {
      const box = await requiredBox(panel)
      return Math.abs(box.y + box.height - expectedBottom)
    })
    .toBeLessThanOrEqual(1)
}

async function expectBottomAtMost(panel: Locator, maximumBottom: number) {
  await expect
    .poll(async () => {
      const box = await requiredBox(panel)
      return box.y + box.height - maximumBottom
    })
    .toBeLessThanOrEqual(1)
}

async function seedLayout(
  page: Page,
  panelLayouts: Record<
    string,
    {
      dock: {
        horizontal?: 'left' | 'right'
        vertical?: 'bottom' | 'top'
      } | null
      x: number
      y: number
    }
  >,
) {
  await page.addInitScript(
    ({ key, layouts }) => {
      localStorage.setItem(key, JSON.stringify({ state: { panelLayouts: layouts }, version: 0 }))
    },
    { key: storageKey, layouts: panelLayouts },
  )
}
