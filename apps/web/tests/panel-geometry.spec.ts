import { expect, test, type Locator, type Page } from '@playwright/test'
import { requiredBox } from './helpers'
import { labURL } from './urls'

const storageKey = 'picodash-geometry-lab:panel-layout:v2'
const safeInset = 8
const defaultPlacementInset = 8
const defaultSnapProximity = 16
const hybridPreviewIconProximityGap = 2
const fixedPositions = [
  'top-left',
  'bottom-left',
  'top-right',
  'bottom-right',
  'full-left',
  'full-right',
  'middle-left',
  'middle-right',
] as const
const hybridPositions = [
  'top-left',
  'top',
  'top-right',
  'full-right',
  'bottom-right',
  'bottom',
  'bottom-left',
  'full-left',
] as const

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 600 })
})

test('shrinks and restores a tall panel during a held drag while preserving its top', async ({
  page,
}) => {
  await page.goto(`${labURL}/lab/panel-geometry?fixture=drag`)
  await expect(page.locator('[data-panel-geometry-lab]')).toBeVisible()
  const panel = geometryPanel(page, 'tall')
  const header = panel.locator('[data-picodash-panel-header]')
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

  const body = panel.locator('[data-picodash-reorder-list]').first()
  await expect(body).toHaveAttribute('data-picodash-scrollport', 'body')
  await expect(body).toHaveClass(/scroll-fade/)
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
  expect(Object.keys(persistedLayout).sort()).toEqual(['placement', 'preferredCoordinates'])
  expect(persistedLayout.placement).toEqual({
    disposition: { kind: 'snapped', position: 'left' },
    mode: 'floating',
  })
  expect(persistedLayout.preferredCoordinates.y).toBe(Math.round(persistedTop))
  expect(JSON.stringify(persisted)).not.toMatch(/height|maxHeight/)
})

test('shrinks a free hybrid panel when it is dragged below the viewport', async ({ page }) => {
  await page.goto(`${labURL}/lab/panel-geometry?fixture=hybrid-viewport`)
  const panel = geometryPanel(page, 'hybrid-viewport')
  const shell = page.locator('[data-picodash-panel-shell]').filter({ has: panel })

  await detachHybridPanel(page, panel, shell)
  const initial = await requiredBox(panel)
  const start = center(await requiredBox(panel.locator('[data-picodash-panel-header]')))

  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x, start.y + 240, { steps: 12 })

  const reduced = await requiredBox(panel)
  expect(reduced.y).toBeGreaterThan(initial.y + 200)
  expect(reduced.height).toBeLessThan(initial.height - 200)
  await expectBottom(panel, 600 - safeInset)
  await expect(shell).toHaveAttribute('data-hybrid-placement', '')
  await page.mouse.up()
})

test('clears obsolete layouts and starts from declared defaults', async ({ page }) => {
  await page.addInitScript(
    ({ key }) => {
      localStorage.setItem(
        key,
        JSON.stringify({
          state: {
            panelLayouts: {
              'geometry-tall': {
                dock: { horizontal: 'left', vertical: 'top' },
                placement: { mode: 'obsolete', position: 'top-left' },
                x: 24,
                y: 32,
              },
            },
          },
          version: 0,
        }),
      )
    },
    { key: storageKey },
  )
  await page.goto(`${labURL}/lab/panel-geometry?fixture=drag`)
  const panel = geometryPanel(page, 'tall')
  const shell = page.locator('[data-picodash-panel-shell]').filter({ has: panel })
  await expect(shell).not.toHaveAttribute('data-hybrid-placement')
  await expect
    .poll(async () => Math.round((await requiredBox(panel)).x))
    .toBe(defaultPlacementInset)

  const persisted = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) ?? 'null'),
    storageKey,
  )
  expect(persisted?.state?.panelLayouts).toEqual({})
  expect(JSON.stringify(persisted)).not.toMatch(/"dock"|"obsolete"/)
})

test('retains peer-edge snapping while projecting panel bounds', async ({ page }) => {
  await page.goto(`${labURL}/lab/panel-geometry?fixture=peer`)
  const source = geometryPanel(page, 'snap-source')
  const peer = geometryPanel(page, 'snap-peer')
  const sourceBox = await requiredBox(source)
  const peerBox = await requiredBox(peer)
  const headerBox = await requiredBox(source.locator('[data-picodash-panel-header]'))
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

  await expect(source).toHaveAttribute('data-picodash-panel-snapping', '')
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
  await page.goto(`${labURL}/lab/panel-geometry?fixture=panel-expansion`)
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
  await page.goto(`${labURL}/lab/panel-geometry?fixture=groups`)
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
      placement: {
        disposition: { kind: 'docked', position: 'bottom-left' },
        mode: 'hybrid',
      },
      preferredCoordinates: { x: safeInset, y: 500 },
    },
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(`${labURL}/lab/panel-geometry?fixture=bottom`)
  const panel = geometryPanel(page, 'bottom')
  const initial = await requiredBox(panel)
  await expectBottom(panel, 600)

  await panel.getByRole('button', { name: 'Bottom group', exact: true }).click()

  await expect(panel.locator('[data-group-id="bottom-group"]')).toHaveAttribute(
    'data-collapsed',
    'false',
  )
  await expectBottom(panel, 600)
  await expect.poll(async () => (await requiredBox(panel)).y).toBeLessThan(initial.y - 250)
})

test('a fresh bottom-positioned panel expands upward before layout is persisted', async ({
  page,
}) => {
  await page.goto(`${labURL}/lab/panel-geometry?fixture=bottom`)
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

test('keeps custom bottom and horizontal placement insets independent', async ({ page }) => {
  await page.goto(`${labURL}/lab/panel-geometry?fixture=custom-bottom`)
  const panel = geometryPanel(page, 'custom-bottom')

  await expect
    .poll(async () => {
      const rect = await requiredBox(panel)
      return {
        bottom: Math.round(600 - rect.y - rect.height),
        right: Math.round(900 - rect.x - rect.width),
      }
    })
    .toEqual({ bottom: 80, right: 16 })
})

test('tracks responsive bottom inset and anchor changes before persistence', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 600 })
  await page.goto(`${labURL}/lab/panel-geometry?fixture=responsive`)
  const panel = geometryPanel(page, 'responsive')
  await expectEdgeInsets(panel, { bottom: 80, right: 16 })

  await page.setViewportSize({ width: 1300, height: 600 })
  await expectEdgeInsets(panel, { bottom: 16, right: 16 })

  await page.setViewportSize({ width: 900, height: 600 })
  await expectEdgeInsets(panel, { right: 16, top: 16 })
})

test('tracks live placement constraint changes before persistence', async ({ page }) => {
  await page.goto(`${labURL}/lab/panel-geometry?fixture=changing-constraint`)
  const panel = geometryPanel(page, 'changing-constraint')
  await expectEdgeInsets(panel, { bottom: 80, right: 16 })

  await page.getByRole('button', { name: 'Use small bottom inset' }).click()
  await expectEdgeInsets(panel, { bottom: 16, right: 16 })

  await page.getByRole('button', { name: 'Use top constraint' }).click()
  await expectEdgeInsets(panel, { right: 16, top: 16 })
})

test('supports fixed placements, inherited boundaries, pinned lanes, and panel overrides', async ({
  page,
}) => {
  await page.goto(`${labURL}/lab/panel-geometry?fixture=fixed-boundaries`)
  const boundary = page.locator('[data-geometry-boundary="provider"]')
  const overrideBoundary = page.locator('[data-geometry-boundary="override"]')
  const panel = geometryPanel(page, 'fixed-boundary')
  const overridePanel = geometryPanel(page, 'fixed-override')
  const placement = page.getByLabel('Fixed placement')
  const runtimePlacement = page.locator('[data-runtime-placement]')

  await expect(runtimePlacement).toHaveText('fixed:full-left')
  await expect(placement.locator('option')).toHaveText([
    'top-left',
    'bottom-left',
    'top-right',
    'bottom-right',
    'full-left',
    'full-right',
    'middle-left',
    'middle-right',
  ])

  for (const position of fixedPositions) {
    await placement.selectOption(position)
    await expect(runtimePlacement).toHaveText(`fixed:${position}`)
    await expectPanelAtBoundary(panel, boundary, position)
  }

  await page.getByRole('button', { name: 'Hybrid' }).click()
  await expect(runtimePlacement).toHaveText('hybrid:top-left')
  const shell = page.locator('[data-picodash-panel-shell]').filter({ has: panel })
  const preview = page.locator('[data-hybrid-dock-preview]')
  await expect(shell).toHaveAttribute('data-hybrid-placement', 'top-left')
  await expectPanelAtBoundary(panel, boundary, 'top-left')
  await expect(panel).toHaveCSS('border-top-left-radius', '0px')
  await expect(panel.locator('[data-picodash-scrollport="auto"]')).toHaveClass(/scroll-fade/)
  const hybridToggle = shell.locator('[data-picodash-fixed-toggle]')
  await hybridToggle.click()
  await expect(panel).toHaveAttribute('data-collapsed', 'true')
  await expectCollapsedPanelBeyondBoundary(panel, boundary, 'top-left')
  await page.getByRole('button', { name: 'Floating' }).click()
  await expect(runtimePlacement).toHaveText('floating:')
  await expect(panel).toHaveAttribute('data-collapsed', 'true')
  await expect(hybridToggle).toHaveCount(0)
  await expect(panel.getByRole('button', { name: 'Expand panel Provider boundary' })).toBeVisible()
  await page.getByRole('button', { name: 'Hybrid' }).click()
  await expect(runtimePlacement).toHaveText('hybrid:top-left')
  await expect(panel).toHaveAttribute('data-collapsed', 'true')
  await expectCollapsedPanelBeyondBoundary(panel, boundary, 'top-left')
  await hybridToggle.click()
  await expect(panel).toHaveAttribute('data-collapsed', 'false')
  await expectPanelAtBoundary(panel, boundary, 'top-left')

  const hybridHeader = panel.locator('[data-picodash-panel-header]')
  const hybridHeaderBox = await requiredBox(hybridHeader)
  await page.mouse.move(
    hybridHeaderBox.x + hybridHeaderBox.width / 2,
    hybridHeaderBox.y + hybridHeaderBox.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    hybridHeaderBox.x + hybridHeaderBox.width / 2 + 1,
    hybridHeaderBox.y + hybridHeaderBox.height / 2 + 1,
  )
  await expectPanelAtBoundary(panel, boundary, 'top-left')
  await page.mouse.move(
    hybridHeaderBox.x + hybridHeaderBox.width / 2 + 180,
    hybridHeaderBox.y + hybridHeaderBox.height / 2 + 30,
    { steps: 12 },
  )
  await page.mouse.move(
    hybridHeaderBox.x + hybridHeaderBox.width / 2 + 240,
    hybridHeaderBox.y + hybridHeaderBox.height / 2 + 40,
    { steps: 4 },
  )
  await expect(runtimePlacement).toHaveText('hybrid:')
  await expect(shell).toHaveAttribute('data-hybrid-placement', '')
  await expect(hybridToggle).toHaveCount(0)
  await expect(panel.locator('[data-picodash-scrollport="body"]')).toHaveClass(/scroll-fade/)
  await page.mouse.up()
  await expect(runtimePlacement).toHaveText('hybrid:')
  await expect(shell).toHaveAttribute('data-hybrid-placement', '')
  await expect(panel.locator('[data-picodash-scrollport="body"]')).toHaveClass(/scroll-fade/)

  const floatingBox = await requiredBox(panel)
  const floatingHeaderBox = await requiredBox(hybridHeader)
  const boundaryBox = await requiredBox(boundary)
  const floatingStart = {
    x: floatingHeaderBox.x + floatingHeaderBox.width / 2,
    y: floatingHeaderBox.y + floatingHeaderBox.height / 2,
  }
  const pointerX = floatingStart.x + boundaryBox.x + safeInset - floatingBox.x
  await page.mouse.move(floatingStart.x, floatingStart.y)
  await page.mouse.down()
  let previousPanelX = floatingBox.x
  for (let step = 1; step <= 12; step += 1) {
    const nextPointerX = floatingStart.x + ((pointerX - floatingStart.x) * step) / 12
    await page.mouse.move(nextPointerX, boundaryBox.y + boundaryBox.height / 2)
    await page.evaluate(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
    )
    const nextPanelX = (await requiredBox(panel)).x
    expect(nextPanelX).toBeLessThanOrEqual(previousPanelX + 1)
    previousPanelX = nextPanelX
  }
  await page.mouse.move(boundaryBox.x + 1, boundaryBox.y + boundaryBox.height / 2, { steps: 4 })
  await expect(panel).toHaveAttribute('data-picodash-panel-snapping', '')
  await expect(runtimePlacement).toHaveText('hybrid:')
  await expect(preview).toHaveAttribute('data-hybrid-dock-preview', 'full-left')
  await expect(shell).toHaveAttribute('data-hybrid-placement', '')
  await expect(hybridToggle).toHaveCount(0)
  await expect(panel.locator('[data-picodash-scrollport="body"]')).toHaveClass(/scroll-fade/)
  await expect
    .poll(async () => {
      const previewBox = await requiredSvgBox(preview)
      const boundaryBox = await requiredBox(boundary)
      return Math.round(boundaryBox.height - previewBox.height) || 0
    })
    .toBe(0)
  await page.mouse.up()
  await expect(runtimePlacement).toHaveText('hybrid:full-left')
  await expect(shell).toHaveAttribute('data-hybrid-placement', 'full-left')
  await expect(panel.locator('[data-picodash-scrollport="auto"]')).toHaveClass(/scroll-fade/)
  await expectPanelAtBoundary(panel, boundary, 'full-left')

  const attachedHeaderBox = await requiredBox(hybridHeader)
  await page.mouse.move(
    attachedHeaderBox.x + attachedHeaderBox.width / 2,
    attachedHeaderBox.y + attachedHeaderBox.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    attachedHeaderBox.x + attachedHeaderBox.width / 2 + 180,
    attachedHeaderBox.y + attachedHeaderBox.height / 2 + 120,
    { steps: 12 },
  )
  await expect(shell).toHaveAttribute('data-hybrid-placement', '')
  const detachedBox = await requiredBox(panel)
  await page.mouse.move(
    attachedHeaderBox.x + attachedHeaderBox.width / 2 + 240,
    attachedHeaderBox.y + attachedHeaderBox.height / 2 + 180,
    { steps: 4 },
  )
  await expect(runtimePlacement).toHaveText('hybrid:')
  await expect(shell).toHaveAttribute('data-hybrid-placement', '')
  await expect(hybridToggle).toHaveCount(0)
  await expect(panel.locator('[data-picodash-scrollport="body"]')).toHaveClass(/scroll-fade/)
  await expect
    .poll(async () => (await requiredBox(boundary)).height - (await requiredBox(panel)).height)
    .toBeGreaterThan(1)
  await expect
    .poll(async () => {
      const panelBox = await requiredBox(panel)
      const boundaryBox = await requiredBox(boundary)
      return Math.min(
        panelBox.y - boundaryBox.y,
        boundaryBox.y + boundaryBox.height - panelBox.y - panelBox.height,
      )
    })
    .toBeGreaterThanOrEqual(safeInset - 1)
  const continuedBox = await requiredBox(panel)
  expect(continuedBox.x).toBeGreaterThan(detachedBox.x)
  await page.mouse.up()
  await expect(runtimePlacement).toHaveText('hybrid:')

  await expectPanelAtBoundary(overridePanel, overrideBoundary, 'bottom-right')

  await placement.selectOption('full-left')
  const scrollport = panel.locator('[data-picodash-scrollport="auto"]')
  await expect(scrollport).toHaveClass(/scroll-fade/)
  await expect(scrollport).toHaveAttribute('data-picodash-reorder-lane', 'auto')
  await expect
    .poll(() =>
      scrollport.evaluate((element) => ({
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
      })),
    )
    .toMatchObject({ clientHeight: expect.any(Number), scrollHeight: expect.any(Number) })

  const pinnedStart = panel.locator('[data-group-id="fixed-start"]')
  const pinnedEnd = panel.locator('[data-group-id="fixed-end"]')
  const initialPinned = {
    end: (await requiredBox(pinnedEnd)).y,
    start: (await requiredBox(pinnedStart)).y,
  }
  await scrollport.evaluate((element) => {
    element.scrollTop = element.scrollHeight
    element.dispatchEvent(new Event('scroll'))
  })
  await expect.poll(() => scrollport.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
  expect((await requiredBox(pinnedStart)).y).toBe(initialPinned.start)
  expect((await requiredBox(pinnedEnd)).y).toBe(initialPinned.end)
})

test('previews the committed width when a constrained hybrid panel expands at an edge', async ({
  page,
}) => {
  await page.goto(`${labURL}/lab/panel-geometry?fixture=fixed-boundaries`)
  const boundary = page.locator('[data-geometry-boundary="provider"]')
  const panel = geometryPanel(page, 'fixed-boundary')
  const shell = page.locator('[data-picodash-panel-shell]').filter({ has: panel })
  const header = panel.locator('[data-picodash-panel-header]')
  const preview = page.locator('[data-hybrid-dock-preview]')

  await page.getByRole('button', { name: 'Hybrid' }).click()
  const attachedHeaderBox = await requiredBox(header)
  const attachedStart = {
    x: attachedHeaderBox.x + attachedHeaderBox.width / 2,
    y: attachedHeaderBox.y + attachedHeaderBox.height / 2,
  }
  await page.mouse.move(attachedStart.x, attachedStart.y)
  await page.mouse.down()
  await page.mouse.move(attachedStart.x + 80, attachedStart.y + 60, { steps: 12 })
  await expect(shell).toHaveAttribute('data-hybrid-placement', '')
  await page.mouse.up()
  await expect(shell).toHaveAttribute('data-hybrid-placement', '')

  await page.setViewportSize({ width: 376, height: 600 })
  await expect.poll(async () => Math.round((await requiredBox(boundary)).width)).toBe(280)
  await expect.poll(async () => Math.round((await requiredBox(panel)).width)).toBe(264)

  const floatingBox = await requiredBox(panel)
  const floatingHeaderBox = await requiredBox(header)
  const boundaryBox = await requiredBox(boundary)
  const floatingStart = {
    x: floatingHeaderBox.x + floatingHeaderBox.width / 2,
    y: floatingHeaderBox.y + floatingHeaderBox.height / 2,
  }
  const pointerX = floatingStart.x + boundaryBox.x + safeInset - floatingBox.x
  await page.mouse.move(floatingStart.x, floatingStart.y)
  await page.mouse.down()
  await page.mouse.move(pointerX, boundaryBox.y + boundaryBox.height * 0.4, { steps: 12 })

  await expect(preview).toHaveAttribute('data-hybrid-dock-preview', 'full-left')
  await expect(shell).toHaveAttribute('data-hybrid-placement', '')
  await expect.poll(async () => Math.round((await requiredBox(panel)).width)).toBe(264)
  await expect
    .poll(async () =>
      Math.round((await requiredBox(boundary)).width - (await requiredSvgBox(preview)).width),
    )
    .toBe(0)
  await page.mouse.up()

  await expect(shell).toHaveAttribute('data-hybrid-placement', 'full-left')
  await expectPanelAtBoundary(panel, boundary, 'full-left')
  await expect
    .poll(async () =>
      Math.round((await requiredBox(boundary)).width - (await requiredBox(panel)).width),
    )
    .toBe(0)
})

for (const position of hybridPositions) {
  test(`previews, commits, and detaches a hybrid panel at ${position}`, async ({ page }) => {
    await page.goto(`${labURL}/lab/panel-geometry?fixture=hybrid-viewport`)
    const boundary = page.locator('[data-geometry-viewport]')
    const panel = geometryPanel(page, 'hybrid-viewport')
    const shell = page.locator('[data-picodash-panel-shell]').filter({ has: panel })
    const header = panel.locator('[data-picodash-panel-header]')
    const preview = page.locator('[data-hybrid-dock-preview]')
    const previewHalo = page.locator('[data-hybrid-dock-preview-halo]')
    const previewIcon = page.locator('[data-hybrid-dock-preview-icon]')
    const hybridToggle = shell.locator('[data-picodash-fixed-toggle]')
    const runtimePlacement = page.locator('[data-runtime-placement]')

    await detachHybridPanel(page, panel, shell)
    await expect(runtimePlacement).toHaveText('hybrid:')

    const floatingBox = await requiredBox(panel)
    const naturalHeight = floatingBox.height
    const floatingHeaderBox = await requiredBox(header)
    const boundaryBox = await requiredBox(boundary)
    const floatingStart = center(floatingHeaderBox)
    const target = hybridTarget(floatingBox, boundaryBox, position)
    let pointerTarget = pointerForPanelTarget(floatingStart, floatingBox, target)
    if (position === 'full-left' || position === 'full-right') {
      pointerTarget.y = boundaryBox.y + boundaryBox.height * 0.4
    }
    if (position.includes('-') && !position.startsWith('full-')) {
      pointerTarget = pointerAtBoundaryCorner(boundaryBox, position)
    }

    await page.mouse.move(floatingStart.x, floatingStart.y)
    await page.mouse.down()
    await page.mouse.move(pointerTarget.x, pointerTarget.y, { steps: 12 })

    if (position === 'top' || position === 'bottom') {
      await expect(preview).toHaveAttribute('data-hybrid-dock-preview', '')
      await expect
        .poll(async () => Number(await preview.getAttribute('opacity')))
        .toBeLessThanOrEqual(0.01)
      await expect(shell).toHaveCSS('opacity', '1')
    } else {
      await expect(preview).toHaveAttribute('data-hybrid-dock-preview', position)
      await expect(preview).toBeVisible()
      await expect(preview).toHaveCSS('filter', /drop-shadow/)
      await expect(preview).toHaveAttribute('fill', 'var(--picodash-color-surface)')
      await expect(preview).toHaveAttribute('stroke', 'var(--picodash-color-text)')
      await expect(preview).toHaveAttribute('rx', '0')
      await expect(preview).toHaveAttribute('stroke-width', '2')
      await expect(previewHalo).toHaveAttribute('stroke', 'var(--picodash-color-surface)')
      await expect(previewHalo).toHaveAttribute('rx', '0')
      await expect(previewHalo).toHaveAttribute('stroke-width', '4')
      await expect(previewHalo).toHaveAttribute('opacity', '1')
      await expect(previewIcon).toHaveAttribute('data-hybrid-dock-preview-icon', position)
      await expect(previewIcon).toBeVisible()
      await expectHybridPreviewIconDirection(previewIcon, preview, position)
      await expect
        .poll(() =>
          shell.evaluate((element) => Number.parseFloat(getComputedStyle(element).opacity)),
        )
        .toBeLessThanOrEqual(0.56)
      await expectHybridPreviewAtBoundary(preview, boundary, position)
    }
    await expect(shell).toHaveAttribute('data-hybrid-placement', '')
    await expect(runtimePlacement).toHaveText('hybrid:')
    await expect(hybridToggle).toHaveCount(0)
    await expect(panel.locator('[data-picodash-scrollport="body"]')).toHaveClass(/scroll-fade/)
    await expect
      .poll(async () => Math.abs((await requiredBox(panel)).height - naturalHeight))
      .toBeLessThanOrEqual(1)
    if (position === 'full-left' || position === 'full-right') {
      await expect
        .poll(async () => {
          const [previewBox, boundaryBox] = await Promise.all([
            requiredSvgBox(preview),
            requiredBox(boundary),
          ])
          return Math.abs(previewBox.height - boundaryBox.height)
        })
        .toBeLessThanOrEqual(2.1)
    } else if (position !== 'top' && position !== 'bottom') {
      await expect
        .poll(async () => Math.abs((await requiredSvgBox(preview)).height - naturalHeight))
        .toBeLessThanOrEqual(2.1)
    }

    await page.mouse.up()

    await expect(runtimePlacement).toHaveText(`hybrid:${position}`)
    await expect(shell).toHaveAttribute('data-hybrid-placement', position)
    await expect(shell).toHaveCSS('opacity', '1')
    await expectHybridPanelAtBoundary(panel, boundary, position)
    if (position === 'top' || position === 'bottom') {
      await expect
        .poll(async () => Math.abs((await requiredBox(panel)).x - floatingBox.x))
        .toBeLessThanOrEqual(1)
    }
    if (position === 'top' || position === 'bottom') {
      await expect(hybridToggle).toHaveCount(0)
      await expect(panel.locator('[data-picodash-scrollport="body"]')).toHaveClass(/scroll-fade/)
      await expect(
        panel.getByRole('button', { name: 'Collapse panel Hybrid viewport' }),
      ).toBeVisible()
    } else {
      await expect(hybridToggle).toBeVisible()
      await expect(panel.locator('[data-picodash-scrollport="auto"]')).toHaveClass(/scroll-fade/)
    }

    const attachedHeaderBox = await requiredBox(header)
    const attachedStart = center(attachedHeaderBox)
    const inward = hybridInwardDelta(position)
    await page.mouse.move(attachedStart.x, attachedStart.y)
    await page.mouse.down()
    const detachedTarget = {
      x: attachedStart.x + inward.x * 0.7,
      y: attachedStart.y + inward.y * 0.7,
    }
    await movePointerAcrossFrames(page, attachedStart, detachedTarget, 10)

    await expect(shell).toHaveAttribute('data-hybrid-placement', '')
    await expect(runtimePlacement).toHaveText('hybrid:')
    await expect(hybridToggle).toHaveCount(0)
    await expect(panel.locator('[data-picodash-scrollport="body"]')).toHaveClass(/scroll-fade/)
    const detachedBox = await requiredBox(panel)

    await movePointerAcrossFrames(
      page,
      detachedTarget,
      {
        x: attachedStart.x + inward.x,
        y: attachedStart.y + inward.y,
      },
      4,
    )
    const continuedBox = await requiredBox(panel)
    expectMovementInDirection(detachedBox, continuedBox, inward)
    await page.mouse.up()

    await expect(runtimePlacement).toHaveText('hybrid:')
    await expect(shell).toHaveAttribute('data-hybrid-placement', '')
  })
}

test('retargets one hybrid proxy across every edge and corner during a held drag', async ({
  page,
}) => {
  await page.goto(`${labURL}/lab/panel-geometry?fixture=hybrid-viewport`)
  const boundary = page.locator('[data-geometry-viewport]')
  const panel = geometryPanel(page, 'hybrid-viewport')
  const shell = page.locator('[data-picodash-panel-shell]').filter({ has: panel })
  const header = panel.locator('[data-picodash-panel-header]')
  const preview = page.locator('[data-hybrid-dock-preview]')

  await detachHybridPanel(page, panel, shell)
  const floatingBox = await requiredBox(panel)
  const boundaryBox = await requiredBox(boundary)
  const start = center(await requiredBox(header))
  const path = [
    'full-left',
    'top-left',
    'top',
    'top-right',
    'full-right',
    'bottom-right',
    'bottom',
    'bottom-left',
    'full-left',
  ] as const

  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  for (const position of path) {
    let target = pointerForPanelTarget(
      start,
      floatingBox,
      hybridTarget(floatingBox, boundaryBox, position),
    )
    if (position === 'full-left' || position === 'full-right') {
      target = {
        x: position === 'full-left' ? boundaryBox.x + 1 : boundaryBox.x + boundaryBox.width - 1,
        y: boundaryBox.y + boundaryBox.height / 2,
      }
    } else if (position === 'top' || position === 'bottom') {
      target = {
        x: boundaryBox.x + boundaryBox.width / 2,
        y: position === 'top' ? boundaryBox.y + 1 : boundaryBox.y + boundaryBox.height - 1,
      }
    } else if (position.includes('-')) {
      target = pointerAtBoundaryCorner(boundaryBox, position)
    }
    await page.mouse.move(target.x, target.y, { steps: 8 })
    if (position === 'top' || position === 'bottom') {
      await expect(preview).toHaveAttribute('data-hybrid-dock-preview', '')
      await expect
        .poll(async () => Number(await preview.getAttribute('opacity')))
        .toBeLessThanOrEqual(0.01)
    } else {
      await expect(preview).toHaveAttribute('data-hybrid-dock-preview', position)
      await expectHybridPreviewAtBoundary(preview, boundary, position)
    }
    await expect(shell).toHaveAttribute('data-hybrid-placement', '')
  }
  await page.mouse.up()

  await expect(shell).toHaveAttribute('data-hybrid-placement', 'full-left')
  await expectHybridPanelAtBoundary(panel, boundary, 'full-left')
})

test('reacquires an opposite-side hybrid proxy from the dragged panel bounds', async ({ page }) => {
  await page.goto(`${labURL}/lab/panel-geometry?fixture=hybrid-viewport`)
  const boundary = page.locator('[data-geometry-viewport]')
  const panel = geometryPanel(page, 'hybrid-viewport')
  const shell = page.locator('[data-picodash-panel-shell]').filter({ has: panel })
  const header = panel.locator('[data-picodash-panel-header]')
  const preview = page.locator('[data-hybrid-dock-preview]')

  await detachHybridPanel(page, panel, shell)
  const boundaryBox = await requiredBox(boundary)
  const start = center(await requiredBox(header))
  const middleY = boundaryBox.y + boundaryBox.height / 2

  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(boundaryBox.x + 1, middleY, { steps: 8 })
  await expect(preview).toHaveAttribute('data-hybrid-dock-preview', 'full-left')
  await expectHybridPreviewAtBoundary(preview, boundary, 'full-left')

  await page.mouse.move(boundaryBox.x + boundaryBox.width / 2, middleY)
  await expect(preview).toHaveAttribute('data-hybrid-dock-preview', '')
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  )

  await page.mouse.move(boundaryBox.x + boundaryBox.width - 1, middleY)
  await expect(preview).toHaveAttribute('data-hybrid-dock-preview', 'full-right')
  const samples = await page.evaluate(async () => {
    const frames = []
    for (let frame = 0; frame < 12; frame += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      const boundaryRect = document
        .querySelector('[data-geometry-viewport]')
        ?.getBoundingClientRect()
      const panelRect = document
        .querySelector('[data-geometry-fixture="hybrid-viewport"]')
        ?.getBoundingClientRect()
      const previewRect = document
        .querySelector('[data-hybrid-dock-preview]')
        ?.getBoundingClientRect()
      if (!boundaryRect || !panelRect || !previewRect) throw new Error('Missing hybrid geometry.')
      frames.push({
        boundaryLeft: boundaryRect.left,
        boundaryRight: boundaryRect.right,
        panelLeft: panelRect.left,
        panelTop: panelRect.top,
        previewLeft: previewRect.left,
        previewRight: previewRect.right,
        previewTop: previewRect.top,
      })
    }
    return frames
  })

  expect(Math.abs(samples[0].previewLeft - samples[0].panelLeft)).toBeLessThanOrEqual(64)
  expect(Math.abs(samples[0].previewTop - samples[0].panelTop)).toBeLessThanOrEqual(64)
  for (const sample of samples) {
    expect(sample.previewLeft).toBeGreaterThanOrEqual(sample.boundaryLeft - 1)
    expect(sample.previewRight).toBeLessThanOrEqual(sample.boundaryRight + 1)
  }
  await page.mouse.up()
})

test('can dismiss and reacquire the same hybrid preview without releasing the pointer', async ({
  page,
}) => {
  await page.goto(`${labURL}/lab/panel-geometry?fixture=hybrid-viewport`)
  const boundary = page.locator('[data-geometry-viewport]')
  const panel = geometryPanel(page, 'hybrid-viewport')
  const shell = page.locator('[data-picodash-panel-shell]').filter({ has: panel })
  const header = panel.locator('[data-picodash-panel-header]')
  const preview = page.locator('[data-hybrid-dock-preview]')

  await detachHybridPanel(page, panel, shell)

  const floatingBox = await requiredBox(panel)
  const floatingStart = center(await requiredBox(header))
  const boundaryBox = await requiredBox(boundary)
  const leftTarget = hybridTarget(floatingBox, boundaryBox, 'full-left')
  let pointer = {
    ...pointerForPanelTarget(floatingStart, floatingBox, leftTarget),
    y: boundaryBox.y + boundaryBox.height / 2,
  }

  await page.mouse.move(floatingStart.x, floatingStart.y)
  await page.mouse.down()
  await page.mouse.move(pointer.x, pointer.y, { steps: 12 })
  await expect(preview).toHaveAttribute('data-hybrid-dock-preview', 'full-left')
  await expectHybridPreviewAtBoundary(preview, boundary, 'full-left')
  await expect(shell).toHaveAttribute('data-hybrid-placement', '')

  await page.mouse.move(0, pointer.y, { steps: 4 })
  await expect(preview).toHaveAttribute('data-hybrid-dock-preview', 'full-left')
  await expectHybridPreviewAtBoundary(preview, boundary, 'full-left')

  pointer = { x: 200, y: floatingStart.y }
  await page.mouse.move(pointer.x, pointer.y, { steps: 8 })
  await expect(preview).toHaveAttribute('data-hybrid-dock-preview', '')
  await expect
    .poll(async () => Number(await preview.getAttribute('opacity')))
    .toBeLessThanOrEqual(0.01)
  await expect.poll(async () => (await requiredBox(panel)).x).toBeGreaterThan(24)

  const detachedBox = await requiredBox(panel)
  pointer = {
    x: pointer.x + boundaryBox.x - detachedBox.x,
    y: boundaryBox.y + boundaryBox.height / 2,
  }
  await page.mouse.move(pointer.x, pointer.y, { steps: 8 })
  await expect(preview).toHaveAttribute('data-hybrid-dock-preview', 'full-left')
  await expectHybridPreviewAtBoundary(preview, boundary, 'full-left')
  await expect(shell).toHaveAttribute('data-hybrid-placement', '')
  await page.mouse.up()

  await expect(page.locator('[data-runtime-placement]')).toHaveText('hybrid:full-left')
  await expect(shell).toHaveAttribute('data-hybrid-placement', 'full-left')
})

test('holds an attached hybrid panel until the pointer reaches its release distance', async ({
  page,
}) => {
  await page.goto(`${labURL}/lab/panel-geometry?fixture=hybrid-viewport`)
  const boundary = page.locator('[data-geometry-viewport]')
  const panel = geometryPanel(page, 'hybrid-viewport')
  const shell = page.locator('[data-picodash-panel-shell]').filter({ has: panel })
  const header = panel.locator('[data-picodash-panel-header]')
  const preview = page.locator('[data-hybrid-dock-preview]')

  await detachHybridPanel(page, panel, shell)
  const floatingBox = await requiredBox(panel)
  const boundaryBox = await requiredBox(boundary)
  const floatingStart = center(await requiredBox(header))
  const leftTarget = hybridTarget(floatingBox, boundaryBox, 'full-left')
  const pointer = {
    ...pointerForPanelTarget(floatingStart, floatingBox, leftTarget),
    y: boundaryBox.y + boundaryBox.height / 2,
  }

  await page.mouse.move(floatingStart.x, floatingStart.y)
  await page.mouse.down()
  await page.mouse.move(pointer.x, pointer.y, { steps: 12 })
  await expect(preview).toHaveAttribute('data-hybrid-dock-preview', 'full-left')
  await expect(shell).toHaveAttribute('data-hybrid-placement', '')
  await page.mouse.up()
  await expect(shell).toHaveAttribute('data-hybrid-placement', 'full-left')
  await expectHybridPanelAtBoundary(panel, boundary, 'full-left')

  const attachedStart = center(await requiredBox(header))
  await page.mouse.move(attachedStart.x, attachedStart.y)
  await page.mouse.down()
  await page.mouse.move(attachedStart.x + 39, attachedStart.y, { steps: 4 })
  await expect(shell).toHaveAttribute('data-hybrid-placement', 'full-left')
  await expectHybridPanelAtBoundary(panel, boundary, 'full-left')

  await page.mouse.move(attachedStart.x + 40, attachedStart.y)
  await expect(shell).toHaveAttribute('data-hybrid-placement', '')
  await expect(page.locator('[data-runtime-placement]')).toHaveText('hybrid:')
  await expect
    .poll(async () => Math.abs(center(await requiredBox(header)).x - (attachedStart.x + 40)))
    .toBeLessThanOrEqual(1)

  await page.mouse.move(attachedStart.x + 48, attachedStart.y, { steps: 4 })
  await expect
    .poll(async () => Math.abs(center(await requiredBox(header)).x - (attachedStart.x + 48)))
    .toBeLessThanOrEqual(1)
  await page.mouse.up()
})

test('applies the hybrid release distance diagonally from a corner', async ({ page }) => {
  await page.goto(`${labURL}/lab/panel-geometry?fixture=hybrid-viewport`)
  const boundary = page.locator('[data-geometry-viewport]')
  const panel = geometryPanel(page, 'hybrid-viewport')
  const shell = page.locator('[data-picodash-panel-shell]').filter({ has: panel })
  const header = panel.locator('[data-picodash-panel-header]')
  const preview = page.locator('[data-hybrid-dock-preview]')

  await detachHybridPanel(page, panel, shell)
  const start = center(await requiredBox(header))
  const boundaryBox = await requiredBox(boundary)
  const corner = pointerAtBoundaryCorner(boundaryBox, 'top-left')
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(corner.x, corner.y, { steps: 12 })
  await expect(preview).toHaveAttribute('data-hybrid-dock-preview', 'top-left')
  await page.mouse.up()
  await expect(shell).toHaveAttribute('data-hybrid-placement', 'top-left')

  const attachedStart = center(await requiredBox(header))
  await page.mouse.move(attachedStart.x, attachedStart.y)
  await page.mouse.down()
  await page.mouse.move(attachedStart.x + 27, attachedStart.y + 27, { steps: 4 })
  await expect(shell).toHaveAttribute('data-hybrid-placement', 'top-left')
  await expectHybridPanelAtBoundary(panel, boundary, 'top-left')

  await page.mouse.move(attachedStart.x + 31, attachedStart.y + 31, { steps: 4 })
  await expect(shell).toHaveAttribute('data-hybrid-placement', '')
  await page.mouse.move(attachedStart.x + 80, attachedStart.y + 80, { steps: 4 })
  await expect(preview).toHaveAttribute('data-hybrid-dock-preview', '')
  await page.mouse.up()
  await expect(page.locator('[data-runtime-placement]')).toHaveText('hybrid:')
})

test('updates a held hybrid preview when the viewport boundary resizes', async ({ page }) => {
  await page.goto(`${labURL}/lab/panel-geometry?fixture=hybrid-viewport`)
  const boundary = page.locator('[data-geometry-viewport]')
  const panel = geometryPanel(page, 'hybrid-viewport')
  const shell = page.locator('[data-picodash-panel-shell]').filter({ has: panel })
  const header = panel.locator('[data-picodash-panel-header]')
  const preview = page.locator('[data-hybrid-dock-preview]')

  await detachHybridPanel(page, panel, shell)
  const start = center(await requiredBox(header))
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(1, 300, { steps: 12 })
  await expect(preview).toHaveAttribute('data-hybrid-dock-preview', 'full-left')
  await expectHybridPreviewAtBoundary(preview, boundary, 'full-left')

  await page.setViewportSize({ width: 700, height: 500 })
  await page.mouse.move(1, 250)
  await expect(preview).toHaveAttribute('data-hybrid-dock-preview', 'full-left')
  await expectHybridPreviewAtBoundary(preview, boundary, 'full-left')
  await expect
    .poll(async () => {
      const [previewBox, boundaryBox] = await Promise.all([
        requiredSvgBox(preview),
        requiredBox(boundary),
      ])
      return Math.abs(previewBox.height - boundaryBox.height)
    })
    .toBeLessThanOrEqual(2.1)
  await page.mouse.up()

  await expect(shell).toHaveAttribute('data-hybrid-placement', 'full-left')
  await expectHybridPanelAtBoundary(panel, boundary, 'full-left')
})

test('settles a hybrid preview immediately with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(`${labURL}/lab/panel-geometry?fixture=hybrid-viewport`)
  const boundary = page.locator('[data-geometry-viewport]')
  const panel = geometryPanel(page, 'hybrid-viewport')
  const shell = page.locator('[data-picodash-panel-shell]').filter({ has: panel })
  const header = panel.locator('[data-picodash-panel-header]')
  const preview = page.locator('[data-hybrid-dock-preview]')

  await detachHybridPanel(page, panel, shell)
  const floatingBox = await requiredBox(panel)
  const boundaryBox = await requiredBox(boundary)
  const start = center(await requiredBox(header))
  const leftPointer = {
    ...pointerForPanelTarget(
      start,
      floatingBox,
      hybridTarget(floatingBox, boundaryBox, 'full-left'),
    ),
    y: boundaryBox.y + boundaryBox.height / 2,
  }
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(leftPointer.x, leftPointer.y)
  await expect(preview).toHaveAttribute('data-hybrid-dock-preview', 'full-left')
  await expect(preview).toHaveAttribute('opacity', '1')
  await expect(page.locator('[data-picodash-hybrid-preview-layer]')).toHaveAttribute(
    'data-picodash-theme',
    'dark',
  )
  await expectHybridPreviewAtBoundary(preview, boundary, 'full-left')

  await page.mouse.up()
  await expect(shell).toHaveAttribute('data-hybrid-placement', 'full-left')
})

for (const position of ['top', 'bottom'] as const) {
  test(`keeps a ${position}-snapped hybrid panel floating-style and collapsible`, async ({
    page,
  }) => {
    await page.goto(`${labURL}/lab/panel-geometry?fixture=hybrid-viewport`)
    const boundary = page.locator('[data-geometry-viewport]')
    const panel = geometryPanel(page, 'hybrid-viewport')
    const shell = page.locator('[data-picodash-panel-shell]').filter({ has: panel })
    const header = panel.locator('[data-picodash-panel-header]')
    const preview = page.locator('[data-hybrid-dock-preview]')

    await detachHybridPanel(page, panel, shell)
    const floatingBox = await requiredBox(panel)
    const boundaryBox = await requiredBox(boundary)
    const start = center(await requiredBox(header))
    const pointer = pointerForPanelTarget(
      start,
      floatingBox,
      hybridTarget(floatingBox, boundaryBox, position),
    )

    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(pointer.x, pointer.y, { steps: 12 })
    await expect(preview).toHaveAttribute('data-hybrid-dock-preview', '')
    await expect
      .poll(async () => Number(await preview.getAttribute('opacity')))
      .toBeLessThanOrEqual(0.01)
    await page.mouse.up()

    await expect(shell).toHaveAttribute('data-hybrid-placement', position)
    await expect(shell.locator('[data-picodash-fixed-toggle]')).toHaveCount(0)
    await expect(panel.locator('[data-picodash-scrollport="body"]')).toHaveClass(/scroll-fade/)

    const collapse = panel.getByRole('button', { name: 'Collapse panel Hybrid viewport' })
    await collapse.click()
    await expect(panel).toHaveAttribute('data-collapsed', 'true')
    await expect(panel.getByRole('button', { name: 'Expand panel Hybrid viewport' })).toBeVisible()
    await expect(shell.locator('[data-picodash-fixed-toggle]')).toHaveCount(0)
  })
}

test('uses cursor edge intent for an intrinsically over-height hybrid panel', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 900, height: 300 })
  await page.goto(`${labURL}/lab/panel-geometry?fixture=hybrid-viewport-tall`)
  const boundary = page.locator('[data-geometry-viewport]')
  const panel = geometryPanel(page, 'hybrid-viewport')
  const shell = page.locator('[data-picodash-panel-shell]').filter({ has: panel })
  const header = panel.locator('[data-picodash-panel-header]')
  const preview = page.locator('[data-hybrid-dock-preview]')

  const initialStart = center(await requiredBox(header))
  await page.mouse.move(initialStart.x, initialStart.y)
  await page.mouse.down()
  await page.mouse.move(initialStart.x + 180, initialStart.y + 120, { steps: 12 })
  await page.mouse.up()
  await expect(shell).toHaveAttribute('data-hybrid-placement', '')

  const floatingBox = await requiredBox(panel)
  const boundaryBox = await requiredBox(boundary)
  const sideStart = center(await requiredBox(header))
  const sidePointer = {
    ...pointerForPanelTarget(
      sideStart,
      floatingBox,
      hybridTarget(floatingBox, boundaryBox, 'full-left'),
    ),
    y: boundaryBox.y + boundaryBox.height / 2,
  }
  await page.mouse.move(sideStart.x, sideStart.y)
  await page.mouse.down()
  await page.mouse.move(sidePointer.x, sidePointer.y, { steps: 12 })
  await expect(preview).toHaveAttribute('data-hybrid-dock-preview', 'full-left')
  await expect(shell).toHaveAttribute('data-hybrid-placement', '')
  await page.mouse.up()
  await expect(shell).toHaveAttribute('data-hybrid-placement', 'full-left')
  await expectHybridPanelAtBoundary(panel, boundary, 'full-left')

  const attachedStart = center(await requiredBox(header))
  await page.mouse.move(attachedStart.x, attachedStart.y)
  await page.mouse.down()
  await page.mouse.move(attachedStart.x + 180, attachedStart.y, { steps: 12 })
  await page.mouse.up()
  await expect(shell).toHaveAttribute('data-hybrid-placement', '')

  const bottomStart = center(await requiredBox(header))
  await page.mouse.move(bottomStart.x, bottomStart.y)
  await page.mouse.down()
  await page.mouse.move(
    boundaryBox.x + boundaryBox.width / 2,
    boundaryBox.y + boundaryBox.height - 1,
    { steps: 12 },
  )
  await expect(preview).toHaveAttribute('data-hybrid-dock-preview', '')
  await expect
    .poll(async () => Number(await preview.getAttribute('opacity')))
    .toBeLessThanOrEqual(0.01)
  await expect(shell).toHaveAttribute('data-hybrid-placement', '')
  await page.mouse.up()
  await expect(shell).toHaveAttribute('data-hybrid-placement', 'bottom')
  await expect(shell.locator('[data-picodash-fixed-toggle]')).toHaveCount(0)
})

test('detaches bottom placement before previewing and committing a bottom corner', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(`${labURL}/lab/panel-geometry?fixture=hybrid-viewport`)
  const boundary = page.locator('[data-geometry-viewport]')
  const panel = geometryPanel(page, 'hybrid-viewport')
  const shell = page.locator('[data-picodash-panel-shell]').filter({ has: panel })
  const header = panel.locator('[data-picodash-panel-header]')
  const preview = page.locator('[data-hybrid-dock-preview]')
  const runtimePlacement = page.locator('[data-runtime-placement]')

  await detachHybridPanel(page, panel, shell)
  const floatingBox = await requiredBox(panel)
  const boundaryBox = await requiredBox(boundary)
  const floatingStart = center(await requiredBox(header))
  const bottomTarget = pointerForPanelTarget(
    floatingStart,
    floatingBox,
    hybridTarget(floatingBox, boundaryBox, 'bottom'),
  )
  await page.mouse.move(floatingStart.x, floatingStart.y)
  await page.mouse.down()
  await page.mouse.move(bottomTarget.x, bottomTarget.y, { steps: 12 })
  await expect(preview).toHaveAttribute('data-hybrid-dock-preview', '')
  await page.mouse.up()
  await expect(runtimePlacement).toHaveText('hybrid:bottom')

  const attachedStart = center(await requiredBox(header))
  await page.mouse.move(attachedStart.x, attachedStart.y)
  await page.mouse.down()
  const detachedTarget = { x: attachedStart.x, y: attachedStart.y - 60 }
  await movePointerAcrossFrames(page, attachedStart, detachedTarget, 10)
  await expect(shell).toHaveAttribute('data-hybrid-placement', '')
  await expect(runtimePlacement).toHaveText('hybrid:')

  const cornerTarget = pointerAtBoundaryCorner(boundaryBox, 'bottom-right')
  await movePointerAcrossFrames(page, detachedTarget, cornerTarget, 12)
  await expect(preview).toHaveAttribute('data-hybrid-dock-preview', 'bottom-right')
  await expectHybridPreviewAtBoundary(preview, boundary, 'bottom-right')
  await expect(shell).toHaveAttribute('data-hybrid-placement', '')
  await expect(runtimePlacement).toHaveText('hybrid:')
  await page.mouse.up()
  await expect(runtimePlacement).toHaveText('hybrid:bottom-right')
  await expectHybridPanelAtBoundary(panel, boundary, 'bottom-right')
})

test('previews the committed width when the caller width equals the floating boundary limit', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 348, height: 600 })
  await page.goto(`${labURL}/lab/panel-geometry?fixture=hybrid-width`)
  const boundary = page.locator('[data-geometry-viewport]')
  const panel = geometryPanel(page, 'hybrid-width')
  const shell = page.locator('[data-picodash-panel-shell]').filter({ has: panel })
  const header = panel.locator('[data-picodash-panel-header]')
  const preview = page.locator('[data-hybrid-dock-preview]')

  await expect(shell).toHaveAttribute('data-hybrid-placement', '')
  const floatingBox = await requiredBox(panel)
  expect(floatingBox.width).toBe(300)
  const boundaryBox = await requiredBox(boundary)
  const start = center(await requiredBox(header))
  const pointer = {
    ...pointerForPanelTarget(
      start,
      floatingBox,
      hybridTarget(floatingBox, boundaryBox, 'full-left'),
    ),
    y: boundaryBox.y + boundaryBox.height / 2,
  }

  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(pointer.x, pointer.y, { steps: 12 })
  await expect(preview).toHaveAttribute('data-hybrid-dock-preview', 'full-left')
  const previewBox = await requiredSvgBox(preview)
  expect(Math.abs(previewBox.width - floatingBox.width)).toBeLessThanOrEqual(2.1)
  await page.mouse.up()

  await expect(shell).toHaveAttribute('data-hybrid-placement', 'full-left')
  await expect
    .poll(async () => Math.abs((await requiredBox(panel)).width - previewBox.width))
    .toBeLessThanOrEqual(2.1)
})

test('applies per-panel snap offset and proximity options', async ({ page }) => {
  await page.goto(`${labURL}/lab/panel-geometry?fixture=hybrid-width`)
  const panel = geometryPanel(page, 'hybrid-width')
  const shell = page.locator('[data-picodash-panel-shell]').filter({ has: panel })
  const panelBox = await requiredBox(panel)
  const start = center(await requiredBox(panel.locator('[data-picodash-panel-header]')))

  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x, start.y - panelBox.y + 31, { steps: 12 })
  await page.mouse.up()

  await expect(shell).toHaveAttribute('data-hybrid-placement', 'top')
  await expect.poll(async () => Math.round((await requiredBox(panel)).y)).toBe(24)
})

test('persists a hybrid detach when the pointer is released immediately', async ({ page }) => {
  await page.goto(`${labURL}/lab/panel-geometry?fixture=hybrid-viewport`)
  const panel = geometryPanel(page, 'hybrid-viewport')
  const shell = page.locator('[data-picodash-panel-shell]').filter({ has: panel })
  const start = center(await requiredBox(panel.locator('[data-picodash-panel-header]')))

  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + 180, start.y + 60, { steps: 12 })
  await page.mouse.up()

  await expect(shell).toHaveAttribute('data-hybrid-placement', '')
  await waitForStablePanelPosition(panel)
  const detachedBox = await requiredBox(panel)
  const serializedLayout = await page.locator('[data-runtime-layout]').textContent()
  const layout = JSON.parse(serializedLayout ?? 'null')
  expect(layout).toMatchObject({
    placement: { disposition: { kind: 'free' }, mode: 'hybrid' },
    preferredCoordinates: {
      x: Math.round(detachedBox.x),
      y: Math.round(detachedBox.y),
    },
  })
})

test('keeps a detached hybrid panel floating-like through viewport resizes', async ({ page }) => {
  await page.goto(`${labURL}/lab/panel-geometry?fixture=hybrid-viewport`)
  const panel = geometryPanel(page, 'hybrid-viewport')
  const shell = page.locator('[data-picodash-panel-shell]').filter({ has: panel })

  await detachHybridPanel(page, panel, shell)
  const initial = await requiredBox(panel)

  await page.setViewportSize({ width: 640, height: 420 })
  await expect(shell).toHaveAttribute('data-hybrid-placement', '')
  await expect(page.locator('[data-runtime-placement]')).toHaveText('hybrid:')
  await expectTop(panel, initial.y)
  await expectBottomAtMost(panel, 420)

  await page.setViewportSize({ width: 900, height: 600 })
  await expect(shell).toHaveAttribute('data-hybrid-placement', '')
  await expectTop(panel, initial.y)
  await expect
    .poll(async () => Math.abs((await requiredBox(panel)).x - initial.x))
    .toBeLessThanOrEqual(1)
})

for (const position of ['full-left', 'full-right'] as const) {
  test(`detaches a hybrid ${position} lane when its header is dragged down`, async ({ page }) => {
    await page.goto(`${labURL}/lab/panel-geometry?fixture=hybrid-viewport`)
    const boundary = page.locator('[data-geometry-viewport]')
    const panel = geometryPanel(page, 'hybrid-viewport')
    const shell = page.locator('[data-picodash-panel-shell]').filter({ has: panel })
    const header = panel.locator('[data-picodash-panel-header]')
    const preview = page.locator('[data-hybrid-dock-preview]')

    await detachHybridPanel(page, panel, shell)
    const floatingBox = await requiredBox(panel)
    const floatingStart = center(await requiredBox(header))
    const boundaryBox = await requiredBox(boundary)
    const target = hybridTarget(floatingBox, boundaryBox, position)
    const pointer = {
      ...pointerForPanelTarget(floatingStart, floatingBox, target),
      y: boundaryBox.y + boundaryBox.height / 2,
    }

    await page.mouse.move(floatingStart.x, floatingStart.y)
    await page.mouse.down()
    await page.mouse.move(pointer.x, pointer.y, { steps: 12 })
    await expect(preview).toHaveAttribute('data-hybrid-dock-preview', position)
    await expect(shell).toHaveAttribute('data-hybrid-placement', '')
    await page.mouse.up()
    await expect(shell).toHaveAttribute('data-hybrid-placement', position)

    const attachedStart = center(await requiredBox(header))
    await page.mouse.move(attachedStart.x, attachedStart.y)
    await page.mouse.down()
    await page.mouse.move(attachedStart.x, attachedStart.y + 39, { steps: 4 })

    await expect(shell).toHaveAttribute('data-hybrid-placement', position)
    await expectHybridPanelAtBoundary(panel, boundary, position)

    await page.mouse.up()
    await expect(shell).toHaveAttribute('data-hybrid-placement', position)
    await expectHybridPanelAtBoundary(panel, boundary, position)

    const retryStart = center(await requiredBox(header))
    await page.mouse.move(retryStart.x, retryStart.y)
    await page.mouse.down()
    await page.mouse.move(retryStart.x, retryStart.y + 40)
    await expect(shell).toHaveAttribute('data-hybrid-placement', '')
    await expect(page.locator('[data-runtime-placement]')).toHaveText('hybrid:')
    await expect
      .poll(async () => Math.abs(center(await requiredBox(header)).y - (retryStart.y + 40)))
      .toBeLessThanOrEqual(1)

    await page.mouse.move(retryStart.x, retryStart.y + 48, { steps: 4 })
    await expect
      .poll(async () => Math.abs(center(await requiredBox(header)).y - (retryStart.y + 48)))
      .toBeLessThanOrEqual(1)
    await page.mouse.up()
  })
}

test('can retarget a side-detached panel to a bottom corner in the same drag', async ({ page }) => {
  await page.goto(`${labURL}/lab/panel-geometry?fixture=hybrid-viewport`)
  const boundary = page.locator('[data-geometry-viewport]')
  const panel = geometryPanel(page, 'hybrid-viewport')
  const shell = page.locator('[data-picodash-panel-shell]').filter({ has: panel })
  const header = panel.locator('[data-picodash-panel-header]')
  const preview = page.locator('[data-hybrid-dock-preview]')

  await detachHybridPanel(page, panel, shell)
  const floatingBox = await requiredBox(panel)
  const boundaryBox = await requiredBox(boundary)
  const floatingStart = center(await requiredBox(header))
  const leftPointer = {
    ...pointerForPanelTarget(
      floatingStart,
      floatingBox,
      hybridTarget(floatingBox, boundaryBox, 'full-left'),
    ),
    y: boundaryBox.y + boundaryBox.height / 2,
  }
  await page.mouse.move(floatingStart.x, floatingStart.y)
  await page.mouse.down()
  await page.mouse.move(leftPointer.x, leftPointer.y, { steps: 12 })
  await expect(preview).toHaveAttribute('data-hybrid-dock-preview', 'full-left')
  await page.mouse.up()
  await expect(shell).toHaveAttribute('data-hybrid-placement', 'full-left')

  const attachedStart = center(await requiredBox(header))
  await page.mouse.move(attachedStart.x, attachedStart.y)
  await page.mouse.down()
  await page.mouse.move(attachedStart.x + 80, attachedStart.y + 80, { steps: 12 })
  await expect(shell).toHaveAttribute('data-hybrid-placement', '')
  await expect(preview).toHaveAttribute('data-hybrid-dock-preview', '')

  await page.mouse.move(
    boundaryBox.x + boundaryBox.width - 1,
    boundaryBox.y + boundaryBox.height - 1,
    { steps: 12 },
  )
  await expect(preview).toHaveAttribute('data-hybrid-dock-preview', 'bottom-right')
  await page.mouse.up()
  await expect(shell).toHaveAttribute('data-hybrid-placement', 'bottom-right')
})

test('handles deferred corners, ordinary class constraints, and viewport panels in a scrolling portal', async ({
  page,
}) => {
  await page.goto(`${labURL}/lab/panel-geometry?fixture=review-regressions`)
  const panel = geometryPanel(page, 'review-regression')
  const portal = page.locator('[data-geometry-scroll-portal]')
  const shell = page.locator('[data-picodash-panel-shell]').filter({ has: panel })
  await expect.poll(async () => (await requiredBox(panel)).width).toBe(220)
  await expect.poll(async () => (await requiredBox(panel)).height).toBe(600)
  await expect(panel).toHaveCSS('max-width', '220px')
  await expect(panel).toHaveCSS('max-height', '600px')
  const initial = await requiredBox(panel)

  await portal.evaluate((element) => {
    element.scrollTop = 160
    element.dispatchEvent(new Event('scroll'))
  })
  await expect.poll(() => portal.evaluate((element) => element.scrollTop)).toBe(160)
  await expect
    .poll(async () => {
      const current = await requiredBox(panel)
      return { x: Math.round(current.x), y: Math.round(current.y) }
    })
    .toEqual({ x: Math.round(initial.x), y: Math.round(initial.y) })

  await shell.locator('[data-picodash-fixed-toggle]').click()
  await expect(panel).toHaveAttribute('data-collapsed', 'true')
  let lastWidth = -1
  await expect
    .poll(
      async () => {
        const width = await panel.evaluate((el: HTMLElement) => el.offsetWidth)
        const stable = width === lastWidth
        lastWidth = width
        return stable
      },
      { timeout: 1000, intervals: [50] },
    )
    .toBe(true)
  await page.getByRole('button', { name: 'Float bottom-right' }).click()
  await expect(page.locator('[data-review-regression-placement]')).toHaveText(
    'floating:bottom-right',
  )
  await expect(shell).not.toHaveAttribute('data-fixed-placement')
  await expect(panel).toHaveAttribute('data-collapsed', 'true')
  await panel.getByRole('button', { name: 'Expand panel Review regression' }).click()
  await expect(panel).toHaveAttribute('data-collapsed', 'false')
  await expect.poll(async () => (await requiredBox(shell)).width).toBe(220)
  await expect(panel).toHaveCSS('max-height', '180px')
  await expect
    .poll(async () => {
      const box = await requiredBox(panel)
      return {
        bottom: Math.round(600 - box.y - box.height),
        right: Math.round(900 - box.x - box.width),
      }
    })
    .toEqual({ bottom: defaultPlacementInset, right: defaultPlacementInset })
})

test('resolves an unsaved corner and ancestor-scoped variable constraints against a custom boundary', async ({
  page,
}) => {
  await page.goto(`${labURL}/lab/panel-geometry?fixture=relative-constraints`)
  const boundary = page.locator('[data-geometry-boundary="relative-constraints"]')
  const panel = geometryPanel(page, 'relative-constraint')

  await expect.poll(async () => (await requiredBox(panel)).width).toBe(260)
  await expect.poll(async () => (await requiredBox(panel)).height).toBe(320)
  await expect(panel).toHaveCSS('max-width', '260px')
  await expect(panel).toHaveCSS('max-height', '320px')
  await expectCornerInset(panel, boundary, 'bottom-right', defaultPlacementInset)

  await boundary.evaluate((element) => {
    const boundaryElement = element as HTMLElement
    boundaryElement.style.width = '600px'
    boundaryElement.style.height = '400px'
  })

  await expect.poll(async () => (await requiredBox(panel)).width).toBe(300)
  await expect.poll(async () => (await requiredBox(panel)).height).toBe(360)
  await expect(panel).toHaveCSS('max-width', '300px')
  await expect(panel).toHaveCSS('max-height', '360px')
  await expectCornerInset(panel, boundary, 'bottom-right', defaultPlacementInset)
})

test('retracts every fixed placement while preserving its reopening control', async ({ page }) => {
  await page.goto(`${labURL}/lab/panel-geometry?fixture=fixed-boundaries`)
  const boundary = page.locator('[data-geometry-boundary="provider"]')
  const panel = geometryPanel(page, 'fixed-boundary')
  const shell = page.locator('[data-picodash-panel-shell]').filter({ has: panel })
  const placement = page.getByLabel('Fixed placement')
  const toggle = shell.locator('[data-picodash-fixed-toggle]')

  await expect(page.locator('[data-runtime-placement]')).toHaveText('fixed:full-left')

  for (const position of fixedPositions) {
    await placement.selectOption(position)
    await expect(shell).toHaveAttribute('data-fixed-placement', position)
    await expectPanelAtBoundary(panel, boundary, position)
    await expect(toggle).toHaveAccessibleName('Collapse panel Provider boundary')
    await expect(toggle.locator('svg')).toHaveClass(expandedArrowClass(position))
    await movePointerOutside(page, toggle)
    await expect(toggle).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    await expectTranslucentHover(page, toggle)

    await toggle.click()

    await expect(panel).toHaveAttribute('data-collapsed', 'true')
    await expect(toggle).toHaveAccessibleName('Expand panel Provider boundary')
    await expect(toggle.locator('svg')).toHaveClass(collapsedArrowClass(position))
    await movePointerOutside(page, toggle)
    await toggle.evaluate((element) => (element as HTMLElement).blur())
    const restingRevealAlpha = await backgroundAlphaAfterTransition(page, toggle)
    expect(restingRevealAlpha).toBeCloseTo(0.72, 2)
    await toggle.hover()
    const hoveredRevealAlpha = await backgroundAlphaAfterTransition(page, toggle)
    expect(hoveredRevealAlpha).toBeCloseTo(0.82, 2)
    await movePointerOutside(page, toggle)
    await toggle.focus()
    await page.keyboard.press('Tab')
    await page.keyboard.press('Shift+Tab')
    await expect(toggle).toBeFocused()
    const focusedRevealAlpha = await backgroundAlphaAfterTransition(page, toggle)
    expect(focusedRevealAlpha).toBeCloseTo(0.82, 2)
    await expectCollapsedPanelBeyondBoundary(panel, boundary, position)
    await expectToggleAtBoundaryCorner(toggle, boundary, position)

    await toggle.click()

    await expect(panel).toHaveAttribute('data-collapsed', 'false')
    await expect(toggle).toHaveAccessibleName('Collapse panel Provider boundary')
    await movePointerOutside(page, toggle)
    await expect(toggle).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    await expectPanelAtBoundary(panel, boundary, position)
  }
})

test('rolls back an active keyboard reorder when its list unmounts', async ({ page }) => {
  await page.goto(`${labURL}/lab/panel-geometry?fixture=keyboard-unmount`)
  const panel = geometryPanel(page, 'keyboard-unmount')
  const secondGrip = panel.getByRole('button', {
    name: 'Reorder Second group',
    exact: true,
  })

  await secondGrip.press('Space')
  await secondGrip.press('ArrowUp')
  await page.getByRole('button', { name: 'Unmount keyboard fixture' }).click()
  await expect(panel).toHaveCount(0)

  await expect.poll(() => keyboardUnmountRootOrder(page)).toEqual(['first-group', 'second-group'])
})

test('viewport shrink and growth constrain an undocked panel without moving its top', async ({
  page,
}) => {
  await page.goto(`${labURL}/lab/panel-geometry?fixture=groups`)
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
  await page.goto(`${labURL}/lab/panel-geometry?fixture=caller-max-height`)
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
  await page.goto(`${labURL}/lab/panel-geometry?fixture=class-max-height`)
  const panel = geometryPanel(page, 'class-max-height')

  await expect.poll(async () => (await requiredBox(panel)).height).toBe(192)
  await expect
    .poll(() => panel.evaluate((element) => getComputedStyle(element).maxHeight))
    .toBe('192px')
})

test('anchors a bottom-docked panel using its caller-capped height', async ({ page }) => {
  await seedLayout(page, {
    'geometry-bottom-capped': {
      placement: {
        disposition: { kind: 'docked', position: 'bottom-left' },
        mode: 'hybrid',
      },
      preferredCoordinates: { x: safeInset, y: 500 },
    },
  })
  await page.goto(`${labURL}/lab/panel-geometry?fixture=bottom-max-height`)
  const panel = geometryPanel(page, 'bottom-max-height')

  await expect.poll(async () => (await requiredBox(panel)).height).toBe(200)
  await expectBottom(panel, 600)
})

test('rebases a bottom-positioned panel while shrinking during a held drag', async ({ page }) => {
  await page.goto(`${labURL}/lab/panel-geometry?fixture=bottom-drag`)
  const panel = geometryPanel(page, 'bottom-drag')
  const initial = await requiredBox(panel)
  const header = await requiredBox(panel.locator('[data-picodash-panel-header]'))
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

async function expectEdgeInsets(
  panel: Locator,
  expected: { bottom?: number; right?: number; top?: number },
) {
  await expect
    .poll(async () => {
      const viewport = panel.page().viewportSize()
      const rect = await requiredBox(panel)
      return {
        ...(expected.bottom === undefined
          ? {}
          : { bottom: Math.round((viewport?.height ?? 0) - rect.y - rect.height) }),
        ...(expected.right === undefined
          ? {}
          : { right: Math.round((viewport?.width ?? 0) - rect.x - rect.width) }),
        ...(expected.top === undefined ? {} : { top: Math.round(rect.y) }),
      }
    })
    .toEqual(expected)
}

async function keyboardUnmountRootOrder(page: Page) {
  return page
    .locator('[data-keyboard-unmount-root-order]')
    .textContent()
    .then((value) => {
      return value?.split(',').filter(Boolean) ?? []
    })
}

async function movePointerOutside(page: Page, locator: Locator) {
  const box = await requiredBox(locator)
  const viewport = page.viewportSize()
  if (!viewport) throw new Error('Expected a viewport for pointer positioning')

  await page.mouse.move(
    box.x + box.width / 2 < viewport.width / 2 ? viewport.width - 1 : 0,
    box.y + box.height / 2 < viewport.height / 2 ? viewport.height - 1 : 0,
  )
}

async function expectTranslucentHover(page: Page, locator: Locator) {
  await locator.hover()
  const alpha = await backgroundAlphaAfterTransition(page, locator)

  expect(alpha).toBeGreaterThan(0)
  expect(alpha).toBeLessThan(1)
  return alpha
}

async function backgroundAlphaAfterTransition(page: Page, locator: Locator) {
  return cssColorAlpha(await backgroundColorAfterTransition(page, locator))
}

async function backgroundColorAfterTransition(page: Page, locator: Locator) {
  await page.waitForTimeout(200)
  return locator.evaluate((element) => getComputedStyle(element).backgroundColor)
}

function cssColorAlpha(color: string) {
  const modernAlpha = color.match(/\/\s*([\d.]+)\s*\)$/)
  if (modernAlpha?.[1]) return Number(modernAlpha[1])

  const rgbaAlpha = color.match(/^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)$/)
  return rgbaAlpha?.[1] ? Number(rgbaAlpha[1]) : 1
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

async function expectPanelAtBoundary(
  panel: Locator,
  boundary: Locator,
  position: (typeof fixedPositions)[number],
) {
  await expect
    .poll(async () => {
      const panelBox = await requiredBox(panel)
      const boundaryBox = await requiredBox(boundary)
      return {
        bottom:
          position.startsWith('bottom') || position === 'full-left' || position === 'full-right'
            ? Math.round(boundaryBox.y + boundaryBox.height - panelBox.y - panelBox.height) || 0
            : null,
        left:
          position.endsWith('left') || position === 'full-left'
            ? Math.round(panelBox.x - boundaryBox.x) || 0
            : null,
        right:
          position.endsWith('right') || position === 'full-right'
            ? Math.round(boundaryBox.x + boundaryBox.width - panelBox.x - panelBox.width) || 0
            : null,
        top:
          position.startsWith('top') || position === 'full-left' || position === 'full-right'
            ? Math.round(panelBox.y - boundaryBox.y) || 0
            : null,
      }
    })
    .toEqual({
      bottom:
        position.startsWith('bottom') || position === 'full-left' || position === 'full-right'
          ? 0
          : null,
      left: position.endsWith('left') || position === 'full-left' ? 0 : null,
      right: position.endsWith('right') || position === 'full-right' ? 0 : null,
      top:
        position.startsWith('top') || position === 'full-left' || position === 'full-right'
          ? 0
          : null,
    })
}

async function detachHybridPanel(page: Page, panel: Locator, shell: Locator) {
  const headerBox = await requiredBox(panel.locator('[data-picodash-panel-header]'))
  const start = center(headerBox)

  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + 180, start.y + 100, { steps: 12 })
  await expect(shell).toHaveAttribute('data-hybrid-placement', '')
  await page.mouse.up()
  await waitForStablePanelPosition(panel)
  const detachedBox = await requiredBox(panel)
  const serializedLayout = await panel.page().locator('[data-runtime-layout]').textContent()
  const layout = JSON.parse(serializedLayout ?? 'null')
  expect(layout).toMatchObject({
    placement: { disposition: { kind: 'free' }, mode: 'hybrid' },
    preferredCoordinates: {
      x: Math.round(detachedBox.x),
      y: Math.round(detachedBox.y),
    },
  })
  await expect
    .poll(async () => {
      const box = await requiredBox(panel)
      return box.x > 100 && box.y > 50
    })
    .toBe(true)
}

function center(rect: { height: number; width: number; x: number; y: number }) {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  }
}

function hybridTarget(
  panel: { height: number; width: number; x: number; y: number },
  boundary: { height: number; width: number; x: number; y: number },
  position: (typeof hybridPositions)[number],
  inset = 0,
) {
  return {
    x:
      position.endsWith('left') || position === 'full-left'
        ? boundary.x + inset
        : position.endsWith('right') || position === 'full-right'
          ? boundary.x + boundary.width - panel.width - inset
          : panel.x,
    y:
      position.startsWith('top') || position === 'full-left' || position === 'full-right'
        ? position === 'full-left' || position === 'full-right'
          ? panel.y
          : boundary.y + inset
        : position.startsWith('bottom') || position === 'bottom'
          ? boundary.y + boundary.height - panel.height - inset
          : panel.y,
  }
}

function pointerForPanelTarget(
  pointerStart: { x: number; y: number },
  panel: { x: number; y: number },
  target: { x: number; y: number },
) {
  return {
    x: pointerStart.x + target.x - panel.x,
    y: pointerStart.y + target.y - panel.y,
  }
}

function pointerAtBoundaryCorner(
  boundary: { height: number; width: number; x: number; y: number },
  position: (typeof hybridPositions)[number],
) {
  return {
    x: position.endsWith('left') ? boundary.x + 1 : boundary.x + boundary.width - 1,
    y: position.startsWith('top') ? boundary.y + 1 : boundary.y + boundary.height - 1,
  }
}

function hybridInwardDelta(position: (typeof hybridPositions)[number]) {
  return {
    x:
      position.endsWith('left') || position === 'full-left'
        ? 180
        : position.endsWith('right') || position === 'full-right'
          ? -180
          : 0,
    y:
      position === 'full-left' || position === 'full-right'
        ? 0
        : position.startsWith('top') || position === 'top'
          ? 60
          : position.startsWith('bottom') || position === 'bottom'
            ? -60
            : 0,
  }
}

async function waitForStablePanelPosition(panel: Locator) {
  let previous: { x: number; y: number } | undefined
  await expect
    .poll(
      async () => {
        const box = await requiredBox(panel)
        const current = { x: box.x, y: box.y }
        const stable =
          previous !== undefined &&
          Math.abs(current.x - previous.x) <= 0.5 &&
          Math.abs(current.y - previous.y) <= 0.5
        previous = current
        return stable
      },
      { intervals: [50] },
    )
    .toBe(true)
}

async function movePointerAcrossFrames(
  page: Page,
  start: { x: number; y: number },
  end: { x: number; y: number },
  steps: number,
) {
  for (let step = 1; step <= steps; step += 1) {
    await page.mouse.move(
      start.x + ((end.x - start.x) * step) / steps,
      start.y + ((end.y - start.y) * step) / steps,
    )
    await page.evaluate(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
    )
  }
}

function expectMovementInDirection(
  before: { x: number; y: number },
  after: { x: number; y: number },
  direction: { x: number; y: number },
) {
  if (direction.x > 0) expect(after.x).toBeGreaterThan(before.x)
  if (direction.x < 0) expect(after.x).toBeLessThan(before.x)
  if (direction.y > 0) expect(after.y).toBeGreaterThan(before.y)
  if (direction.y < 0) expect(after.y).toBeLessThan(before.y)
}

async function expectHybridPanelAtBoundary(
  panel: Locator,
  boundary: Locator,
  position: (typeof hybridPositions)[number],
) {
  await expect
    .poll(async () => {
      const panelBox = await requiredBox(panel)
      const boundaryBox = await requiredBox(boundary)
      return {
        bottom:
          position.startsWith('bottom') ||
          position === 'bottom' ||
          position === 'full-left' ||
          position === 'full-right'
            ? Math.round(boundaryBox.y + boundaryBox.height - panelBox.y - panelBox.height) || 0
            : null,
        left:
          position.endsWith('left') || position === 'full-left'
            ? Math.round(panelBox.x - boundaryBox.x) || 0
            : null,
        right:
          position.endsWith('right') || position === 'full-right'
            ? Math.round(boundaryBox.x + boundaryBox.width - panelBox.x - panelBox.width) || 0
            : null,
        top:
          position.startsWith('top') ||
          position === 'top' ||
          position === 'full-left' ||
          position === 'full-right'
            ? Math.round(panelBox.y - boundaryBox.y) || 0
            : null,
      }
    })
    .toEqual({
      bottom:
        position === 'bottom'
          ? defaultPlacementInset
          : position.startsWith('bottom') || position === 'full-left' || position === 'full-right'
            ? 0
            : null,
      left: position.endsWith('left') || position === 'full-left' ? 0 : null,
      right: position.endsWith('right') || position === 'full-right' ? 0 : null,
      top:
        position === 'top'
          ? defaultPlacementInset
          : position.startsWith('top') || position === 'full-left' || position === 'full-right'
            ? 0
            : null,
    })
}

async function expectHybridPreviewAtBoundary(
  preview: Locator,
  boundary: Locator,
  position: (typeof hybridPositions)[number],
) {
  await expect
    .poll(async () => {
      const previewBox = await requiredSvgBox(preview)
      const boundaryBox = await requiredBox(boundary)
      const distances = [
        ...(position.startsWith('bottom') || position === 'bottom'
          ? [Math.abs(previewBox.y + previewBox.height - boundaryBox.y - boundaryBox.height)]
          : []),
        ...(position.endsWith('left') || position === 'full-left'
          ? [Math.abs(previewBox.x - boundaryBox.x)]
          : []),
        ...(position.endsWith('right') || position === 'full-right'
          ? [Math.abs(previewBox.x + previewBox.width - boundaryBox.x - boundaryBox.width)]
          : []),
        ...(position.startsWith('top') || position === 'top'
          ? [Math.abs(previewBox.y - boundaryBox.y)]
          : []),
      ]
      return Math.max(...distances)
    })
    .toBeLessThanOrEqual(1)
}

async function expectHybridPreviewIconDirection(
  icon: Locator,
  preview: Locator,
  position: Exclude<(typeof hybridPositions)[number], 'bottom' | 'top'>,
) {
  await expect
    .poll(async () => {
      const [previewBox, iconGeometry] = await Promise.all([
        requiredBox(preview),
        icon.evaluate((element) => {
          const matrix = (element as SVGGraphicsElement).getScreenCTM()
          if (!matrix) throw new Error('Hybrid preview icon has no screen transform.')
          const tip = new DOMPoint(0, -7).matrixTransform(matrix)
          const base = new DOMPoint(0, 6).matrixTransform(matrix)
          const box = (element as SVGGraphicsElement).getBBox()
          return {
            box: { height: box.height, width: box.width },
            tip: { x: tip.x, y: tip.y },
            vector: { x: tip.x - base.x, y: tip.y - base.y },
          }
        }),
      ])
      const target = hybridPreviewIconTipTarget(previewBox, position)
      return {
        atProximityEdge:
          Math.abs(iconGeometry.tip.x - target.x) <= 2 &&
          Math.abs(iconGeometry.tip.y - target.y) <= 2,
        direction: hybridPreviewIconDirection(iconGeometry.vector),
        enlarged: iconGeometry.box.width >= 16 && iconGeometry.box.height >= 13,
      }
    })
    .toEqual({ atProximityEdge: true, direction: position, enlarged: true })
}

function hybridPreviewIconTipTarget(
  preview: { height: number; width: number; x: number; y: number },
  position: Exclude<(typeof hybridPositions)[number], 'bottom' | 'top'>,
) {
  const edgeInset = defaultSnapProximity + hybridPreviewIconProximityGap
  return {
    x: position.endsWith('left') ? preview.x + edgeInset : preview.x + preview.width - edgeInset,
    y: position.startsWith('top')
      ? preview.y + edgeInset
      : position.startsWith('bottom')
        ? preview.y + preview.height - edgeInset
        : preview.y + preview.height / 2,
  }
}

function hybridPreviewIconDirection({
  x,
  y,
}: {
  x: number
  y: number
}): Exclude<(typeof hybridPositions)[number], 'bottom' | 'top'> {
  if (Math.abs(x) > Math.abs(y) * 2) return x < 0 ? 'full-left' : 'full-right'
  if (x < 0) return y < 0 ? 'top-left' : 'bottom-left'
  return y < 0 ? 'top-right' : 'bottom-right'
}

async function requiredSvgBox(locator: Locator) {
  return locator.evaluate((element) => {
    const box = (element as SVGGraphicsElement).getBBox()
    return { height: box.height, width: box.width, x: box.x, y: box.y }
  })
}

async function expectCornerInset(
  panel: Locator,
  boundary: Locator,
  position: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right',
  inset: number,
) {
  await expect
    .poll(async () => {
      const panelBox = await requiredBox(panel)
      const boundaryBox = await requiredBox(boundary)
      return {
        horizontal: position.endsWith('left')
          ? Math.round(panelBox.x - boundaryBox.x)
          : Math.round(boundaryBox.x + boundaryBox.width - panelBox.x - panelBox.width),
        vertical: position.startsWith('top')
          ? Math.round(panelBox.y - boundaryBox.y)
          : Math.round(boundaryBox.y + boundaryBox.height - panelBox.y - panelBox.height),
      }
    })
    .toEqual({ horizontal: inset, vertical: inset })
}

async function expectCollapsedPanelBeyondBoundary(
  panel: Locator,
  boundary: Locator,
  position: (typeof fixedPositions)[number],
) {
  await expect
    .poll(async () => {
      const panelBox = await requiredBox(panel)
      const boundaryBox = await requiredBox(boundary)
      return {
        horizontal:
          position.endsWith('left') || position === 'full-left'
            ? Math.round(panelBox.x + panelBox.width - boundaryBox.x) || 0
            : Math.round(panelBox.x - boundaryBox.x - boundaryBox.width) || 0,
        vertical: position.startsWith('bottom')
          ? Math.round(panelBox.y - boundaryBox.y - boundaryBox.height) || 0
          : null,
      }
    })
    .toEqual({ horizontal: 0, vertical: position.startsWith('bottom') ? 0 : null })
}

async function expectToggleAtBoundaryCorner(
  toggle: Locator,
  boundary: Locator,
  position: (typeof fixedPositions)[number],
) {
  await expect
    .poll(async () => {
      const toggleBox = await requiredBox(toggle)
      const boundaryBox = await requiredBox(boundary)
      return {
        horizontal:
          position.endsWith('left') || position === 'full-left'
            ? Math.round(toggleBox.x - boundaryBox.x)
            : Math.round(boundaryBox.x + boundaryBox.width - toggleBox.x - toggleBox.width),
        vertical: position.startsWith('bottom')
          ? Math.round(boundaryBox.y + boundaryBox.height - toggleBox.y - toggleBox.height)
          : Math.round(toggleBox.y - boundaryBox.y),
      }
    })
    .toEqual({ horizontal: 0, vertical: 0 })
}

function collapsedArrowClass(position: (typeof fixedPositions)[number]) {
  if (position === 'bottom-left') return /lucide-arrow-up-right/
  if (position === 'bottom-right') return /lucide-arrow-up-left/
  return position.endsWith('left') || position === 'full-left'
    ? /lucide-arrow-right/
    : /lucide-arrow-left/
}

function expandedArrowClass(position: (typeof fixedPositions)[number]) {
  if (position === 'bottom-left') return /lucide-arrow-down-left/
  if (position === 'bottom-right') return /lucide-arrow-down-right/
  return position.endsWith('left') || position === 'full-left'
    ? /lucide-arrow-left/
    : /lucide-arrow-right/
}

async function seedLayout(
  page: Page,
  panelLayouts: Record<
    string,
    {
      placement: {
        disposition: { kind: 'docked'; position: 'bottom-left' }
        mode: 'hybrid'
      }
      preferredCoordinates: { x: number; y: number }
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
