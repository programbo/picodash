import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { tweakerMotionTokens } from '../../../packages/panel/src/theme.ts'

const customGroupLabels = {
  'common-items': 'Common inputs',
  'media-items': 'Media and files',
  'spatial-items': 'Direct manipulation',
  'visualization-items': 'Live visualizations',
} as const
const initialCustomRootOrder = [
  'common-items',
  'spatial-items',
  'media-items',
  'visualization-items',
  'custom-items-summary',
]

async function changeDemoThemes(
  page: Page,
  detail: {
    custom?: string | null
    provider?: string | null
    scene?: string | null
  },
) {
  await page.evaluate((nextThemes) => {
    window.dispatchEvent(
      new CustomEvent('tweaker-demo-theme-change', {
        detail: nextThemes,
      }),
    )
  }, detail)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Tweaker State Lab' })).toBeVisible()
})

for (const scenario of [
  {
    expectedOrder: [
      'spatial-items',
      'common-items',
      'media-items',
      'visualization-items',
      'custom-items-summary',
    ],
    name: 'Common inputs over the second root item',
    sourceId: 'common-items',
    sourceLabel: 'Common inputs',
    singleDirection: true,
    targetId: 'spatial-items',
  },
  {
    expectedOrder: [
      'spatial-items',
      'media-items',
      'common-items',
      'visualization-items',
      'custom-items-summary',
    ],
    name: 'Common inputs over the third root item',
    sourceId: 'common-items',
    sourceLabel: 'Common inputs',
    targetId: 'media-items',
  },
  {
    expectedOrder: [
      'common-items',
      'spatial-items',
      'media-items',
      'custom-items-summary',
      'visualization-items',
    ],
    name: 'Selection upward over the adjacent root group',
    sourceId: 'custom-items-summary',
    sourceLabel: 'Selection',
    singleDirection: true,
    targetId: 'visualization-items',
  },
  {
    expectedOrder: [
      'common-items',
      'custom-items-summary',
      'spatial-items',
      'media-items',
      'visualization-items',
    ],
    name: 'Selection upward over multiple root groups',
    sourceId: 'custom-items-summary',
    sourceLabel: 'Selection',
    targetId: 'spatial-items',
  },
] as const) {
  test(`previews and commits ${scenario.name} while all groups are collapsed`, async ({ page }) => {
    const panel = page.locator('[data-tweaker-panel-id="custom-items"]')
    const rootList = panel.locator('[data-tweaker-reorder-list="root"]')

    await collapseCustomGroups(panel, Object.keys(customGroupLabels) as CustomGroupId[])
    expect(await itemOrder(rootList, 'root')).toEqual(initialCustomRootOrder)

    await exerciseLivePreviewDrag({
      ...scenario,
      list: rootList,
      page,
      panel,
      parentId: 'root',
      verifyDirectionChange: !('singleDirection' in scenario && scenario.singleDirection),
      verifyCancellation: scenario.targetId === 'spatial-items',
    })
  })
}

for (const scenario of [
  {
    name: 'a collapsed group downward across an expanded group',
    sourceId: 'spatial-items',
    sourceLabel: 'Direct manipulation',
    targetId: 'media-items',
  },
  {
    name: 'an expanded group upward across a collapsed group',
    sourceId: 'media-items',
    sourceLabel: 'Media and files',
    targetId: 'spatial-items',
  },
] as const) {
  test(`previews and commits ${scenario.name}`, async ({ page }) => {
    const panel = page.locator('[data-tweaker-panel-id="custom-items"]')
    const rootList = panel.locator('[data-tweaker-reorder-list="root"]')

    await collapseCustomGroups(panel, ['common-items', 'spatial-items', 'visualization-items'])
    await expect(panel.locator('[data-group-id="media-items"]')).toHaveAttribute(
      'data-collapsed',
      'false',
    )

    await exerciseLivePreviewDrag({
      ...scenario,
      expectedOrder: [
        'common-items',
        'media-items',
        'spatial-items',
        'visualization-items',
        'custom-items-summary',
      ],
      list: rootList,
      page,
      panel,
      parentId: 'root',
    })
  })
}

test('previews and commits an expanded group downward across another expanded group', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1200 })
  const panel = page.locator('[data-tweaker-panel-id="custom-items"]')
  const rootList = panel.locator('[data-tweaker-reorder-list="root"]')

  await collapseCustomGroups(panel, ['common-items', 'visualization-items'])
  await expect(panel.locator('[data-group-id="spatial-items"]')).toHaveAttribute(
    'data-collapsed',
    'false',
  )
  await expect(panel.locator('[data-group-id="media-items"]')).toHaveAttribute(
    'data-collapsed',
    'false',
  )

  await exerciseLivePreviewDrag({
    expectedOrder: [
      'common-items',
      'media-items',
      'spatial-items',
      'visualization-items',
      'custom-items-summary',
    ],
    list: rootList,
    page,
    panel,
    parentId: 'root',
    sourceId: 'spatial-items',
    sourceLabel: 'Direct manipulation',
    targetId: 'media-items',
  })
})

test('moves an expanded Common group upward across multiple collapsed groups from third', async ({
  page,
}) => {
  const panel = page.locator('[data-tweaker-panel-id="custom-items"]')
  const rootList = panel.locator('[data-tweaker-reorder-list="root"]')

  await collapseCustomGroups(panel, Object.keys(customGroupLabels) as CustomGroupId[])
  await exerciseLivePreviewDrag({
    expectedOrder: [
      'spatial-items',
      'media-items',
      'common-items',
      'visualization-items',
      'custom-items-summary',
    ],
    list: rootList,
    page,
    panel,
    parentId: 'root',
    sourceId: 'common-items',
    sourceLabel: 'Common inputs',
    targetId: 'media-items',
  })

  const common = panel.locator('[data-group-id="common-items"]')
  await common.getByRole('button', { name: customGroupLabels['common-items'], exact: true }).click()
  await expect(common).toHaveAttribute('data-collapsed', 'false')
  await page.waitForTimeout(200)

  await exerciseLivePreviewDrag({
    expectedOrder: initialCustomRootOrder,
    list: rootList,
    page,
    panel,
    parentId: 'root',
    sourceId: 'common-items',
    sourceLabel: 'Common inputs',
    targetId: 'spatial-items',
  })
})

test('reverses an expanded root group across collapsed groups and a root item', async ({
  page,
}) => {
  const panel = page.locator('[data-tweaker-panel-id="custom-items"]')
  const rootList = panel.locator('[data-tweaker-reorder-list="root"]')

  await collapseCustomGroups(panel, ['common-items', 'spatial-items', 'visualization-items'])
  await expect(panel.locator('[data-group-id="media-items"]')).toHaveAttribute(
    'data-collapsed',
    'false',
  )

  await exerciseThresholdItinerary({
    list: rootList,
    page,
    panel,
    parentId: 'root',
    sourceId: 'media-items',
    sourceLabel: 'Media and files',
    stops: [
      { targetId: 'visualization-items' },
      { targetId: 'custom-items-summary' },
      { targetId: 'spatial-items' },
      { targetId: 'common-items' },
    ],
  })
})

test('settles active group disclosure transitions before measuring a root drag', async ({
  page,
}) => {
  const panel = page.locator('[data-tweaker-panel-id="custom-items"]')
  const rootList = panel.locator('[data-tweaker-reorder-list="root"]')

  await collapseCustomGroups(panel, Object.keys(customGroupLabels) as CustomGroupId[], {
    settle: false,
  })
  expect(await activeDisclosureTransitionCount(panel)).toBeGreaterThan(0)

  await exerciseLivePreviewDrag({
    expectedOrder: [
      'spatial-items',
      'media-items',
      'common-items',
      'visualization-items',
      'custom-items-summary',
    ],
    list: rootList,
    page,
    panel,
    parentId: 'root',
    sourceId: 'common-items',
    sourceLabel: 'Common inputs',
    targetId: 'media-items',
    onPointerDown: async () => {
      expect(await activeDisclosureTransitionCount(panel)).toBe(0)
    },
  })
})

for (const scenario of [
  {
    expectedOrder: ['alignment', 'vector', 'density', 'thresholdRange'],
    name: 'downward',
    sourceId: 'density',
    sourceLabel: 'Density',
    targetId: 'vector',
  },
  {
    expectedOrder: ['thresholdRange', 'density', 'alignment', 'vector'],
    name: 'upward',
    sourceId: 'thresholdRange',
    sourceLabel: 'Thresholds',
    targetId: 'density',
  },
] as const) {
  test(`reorders grouped controls ${scenario.name} in one direction without changing root order`, async ({
    page,
  }) => {
    const panel = page.locator('[data-tweaker-panel-id="custom-items"]')
    const rootList = panel.locator('[data-tweaker-reorder-list="root"]')
    const commonList = panel.locator('[data-tweaker-reorder-list="common-items"]')

    await exerciseLivePreviewDrag({
      ...scenario,
      list: commonList,
      page,
      panel,
      parentId: 'common-items',
      unchangedOrder: {
        expected: initialCustomRootOrder,
        list: rootList,
        parentId: 'root',
      },
      verifyDirectionChange: false,
    })
  })
}

test('reverses a nested control across multiple siblings in both directions', async ({ page }) => {
  const panel = page.locator('[data-tweaker-panel-id="scene-controls"]')
  const rootList = panel.locator('[data-tweaker-reorder-list="root"]')
  const renderingList = panel.locator('[data-tweaker-reorder-list="scene-rendering"]')

  await exerciseThresholdItinerary({
    list: renderingList,
    page,
    panel,
    parentId: 'scene-rendering',
    sourceId: 'maxBounces',
    sourceLabel: 'Max bounces',
    stops: [
      { targetId: 'textureQuality' },
      { targetId: 'renderScale' },
      { targetId: 'shadowSoftness' },
      { targetId: 'cameraHeight' },
      { targetId: 'quality' },
    ],
    unchangedOrder: {
      expected: ['scene-essentials', 'scene-rendering', 'scene-summary'],
      list: rootList,
      parentId: 'root',
    },
  })
})

test('avoids Camera height before Quality covers it and retains avoidance on a 1px reversal', async ({
  page,
}) => {
  const panel = page.locator('[data-tweaker-panel-id="scene-controls"]')
  const list = panel.locator('[data-tweaker-reorder-list="scene-rendering"]')
  const quality = panel.locator('[data-control-id="quality"]')
  const cameraHeight = panel.locator('[data-control-id="cameraHeight"]')
  const grip = quality.getByRole('button', { name: 'Reorder Quality', exact: true })

  await grip.scrollIntoViewIfNeeded()
  const gripRect = await requiredBox(grip)
  const qualityRect = await requiredBox(quality)
  const cameraRect = await requiredBox(cameraHeight)
  const pointerX = gripRect.x + gripRect.width / 2
  const pointerY = gripRect.y + gripRect.height / 2
  const avoidanceOffset = cameraRect.y + cameraRect.height / 2 - qualityRect.y - qualityRect.height
  const cameraSlotOffset = cameraRect.y - qualityRect.y

  await page.mouse.move(pointerX, pointerY)
  await page.mouse.down()

  await page.mouse.move(pointerX, pointerY + avoidanceOffset - 1)
  await expect
    .poll(() => itemOrder(list, 'scene-rendering'))
    .toEqual([
      'quality',
      'cameraHeight',
      'shadowSoftness',
      'maxBounces',
      'motionBlur',
      'textureQuality',
      'renderScale',
    ])
  await expectSiblingAt(cameraHeight, cameraRect.y)

  await page.mouse.move(pointerX, pointerY + avoidanceOffset + 1)
  await expect
    .poll(() => itemOrder(list, 'scene-rendering'))
    .toEqual([
      'cameraHeight',
      'quality',
      'shadowSoftness',
      'maxBounces',
      'motionBlur',
      'textureQuality',
      'renderScale',
    ])
  await expectSiblingAt(cameraHeight, qualityRect.y)
  const partiallyOverlappingQuality = await requiredBox(quality)
  expect(partiallyOverlappingQuality.y).toBeLessThan(cameraRect.y)
  expect(partiallyOverlappingQuality.y + partiallyOverlappingQuality.height).toBeLessThan(
    cameraRect.y + cameraRect.height,
  )

  await page.mouse.move(pointerX, pointerY + cameraSlotOffset)
  await expectPointerOffset(quality, qualityRect.y, cameraSlotOffset)
  await page.mouse.move(pointerX, pointerY + cameraSlotOffset - 1)
  await expect
    .poll(() => itemOrder(list, 'scene-rendering'))
    .toEqual([
      'cameraHeight',
      'quality',
      'shadowSoftness',
      'maxBounces',
      'motionBlur',
      'textureQuality',
      'renderScale',
    ])
  await expectSiblingAt(cameraHeight, qualityRect.y)

  await page.mouse.up()
  await expect
    .poll(() => itemOrder(list, 'scene-rendering'))
    .toEqual([
      'cameraHeight',
      'quality',
      'shadowSoftness',
      'maxBounces',
      'motionBlur',
      'textureQuality',
      'renderScale',
    ])
  await expectContiguousItems(list, 'scene-rendering')
})

for (const collapsed of [false, true]) {
  test(`renders singleton Scene placement bands as static while groups are ${collapsed ? 'collapsed' : 'expanded'}`, async ({
    page,
  }) => {
    const panel = page.locator('[data-tweaker-panel-id="scene-controls"]')
    const list = panel.locator('[data-tweaker-reorder-list="root"]')
    const essentials = panel.locator('[data-group-id="scene-essentials"]')
    const rendering = panel.locator('[data-group-id="scene-rendering"]')
    const summary = panel.locator('[data-control-id="scene-summary"]')

    if (collapsed) {
      await essentials.getByRole('button', { name: 'Essentials', exact: true }).click()
      await rendering.getByRole('button', { name: 'Rendering', exact: true }).click()
      await expect(essentials).toHaveAttribute('data-collapsed', 'true')
      await expect(rendering).toHaveAttribute('data-collapsed', 'true')
      await page.waitForTimeout(200)
    }

    const initialOrder = ['scene-essentials', 'scene-rendering', 'scene-summary']
    expect(await itemOrder(list, 'root')).toEqual(initialOrder)
    const staticItems = [
      {
        item: essentials,
        label: 'Essentials',
        surface: essentials.locator(':scope > div').first(),
      },
      { item: rendering, label: 'Rendering', surface: rendering.locator(':scope > div').first() },
      { item: summary, label: 'Summary', surface: summary },
    ]

    for (const { item, label, surface } of staticItems) {
      const slot = item.getByRole('button', { name: `Reorder ${label}`, exact: true })
      await expect(item).toHaveAttribute('data-reorderable', 'false')
      await expect(slot).toHaveCount(0)
      await expect(surface).toHaveCSS('padding-left', '6px')
      await expect(item).toHaveAttribute('data-dragging', 'false')
      expect(await itemOrder(list, 'root')).toEqual(initialOrder)
    }

    const customRootGroup = page.locator('[data-group-id="common-items"]')
    await expect(customRootGroup.locator(':scope > div').first()).toHaveCSS('padding-left', '0px')
    await expect.poll(() => listTransformsAreNone(list, 'root')).toBe(true)
    await expectContiguousItems(list, 'root')
  })
}

test('transfers hover ownership between a group header and its child', async ({ page }) => {
  const group = page.locator('[data-group-id="scene-rendering"]')
  const child = page.locator('[data-control-id="quality"]')
  const groupHeader = group.getByRole('button', { name: 'Rendering', exact: true })
  const childGrip = child.getByRole('button', { name: 'Reorder Quality', exact: true })

  await childGrip.hover()
  await expect(child).toHaveAttribute('data-hovered', 'true')
  await expect(group).toHaveAttribute('data-hovered', 'false')

  await groupHeader.hover()
  await expect(group).toHaveAttribute('data-hovered', 'true')
  await expect(child).toHaveAttribute('data-hovered', 'false')

  await childGrip.hover()
  await expect(child).toHaveAttribute('data-hovered', 'true')
  await expect(group).toHaveAttribute('data-hovered', 'false')
})

test('pins the group hover band to the left and bottom edges while preserving its label gap', async ({
  page,
}) => {
  const group = page.locator('[data-group-id="scene-essentials"]')
  const firstRow = group.locator('[data-control-id="opacity"]')
  const lastRow = group.locator('[data-control-id="bloom"]')
  const firstRail = firstRow.locator(':scope > span').first()
  const lastRail = lastRow.locator(':scope > span').first()
  const label = firstRow.locator('label').first()

  await group.getByRole('button', { name: 'Essentials', exact: true }).hover()
  await expect(group).toHaveAttribute('data-hovered', 'true')

  const groupRect = await requiredBox(group)
  const firstRailRect = await requiredBox(firstRail)
  const lastRailRect = await requiredBox(lastRail)
  const labelRect = await requiredBox(label)
  const borderBottomWidth = await group.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).borderBottomWidth),
  )

  expect(Math.abs(firstRailRect.x - groupRect.x)).toBeLessThanOrEqual(0.5)
  expect(firstRailRect.width).toBe(24)
  await expect
    .poll(async () => {
      const [groupBorderColor, railColor] = await Promise.all([
        group.evaluate((element) => getComputedStyle(element).borderLeftColor),
        firstRail.evaluate((element) => getComputedStyle(element).backgroundColor),
      ])
      return groupBorderColor === railColor
    })
    .toBe(true)
  expect(Math.abs(labelRect.x - (firstRailRect.x + firstRailRect.width) - 6)).toBeLessThanOrEqual(
    0.5,
  )
  expect(
    Math.abs(
      lastRailRect.y + lastRailRect.height - (groupRect.y + groupRect.height - borderBottomWidth),
    ),
  ).toBeLessThanOrEqual(0.5)
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

test('renders static square slots for non-reorderable items', async ({ page }) => {
  const fixedControl = page.locator('[data-control-id="shadcn-frame-chart"]')
  const fixedSlot = fixedControl.getByRole('button', {
    name: 'Reorder Frame time',
    exact: true,
  })
  const reorderableControl = page.locator('[data-control-id="quality"]')
  const reorderableSlot = reorderableControl.getByRole('button', {
    name: 'Reorder Quality',
    exact: true,
  })

  await expect(fixedControl).toHaveAttribute('data-reorderable', 'false')
  await expect(fixedControl).toHaveCSS('padding-left', '0px')
  await expect(fixedSlot).toHaveAttribute('aria-disabled', 'true')
  await expect(fixedSlot.locator('[data-tweaker-reorder-indicator="static"]')).toHaveCount(1)
  await expect(fixedSlot.locator('svg')).toHaveCount(0)

  await expect(reorderableControl).toHaveAttribute('data-reorderable', 'true')
  await expect(reorderableSlot).toHaveAttribute('aria-disabled', 'false')
  await expect(reorderableSlot.locator('[data-tweaker-reorder-indicator="grip"]')).toHaveCount(1)
  await expect(reorderableSlot.locator('svg')).toHaveCount(1)
})

test('keeps the portaled Select in the viewport and updates it from the keyboard', async ({
  page,
}) => {
  await page.setViewportSize({ width: 640, height: 480 })
  const quality = page.locator('[data-control-id="quality"]')
  const trigger = quality.getByRole('combobox', { name: 'Quality' })

  await trigger.scrollIntoViewIfNeeded()
  await trigger.focus()
  await trigger.press('Enter')

  const content = page.locator('[data-tweaker-theme="dark"][data-side]')
  await expect(content).toBeVisible()
  await expect(content).toHaveAttribute('data-tweaker-theme', 'dark')
  const finalOption = page.getByRole('option', { name: 'Final' })
  await expect(finalOption).toBeVisible()

  const contentBox = await content.boundingBox()
  expect(contentBox).not.toBeNull()
  if (contentBox) {
    expect(contentBox.x).toBeGreaterThanOrEqual(0)
    expect(contentBox.y).toBeGreaterThanOrEqual(0)
    expect(contentBox.x + contentBox.width).toBeLessThanOrEqual(640)
    expect(contentBox.y + contentBox.height).toBeLessThanOrEqual(480)
  }

  await page.keyboard.press('ArrowDown')
  await expect(finalOption).toHaveAttribute('data-highlighted', '')
  await finalOption.press('Enter')
  await expect(trigger).toHaveText('Final')
  await expect(page.getByText(/72% opacity \/ final/i)).toBeVisible()
  await expect(trigger).toBeFocused()
})

test('keeps panel typography and dropzone geometry at the baseline', async ({ page }) => {
  const alignment = page.locator('[data-control-id="alignment"]')
  const alignmentLabel = alignment.locator('label')
  const qualityTrigger = page.locator('[data-control-id="quality"]').getByRole('combobox')
  const helpButton = alignment.getByRole('button', { name: 'Help for Alignment' })
  const dropSurface = page
    .locator('[data-control-id="droppedFiles"]')
    .getByRole('button', { name: 'Choose files or drop them here' })

  await expect(alignmentLabel).toHaveCSS('font-size', '12px')
  await expect(alignmentLabel).toHaveCSS('line-height', '16px')
  await expect(qualityTrigger).toHaveCSS('font-size', '12px')
  await expect(qualityTrigger).toHaveCSS('line-height', '16px')
  await expect(helpButton).toHaveCSS('font-size', '14px')
  await expect(helpButton).toHaveCSS('line-height', '20px')
  await expect(dropSurface).toHaveCSS('height', '96px')
})

test('fits Scene Controls without a default vertical scrollbar', async ({ page }) => {
  const body = page.locator(
    '[data-tweaker-panel-id="scene-controls"] [data-tweaker-reorder-list="root"]',
  )

  await expect
    .poll(() => body.evaluate((element) => element.scrollHeight - element.clientHeight))
    .toBeLessThanOrEqual(0)
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

test('applies simultaneous named themes to panels and every portaled surface', async ({ page }) => {
  await page.goto('/?providerTheme=ocean&customTheme=plum')

  const scenePanel = page.locator('[data-tweaker-panel-id="scene-controls"]')
  const customPanel = page.locator('[data-tweaker-panel-id="custom-items"]')
  await expect(page.locator('[data-tweaker-container]')).toHaveAttribute(
    'data-tweaker-theme',
    'ocean',
  )
  await expect(scenePanel).toHaveAttribute('data-tweaker-theme', 'ocean')
  await expect(customPanel).toHaveAttribute('data-tweaker-theme', 'plum')
  await expect(scenePanel).toHaveCSS('background-color', 'rgb(7, 38, 52)')
  await expect(customPanel).toHaveCSS('background-color', 'rgb(54, 19, 62)')

  const alignment = customPanel.locator('[data-control-id="alignment"]')
  await expect(alignment.getByRole('radio', { name: 'Centre', exact: true })).toHaveCSS(
    'background-color',
    'rgb(241, 159, 248)',
  )
  await expect(alignment.getByRole('radiogroup')).toHaveCSS('border-radius', '9px')

  const qualityTrigger = page.locator('[data-control-id="quality"]').getByRole('combobox')
  await expect(qualityTrigger).toHaveCSS('border-bottom-color', 'rgb(91, 158, 171)')
  await qualityTrigger.click()
  const selectContent = page.locator('[data-tweaker-theme="ocean"][data-side]')
  await expect(selectContent).toHaveCSS('background-color', 'rgb(11, 55, 72)')
  await expect(selectContent).toHaveCSS('border-radius', '8px')
  const finalOption = page.getByRole('option', { name: 'Final' })
  await finalOption.hover()
  await expect(finalOption).toHaveCSS('background-color', 'rgb(17, 78, 96)')
  await page.keyboard.press('Escape')

  await alignment.getByRole('button', { name: 'Help for Alignment' }).hover()
  await expect(page.getByRole('tooltip')).toBeVisible()
  const tooltip = page.locator('[data-tweaker-theme="plum"][data-side]')
  await expect(tooltip).toHaveCSS('background-color', 'rgb(75, 27, 85)')
  await expect(tooltip).toHaveCSS('border-radius', '12px')

  const dropzone = customPanel.locator('[data-control-id="droppedFiles"]')
  await dropzone.locator('input[type="file"]').setInputFiles({
    name: 'themed.png',
    mimeType: 'image/png',
    buffer: Buffer.from('themed image metadata'),
  })
  const previewButton = dropzone.getByRole('button', { name: 'View themed.png' })
  await previewButton.click()
  const viewer = page.getByRole('dialog')
  await expect(viewer).toHaveAttribute('data-tweaker-theme', 'plum')
  await expect(viewer).toHaveCSS('border-radius', '12px')
  await page.keyboard.press('Escape')

  const customActions = customPanel.getByRole('button', { name: 'Open actions for Custom Items' })
  await customActions.click()
  const menu = page.getByRole('menu', { name: 'Actions for Custom Items' })
  await expect(menu).toHaveAttribute('data-tweaker-theme', 'plum')
  await menu.getByRole('menuitem', { name: 'Copy' }).hover()
  await expect(page.locator('[data-tweaker-theme="plum"][role="menu"]')).toHaveCount(2)
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  await customActions.click()
  await menu.getByRole('menuitem', { name: 'Reset…' }).click()
  const dialog = page.getByRole('alertdialog', { name: 'Reset Custom Items?' })
  await expect(dialog).toHaveAttribute('data-tweaker-theme', 'plum')
  await expect(
    page.locator('[data-tweaker-theme="plum"][data-state="open"].fixed.inset-0'),
  ).toHaveCount(1)
  await dialog.getByRole('button', { name: 'Cancel' }).click()
})

test('updates inherited panel themes at runtime while preserving explicit overrides', async ({
  page,
}) => {
  await changeDemoThemes(page, { custom: 'plum' })

  const scenePanel = page.locator('[data-tweaker-panel-id="scene-controls"]')
  const customPanel = page.locator('[data-tweaker-panel-id="custom-items"]')
  await expect(scenePanel).toHaveAttribute('data-tweaker-theme', 'dark')
  await expect(customPanel).toHaveAttribute('data-tweaker-theme', 'plum')

  await changeDemoThemes(page, { provider: 'ocean' })

  await expect(page.locator('[data-demo-provider-theme]')).toHaveAttribute(
    'data-demo-provider-theme',
    'ocean',
  )
  await expect(scenePanel).toHaveAttribute('data-tweaker-theme', 'ocean')
  await expect(customPanel).toHaveAttribute('data-tweaker-theme', 'plum')

  await changeDemoThemes(page, { custom: null })
  await expect(customPanel).toHaveAttribute('data-tweaker-theme', 'ocean')
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

test('keeps the panel action menu contained and manages collapsible groups', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 480 })
  await page
    .locator('[data-tweaker-panel-id="custom-items"]')
    .evaluate((element: HTMLElement) => (element.style.display = 'none'))
  const panel = page.locator('[data-tweaker-panel-id="scene-controls"]')
  const trigger = panel.getByRole('button', { name: 'Open actions for Scene Controls' })
  const essentials = panel.locator('[data-group-id="scene-essentials"]')
  const rendering = panel.locator('[data-group-id="scene-rendering"]')
  const panelTransform = await panel.evaluate((element) => getComputedStyle(element).transform)

  const triggerBox = await trigger.boundingBox()
  expect(triggerBox).not.toBeNull()
  if (triggerBox) {
    await page.mouse.move(triggerBox.x + triggerBox.width / 2, triggerBox.y + triggerBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(triggerBox.x - 80, triggerBox.y + 60, { steps: 4 })
    await page.mouse.up()
    await page.keyboard.press('Escape')
    await expect
      .poll(() => panel.evaluate((element) => getComputedStyle(element).transform))
      .toBe(panelTransform)
  }

  await trigger.click()
  const menu = page.getByRole('menu', { name: 'Actions for Scene Controls' })
  await expect(menu).toBeVisible()
  await expect(menu).toHaveAttribute('data-tweaker-theme', 'dark')
  const menuBox = await menu.boundingBox()
  expect(menuBox).not.toBeNull()
  if (menuBox) {
    expect(menuBox.x).toBeGreaterThanOrEqual(0)
    expect(menuBox.y).toBeGreaterThanOrEqual(0)
    expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(640)
    expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(480)
  }

  const expandAll = menu.getByRole('menuitem', { name: 'Expand all' })
  const collapseAll = menu.getByRole('menuitem', { name: 'Collapse all' })
  await expect(expandAll).toBeDisabled()
  await expect(collapseAll).toBeEnabled()
  await collapseAll.click()
  await expect(essentials).toHaveAttribute('data-collapsed', 'true')
  await expect(rendering).toHaveAttribute('data-collapsed', 'true')
  await expect(trigger).toBeFocused()

  await trigger.click()
  await expect(menu.getByRole('menuitem', { name: 'Collapse all' })).toBeDisabled()
  await expect(menu.getByRole('menuitem', { name: 'Expand all' })).toBeEnabled()
  await menu.getByRole('menuitem', { name: 'Expand all' }).click()
  await expect(essentials).toHaveAttribute('data-collapsed', 'false')
  await expect(rendering).toHaveAttribute('data-collapsed', 'false')

  await trigger.click()
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
  await expect
    .poll(() => panel.evaluate((element) => getComputedStyle(element).transform))
    .toBe(panelTransform)
})

test('confirms registered-field resets without changing group disclosure', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 480 })
  await page
    .locator('[data-tweaker-panel-id="custom-items"]')
    .evaluate((element: HTMLElement) => (element.style.display = 'none'))
  const panel = page.locator('[data-tweaker-panel-id="scene-controls"]')
  const trigger = panel.getByRole('button', { name: 'Open actions for Scene Controls' })
  const quality = panel.locator('[data-control-id="quality"]').getByRole('combobox')
  const rendering = panel.locator('[data-group-id="scene-rendering"]')

  await quality.click()
  await page.getByRole('option', { name: 'Final' }).click()
  await rendering.getByRole('button', { name: 'Rendering', exact: true }).click()
  await expect(rendering).toHaveAttribute('data-collapsed', 'true')

  await trigger.click()
  await page.getByRole('menuitem', { name: 'Reset…' }).click()
  const dialog = page.getByRole('alertdialog', { name: 'Reset Scene Controls?' })
  await expect(dialog).toHaveAttribute('data-tweaker-theme', 'dark')
  const dialogBox = await dialog.boundingBox()
  expect(dialogBox).not.toBeNull()
  if (dialogBox) {
    expect(dialogBox.x).toBeGreaterThanOrEqual(0)
    expect(dialogBox.y).toBeGreaterThanOrEqual(0)
    expect(dialogBox.x + dialogBox.width).toBeLessThanOrEqual(640)
    expect(dialogBox.y + dialogBox.height).toBeLessThanOrEqual(480)
  }
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByText(/72% opacity \/ final/i)).toBeVisible()
  await expect(rendering).toHaveAttribute('data-collapsed', 'true')
  await expect(trigger).toBeFocused()

  await trigger.click()
  await page.getByRole('menuitem', { name: 'Reset…' }).click()
  await dialog.getByRole('button', { name: 'Reset values' }).click()
  await expect(page.getByText(/72% opacity \/ balanced/i)).toBeVisible()
  await expect(rendering).toHaveAttribute('data-collapsed', 'true')
  await expect(trigger).toBeFocused()
})

test('copies and exports registered panel values as JSON and YAML', async ({ context, page }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const panel = page.locator('[data-tweaker-panel-id="scene-controls"]')
  const trigger = panel.getByRole('button', { name: 'Open actions for Scene Controls' })
  const status = panel.locator('span[role="status"]')

  await openActionSubmenu(page, trigger, 'Copy')
  await page.getByRole('menuitem', { name: 'Copy JSON' }).click()
  await expect(status).toHaveText('Copied panel values as JSON.')
  const copiedJson = await page.evaluate(() => navigator.clipboard.readText())
  expect(JSON.parse(copiedJson)).toMatchObject({
    opacity: 0.72,
    quality: 'balanced',
  })

  await openActionSubmenu(page, trigger, 'Copy')
  await page.getByRole('menuitem', { name: 'Copy YAML' }).click()
  await expect(status).toHaveText('Copied panel values as YAML.')
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain('quality: balanced')

  await openActionSubmenu(page, trigger, 'Export')
  const [jsonDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('menuitem', { name: 'Export JSON' }).click(),
  ])
  expect(jsonDownload.suggestedFilename()).toBe('scene-controls.json')
  const jsonPath = await jsonDownload.path()
  expect(jsonPath).not.toBeNull()
  if (jsonPath) {
    expect(JSON.parse(await readFile(jsonPath, 'utf8'))).toMatchObject({ quality: 'balanced' })
  }

  await openActionSubmenu(page, trigger, 'Export')
  const [yamlDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('menuitem', { name: 'Export YAML' }).click(),
  ])
  expect(yamlDownload.suggestedFilename()).toBe('scene-controls.yaml')
  const yamlPath = await yamlDownload.path()
  expect(yamlPath).not.toBeNull()
  if (yamlPath) {
    expect(await readFile(yamlPath, 'utf8')).toContain('quality: balanced')
  }
})

test('imports JSON and YAML atomically and reports invalid files without mutation', async ({
  page,
}) => {
  const panel = page.locator('[data-tweaker-panel-id="scene-controls"]')
  const trigger = panel.getByRole('button', { name: 'Open actions for Scene Controls' })
  const status = panel.locator('span[role="status"]')
  const summary = page.locator('[data-control-id="scene-summary"]')

  await importPanelFile(page, trigger, {
    buffer: Buffer.from('{"opacity":0.4,"quality":"final"}'),
    mimeType: 'application/json',
    name: 'scene.json',
  })
  await expect(status).toHaveText('Imported panel values from scene.json.')
  await expect(summary).toContainText('40% opacity / final')

  const yamlFile = {
    buffer: Buffer.from('quality: draft\n'),
    mimeType: 'application/yaml',
    name: 'scene.yaml',
  }
  await importPanelFile(page, trigger, yamlFile)
  await expect(status).toHaveText('Imported panel values from scene.yaml.')
  await expect(summary).toContainText('72% opacity / draft')

  await panel.locator('[data-control-id="quality"]').getByRole('combobox').click()
  await page.getByRole('option', { name: 'Final' }).click()
  await expect(summary).toContainText('72% opacity / final')
  await importPanelFile(page, trigger, yamlFile)
  await expect(summary).toContainText('72% opacity / draft')

  await importPanelFile(page, trigger, {
    buffer: Buffer.from('{"quality":3,"unknown":true}'),
    mimeType: 'application/json',
    name: 'invalid.json',
  })
  await expect(status).toContainText('Import failed:')
  await expect(summary).toContainText('72% opacity / draft')
})

async function openActionSubmenu(
  page: import('@playwright/test').Page,
  trigger: import('@playwright/test').Locator,
  name: string,
) {
  await trigger.click()
  const submenuTrigger = page.getByRole('menuitem', { name })
  await submenuTrigger.hover()
}

async function importPanelFile(
  page: import('@playwright/test').Page,
  trigger: import('@playwright/test').Locator,
  file: { buffer: Buffer; mimeType: string; name: string },
) {
  await trigger.click()
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('menuitem', { name: 'Import…' }).click(),
  ])
  await chooser.setFiles(file)
}

type CustomGroupId = keyof typeof customGroupLabels

async function collapseCustomGroups(
  panel: import('@playwright/test').Locator,
  groupIds: CustomGroupId[],
  { settle = true }: { settle?: boolean } = {},
) {
  for (const groupId of groupIds) {
    const group = panel.locator(`[data-group-id="${groupId}"]`)
    await group
      .getByRole('button', { name: customGroupLabels[groupId], exact: true })
      .evaluate((button: HTMLButtonElement) => button.click())
    await expect(group).toHaveAttribute('data-collapsed', 'true')
  }

  if (settle) {
    await panel.page().waitForTimeout(200)
  }
}

async function exerciseLivePreviewDrag({
  expectedOrder,
  list,
  onPointerDown,
  page,
  panel,
  parentId,
  sourceId,
  sourceLabel,
  targetId,
  unchangedOrder,
  verifyCancellation = false,
  verifyDirectionChange = true,
}: {
  expectedOrder: readonly string[]
  list: import('@playwright/test').Locator
  onPointerDown?: () => Promise<void>
  page: import('@playwright/test').Page
  panel: import('@playwright/test').Locator
  parentId: string
  sourceId: string
  sourceLabel: string
  targetId: string
  unchangedOrder?: {
    expected: readonly string[]
    list: import('@playwright/test').Locator
    parentId: string
  }
  verifyCancellation?: boolean
  verifyDirectionChange?: boolean
}) {
  const source = panel.locator(`[data-group-id="${sourceId}"], [data-control-id="${sourceId}"]`)
  const grip = source.getByRole('button', {
    name: `Reorder ${sourceLabel}`,
    exact: true,
  })
  await grip.scrollIntoViewIfNeeded()
  await expect.poll(() => listTransformsAreNone(list, parentId)).toBe(true)
  await expectContiguousItems(list, parentId)

  const initialOrder = await itemOrder(list, parentId)
  const gripBox = await grip.boundingBox()
  expect(gripBox).not.toBeNull()
  if (!gripBox) return

  const pointerX = gripBox.x + gripBox.width / 2
  const pointerY = gripBox.y + gripBox.height / 2
  const rootList = panel.locator('[data-tweaker-reorder-list="root"]')
  const initialScrollTop = await rootList.evaluate((element) => element.scrollTop)

  await page.mouse.move(pointerX, pointerY)
  await page.mouse.down()
  await onPointerDown?.()

  const initialRects = await itemRects(list, parentId)
  const initialSlots = await itemSlots(list, parentId)
  const sourceRect = initialRects[sourceId]
  const targetRect = initialRects[targetId]
  expect(sourceRect).toBeDefined()
  expect(targetRect).toBeDefined()
  if (!sourceRect || !targetRect) return

  const sourceSlot = initialSlots[sourceId]
  const targetSlot = initialSlots[targetId]
  expect(sourceSlot).toBeDefined()
  expect(targetSlot).toBeDefined()
  if (!sourceSlot || !targetSlot) return
  const constraintRect = await requiredBox(list.locator(':scope > div'))
  const visualPointerOffset = (offset: number) =>
    constrainPointerOffset(
      offset,
      constraintRect.y - sourceRect.y,
      constraintRect.y + constraintRect.height - (sourceRect.y + sourceRect.height),
    )

  const sourceCenter = sourceRect.y + sourceRect.height / 2
  const targetCenter = targetRect.y + targetRect.height / 2
  const direction = targetCenter > sourceCenter ? 1 : -1
  const restingOffset = direction * 4

  await page.mouse.move(pointerX, pointerY + restingOffset)
  await expect
    .poll(async () => ((await requiredBox(source)).y - sourceRect.y) * direction)
    .toBeGreaterThanOrEqual(3)
  await expect
    .poll(async () => ((await requiredBox(source)).y - sourceRect.y) * direction)
    .toBeLessThanOrEqual(5)
  await expectSiblingRects(list, parentId, initialRects, sourceId)
  await expect.poll(() => siblingTransformsAreNone(list, parentId, sourceId)).toBe(true)

  const sourceLeadingEdge = direction > 0 ? sourceRect.y + sourceRect.height : sourceRect.y
  const targetThreshold = targetCenter - sourceLeadingEdge
  const targetIndex = initialOrder.indexOf(targetId)
  const nextId = initialOrder[targetIndex + direction]
  const nextRect = nextId ? initialRects[nextId] : undefined
  const nextThreshold = nextRect
    ? nextRect.y + nextRect.height / 2 - sourceLeadingEdge
    : direction > 0
      ? Number.POSITIVE_INFINITY
      : Number.NEGATIVE_INFINITY
  const crossingOffset =
    direction > 0
      ? Math.min(targetThreshold + 2, nextThreshold - 2)
      : Math.max(targetThreshold - 2, nextThreshold + 2)
  await startSiblingTransitionSampling(list, parentId, sourceId)
  await page.mouse.move(pointerX, pointerY + crossingOffset)
  await expect.poll(() => itemOrder(list, parentId)).toEqual(expectedOrder)
  await expectPointerOffset(source, sourceRect.y, visualPointerOffset(crossingOffset))
  await expectSiblingDisplacement(list, parentId, initialSlots, sourceId)
  await expectSiblingTransition(list, parentId, sourceId)
  await expectContiguousSlots(list, parentId)
  await expectSiblingVisualsToSettle(list, parentId, sourceId)
  await expect.poll(() => rootList.evaluate((element) => element.scrollTop)).toBe(initialScrollTop)
  await expectUnchangedOrder(unchangedOrder)

  if (verifyDirectionChange) {
    await page.mouse.move(pointerX, pointerY + restingOffset)
    await expect.poll(() => itemOrder(list, parentId)).toEqual(initialOrder)
    await expectPointerOffset(source, sourceRect.y, restingOffset)
    await expectSiblingVisualsToSettle(list, parentId, sourceId)
    await expectSiblingRects(list, parentId, initialRects, sourceId)
    await expectContiguousSlots(list, parentId)
    await expectUnchangedOrder(unchangedOrder)

    await startSiblingTransitionSampling(list, parentId, sourceId)
    await page.mouse.move(pointerX, pointerY + crossingOffset)
    await expect.poll(() => itemOrder(list, parentId)).toEqual(expectedOrder)
    await expectPointerOffset(source, sourceRect.y, visualPointerOffset(crossingOffset))
    await expectSiblingTransition(list, parentId, sourceId)
    await expectContiguousSlots(list, parentId)
    await expectUnchangedOrder(unchangedOrder)
  }

  if (verifyCancellation) {
    await grip.dispatchEvent('pointercancel', {
      bubbles: true,
      pointerId: 1,
      pointerType: 'mouse',
    })
    await page.mouse.up()
    await expect.poll(() => itemOrder(list, parentId)).toEqual(initialOrder)
    await expectPointerOffset(source, sourceRect.y, 0)
    await expect(source).toHaveAttribute('data-dragging', 'false')
    await expectContiguousItems(list, parentId)
    await expectUnchangedOrder(unchangedOrder)

    await page.mouse.move(pointerX, pointerY)
    await page.mouse.down()
    await page.mouse.move(pointerX, pointerY + crossingOffset)
    await expect.poll(() => itemOrder(list, parentId)).toEqual(expectedOrder)
    await expectPointerOffset(source, sourceRect.y, visualPointerOffset(crossingOffset))
  }

  await page.mouse.up()
  await expect.poll(() => itemOrder(list, parentId)).toEqual(expectedOrder)
  await expect.poll(() => rootList.evaluate((element) => element.scrollTop)).toBe(initialScrollTop)
  await expect.poll(async () => Math.abs(await visualTop(source))).toBeLessThanOrEqual(0.05)
  await expect(source).toHaveAttribute('data-dragging', 'false')
  await expect.poll(() => listTransformsAreNone(list, parentId)).toBe(true)
  await expectContiguousItems(list, parentId)
  await expectUnchangedOrder(unchangedOrder)
}

async function exerciseThresholdItinerary({
  list,
  page,
  panel,
  parentId,
  sourceId,
  sourceLabel,
  stops,
  unchangedOrder,
}: {
  list: import('@playwright/test').Locator
  page: import('@playwright/test').Page
  panel: import('@playwright/test').Locator
  parentId: string
  sourceId: string
  sourceLabel: string
  stops: readonly { targetId: string }[]
  unchangedOrder?: {
    expected: readonly string[]
    list: import('@playwright/test').Locator
    parentId: string
  }
}) {
  const source = panel.locator(`[data-group-id="${sourceId}"], [data-control-id="${sourceId}"]`)
  const grip = source.getByRole('button', {
    name: `Reorder ${sourceLabel}`,
    exact: true,
  })
  await grip.scrollIntoViewIfNeeded()
  await expect.poll(() => listTransformsAreNone(list, parentId)).toBe(true)

  const gripBox = await requiredBox(grip)
  const pointerX = gripBox.x + gripBox.width / 2
  const pointerY = gripBox.y + gripBox.height / 2
  await page.mouse.move(pointerX, pointerY)
  await page.mouse.down()

  const initialOrder = await itemOrder(list, parentId)
  const initialRects = await itemRects(list, parentId)
  const sourceRect = initialRects[sourceId]
  expect(sourceRect).toBeDefined()
  if (!sourceRect) return
  const sourceCenter = sourceRect.y + sourceRect.height / 2
  for (const stop of stops) {
    const targetRect = initialRects[stop.targetId]
    expect(targetRect).toBeDefined()
    if (!targetRect) continue

    const targetCenter = targetRect.y + targetRect.height / 2
    const direction = Math.sign(targetCenter - sourceCenter)
    expect(direction).not.toBe(0)
    const sourceLeadingEdge = direction > 0 ? sourceRect.y + sourceRect.height : sourceRect.y
    const targetThreshold = targetCenter - sourceLeadingEdge

    await page.mouse.move(pointerX, pointerY + targetThreshold - direction)
    await expect
      .poll(() => itemOrder(list, parentId))
      .toEqual(orderAtTargetThreshold(initialOrder, sourceId, stop.targetId, false))
    await expectPointerOffset(source, sourceRect.y, targetThreshold - direction)
    await expectUnchangedOrder(unchangedOrder)

    await page.mouse.move(pointerX, pointerY + targetThreshold + direction)
    await expect
      .poll(() => itemOrder(list, parentId))
      .toEqual(orderAtTargetThreshold(initialOrder, sourceId, stop.targetId, true))
    await expectPointerOffset(source, sourceRect.y, targetThreshold + direction)
    await expectUnchangedOrder(unchangedOrder)
  }

  await page.mouse.up()
  const finalTargetId = stops.at(-1)?.targetId
  expect(finalTargetId).toBeDefined()
  if (!finalTargetId) return
  await expect
    .poll(() => itemOrder(list, parentId))
    .toEqual(orderAtTargetThreshold(initialOrder, sourceId, finalTargetId, true))
  await expect.poll(async () => Math.abs(await visualTop(source))).toBeLessThanOrEqual(0.05)
  await expect(source).toHaveAttribute('data-dragging', 'false')
  await expect.poll(() => listTransformsAreNone(list, parentId)).toBe(true)
  await expectContiguousItems(list, parentId)
  await expectUnchangedOrder(unchangedOrder)
}

function orderAtTargetThreshold(
  initialOrder: string[],
  sourceId: string,
  targetId: string,
  crossed: boolean,
) {
  const sourceIndex = initialOrder.indexOf(sourceId)
  const targetIndex = initialOrder.indexOf(targetId)
  const direction = Math.sign(targetIndex - sourceIndex)
  expect(sourceIndex).toBeGreaterThanOrEqual(0)
  expect(targetIndex).toBeGreaterThanOrEqual(0)
  expect(direction).not.toBe(0)

  const nextOrder = [...initialOrder]
  const [source] = nextOrder.splice(sourceIndex, 1)
  nextOrder.splice(crossed ? targetIndex : targetIndex - direction, 0, source!)
  return nextOrder
}

async function expectUnchangedOrder(
  unchangedOrder:
    | {
        expected: readonly string[]
        list: import('@playwright/test').Locator
        parentId: string
      }
    | undefined,
) {
  if (!unchangedOrder) return
  await expect
    .poll(() => itemOrder(unchangedOrder.list, unchangedOrder.parentId))
    .toEqual(unchangedOrder.expected)
}

async function expectPointerOffset(
  source: import('@playwright/test').Locator,
  initialY: number,
  pointerOffset: number,
) {
  await expect
    .poll(async () => Math.abs((await requiredBox(source)).y - (initialY + pointerOffset)))
    .toBeLessThanOrEqual(1.25)
}

async function expectSiblingAt(locator: import('@playwright/test').Locator, expectedY: number) {
  await expect
    .poll(async () => Math.abs((await requiredBox(locator)).y - expectedY))
    .toBeLessThanOrEqual(1.25)
}

function constrainPointerOffset(value: number, min: number, max: number) {
  if (value < min) {
    return min - Math.min((min - value) * tweakerMotionTokens.dragElastic, 1)
  }
  if (value > max) {
    return max + Math.min((value - max) * tweakerMotionTokens.dragElastic, 1)
  }
  return value
}

async function expectSiblingRects(
  list: import('@playwright/test').Locator,
  parentId: string,
  initialRects: Record<string, ItemRect>,
  sourceId: string,
) {
  await expect
    .poll(async () => {
      const currentRects = await itemRects(list, parentId)
      return Object.entries(initialRects)
        .filter(([id]) => id !== sourceId)
        .every(([id, rect]) => Math.abs((currentRects[id]?.y ?? Number.NaN) - rect.y) <= 1)
    })
    .toBe(true)
}

async function expectSiblingDisplacement(
  list: import('@playwright/test').Locator,
  parentId: string,
  initialSlots: Record<string, ItemRect>,
  sourceId: string,
) {
  await expect
    .poll(async () => {
      const currentSlots = await itemSlots(list, parentId)
      return Object.entries(initialSlots)
        .filter(([id]) => id !== sourceId)
        .some(([id, slot]) => Math.abs((currentSlots[id]?.y ?? Number.NaN) - slot.y) > 1)
    })
    .toBe(true)
}

async function expectContiguousItems(list: import('@playwright/test').Locator, parentId: string) {
  const slots = Object.values(await itemRects(list, parentId))
  expect(
    slots.every(
      (slot, index) =>
        index === 0 || slot.y + 0.5 >= slots[index - 1]!.y + slots[index - 1]!.height,
    ),
  ).toBe(true)
}

async function expectSiblingTransition(
  list: import('@playwright/test').Locator,
  _parentId: string,
  _sourceId: string,
) {
  await expect
    .poll(async () => Number(await list.getAttribute('data-test-max-sibling-reorder-offset')))
    .toBeGreaterThan(0.5)
}

async function startSiblingTransitionSampling(
  list: import('@playwright/test').Locator,
  parentId: string,
  sourceId: string,
) {
  await list.evaluate(
    (element, { parentId, sourceId }) => {
      const listElement = element as HTMLElement
      listElement.dataset.testMaxSiblingReorderOffset = '0'
      let remainingFrames = 120

      const sample = () => {
        const group = listElement.firstElementChild
        const maxOffset = Math.max(
          Number(listElement.dataset.testMaxSiblingReorderOffset ?? 0),
          ...Array.from(group?.children ?? [])
            .filter((item) => {
              const itemElement = item as HTMLElement
              const id = itemElement.dataset.groupId ?? itemElement.dataset.controlId
              return itemElement.dataset.parentId === parentId && id !== sourceId
            })
            .map((item) => {
              const top = Number.parseFloat(getComputedStyle(item).top)
              return Number.isFinite(top) ? Math.abs(top) : 0
            }),
        )
        listElement.dataset.testMaxSiblingReorderOffset = String(maxOffset)
        remainingFrames -= 1
        if (remainingFrames > 0) requestAnimationFrame(sample)
      }

      requestAnimationFrame(sample)
    },
    { parentId, sourceId },
  )
}

async function expectSiblingVisualsToSettle(
  list: import('@playwright/test').Locator,
  parentId: string,
  sourceId: string,
) {
  await expect
    .poll(() =>
      directItems(list, parentId).evaluateAll(
        (items, sourceId) =>
          Math.max(
            0,
            ...items
              .filter((item) => {
                const element = item as HTMLElement
                return (element.dataset.groupId ?? element.dataset.controlId) !== sourceId
              })
              .map((item) => {
                const element = item as HTMLElement
                const top = Number.parseFloat(getComputedStyle(element).top)
                return Number.isFinite(top) ? Math.abs(top) : 0
              }),
          ),
        sourceId,
      ),
    )
    .toBeLessThanOrEqual(0.5)
}

async function expectContiguousSlots(list: import('@playwright/test').Locator, parentId: string) {
  const slots = Object.values(await itemSlots(list, parentId))
  expect(
    slots.every(
      (slot, index) =>
        index === 0 || slot.y + 0.5 >= slots[index - 1]!.y + slots[index - 1]!.height,
    ),
  ).toBe(true)
}

async function itemOrder(list: import('@playwright/test').Locator, parentId: string) {
  return directItems(list, parentId).evaluateAll((items) =>
    items.map((item) =>
      item instanceof HTMLElement ? (item.dataset.groupId ?? item.dataset.controlId ?? '') : '',
    ),
  )
}

type ItemRect = { height: number; y: number }

async function itemSlots(list: import('@playwright/test').Locator, parentId: string) {
  return directItems(list, parentId).evaluateAll((items) =>
    Object.fromEntries(
      items.map((item) => {
        const element = item as HTMLElement
        const visualTop = Number.parseFloat(getComputedStyle(element).top)
        return [
          element.dataset.groupId ?? element.dataset.controlId ?? '',
          {
            height: element.offsetHeight,
            y: element.offsetTop - (Number.isFinite(visualTop) ? visualTop : 0),
          },
        ]
      }),
    ),
  ) as Promise<Record<string, ItemRect>>
}

async function itemRects(list: import('@playwright/test').Locator, parentId: string) {
  return directItems(list, parentId).evaluateAll((items) =>
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

function directItems(list: import('@playwright/test').Locator, parentId: string) {
  return list.locator(`:scope > div > [data-parent-id="${parentId}"]`)
}

async function requiredBox(locator: import('@playwright/test').Locator) {
  const box = await locator.boundingBox()
  expect(box).not.toBeNull()
  return box!
}

async function visualTop(locator: import('@playwright/test').Locator) {
  return locator.evaluate((element) => {
    const top = Number.parseFloat(getComputedStyle(element).top)
    return Number.isFinite(top) ? top : 0
  })
}

async function listTransformsAreNone(list: import('@playwright/test').Locator, parentId: string) {
  return directItems(list, parentId).evaluateAll((items) =>
    items.every((item) => getComputedStyle(item).transform === 'none'),
  )
}

async function siblingTransformsAreNone(
  list: import('@playwright/test').Locator,
  parentId: string,
  sourceId: string,
) {
  return directItems(list, parentId).evaluateAll(
    (items, sourceId) =>
      items
        .filter((item) => {
          const element = item as HTMLElement
          return (element.dataset.groupId ?? element.dataset.controlId) !== sourceId
        })
        .every((item) => {
          const style = getComputedStyle(item)
          const top = Number.parseFloat(style.top)
          return style.transform === 'none' && (!Number.isFinite(top) || Math.abs(top) <= 0.05)
        }),
    sourceId,
  )
}

async function activeDisclosureTransitionCount(panel: import('@playwright/test').Locator) {
  return panel
    .locator('[data-tweaker-group-disclosure]')
    .evaluateAll((disclosures) =>
      disclosures.reduce(
        (count, disclosure) =>
          count +
          disclosure
            .getAnimations()
            .filter(
              (animation) =>
                animation.playState === 'running' &&
                'transitionProperty' in animation &&
                animation.transitionProperty === 'grid-template-rows',
            ).length,
        0,
      ),
    )
}
