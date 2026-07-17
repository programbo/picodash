import { expect, test } from '@playwright/test'

const customGroupLabels = {
  'common-items': 'Common inputs',
  'media-items': 'Media and files',
  'spatial-items': 'Direct manipulation',
  'visualization-items': 'Live visualizations',
} as const

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Tweaker State Lab' })).toBeVisible()
})

test('previews a collapsed group reorder before pointer release', async ({ page }) => {
  const panel = page.locator('[data-tweaker-panel-id="custom-items"]')
  const rootList = panel.locator('[data-tweaker-reorder-list="root"]')

  await collapseCustomGroups(panel, Object.keys(customGroupLabels) as CustomGroupId[])
  await expect(rootList).toBeVisible()

  const initialOrder = await rootItemOrder(rootList)
  expect(initialOrder).toEqual([
    'common-items',
    'spatial-items',
    'media-items',
    'visualization-items',
    'custom-items-summary',
  ])

  await exerciseLivePreviewGroupDrag({
    page,
    panel,
    rootList,
    sourceId: 'media-items',
    targetId: 'visualization-items',
    verifyCancellation: true,
    expectedOrder: [
      'common-items',
      'spatial-items',
      'visualization-items',
      'media-items',
      'custom-items-summary',
    ],
  })
})

test('previews a mixed-height group reorder without shifting the pointer target', async ({
  page,
}) => {
  const panel = page.locator('[data-tweaker-panel-id="custom-items"]')
  const rootList = panel.locator('[data-tweaker-reorder-list="root"]')

  await collapseCustomGroups(panel, ['common-items', 'media-items', 'visualization-items'])
  await expect(panel.locator('[data-group-id="spatial-items"]')).toHaveAttribute(
    'data-collapsed',
    'false',
  )
  await rootList.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })

  await exerciseLivePreviewGroupDrag({
    page,
    panel,
    rootList,
    sourceId: 'media-items',
    targetId: 'visualization-items',
    expectedOrder: [
      'common-items',
      'spatial-items',
      'visualization-items',
      'media-items',
      'custom-items-summary',
    ],
  })
})

test('does not overshoot the next slot after crossing an expanded group', async ({ page }) => {
  const panel = page.locator('[data-tweaker-panel-id="custom-items"]')
  const rootList = panel.locator('[data-tweaker-reorder-list="root"]')

  await collapseCustomGroups(panel, ['common-items', 'spatial-items', 'visualization-items'])
  await expect(panel.locator('[data-group-id="media-items"]')).toHaveAttribute(
    'data-collapsed',
    'false',
  )

  await exerciseLivePreviewGroupDrag({
    page,
    panel,
    rootList,
    sourceId: 'spatial-items',
    targetId: 'media-items',
    releaseAfterTarget: true,
    expectedOrder: [
      'common-items',
      'media-items',
      'spatial-items',
      'visualization-items',
      'custom-items-summary',
    ],
  })
})

test('transfers hover ownership between a group header and its child', async ({ page }) => {
  const group = page.locator('[data-group-id="scene-rendering"]')
  const child = page.locator('[data-control-id="quality"]')
  const groupGrip = group.getByRole('button', { name: 'Reorder Rendering', exact: true })
  const childGrip = child.getByRole('button', { name: 'Reorder Quality', exact: true })

  await childGrip.hover()
  await expect(child).toHaveAttribute('data-hovered', 'true')
  await expect(group).toHaveAttribute('data-hovered', 'false')

  await groupGrip.hover()
  await expect(group).toHaveAttribute('data-hovered', 'true')
  await expect(child).toHaveAttribute('data-hovered', 'false')

  await childGrip.hover()
  await expect(child).toHaveAttribute('data-hovered', 'true')
  await expect(group).toHaveAttribute('data-hovered', 'false')
})

test('contains grip layers within their reorder items', async ({ page }) => {
  const group = page.locator('[data-group-id="scene-rendering"]')
  const draggedControl = page.locator('[data-control-id="quality"]')
  const idleControl = page.locator('[data-control-id="cameraHeight"]')
  const draggedGrip = draggedControl.getByRole('button', {
    name: 'Reorder Quality',
    exact: true,
  })
  const idleGrip = idleControl.getByRole('button', {
    name: 'Reorder Camera height',
    exact: true,
  })

  await expect(group).toHaveCSS('isolation', 'isolate')
  await expect(draggedControl).toHaveCSS('isolation', 'isolate')
  await expect(idleControl).toHaveCSS('isolation', 'isolate')

  const draggedGripBox = await draggedGrip.boundingBox()
  expect(draggedGripBox).not.toBeNull()
  if (!draggedGripBox) return

  await page.mouse.move(
    draggedGripBox.x + draggedGripBox.width / 2,
    draggedGripBox.y + draggedGripBox.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    draggedGripBox.x + draggedGripBox.width / 2,
    draggedGripBox.y + draggedGripBox.height / 2 + 20,
    { steps: 4 },
  )
  await expect(draggedControl).toHaveAttribute('data-dragging', 'true')
  await expect(draggedControl).toHaveCSS('z-index', '20')
  await expect(idleControl).toHaveCSS('z-index', 'auto')
  await expect(idleGrip).toHaveCSS('z-index', '10')

  await page.mouse.up()
})

test('updates common, spatial, and gradient values through accessible controls', async ({
  page,
}) => {
  const density = page.locator('[data-control-id="density"]')
  await expect(density.getByRole('radiogroup').locator('svg')).toHaveCount(3)
  await density.getByRole('radio', { name: 'Open' }).click()
  await expect(density.getByRole('radio', { name: 'Open' })).toHaveAttribute('data-state', 'on')

  const alignment = page.locator('[data-control-id="alignment"]')
  await alignment.getByRole('radio', { name: 'Bottom right' }).click()
  await expect(alignment.getByRole('radio', { name: 'Bottom right' })).toHaveAttribute(
    'data-state',
    'on',
  )

  const vector = page.locator('[data-control-id="vector"]')
  await vector.getByRole('spinbutton', { name: 'X axis' }).fill('4.5')
  await expect(vector.getByRole('spinbutton', { name: 'X axis' })).toHaveValue('4.5')

  const range = page.locator('[data-control-id="thresholdRange"]')
  const lowerThumb = range.getByRole('slider', { name: 'Lower value' })
  await lowerThumb.focus()
  await lowerThumb.press('ArrowRight')
  await expect(lowerThumb).toHaveAttribute('aria-valuenow', '25')

  const xy = page.locator('[data-control-id="xy"]')
  const xyPad = xy.getByRole('group', { name: 'Two-dimensional value' })
  await xyPad.scrollIntoViewIfNeeded()
  const box = await xyPad.boundingBox()
  expect(box).not.toBeNull()
  if (!box) return
  await page.mouse.click(box.x + box.width * 0.25, box.y + box.height * 0.75)
  await expect(xy.locator('output')).toContainText('X 0.25')
  await expect(xy.locator('output')).toContainText('Y 0.25')
  const xAxis = xy.getByRole('slider', { name: 'Two-dimensional value, X axis' })
  const yAxis = xy.getByRole('slider', { name: 'Two-dimensional value, Y axis' })
  await expect(xAxis).toHaveAttribute('min', '0')
  await expect(xAxis).toHaveAttribute('max', '1')
  await expect(xAxis).toHaveAttribute('step', '0.01')
  await xAxis.focus()
  await xAxis.press('ArrowRight')
  await expect(xy.locator('output')).toContainText('X 0.26')
  await yAxis.focus()
  await yAxis.press('ArrowUp')
  await expect(xy.locator('output')).toContainText('Y 0.26')

  const gradient = page.locator('[data-control-id="gradient"]')
  const gradientTrack = gradient.locator('div[style*="linear-gradient"]')
  await expect(gradient.getByRole('slider')).toHaveCount(3)
  await gradientTrack.dblclick({ position: { x: 120, y: 18 } })
  await expect(gradient.getByRole('slider')).toHaveCount(4)
})

test('renders safe media, serializable drop metadata, and a Recharts SVG', async ({ page }) => {
  const preview = page.locator('[data-control-id="previewAsset"]')
  await expect(preview.getByRole('img', { name: 'Tweaker mark' })).toHaveAttribute(
    'src',
    /favicon\.svg$/,
  )

  const dropzone = page.locator('[data-control-id="droppedFiles"]')
  const fileInput = dropzone.locator('input[type="file"]')
  await fileInput.setInputFiles([
    {
      name: 'sample.png',
      mimeType: 'image/png',
      buffer: Buffer.from('demo image metadata'),
    },
    { name: 'second.png', mimeType: 'image/png', buffer: Buffer.from('second') },
  ])
  await expect(dropzone.getByText('sample.png')).toBeVisible()
  await expect(dropzone.getByRole('list', { name: 'Selected files' })).toContainText('19 B')
  await expect(dropzone.getByText('2 of 3 files selected')).toBeVisible()

  await fileInput.setInputFiles([
    { name: 'third.png', mimeType: 'image/png', buffer: Buffer.from('third') },
    { name: 'overflow.png', mimeType: 'image/png', buffer: Buffer.from('overflow') },
  ])
  await expect(dropzone.getByText('third.png')).toBeVisible()
  await expect(dropzone.getByText('overflow.png')).toHaveCount(0)
  await expect(dropzone.getByRole('listitem')).toHaveCount(3)
  await expect(dropzone.getByText('Only 3 files can be selected')).toBeVisible()
  await dropzone.getByRole('button', { name: 'View sample.png' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('img', { name: 'sample.png' })).toBeVisible()
  await page.getByRole('button', { name: 'Close image viewer' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)

  const chart = page.locator('[data-control-id="shadcn-frame-chart"]')
  await expect(chart.locator('svg.recharts-surface')).toBeVisible()
  await expect(chart.locator('.recharts-line-curve')).toHaveCount(2)
  const yAxisTicks = chart.locator(
    '.recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value',
  )
  await expect(yAxisTicks).toHaveText(['0', '5', '10', '15', '20'])
  const chartBox = await chart.locator('svg.recharts-surface').boundingBox()
  expect(chartBox).not.toBeNull()
  if (chartBox) {
    const tickBoxes = await yAxisTicks.evaluateAll((ticks) =>
      ticks.map((tick) => {
        const box = tick.getBoundingClientRect()
        return { left: box.left, right: box.right }
      }),
    )
    for (const tickBox of tickBoxes) {
      expect(tickBox.left).toBeGreaterThanOrEqual(chartBox.x)
      expect(tickBox.right).toBeLessThanOrEqual(chartBox.x + chartBox.width)
    }
  }
})

test('animates transient visual paths and switches deterministic signal mode', async ({ page }) => {
  const velocity = page.locator('[data-control-id="mouse-velocity"]')
  const display = velocity.locator('[data-pointer-velocity-display]')
  const description = velocity.getByText('Move anywhere in the full viewport.', { exact: false })
  const velocityXPath = velocity.locator('path.stroke-chart-1')
  const velocityYPath = velocity.locator('path.stroke-chart-3')
  await display.scrollIntoViewIfNeeded()
  await expect(display).toBeVisible()
  await expect(display).toHaveCSS('pointer-events', 'none')
  const displayBox = await display.boundingBox()
  const descriptionBox = await description.boundingBox()
  expect(displayBox).not.toBeNull()
  expect(descriptionBox).not.toBeNull()
  if (displayBox && descriptionBox) {
    expect(descriptionBox.y).toBeGreaterThanOrEqual(displayBox.y + displayBox.height)
  }
  const initialVelocityXPath = await velocityXPath.getAttribute('d')
  const initialVelocityYPath = await velocityYPath.getAttribute('d')
  const headingBox = await page.getByRole('heading', { name: 'Tweaker State Lab' }).boundingBox()
  expect(headingBox).not.toBeNull()
  if (!headingBox) return

  // The listener targets the full viewport, so motion over unrelated page content
  // updates the display without the chart needing to capture pointer events.
  await page.mouse.move(headingBox.x + 4, headingBox.y + 4)
  await page.mouse.move(
    headingBox.x + headingBox.width - 4,
    headingBox.y + headingBox.height + 80,
    {
      steps: 8,
    },
  )
  await expect.poll(() => velocityXPath.getAttribute('d')).not.toBe(initialVelocityXPath)
  await expect.poll(() => velocityYPath.getAttribute('d')).not.toBe(initialVelocityYPath)

  const signal = page.locator('[data-control-id="signal-visualizer"]')
  const signalPath = signal.locator('path.stroke-chart-2')
  const initialSignalPath = await signalPath.getAttribute('d')
  await signal.getByRole('radio', { name: 'Show spectrum' }).click()
  await expect(signal.getByRole('radio', { name: 'Show spectrum' })).toHaveAttribute(
    'data-state',
    'on',
  )
  await expect(signal.getByRole('img', { name: 'Synthetic signal spectrum' })).toBeVisible()
  await expect.poll(() => signalPath.getAttribute('d')).not.toBe(initialSignalPath)
  await expect(signalPath).toHaveAttribute('fill-opacity', '0.18')
})

type CustomGroupId = keyof typeof customGroupLabels

async function collapseCustomGroups(
  panel: import('@playwright/test').Locator,
  groupIds: CustomGroupId[],
) {
  for (const groupId of groupIds) {
    const group = panel.locator(`[data-group-id="${groupId}"]`)
    await group
      .getByRole('button', { name: customGroupLabels[groupId], exact: true })
      .evaluate((button: HTMLButtonElement) => button.click())
    await expect(group).toHaveAttribute('data-collapsed', 'true')
  }

  // Disclosure rows animate for 150ms. Reorder sessions must capture the settled
  // geometry rather than a frame from the collapse transition.
  await panel.page().waitForTimeout(200)
}

async function exerciseLivePreviewGroupDrag({
  expectedOrder,
  page,
  panel,
  releaseAfterTarget = false,
  rootList,
  sourceId,
  targetId,
  verifyCancellation = false,
}: {
  expectedOrder: string[]
  page: import('@playwright/test').Page
  panel: import('@playwright/test').Locator
  releaseAfterTarget?: boolean
  rootList: import('@playwright/test').Locator
  sourceId: CustomGroupId
  targetId: CustomGroupId
  verifyCancellation?: boolean
}) {
  const source = panel.locator(`[data-group-id="${sourceId}"]`)
  const grip = source.getByRole('button', {
    name: `Reorder ${customGroupLabels[sourceId]}`,
    exact: true,
  })
  await grip.scrollIntoViewIfNeeded()
  await expect.poll(() => rootTransformsAreNone(rootList)).toBe(true)
  await expectContiguousRootItems(rootList)

  const initialOrder = await rootItemOrder(rootList)
  const initialRects = await rootItemRects(rootList)
  const initialSlots = await rootItemSlots(rootList)
  const sourceRect = initialRects[sourceId]
  const targetRect = initialRects[targetId]
  const sourceSlot = initialSlots[sourceId]
  const gripBox = await grip.boundingBox()
  expect(sourceRect).toBeDefined()
  expect(targetRect).toBeDefined()
  expect(sourceSlot).toBeDefined()
  expect(gripBox).not.toBeNull()
  if (!sourceRect || !targetRect || !sourceSlot || !gripBox) return

  const pointerX = gripBox.x + gripBox.width / 2
  const pointerY = gripBox.y + gripBox.height / 2
  const initialScrollTop = await rootList.evaluate((element) => element.scrollTop)

  await page.mouse.move(pointerX, pointerY)
  await page.mouse.down()
  await expect
    .poll(async () => Math.abs((await requiredBox(source)).y - sourceRect.y))
    .toBeLessThanOrEqual(1)
  await expectSiblingRects(rootList, initialRects, sourceId)

  await page.mouse.move(pointerX, pointerY + 4)
  await expect
    .poll(async () => (await requiredBox(source)).y - sourceRect.y)
    .toBeGreaterThanOrEqual(3)
  await expect.poll(async () => (await requiredBox(source)).y - sourceRect.y).toBeLessThanOrEqual(5)
  await expectSiblingRects(rootList, initialRects, sourceId)

  const sourceCenter = sourceRect.y + sourceRect.height / 2
  const targetThreshold = targetRect.y + targetRect.height / 2 - sourceCenter
  const targetIndex = initialOrder.indexOf(targetId)
  const nextId = initialOrder[targetIndex + 1]
  const nextRect = nextId ? initialRects[nextId] : undefined
  const nextThreshold = nextRect
    ? nextRect.y + nextRect.height / 2 - sourceCenter
    : Number.POSITIVE_INFINITY
  const crossingOffset = releaseAfterTarget
    ? targetRect.y + targetRect.height - (sourceRect.y + sourceRect.height) + 1
    : Math.min(targetThreshold + 2, nextThreshold - 2)
  await page.mouse.move(pointerX, pointerY + crossingOffset)
  await expect.poll(() => rootItemOrder(rootList)).toEqual(expectedOrder)
  await expectPointerOffset(source, sourceRect.y, crossingOffset)
  await expect
    .poll(async () => Math.abs((await rootItemSlots(rootList))[targetId]!.y - sourceSlot.y))
    .toBeLessThanOrEqual(1)
  await expectContiguousRootSlots(rootList)
  await expect.poll(() => rootTransformsAreNone(rootList)).toBe(true)
  await expect.poll(() => rootList.evaluate((element) => element.scrollTop)).toBe(initialScrollTop)

  await page.mouse.move(pointerX, pointerY + 4)
  await expect.poll(() => rootItemOrder(rootList)).toEqual(initialOrder)
  await expectPointerOffset(source, sourceRect.y, 4)
  await expectSiblingRects(rootList, initialRects, sourceId)
  await expectContiguousRootSlots(rootList)

  await page.mouse.move(pointerX, pointerY + crossingOffset)
  await expect.poll(() => rootItemOrder(rootList)).toEqual(expectedOrder)
  await expectPointerOffset(source, sourceRect.y, crossingOffset)
  await expectContiguousRootSlots(rootList)

  if (verifyCancellation) {
    await grip.dispatchEvent('pointercancel', {
      bubbles: true,
      pointerId: 1,
      pointerType: 'mouse',
    })
    await page.mouse.up()
    await expect.poll(() => rootItemOrder(rootList)).toEqual(initialOrder)
    await expectPointerOffset(source, sourceRect.y, 0)
    await expect(source).toHaveAttribute('data-dragging', 'false')
    await expectContiguousRootItems(rootList)

    await page.mouse.move(pointerX, pointerY)
    await page.mouse.down()
    await page.mouse.move(pointerX, pointerY + crossingOffset)
    await expect.poll(() => rootItemOrder(rootList)).toEqual(expectedOrder)
    await expectPointerOffset(source, sourceRect.y, crossingOffset)
  }

  await page.mouse.up()
  await expect.poll(() => rootItemOrder(rootList)).toEqual(expectedOrder)
  await expect.poll(() => rootList.evaluate((element) => element.scrollTop)).toBe(initialScrollTop)
  await expect(source).toHaveAttribute('data-dragging', 'false')
  await expect.poll(() => rootTransformsAreNone(rootList)).toBe(true)
  await expectContiguousRootItems(rootList)
}

async function expectPointerOffset(
  source: import('@playwright/test').Locator,
  initialY: number,
  pointerOffset: number,
) {
  await expect
    .poll(async () => Math.abs((await requiredBox(source)).y - (initialY + pointerOffset)))
    .toBeLessThanOrEqual(1)
}

async function expectSiblingRects(
  rootList: import('@playwright/test').Locator,
  initialRects: Record<string, ItemRect>,
  sourceId: string,
) {
  await expect
    .poll(async () => {
      const currentRects = await rootItemRects(rootList)
      return Object.entries(initialRects)
        .filter(([id]) => id !== sourceId)
        .every(([id, rect]) => Math.abs((currentRects[id]?.y ?? Number.NaN) - rect.y) <= 1)
    })
    .toBe(true)
}

async function expectContiguousRootItems(rootList: import('@playwright/test').Locator) {
  const slots = Object.values(await rootItemRects(rootList))
  expect(
    slots.every(
      (slot, index) =>
        index === 0 || slot.y + 0.5 >= slots[index - 1]!.y + slots[index - 1]!.height,
    ),
  ).toBe(true)
}

async function expectContiguousRootSlots(rootList: import('@playwright/test').Locator) {
  const slots = Object.values(await rootItemSlots(rootList))
  expect(
    slots.every(
      (slot, index) =>
        index === 0 || slot.y + 0.5 >= slots[index - 1]!.y + slots[index - 1]!.height,
    ),
  ).toBe(true)
}

async function rootItemOrder(rootList: import('@playwright/test').Locator) {
  return rootList.locator(':scope > div > [data-parent-id="root"]').evaluateAll((items) =>
    items.map((item) => {
      if (!(item instanceof HTMLElement)) return ''
      return item.dataset.groupId ?? item.dataset.controlId ?? ''
    }),
  )
}

type ItemRect = { height: number; y: number }

async function rootItemSlots(rootList: import('@playwright/test').Locator) {
  return rootList.locator(':scope > div > [data-parent-id="root"]').evaluateAll((items) =>
    Object.fromEntries(
      items.map((item) => {
        const element = item as HTMLElement
        return [
          element.dataset.groupId ?? element.dataset.controlId ?? '',
          { height: element.offsetHeight, y: element.offsetTop },
        ]
      }),
    ),
  ) as Promise<Record<string, ItemRect>>
}

async function rootItemRects(rootList: import('@playwright/test').Locator) {
  return rootList.locator(':scope > div > [data-parent-id="root"]').evaluateAll((items) =>
    Object.fromEntries(
      items.map((item) => {
        const element = item as HTMLElement
        const rect = element.getBoundingClientRect()
        return [
          element.dataset.groupId ?? element.dataset.controlId ?? '',
          { height: rect.height, y: rect.y },
        ]
      }),
    ),
  ) as Promise<Record<string, ItemRect>>
}

async function requiredBox(locator: import('@playwright/test').Locator) {
  const box = await locator.boundingBox()
  expect(box).not.toBeNull()
  return box!
}

async function rootTransformsAreNone(rootList: import('@playwright/test').Locator) {
  return rootList
    .locator(':scope > div > [data-parent-id="root"]')
    .evaluateAll((items) => items.every((item) => getComputedStyle(item).transform === 'none'))
}
