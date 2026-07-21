import { expect, test, type Locator, type Page } from '@playwright/test'

const storageKey = 'tweaker-geometry-lab:panel-layout:v1'
const safeInset = 8
const defaultPlacementInset = 16
const fixedPositions = [
  'top-left',
  'bottom-left',
  'top-right',
  'bottom-right',
  'left',
  'right',
] as const

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
  await expect(body).toHaveAttribute('data-tweaker-scrollport', 'body')
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

test('keeps custom bottom and horizontal placement insets independent', async ({ page }) => {
  await page.goto('/panel-geometry-lab?fixture=custom-bottom')
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
  await page.goto('/panel-geometry-lab?fixture=responsive')
  const panel = geometryPanel(page, 'responsive')
  await expectEdgeInsets(panel, { bottom: 80, right: 16 })

  await page.setViewportSize({ width: 1300, height: 600 })
  await expectEdgeInsets(panel, { bottom: 16, right: 16 })

  await page.setViewportSize({ width: 900, height: 600 })
  await expectEdgeInsets(panel, { right: 16, top: 16 })
})

test('tracks live placement constraint changes before persistence', async ({ page }) => {
  await page.goto('/panel-geometry-lab?fixture=changing-constraint')
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
  await page.goto('/panel-geometry-lab?fixture=fixed-boundaries')
  const boundary = page.locator('[data-geometry-boundary="provider"]')
  const overrideBoundary = page.locator('[data-geometry-boundary="override"]')
  const panel = geometryPanel(page, 'fixed-boundary')
  const overridePanel = geometryPanel(page, 'fixed-override')
  const placement = page.getByLabel('Fixed placement')
  const runtimePlacement = page.locator('[data-runtime-placement]')

  await expect(runtimePlacement).toHaveText('fixed:left')
  await expect(placement.locator('option')).toHaveText([
    'top-left',
    'bottom-left',
    'top-right',
    'bottom-right',
    'left',
    'right',
  ])

  for (const position of fixedPositions) {
    await placement.selectOption(position)
    await expect(runtimePlacement).toHaveText(`fixed:${position}`)
    await expectPanelAtBoundary(panel, boundary, position)
  }

  await page.getByRole('button', { name: 'Magnetic' }).click()
  await expect(runtimePlacement).toHaveText('magnetic:top-left')
  await page.getByRole('button', { name: 'Floating' }).click()
  await expect(runtimePlacement).toHaveText('floating:')

  await expectPanelAtBoundary(overridePanel, overrideBoundary, 'bottom-right')

  await placement.selectOption('left')
  const scrollport = panel.locator('[data-tweaker-scrollport="auto"]')
  await expect(scrollport).toHaveClass(/scroll-fade/)
  await expect(scrollport).toHaveAttribute('data-tweaker-reorder-lane', 'auto')
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

test('handles deferred corners, ordinary class constraints, and viewport panels in a scrolling portal', async ({
  page,
}) => {
  await page.goto('/panel-geometry-lab?fixture=review-regressions')
  const panel = geometryPanel(page, 'review-regression')
  const portal = page.locator('[data-geometry-scroll-portal]')
  const shell = page.locator('[data-tweaker-panel-shell]').filter({ has: panel })

  await expect.poll(async () => (await requiredBox(panel)).width).toBe(220)
  await expect.poll(async () => (await requiredBox(panel)).height).toBe(180)
  await expect(panel).toHaveCSS('max-width', '220px')
  await expect(panel).toHaveCSS('max-height', '180px')
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

  await shell.locator('[data-tweaker-fixed-toggle]').click()
  await expect(panel).toHaveAttribute('data-collapsed', 'true')
  await page.waitForTimeout(250)
  await page.getByRole('button', { name: 'Float bottom-right' }).click()
  await expect(page.locator('[data-review-regression-placement]')).toHaveText(
    'floating:bottom-right',
  )
  await expect(shell).not.toHaveAttribute('data-fixed-placement')
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
  await page.goto('/panel-geometry-lab?fixture=relative-constraints')
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
  await page.goto('/panel-geometry-lab?fixture=fixed-boundaries')
  const boundary = page.locator('[data-geometry-boundary="provider"]')
  const panel = geometryPanel(page, 'fixed-boundary')
  const shell = page.locator('[data-tweaker-panel-shell]').filter({ has: panel })
  const placement = page.getByLabel('Fixed placement')
  const toggle = shell.locator('[data-tweaker-fixed-toggle]')

  await expect(page.locator('[data-runtime-placement]')).toHaveText('fixed:left')

  for (const position of fixedPositions) {
    await placement.selectOption(position)
    await expect(shell).toHaveAttribute('data-fixed-placement', position)
    await expectPanelAtBoundary(panel, boundary, position)
    await expect(toggle).toHaveAccessibleName('Collapse panel Provider boundary')
    await expect(toggle.locator('svg')).toHaveClass(expandedArrowClass(position))

    await toggle.click()

    await expect(panel).toHaveAttribute('data-collapsed', 'true')
    await expect(toggle).toHaveAccessibleName('Expand panel Provider boundary')
    await expect(toggle.locator('svg')).toHaveClass(collapsedArrowClass(position))
    await expectCollapsedPanelBeyondBoundary(panel, boundary, position)
    await expectToggleAtBoundaryCorner(toggle, boundary, position)

    await toggle.click()

    await expect(panel).toHaveAttribute('data-collapsed', 'false')
    await expect(toggle).toHaveAccessibleName('Collapse panel Provider boundary')
    await expectPanelAtBoundary(panel, boundary, position)
  }
})

test('rolls back an active keyboard reorder when its list unmounts', async ({ page }) => {
  await page.goto('/panel-geometry-lab?fixture=keyboard-unmount')
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
  return page.evaluate(async () => {
    const modulePath = ['/src', 'panel-geometry-lab.tsx'].join('/')
    const { keyboardUnmountPanelStore } = await import(modulePath)
    return keyboardUnmountPanelStore.getState().order.root
  })
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

async function expectPanelAtBoundary(
  panel: Locator,
  boundary: Locator,
  position: 'bottom-left' | 'bottom-right' | 'left' | 'right' | 'top-left' | 'top-right',
) {
  await expect
    .poll(async () => {
      const panelBox = await requiredBox(panel)
      const boundaryBox = await requiredBox(boundary)
      return {
        bottom:
          position.startsWith('bottom') || position === 'left' || position === 'right'
            ? Math.round(boundaryBox.y + boundaryBox.height - panelBox.y - panelBox.height)
            : null,
        left:
          position.endsWith('left') || position === 'left'
            ? Math.round(panelBox.x - boundaryBox.x)
            : null,
        right:
          position.endsWith('right') || position === 'right'
            ? Math.round(boundaryBox.x + boundaryBox.width - panelBox.x - panelBox.width)
            : null,
        top:
          position.startsWith('top') || position === 'left' || position === 'right'
            ? Math.round(panelBox.y - boundaryBox.y)
            : null,
      }
    })
    .toEqual({
      bottom:
        position.startsWith('bottom') || position === 'left' || position === 'right' ? 0 : null,
      left: position.endsWith('left') || position === 'left' ? 0 : null,
      right: position.endsWith('right') || position === 'right' ? 0 : null,
      top: position.startsWith('top') || position === 'left' || position === 'right' ? 0 : null,
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
          position.endsWith('left') || position === 'left'
            ? Math.round(panelBox.x + panelBox.width - boundaryBox.x)
            : Math.round(panelBox.x - boundaryBox.x - boundaryBox.width),
        vertical: position.startsWith('bottom')
          ? Math.round(panelBox.y - boundaryBox.y - boundaryBox.height)
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
          position.endsWith('left') || position === 'left'
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
  return position.endsWith('left') || position === 'left'
    ? /lucide-arrow-right/
    : /lucide-arrow-left/
}

function expandedArrowClass(position: (typeof fixedPositions)[number]) {
  if (position === 'bottom-left') return /lucide-arrow-down-left/
  if (position === 'bottom-right') return /lucide-arrow-down-right/
  return position.endsWith('left') || position === 'left'
    ? /lucide-arrow-left/
    : /lucide-arrow-right/
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
