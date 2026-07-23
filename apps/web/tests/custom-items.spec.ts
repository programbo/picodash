import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { picodashMotionTokens } from '../../../packages/panel/src/theme'
import { requiredBox } from './helpers'

const builtInGroupLabels = {
  'chart-items': 'Charts',
  'common-items': 'Common inputs',
  'media-items': 'Media and files',
  'spatial-items': 'Direct manipulation',
  'visualization-items': 'Display variants',
} as const
const initialBuiltInRootOrder = [
  'common-items',
  'spatial-items',
  'media-items',
  'chart-items',
  'visualization-items',
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
      new CustomEvent('picodash-demo-theme-change', {
        detail: nextThemes,
      }),
    )
  }, detail)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/state-lab')
  await expect(page.getByRole('heading', { name: 'Picodash State Lab' })).toBeVisible()
  await expect(page.locator('[data-state-lab]')).toHaveCSS('position', 'relative')
})

test('controls registered panels through usePicodashPanel', async ({ page }) => {
  const scenePanel = page.locator('[data-picodash-panel-id="scene-controls"]')
  const hiddenPanel = page.locator('[data-picodash-panel-id="initially-hidden"]')
  const sceneController = page.locator('[data-panel-controller="Scene Controls"]')
  const hiddenController = page.locator('[data-panel-controller="Initially Hidden"]')
  const sceneItems = scenePanel.locator('[data-item-id]')
  const sceneActions = scenePanel.getByRole('button', { name: 'Open actions for Scene Controls' })
  const sceneClose = scenePanel.getByRole('button', { name: 'Close panel Scene Controls' })

  await expect(page.locator('[data-missing-panel-controller]')).toHaveAttribute(
    'data-missing-panel-controller',
    'null',
  )
  await expect(sceneController.locator('[data-panel-visibility]')).toHaveText('visible')
  await expect(hiddenController.locator('[data-panel-visibility]')).toHaveText('hidden')
  await expect(hiddenPanel).toHaveCount(1)
  await expect(hiddenPanel).toBeHidden()
  await expect(hiddenPanel.locator('[data-item-id="hidden-panel-status"]')).toHaveCount(1)
  const [sceneActionsBox, sceneCloseBox] = await Promise.all([
    requiredBox(sceneActions),
    requiredBox(sceneClose),
  ])
  expect(sceneCloseBox.x).toBeGreaterThanOrEqual(sceneActionsBox.x + sceneActionsBox.width)
  expect(sceneCloseBox.x - (sceneActionsBox.x + sceneActionsBox.width)).toBeLessThanOrEqual(8)
  await expect(
    page
      .locator('[data-picodash-panel-id="custom-items"]')
      .getByRole('button', { name: 'Close panel Custom Items' }),
  ).toHaveCount(0)

  const sceneItemCount = await sceneItems.count()
  await sceneController.getByRole('button', { name: 'Hide', exact: true }).click()
  await expect(scenePanel).toBeHidden()
  await expect(scenePanel).toHaveAttribute('data-visible', 'false')
  await expect(sceneController.locator('[data-panel-visibility]')).toHaveText('hidden')
  await expect(sceneItems).toHaveCount(sceneItemCount)

  await sceneController.getByRole('button', { name: 'Show', exact: true }).click()
  await expect(scenePanel).toBeVisible()
  await expect(scenePanel).toHaveAttribute('data-visible', 'true')

  await sceneController.getByRole('button', { name: 'Toggle', exact: true }).click()
  await expect(scenePanel).toBeHidden()
  await sceneController.getByRole('button', { name: 'Toggle', exact: true }).click()
  await expect(scenePanel).toBeVisible()

  await sceneController.getByRole('button', { name: 'Set hidden', exact: true }).click()
  await expect(scenePanel).toBeHidden()
  await sceneController.getByRole('button', { name: 'Activate', exact: true }).click()
  await expect(scenePanel).toBeVisible()
  await expect
    .poll(async () =>
      Number(await scenePanel.evaluate((element) => getComputedStyle(element).zIndex)),
    )
    .toBeGreaterThan(
      Number(await hiddenPanel.evaluate((element) => getComputedStyle(element).zIndex)),
    )

  await hiddenController.getByRole('button', { name: 'Activate', exact: true }).click()
  await expect(hiddenPanel).toBeVisible()
  await expect
    .poll(async () =>
      Number(await hiddenPanel.evaluate((element) => getComputedStyle(element).zIndex)),
    )
    .toBeGreaterThan(
      Number(await scenePanel.evaluate((element) => getComputedStyle(element).zIndex)),
    )

  await sceneClose.click()
  await expect(scenePanel).toBeHidden()
  await expect(sceneController.locator('[data-panel-visibility]')).toHaveText('hidden')
  await expect(sceneItems).toHaveCount(sceneItemCount)
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      }),
  )
  await expect(page.locator('[data-scene-panel-rect]')).toHaveAttribute(
    'data-scene-panel-rect',
    'absent',
  )
  await expect(page.locator('[data-last-panel-close]')).toHaveAttribute(
    'data-last-panel-close',
    'scene-controls:hide',
  )

  await hiddenPanel.getByRole('button', { name: 'Close panel Initially Hidden' }).click()
  await expect(hiddenPanel).toHaveCount(0)
  await expect(hiddenController.locator('[data-panel-visibility]')).toHaveText('waiting')
  await expect(page.locator('[data-close-callback-portal-state]')).toHaveAttribute(
    'data-close-callback-portal-state',
    'removed',
  )
  await expect(page.locator('[data-last-panel-close]')).toHaveAttribute(
    'data-last-panel-close',
    'initially-hidden:deregister',
  )
})

test('routes the home, state lab, and unknown paths explicitly', async ({ page }) => {
  await page.goto('/')

  await expect(page.locator('main')).toHaveAttribute('data-product-route', 'home')
  await expect(page.locator('main')).toHaveCSS('overflow', 'hidden')
  await expect(page.locator('[data-interactive-jsx-example]')).toBeVisible()
  await expect(page.locator('[data-picodash-panel-id="built-in-items"]')).toBeVisible()

  await page.goto('/gallery/')

  await expect(page.locator('main')).toHaveAttribute('data-product-route', 'not-found')
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
  await expect(page.locator('[data-picodash-panel-id]')).toHaveCount(0)

  await page.goto('/state-lab')

  await expect(page.locator('main')).toHaveAttribute('data-product-route', 'state-lab')
  await expect(page.getByRole('heading', { name: 'Picodash State Lab' })).toBeVisible()
  await expect(page.locator('[data-picodash-panel-id="scene-controls"]')).toBeVisible()
  await expect(page.locator('[data-picodash-panel-id="built-in-items"]')).toBeVisible()
  await expect(page.locator('[data-picodash-panel-id="custom-items"]')).toBeVisible()

  await page.goto('/missing-product-page')

  await expect(page.locator('main')).toHaveAttribute('data-product-route', 'not-found')
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Page not found' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open home' })).toHaveAttribute('href', '/')
  await expect(page.locator('[data-picodash-panel-id]')).toHaveCount(0)
})

test('lets the desktop custom-items panel size itself to its content', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 })
  const panel = page.locator('[data-picodash-panel-id="custom-items"]')
  const group = panel.locator('[data-group-id="custom-examples"]')

  await expect(panel).toHaveCSS('top', '32px')
  await expect
    .poll(async () => {
      const [panelBox, groupBox] = await Promise.all([panel.boundingBox(), group.boundingBox()])
      return panelBox && groupBox ? Math.round(panelBox.height - groupBox.height) : null
    })
    .toBeLessThan(50)
})

test('retains invalid custom-item drafts and validates through a Zod Standard Schema', async ({
  page,
}) => {
  const input = page.locator('[data-validated-preset-name]')

  await expect(input).toHaveValue('Studio')
  await input.fill('x')
  await expect(input).toHaveValue('x')
  await expect(input).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByText('Preset name must contain at least 3 characters.')).toBeVisible()

  await input.fill('Gallery')
  await expect(input).toHaveValue('Gallery')
  await expect(input).toHaveAttribute('aria-invalid', 'false')
  await expect(page.getByText('Preset name must contain at least 3 characters.')).toHaveCount(0)
})

test('reviews repairable custom-item imports before committing them atomically', async ({
  page,
}) => {
  const panel = page.locator('[data-picodash-panel-id="custom-items"]')
  const input = panel.locator('[data-validated-preset-name]')
  const importInput = panel.locator('input[data-picodash-panel-import]')
  const trigger = panel.getByRole('button', { name: 'Open actions for Custom Items' })
  const repairFile = {
    buffer: Buffer.from('{"presetName":"x"}'),
    mimeType: 'application/json',
    name: 'repair.json',
  }

  await input.fill('Gallery')
  await importInput.setInputFiles(repairFile)

  const dialog = page.getByRole('alertdialog', { name: 'Review import for Custom Items' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'presetName' })).toBeVisible()
  await expect(dialog).toContainText('Studio')
  await dialog.getByRole('button', { name: 'Abort' }).click()
  await expect(input).toHaveValue('Gallery')
  await expect(trigger).toBeFocused()

  await importInput.setInputFiles(repairFile)
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(input).toHaveValue('Gallery')
  await expect(trigger).toBeFocused()

  await importInput.setInputFiles(repairFile)
  await dialog.getByRole('button', { name: 'Accept changes' }).click()
  await expect(input).toHaveValue('Studio')
  await expect(trigger).toBeFocused()
  await expect(panel.locator('span[role="status"]')).toHaveText(
    'Imported repaired panel values from repair.json.',
  )
})

test('dismisses only the topmost repair dialog on Escape', async ({ page }) => {
  const customPanel = page.locator('[data-picodash-panel-id="custom-items"]')
  const customImport = customPanel.locator('input[data-picodash-panel-import]')
  const builtInPanel = page.locator('[data-picodash-panel-id="built-in-items"]')
  const builtInImport = builtInPanel.locator('input[data-picodash-panel-import]')

  await customImport.setInputFiles({
    buffer: Buffer.from('{"presetName":"x"}'),
    mimeType: 'application/json',
    name: 'custom-repair.json',
  })
  const customDialog = page.getByRole('alertdialog', { name: 'Review import for Custom Items' })
  await expect(customDialog).toBeVisible()

  await builtInImport.setInputFiles({
    buffer: Buffer.from('{"text":42}'),
    mimeType: 'application/json',
    name: 'built-in-repair.json',
  })

  const dialogs = page.locator('[role="alertdialog"]')
  await expect(dialogs).toHaveCount(2)

  await page.keyboard.press('Escape')
  await expect(dialogs).toHaveCount(1)
  await expect(customDialog).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(dialogs).toHaveCount(0)
})

for (const scenario of [
  {
    expectedOrder: [
      'spatial-items',
      'common-items',
      'media-items',
      'chart-items',
      'visualization-items',
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
      'chart-items',
      'visualization-items',
    ],
    name: 'Common inputs over the third root item',
    sourceId: 'common-items',
    sourceLabel: 'Common inputs',
    targetId: 'media-items',
  },
] as const) {
  test(`previews and commits ${scenario.name} while all groups are collapsed`, async ({ page }) => {
    const panel = page.locator('[data-picodash-panel-id="built-in-items"]')
    const rootList = panel.locator('[data-picodash-reorder-list="root"]')

    await collapseCustomGroups(panel, Object.keys(builtInGroupLabels) as CustomGroupId[])
    expect(await itemOrder(rootList, 'root')).toEqual(initialBuiltInRootOrder)

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
    const panel = page.locator('[data-picodash-panel-id="built-in-items"]')
    const rootList = panel.locator('[data-picodash-reorder-list="root"]')

    await collapseCustomGroups(panel, [
      'common-items',
      'spatial-items',
      'chart-items',
      'visualization-items',
    ])
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
        'chart-items',
        'visualization-items',
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
  const panel = page.locator('[data-picodash-panel-id="built-in-items"]')
  const rootList = panel.locator('[data-picodash-reorder-list="root"]')

  await collapseCustomGroups(panel, ['common-items', 'chart-items', 'visualization-items'])
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
      'chart-items',
      'visualization-items',
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
  const panel = page.locator('[data-picodash-panel-id="built-in-items"]')
  const rootList = panel.locator('[data-picodash-reorder-list="root"]')

  await collapseCustomGroups(panel, Object.keys(builtInGroupLabels) as CustomGroupId[])
  await exerciseLivePreviewDrag({
    expectedOrder: [
      'spatial-items',
      'media-items',
      'common-items',
      'chart-items',
      'visualization-items',
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
  await common
    .getByRole('button', {
      name: builtInGroupLabels['common-items'],
      exact: true,
    })
    .click()
  await expect(common).toHaveAttribute('data-collapsed', 'false')
  await expect(common.locator('[data-picodash-reorder-list="common-items"]')).toBeVisible()

  await exerciseLivePreviewDrag({
    expectedOrder: initialBuiltInRootOrder,
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
  const panel = page.locator('[data-picodash-panel-id="built-in-items"]')
  const rootList = panel.locator('[data-picodash-reorder-list="root"]')

  await collapseCustomGroups(panel, [
    'common-items',
    'spatial-items',
    'chart-items',
    'visualization-items',
  ])
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
      { targetId: 'chart-items' },
      { targetId: 'spatial-items' },
      { targetId: 'common-items' },
    ],
  })
})

test('settles group disclosure changes before measuring a root drag', async ({ page }) => {
  const panel = page.locator('[data-picodash-panel-id="built-in-items"]')
  const rootList = panel.locator('[data-picodash-reorder-list="root"]')

  await collapseCustomGroups(panel, ['media-items'], { settle: false })

  await exerciseLivePreviewDrag({
    expectedOrder: [
      'spatial-items',
      'media-items',
      'common-items',
      'chart-items',
      'visualization-items',
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
    expectedOrder: [
      'multilineText',
      'number',
      'text',
      'switch',
      'select',
      'slider',
      'sliderMarks',
      'range',
      'segmented',
      'vector3',
      'alignment',
    ],
    name: 'downward',
    sourceId: 'text',
    sourceLabel: 'Text',
    targetId: 'number',
  },
  {
    expectedOrder: [
      'text',
      'multilineText',
      'number',
      'switch',
      'select',
      'slider',
      'sliderMarks',
      'segmented',
      'range',
      'vector3',
      'alignment',
    ],
    name: 'upward',
    sourceId: 'segmented',
    sourceLabel: 'Segmented',
    targetId: 'range',
  },
] as const) {
  test(`reorders grouped controls ${scenario.name} in one direction without changing root order`, async ({
    page,
  }) => {
    const panel = page.locator('[data-picodash-panel-id="built-in-items"]')
    const rootList = panel.locator('[data-picodash-reorder-list="root"]')
    const commonList = panel.locator('[data-picodash-reorder-list="common-items"]')

    await exerciseLivePreviewDrag({
      ...scenario,
      list: commonList,
      page,
      panel,
      parentId: 'common-items',
      unchangedOrder: {
        expected: initialBuiltInRootOrder,
        list: rootList,
        parentId: 'root',
      },
      verifyDirectionChange: false,
    })
  })
}

test('reorders an auto-grown Text textarea in both directions without losing its value or height', async ({
  page,
}) => {
  const panel = page.locator('[data-picodash-panel-id="built-in-items"]')
  const list = panel.locator('[data-picodash-reorder-list="common-items"]')
  const row = panel.locator('[data-item-id="multilineText"]')
  const textarea = row.getByRole('textbox')
  const initialOrder = [
    'text',
    'multilineText',
    'number',
    'switch',
    'select',
    'slider',
    'sliderMarks',
    'range',
    'segmented',
    'vector3',
    'alignment',
  ]
  const value = [
    'Auto-growing text',
    'keeps expanding',
    'through several lines',
    'before drag.',
  ].join('\n')
  const initialHeight = await textarea.evaluate((element) => element.getBoundingClientRect().height)

  await textarea.fill(value)
  await expect(textarea).toHaveValue(value)
  const grownHeight = await textarea.evaluate((element) => element.getBoundingClientRect().height)
  expect(grownHeight).toBeGreaterThan(initialHeight)

  await exerciseLivePreviewDrag({
    expectedOrder: [
      'text',
      'number',
      'multilineText',
      'switch',
      'select',
      'slider',
      'sliderMarks',
      'range',
      'segmented',
      'vector3',
      'alignment',
    ],
    list,
    page,
    panel,
    parentId: 'common-items',
    sourceId: 'multilineText',
    sourceLabel: 'Text',
    targetId: 'number',
    verifyDirectionChange: false,
  })
  await expect(textarea).toHaveValue(value)
  await expect
    .poll(() => textarea.evaluate((element) => element.getBoundingClientRect().height))
    .toBe(grownHeight)

  await exerciseLivePreviewDrag({
    expectedOrder: initialOrder,
    list,
    page,
    panel,
    parentId: 'common-items',
    sourceId: 'multilineText',
    sourceLabel: 'Text',
    targetId: 'number',
    verifyDirectionChange: false,
  })
  await expect(textarea).toHaveValue(value)
  await expect
    .poll(() => textarea.evaluate((element) => element.getBoundingClientRect().height))
    .toBe(grownHeight)
})

test('reverses a nested control across multiple siblings in both directions', async ({ page }) => {
  const panel = page.locator('[data-picodash-panel-id="scene-controls"]')
  const rootList = panel.locator('[data-picodash-reorder-list="root"]')
  const renderingList = panel.locator('[data-picodash-reorder-list="scene-rendering"]')

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

test('reorders root and nested items from the keyboard with commit and cancellation', async ({
  page,
}) => {
  const panel = page.locator('[data-picodash-panel-id="scene-controls"]')
  const rootList = panel.locator('[data-picodash-reorder-list="root"]')
  const renderingList = panel.locator('[data-picodash-reorder-list="scene-rendering"]')
  const builtInPanel = page.locator('[data-picodash-panel-id="built-in-items"]')
  const builtInRootList = builtInPanel.locator('[data-picodash-reorder-list="root"]')
  const qualityGrip = panel.getByRole('button', { name: 'Reorder Quality', exact: true })
  const mediaGrip = builtInPanel.getByRole('button', {
    name: 'Reorder Media and files',
    exact: true,
  })

  await qualityGrip.focus()
  await expect(qualityGrip).toHaveAttribute('aria-pressed', 'false')
  await qualityGrip.press('Enter')
  await expect(qualityGrip).toHaveAttribute('aria-pressed', 'true')
  await expect(panel.locator('[data-keyboard-reorder-status]')).toContainText('Quality picked up.')

  await qualityGrip.press('ArrowDown')
  await expect
    .poll(() => itemOrder(renderingList, 'scene-rendering'))
    .toEqual([
      'cameraHeight',
      'quality',
      'shadowSoftness',
      'maxBounces',
      'motionBlur',
      'textureQuality',
      'renderScale',
    ])
  await qualityGrip.press('Escape')
  await expect(qualityGrip).toHaveAttribute('aria-pressed', 'false')
  await expect
    .poll(() => itemOrder(renderingList, 'scene-rendering'))
    .toEqual([
      'quality',
      'cameraHeight',
      'shadowSoftness',
      'maxBounces',
      'motionBlur',
      'textureQuality',
      'renderScale',
    ])

  await mediaGrip.focus()
  await mediaGrip.press('Space')
  await mediaGrip.press('ArrowUp')
  await expect
    .poll(() => itemOrder(builtInRootList, 'root'))
    .toEqual(['common-items', 'media-items', 'spatial-items', 'chart-items', 'visualization-items'])
  await mediaGrip.press('Space')
  await expect(mediaGrip).toHaveAttribute('aria-pressed', 'false')
  await expect(builtInPanel.locator('[data-keyboard-reorder-status]')).toContainText(
    'Media and files dropped.',
  )

  await expect(panel.getByRole('button', { name: 'Reorder Rendering', exact: true })).toHaveCount(0)
  await expect(itemOrder(rootList, 'root')).resolves.toEqual([
    'scene-essentials',
    'scene-rendering',
    'scene-summary',
  ])

  const fixedGrip = builtInPanel
    .locator('[data-item-id="shadcn-frame-chart"]')
    .getByRole('button', { name: 'Reorder Chart', exact: true })
  await expect(fixedGrip).toHaveAttribute('aria-disabled', 'true')
  await fixedGrip.focus()
  await fixedGrip.press('Space')
  await expect(fixedGrip).toHaveAttribute('aria-pressed', 'false')
})

test('ignores a second keyboard pickup while a reorder session is active', async ({ page }) => {
  await page.goto('/')
  const panel = page.locator('[data-picodash-panel-id="built-in-items"]')
  const mediaGrip = panel.getByRole('button', {
    name: 'Reorder Media and files',
    exact: true,
  })
  const commonGrip = panel.getByRole('button', {
    name: 'Reorder Common inputs',
    exact: true,
  })
  const initialOrder = [
    'common-items',
    'spatial-items',
    'media-items',
    'chart-items',
    'visualization-items',
  ]

  await mediaGrip.press('Space')
  await mediaGrip.press('ArrowUp')
  await commonGrip.press('Space')

  await expect(mediaGrip).toHaveAttribute('aria-pressed', 'true')
  await expect(commonGrip).toHaveAttribute('aria-pressed', 'false')
  await mediaGrip.press('Escape')
  await expect.poll(() => builtInRootStoreOrder(page)).toEqual(initialOrder)
})

test('preserves an active keyboard reorder when the panel width changes', async ({ page }) => {
  await page.goto('/')
  const panel = page.locator('[data-picodash-panel-id="built-in-items"]')
  const mediaGrip = panel.getByRole('button', {
    name: 'Reorder Media and files',
    exact: true,
  })

  await mediaGrip.focus()
  await mediaGrip.press('Space')
  await panel.evaluate((element) => {
    element.style.width = '420px'
  })

  await expect(panel).toHaveCSS('width', '420px')
  await expect(mediaGrip).toBeFocused()
  await expect(mediaGrip).toHaveAttribute('aria-pressed', 'true')
  await mediaGrip.press('Escape')
})

test('blocks pointer pickup while a keyboard reorder session is active', async ({ page }) => {
  await page.goto('/')
  const panel = page.locator('[data-picodash-panel-id="built-in-items"]')
  const mediaGrip = panel.getByRole('button', {
    name: 'Reorder Media and files',
    exact: true,
  })
  const commonGroup = panel.locator('[data-group-id="common-items"]')
  const commonGrip = commonGroup.getByRole('button', {
    name: 'Reorder Common inputs',
    exact: true,
  })
  const initialOrder = [
    'common-items',
    'spatial-items',
    'media-items',
    'chart-items',
    'visualization-items',
  ]

  await mediaGrip.press('Space')
  await mediaGrip.press('ArrowUp')
  const gripRect = await requiredBox(commonGrip)
  await page.mouse.move(gripRect.x + gripRect.width / 2, gripRect.y + gripRect.height / 2)
  await page.mouse.down()
  await page.mouse.move(gripRect.x + gripRect.width / 2, gripRect.y + gripRect.height + 80, {
    steps: 4,
  })
  await expect.poll(() => builtInDraggingId(page)).toBeNull()
  await expect(commonGroup).toHaveAttribute('data-dragging', 'false')
  await page.mouse.up()

  await expect(mediaGrip).toHaveAttribute('aria-pressed', 'true')
  await mediaGrip.press('Escape')
  await expect.poll(() => builtInRootStoreOrder(page)).toEqual(initialOrder)
})

test('blocks keyboard pickup while a pointer reorder session is active', async ({ page }) => {
  await page.goto('/')
  const panel = page.locator('[data-picodash-panel-id="built-in-items"]')
  const commonGroup = panel.locator('[data-group-id="common-items"]')
  const commonGrip = commonGroup.getByRole('button', {
    name: 'Reorder Common inputs',
    exact: true,
  })
  const gripRect = await requiredBox(commonGrip)

  await page.mouse.move(gripRect.x + gripRect.width / 2, gripRect.y + gripRect.height / 2)
  await page.mouse.down()
  await page.mouse.move(gripRect.x + gripRect.width / 2, gripRect.y + gripRect.height + 80, {
    steps: 4,
  })
  await expect.poll(() => builtInDraggingId(page)).toBe('common-items')

  await commonGrip.press('Space')
  await expect(commonGrip).toHaveAttribute('aria-pressed', 'false')
  await page.mouse.up()
})

test('keeps keyboard and pointer reorder sessions exclusive across nested lists', async ({
  page,
}) => {
  await page.goto('/')
  const panel = page.locator('[data-picodash-panel-id="built-in-items"]')
  const mediaGrip = panel.getByRole('button', {
    name: 'Reorder Media and files',
    exact: true,
  })
  const textItem = panel.locator('[data-item-id="text"]')
  const textGrip = textItem.getByRole('button', {
    name: 'Reorder Text',
    exact: true,
  })
  const initialOrder = [
    'common-items',
    'spatial-items',
    'media-items',
    'chart-items',
    'visualization-items',
  ]

  await mediaGrip.press('Space')
  await mediaGrip.press('ArrowUp')
  await textGrip.press('Space')
  await expect(textGrip).toHaveAttribute('aria-pressed', 'false')

  const gripRect = await requiredBox(textGrip)
  await page.mouse.move(gripRect.x + gripRect.width / 2, gripRect.y + gripRect.height / 2)
  await page.mouse.down()
  await page.mouse.move(gripRect.x + gripRect.width / 2, gripRect.y + gripRect.height + 80, {
    steps: 4,
  })
  await expect.poll(() => builtInDraggingId(page)).toBeNull()
  await page.mouse.up()

  await mediaGrip.press('Escape')
  await expect.poll(() => builtInRootStoreOrder(page)).toEqual(initialOrder)
})

test('keyboard reordering preserves hidden root slots on commit and cancellation', async ({
  page,
}) => {
  await page.goto('/')
  const panel = page.locator('[data-picodash-panel-id="built-in-items"]')
  const mediaGrip = panel.getByRole('button', {
    name: 'Reorder Media and files',
    exact: true,
  })
  const example = page.locator('[data-interactive-jsx-example]')
  const initialOrder = [
    'common-items',
    'spatial-items',
    'media-items',
    'chart-items',
    'visualization-items',
  ]

  await example.getByRole('checkbox', { name: 'Show all props' }).check()
  await example.getByLabel('Visible for spatial-items').click()
  await expect(panel.locator('[data-group-id="spatial-items"]')).toHaveCount(0)
  await mediaGrip.press('Space')
  await mediaGrip.press('ArrowUp')
  await mediaGrip.press('Escape')
  await expect.poll(() => builtInRootStoreOrder(page)).toEqual(initialOrder)

  await mediaGrip.press('Space')
  await mediaGrip.press('ArrowUp')
  await mediaGrip.press('Space')
  await expect
    .poll(() => builtInRootStoreOrder(page))
    .toEqual(['media-items', 'spatial-items', 'common-items', 'chart-items', 'visualization-items'])
})

test('allows an active keyboard reorder to cancel after its siblings become hidden', async ({
  page,
}) => {
  await page.goto('/')
  const panel = page.locator('[data-picodash-panel-id="built-in-items"]')
  const mediaGrip = panel.getByRole('button', {
    name: 'Reorder Media and files',
    exact: true,
  })
  const example = page.locator('[data-interactive-jsx-example]')

  await mediaGrip.press('Space')
  await expect(mediaGrip).toHaveAttribute('aria-pressed', 'true')
  await example.getByRole('checkbox', { name: 'Show all props' }).check()
  for (const groupId of ['common-items', 'spatial-items', 'chart-items', 'visualization-items']) {
    await example.getByLabel(`Visible for ${groupId}`).click()
    await expect(panel.locator(`[data-group-id="${groupId}"]`)).toHaveCount(0)
  }
  await expect(mediaGrip).toHaveAttribute('aria-disabled', 'true')

  await mediaGrip.press('Escape')
  await expect(mediaGrip).toHaveCount(0)
  await expect(panel.locator('[data-keyboard-reorder-status]')).toContainText(
    'Media and files reorder cancelled.',
  )
})

test('rolls back an active keyboard reorder when the picked-up item becomes hidden', async ({
  page,
}) => {
  await page.goto('/')
  const panel = page.locator('[data-picodash-panel-id="built-in-items"]')
  const example = page.locator('[data-interactive-jsx-example]')
  const mediaGrip = panel.getByRole('button', {
    name: 'Reorder Media and files',
    exact: true,
  })

  await example.getByRole('checkbox', { name: 'Show all props' }).check()
  await mediaGrip.press('Space')
  await mediaGrip.press('ArrowUp')
  await example.getByLabel('Visible for media-items').click()
  await expect(panel.locator('[data-group-id="media-items"]')).toHaveCount(0)
  await expect
    .poll(() => builtInRootStoreOrder(page))
    .toEqual(['common-items', 'spatial-items', 'media-items', 'chart-items', 'visualization-items'])
})

test('avoids Camera height before Quality covers it and retains avoidance on a 1px reversal', async ({
  page,
}) => {
  const panel = page.locator('[data-picodash-panel-id="scene-controls"]')
  const list = panel.locator('[data-picodash-reorder-list="scene-rendering"]')
  const quality = panel.locator('[data-item-id="quality"]')
  const cameraHeight = panel.locator('[data-item-id="cameraHeight"]')
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
    const panel = page.locator('[data-picodash-panel-id="scene-controls"]')
    const list = panel.locator('[data-picodash-reorder-list="root"]')
    const essentials = panel.locator('[data-group-id="scene-essentials"]')
    const rendering = panel.locator('[data-group-id="scene-rendering"]')
    const summary = panel.locator('[data-item-id="scene-summary"]')

    if (collapsed) {
      await essentials.getByRole('button', { name: 'Essentials', exact: true }).click()
      await rendering.getByRole('button', { name: 'Rendering', exact: true }).click()
      await expect(essentials).toHaveAttribute('data-collapsed', 'true')
      await expect(rendering).toHaveAttribute('data-collapsed', 'true')
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
  const child = page.locator('[data-item-id="quality"]')
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
  const firstRow = group.locator('[data-item-id="opacity"]')
  const lastRow = group.locator('[data-item-id="bloom"]')
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
  const draggedControl = page.locator('[data-item-id="quality"]')
  const idleControl = page.locator('[data-item-id="cameraHeight"]')
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

  const draggedGripBox = await requiredBox(draggedGrip)

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
  const fixedControl = page.locator('[data-item-id="shadcn-frame-chart"]')
  const fixedSlot = fixedControl.getByRole('button', {
    name: 'Reorder Chart',
    exact: true,
  })
  const reorderableControl = page.locator('[data-item-id="quality"]')
  const reorderableSlot = reorderableControl.getByRole('button', {
    name: 'Reorder Quality',
    exact: true,
  })

  await expect(fixedControl).toHaveAttribute('data-reorderable', 'false')
  await expect(fixedControl).toHaveCSS('padding-left', '0px')
  await expect(fixedSlot).toHaveAttribute('aria-disabled', 'true')
  await expect(fixedSlot.locator('[data-picodash-reorder-indicator="static"]')).toHaveCount(1)
  await expect(fixedSlot.locator('svg')).toHaveCount(0)

  await expect(reorderableControl).toHaveAttribute('data-reorderable', 'true')
  await expect(reorderableSlot).toHaveAttribute('aria-disabled', 'false')
  await expect(reorderableSlot.locator('[data-picodash-reorder-indicator="grip"]')).toHaveCount(1)
  await expect(reorderableSlot.locator('svg')).toHaveCount(1)
})

test('keeps the portaled Select interactive without blocking the surrounding page', async ({
  page,
}) => {
  await page.setViewportSize({ width: 640, height: 480 })
  const quality = page.locator('[data-item-id="quality"]')
  const trigger = quality.locator('[aria-haspopup="listbox"]')

  await trigger.scrollIntoViewIfNeeded()
  await trigger.focus()
  await trigger.press('Enter')

  const content = page.locator('[data-picodash-theme="dark"][data-placement]')
  await expect(content).toBeVisible()
  await expect(content).toHaveAttribute('data-picodash-theme', 'dark')
  await expect(content).toHaveCSS('pointer-events', 'auto')
  await expect(page.locator('[data-picodash-container]')).toHaveCSS('pointer-events', 'none')
  const finalOption = page.getByRole('option', { name: 'Final' })
  await expect(finalOption).toBeVisible()

  const contentBox = await requiredBox(content)
  expect(contentBox.x).toBeGreaterThanOrEqual(0)
  expect(contentBox.y).toBeGreaterThanOrEqual(0)
  expect(contentBox.x + contentBox.width).toBeLessThanOrEqual(640)
  expect(contentBox.y + contentBox.height).toBeLessThanOrEqual(480)

  await finalOption.click()
  await expect(trigger).toHaveText('Final')
  await expect(page.getByText(/72% opacity \/ final/i)).toBeVisible()
  await expect(trigger).toBeFocused()

  await trigger.press('Enter')
  await page.keyboard.press('ArrowUp')
  const balancedOption = page.getByRole('option', { name: 'Balanced' })
  await expect(balancedOption).toHaveAttribute('data-focused', 'true')
  await balancedOption.press('Enter')
  await expect(trigger).toHaveText('Balanced')
  await expect(page.getByText(/72% opacity \/ balanced/i)).toBeVisible()
})

test('keeps panel typography and dropzone geometry at the baseline', async ({ page }) => {
  const alignment = page.locator('[data-item-id="alignment"]')
  const alignmentLabel = alignment.locator('label')
  const qualityTrigger = page.locator('[data-item-id="quality"] [aria-haspopup="listbox"]')
  const helpButton = alignment.getByRole('button', { name: 'Help for Matrix2D' })
  const dropSurface = page
    .locator('[data-item-id="droppedFiles"]')
    .getByRole('button', { name: 'Choose files or drop them here' })

  await expect(alignmentLabel).toHaveCSS('font-size', '12px')
  await expect(alignmentLabel).toHaveCSS('line-height', '13.2px')
  await expect(qualityTrigger).toHaveCSS('font-size', '12px')
  await expect(qualityTrigger).toHaveCSS('line-height', '13.2px')
  await expect(helpButton).toHaveCSS('font-size', '14px')
  await expect(helpButton).toHaveCSS('line-height', '17.5px')
  await expect(dropSurface).toHaveCSS('height', '96px')
})

test('fits Scene Controls without a default vertical scrollbar', async ({ page }) => {
  const body = page.locator(
    '[data-picodash-panel-id="scene-controls"] [data-picodash-reorder-list="root"]',
  )

  await expect
    .poll(() => body.evaluate((element) => element.scrollHeight - element.clientHeight))
    .toBeLessThanOrEqual(0)
})

test('updates common, spatial, and gradient values through accessible controls', async ({
  page,
}) => {
  const groupToggle = page.getByRole('button', { name: 'Common inputs', exact: true })
  await expect(groupToggle).toHaveAttribute('aria-expanded', 'true')
  await expect(groupToggle).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')

  const switchItem = page.locator('[data-item-id="switch"]')
  const switchInput = switchItem.getByRole('switch')
  await switchItem.locator('[id="switch:label"]').click()
  await expect(switchInput).toBeFocused()

  const range = page.locator('[data-item-id="range"]')
  const lowerThumb = range.getByRole('slider', { name: 'Lower value' })
  await range.locator('[id="range:label"]').click()
  await expect(lowerThumb).toBeFocused()

  const segmented = page.locator('[data-item-id="segmented"]')
  const balancedSegment = segmented.getByRole('radio', { name: 'Balanced' })
  const openSegment = segmented.getByRole('radio', { name: 'Open' })
  const tightSegment = segmented.getByRole('radio', { name: 'Tight' })
  await segmented.locator('[id="segmented:label"]').click()
  await expect(balancedSegment).toBeFocused()
  await openSegment.click()
  await expect(openSegment).toHaveAttribute('data-selected', 'true')
  await expect
    .poll(async () => {
      const [selectedBackground, unselectedBackground] = await Promise.all([
        openSegment.evaluate((element) => getComputedStyle(element).backgroundColor),
        tightSegment.evaluate((element) => getComputedStyle(element).backgroundColor),
      ])
      return selectedBackground === unselectedBackground
    })
    .toBe(false)

  const alignment = page.locator('[data-item-id="alignment"]')
  await alignment.getByRole('radio', { name: 'Bottom right' }).click()
  await expect(alignment.getByRole('radio', { name: 'Bottom right' })).toHaveAttribute(
    'data-state',
    'on',
  )
  const middleCenter = alignment.getByRole('radio', { name: 'Middle center', exact: true })
  const middleRight = alignment.getByRole('radio', { name: 'Middle right' })
  await middleCenter.click()
  await middleCenter.press('ArrowRight')
  await expect(middleCenter).toHaveAttribute('aria-checked', 'false')
  await expect(middleRight).toHaveAttribute('aria-checked', 'true')

  const vector = page.locator('[data-item-id="vector3"]')
  await vector.getByRole('spinbutton', { name: 'X axis' }).fill('4.5')
  await expect(vector.getByRole('spinbutton', { name: 'X axis' })).toHaveValue('4.5')

  await lowerThumb.focus()
  await lowerThumb.press('ArrowRight')
  await expect(lowerThumb).toHaveValue('25')

  const xy = page.locator('[data-item-id="xyPad"]')
  const xyPad = xy.getByRole('group', { name: 'Two-dimensional value' })
  await xyPad.scrollIntoViewIfNeeded()
  const box = await requiredBox(xyPad)
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

  const gradient = page.locator('[data-item-id="gradient"]')
  const gradientTrack = gradient.locator('[id="gradient:input"]')
  await expect(gradient).toContainText('Gradient')
  await expect(gradientTrack).toHaveAttribute('style', /linear-gradient\(to right/)
  await expect(gradient).not.toContainText('Rotation')
  await expect(
    gradient.getByText('Drag stops or use arrow keys. Double-click the gradient to add a stop.', {
      exact: true,
    }),
  ).toBeVisible()
  const gradientStops = gradient.getByRole('slider', { name: /Gradient stop at/ })
  const rotation = gradient.getByRole('slider', { name: 'Gradient rotation' })
  await expect(gradientStops).toHaveCount(3)
  await expect(rotation).toHaveValue('135')
  await expect(rotation).toHaveAttribute('max', '359')
  await expect(gradient.getByText('0', { exact: true })).toBeVisible()
  await expect(gradient.getByText('359', { exact: true })).toBeVisible()
  await rotation.focus()
  await rotation.press('ArrowRight')
  await expect(rotation).toHaveValue('136')
  await expect(page.locator('[data-demo-background]')).toHaveAttribute(
    'style',
    /linear-gradient\(136deg/,
  )
  await expect(gradientTrack).toHaveAttribute('style', /linear-gradient\(to right/)
  await gradientTrack.dblclick({ position: { x: 120, y: 18 } })
  await expect(gradientStops).toHaveCount(4)
})

test('renders safe media, serializable drop metadata, and a Recharts SVG', async ({ page }) => {
  const preview = page.locator('[data-item-id="previewAsset"]')
  await expect(preview.getByRole('img', { name: 'Picodash mark' })).toHaveAttribute(
    'src',
    /favicon\.svg$/,
  )

  const dropzone = page.locator('[data-item-id="droppedFiles"]')
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
  const imageDialog = page.getByRole('dialog')
  await expect(imageDialog).toBeVisible()
  const imageDescriptionId = await imageDialog.getAttribute('aria-describedby')
  expect(imageDescriptionId).toBeTruthy()
  await expect(page.locator(`[id="${imageDescriptionId}"]`)).toHaveText('19 B')
  await expect(page.getByRole('img', { name: 'sample.png' })).toBeVisible()
  await page.locator('[data-slot="dialog-overlay"]').click({ position: { x: 8, y: 8 } })
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(dropzone.getByRole('button', { name: 'View sample.png' })).toBeFocused()

  await dropzone.getByRole('button', { name: 'View sample.png' }).click()
  await page.getByRole('button', { name: 'Close image viewer' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(dropzone.getByRole('button', { name: 'View sample.png' })).toBeFocused()

  const chart = page.locator('[data-item-id="shadcn-frame-chart"]')
  await expect(chart.locator('svg.recharts-surface')).toBeVisible()
  await expect(chart.locator('.recharts-line-curve')).toHaveCount(2)
  const yAxisTicks = chart.locator(
    '.recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value',
  )
  await expect(yAxisTicks).toHaveText(['0', '5', '10', '15', '20'])
  const chartBox = await requiredBox(chart.locator('svg.recharts-surface'))
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
})

test('applies simultaneous named themes to panels and every portaled surface', async ({ page }) => {
  await page.goto('/state-lab?providerTheme=ocean&customTheme=plum')

  const scenePanel = page.locator('[data-picodash-panel-id="scene-controls"]')
  const customPanel = page.locator('[data-picodash-panel-id="custom-items"]')
  const builtInPanel = page.locator('[data-picodash-panel-id="built-in-items"]')
  await expect(page.locator('[data-picodash-container]')).toHaveAttribute(
    'data-picodash-theme',
    'ocean',
  )
  await expect(scenePanel).toHaveAttribute('data-picodash-theme', 'ocean')
  await expect(builtInPanel).toHaveAttribute('data-picodash-theme', 'ocean')
  await expect(customPanel).toHaveAttribute('data-picodash-theme', 'plum')
  await expect(scenePanel).toHaveCSS('background-color', 'rgb(7, 38, 52)')
  await expect(builtInPanel).toHaveCSS('background-color', /0\.72/)
  await expect(customPanel).toHaveCSS('background-color', 'rgb(54, 19, 62)')

  const alignment = builtInPanel.locator('[data-item-id="alignment"]')
  await expect(alignment.getByRole('radio', { name: 'Middle center', exact: true })).toHaveCSS(
    'background-color',
    'rgb(61, 214, 230)',
  )
  await expect(alignment.getByRole('radiogroup')).toHaveCSS('border-radius', '6px')

  const qualityTrigger = page.locator('[data-item-id="quality"] [aria-haspopup="listbox"]')
  await expect(qualityTrigger).toHaveCSS('border-bottom-color', 'rgb(91, 158, 171)')
  await qualityTrigger.click()
  const selectContent = page.locator('[data-picodash-theme="ocean"][data-placement]')
  await expect(selectContent).toHaveCSS('background-color', 'rgb(11, 55, 72)')
  await expect(selectContent).toHaveCSS('border-radius', '8px')
  const finalOption = page.getByRole('option', { name: 'Final' })
  await finalOption.hover()
  await expect(finalOption).toHaveCSS('background-color', 'rgb(17, 78, 96)')
  await page.keyboard.press('Escape')

  await page.mouse.move(0, 0)
  await alignment.getByRole('button', { name: 'Help for Matrix2D' }).hover()
  await expect(page.getByRole('tooltip')).toBeVisible()
  const tooltip = page.locator('[data-picodash-theme="ocean"][data-placement]')
  await expect(tooltip).toHaveCSS('background-color', 'rgb(11, 55, 72)')
  await expect(tooltip).toHaveCSS('border-radius', '8px')

  const dropzone = builtInPanel.locator('[data-item-id="droppedFiles"]')
  await dropzone.locator('input[type="file"]').setInputFiles({
    name: 'themed.png',
    mimeType: 'image/png',
    buffer: Buffer.from('themed image metadata'),
  })
  const previewButton = dropzone.getByRole('button', { name: 'View themed.png' })
  await previewButton.click()
  const viewer = page.getByRole('dialog')
  await expect(viewer).toHaveAttribute('data-picodash-theme', 'ocean')
  await expect(viewer.locator('figure')).toHaveCSS('border-radius', '8px')
  await page.keyboard.press('Escape')

  const customActions = customPanel.getByRole('button', { name: 'Open actions for Custom Items' })
  await customActions.click()
  const menu = page.getByRole('menu', { name: 'Actions for Custom Items' })
  await expect(menu).toHaveAttribute('data-picodash-theme', 'plum')
  const copySubmenuTrigger = menu.getByRole('menuitem', { name: 'Copy' })
  await copySubmenuTrigger.focus()
  await copySubmenuTrigger.press('ArrowRight')
  const themedMenus = page.locator('[data-picodash-theme="plum"][role="menu"]')
  await expect(themedMenus).toHaveCount(2)
  await expect(themedMenus.nth(1)).toHaveCSS('pointer-events', 'auto')
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')
  await customActions.click()
  await menu.getByRole('menuitem', { name: 'Reset…' }).click()
  const dialog = page.getByRole('alertdialog', { name: 'Reset Custom Items?' })
  await expect(dialog).toHaveAttribute('data-picodash-theme', 'plum')
  await expect(
    page.locator('[data-picodash-theme="plum"][data-slot="alert-dialog-overlay"]'),
  ).toHaveCount(1)
  await dialog.getByRole('button', { name: 'Cancel' }).click()
})

test('updates inherited panel themes at runtime while preserving explicit overrides', async ({
  page,
}) => {
  await changeDemoThemes(page, { custom: 'plum' })

  const scenePanel = page.locator('[data-picodash-panel-id="scene-controls"]')
  const customPanel = page.locator('[data-picodash-panel-id="custom-items"]')
  await expect(scenePanel).toHaveAttribute('data-picodash-theme', 'dark')
  await expect(customPanel).toHaveAttribute('data-picodash-theme', 'plum')

  await changeDemoThemes(page, { provider: 'ocean' })

  await expect(page.locator('[data-demo-provider-theme]')).toHaveAttribute(
    'data-demo-provider-theme',
    'ocean',
  )
  await expect(scenePanel).toHaveAttribute('data-picodash-theme', 'ocean')
  await expect(customPanel).toHaveAttribute('data-picodash-theme', 'plum')

  await changeDemoThemes(page, { custom: null })
  await expect(customPanel).toHaveAttribute('data-picodash-theme', 'ocean')
})

test('animates transient visual paths and switches deterministic signal mode', async ({ page }) => {
  const velocity = page.locator('[data-item-id="mouse-velocity"]')
  const display = velocity.locator('[data-pointer-velocity-display]')
  const description = velocity.getByText('Move anywhere in the full viewport.', { exact: false })
  const velocityXPath = velocity.locator('path.stroke-chart-1')
  const velocityYPath = velocity.locator('path.stroke-chart-3')
  const fps = velocity.locator('[data-pointer-velocity-fps]')
  await display.scrollIntoViewIfNeeded()
  await expect(display).toBeVisible()
  await expect(display).toHaveCSS('pointer-events', 'none')
  await expect(fps).toHaveText(/^\d+ FPS$/)
  const displayBox = await requiredBox(display)
  const descriptionBox = await requiredBox(description)
  const fpsBox = await requiredBox(fps)
  expect(descriptionBox.y).toBeGreaterThanOrEqual(displayBox.y + displayBox.height)
  const rightGap = displayBox.x + displayBox.width - (fpsBox.x + fpsBox.width)
  const bottomGap = displayBox.y + displayBox.height - (fpsBox.y + fpsBox.height)
  expect(fpsBox.x).toBeGreaterThan(displayBox.x + displayBox.width / 2)
  expect(rightGap).toBeGreaterThanOrEqual(0)
  expect(rightGap).toBeLessThanOrEqual(12)
  expect(bottomGap).toBeGreaterThanOrEqual(0)
  expect(bottomGap).toBeLessThanOrEqual(12)
  const initialVelocityXPath = await velocityXPath.getAttribute('d')
  const initialVelocityYPath = await velocityYPath.getAttribute('d')
  const headingBox = await requiredBox(page.getByRole('heading', { name: 'Picodash State Lab' }))

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

  await display.evaluate((element: HTMLElement) => (element.style.display = 'none'))
  await expect(display).toBeHidden()
  await expect(fps).toHaveText('0 FPS')
  const pausedVelocityXPath = await velocityXPath.getAttribute('d')

  // Restoring the observed surface avoids producing another pointer sample.
  // Re-entry should resume the retained trace until it naturally settles again.
  await display.evaluate((element: HTMLElement) => element.style.removeProperty('display'))
  await expect(display).toBeVisible()
  await expect.poll(() => velocityXPath.getAttribute('d')).not.toBe(pausedVelocityXPath)
  await expect
    .poll(async () => Number.parseInt((await fps.textContent()) ?? '0', 10), {
      intervals: [50],
    })
    .toBeGreaterThan(0)
  await expect(fps).toHaveText('0 FPS')

  const signal = page.locator('[data-item-id="signal-visualizer"]')
  const signalPath = signal.locator('path.stroke-chart-2')
  const initialSignalPath = await signalPath.getAttribute('d')
  await signal.getByRole('radio', { name: 'Show spectrum' }).click()
  await expect(signal.getByRole('radio', { name: 'Show spectrum' })).toHaveAttribute(
    'data-selected',
    'true',
  )
  await expect(signal.getByRole('img', { name: 'Synthetic signal spectrum' })).toBeVisible()
  await expect.poll(() => signalPath.getAttribute('d')).not.toBe(initialSignalPath)
  await expect(signalPath).toHaveAttribute('fill-opacity', '0.18')
})

test('resumes pointer velocity decay when document visibility returns', async ({ page }) => {
  const velocity = page.locator('[data-item-id="mouse-velocity"]')
  const display = velocity.locator('[data-pointer-velocity-display]')
  const velocityXPath = velocity.locator('path.stroke-chart-1')
  const fps = velocity.locator('[data-pointer-velocity-fps]')
  await display.scrollIntoViewIfNeeded()
  await expect(display).toBeVisible()

  const initialVelocityXPath = await velocityXPath.getAttribute('d')
  const headingBox = await requiredBox(page.getByRole('heading', { name: 'Picodash State Lab' }))

  await page.mouse.move(headingBox.x + 4, headingBox.y + 4)
  await page.mouse.move(
    headingBox.x + headingBox.width - 4,
    headingBox.y + headingBox.height + 80,
    { steps: 8 },
  )
  await expect.poll(() => velocityXPath.getAttribute('d')).not.toBe(initialVelocityXPath)

  await setDocumentVisibility(page, 'hidden')
  await expect(fps).toHaveText('0 FPS')
  const pausedVelocityXPath = await velocityXPath.getAttribute('d')
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  )
  expect(await velocityXPath.getAttribute('d')).toBe(pausedVelocityXPath)

  await setDocumentVisibility(page, 'visible')
  await expect.poll(() => velocityXPath.getAttribute('d')).not.toBe(pausedVelocityXPath)
  await expect
    .poll(async () => Number.parseInt((await fps.textContent()) ?? '0', 10), {
      intervals: [50],
    })
    .toBeGreaterThan(0)
  await expect(fps).toHaveText('0 FPS')
})

test('supports keyboard typeahead across panel actions and format submenus', async ({ page }) => {
  const panel = page.locator('[data-picodash-panel-id="scene-controls"]')
  const trigger = panel.getByRole('button', { name: 'Open actions for Scene Controls' })
  const menu = page.getByRole('menu', { name: 'Actions for Scene Controls' })

  await trigger.click()
  await menu.focus()
  await page.keyboard.type('import')
  await expect(menu.getByRole('menuitem', { name: 'Import…' })).toBeFocused()
  await page.keyboard.press('Escape')

  await trigger.click()
  await menu.focus()
  await page.keyboard.type('copy')
  const copyTrigger = menu.getByRole('menuitem', { name: 'Copy' })
  await expect(copyTrigger).toBeFocused()
  await page.keyboard.press('ArrowRight')

  const copyMenu = page.getByRole('menu').nth(1)
  await expect(copyMenu).toBeVisible()
  const copyJson = copyMenu.getByRole('menuitem', { name: 'Copy JSON' })
  await copyMenu.focus()
  await page.keyboard.press('c')
  await expect(copyJson).toHaveAttribute('data-focused', 'true')
  await page.keyboard.press('Escape')
  await page.keyboard.press('Escape')

  await trigger.click()
  await menu.focus()
  await page.keyboard.type('export')
  await expect(menu.getByRole('menuitem', { name: 'Export' })).toBeFocused()
})

test('keeps tall panel action menus scrollable within the available viewport height', async ({
  page,
}) => {
  await page.setViewportSize({ width: 640, height: 240 })
  await page
    .locator('[data-picodash-panel-id="custom-items"]')
    .evaluate((element: HTMLElement) => (element.style.display = 'none'))
  await page
    .locator('[data-picodash-panel-id="built-in-items"]')
    .evaluate((element: HTMLElement) => (element.style.display = 'none'))

  const panel = page.locator('[data-picodash-panel-id="scene-controls"]')
  await panel.getByRole('button', { name: 'Open actions for Scene Controls' }).click()

  const menu = page.getByRole('menu', { name: 'Actions for Scene Controls' })
  const popover = page.locator('[data-slot="dropdown-menu-content"]', { has: menu })
  await expect(menu).toBeVisible()
  await expect(popover).toHaveCSS('overflow-y', 'auto')

  const metrics = await popover.evaluate((element) => ({
    clientHeight: element.clientHeight,
    maxHeight: getComputedStyle(element).maxHeight,
    scrollHeight: element.scrollHeight,
  }))
  expect(metrics.maxHeight).not.toBe('none')
  expect(metrics.clientHeight).toBeLessThan(metrics.scrollHeight)

  const popoverBox = await requiredBox(popover)
  expect(popoverBox.y).toBeGreaterThanOrEqual(0)
  expect(popoverBox.y + popoverBox.height).toBeLessThanOrEqual(240)
})

test('keeps the panel action menu contained and manages collapsible groups', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 480 })
  await page
    .locator('[data-picodash-panel-id="custom-items"]')
    .evaluate((element: HTMLElement) => (element.style.display = 'none'))
  await page
    .locator('[data-picodash-panel-id="built-in-items"]')
    .evaluate((element: HTMLElement) => (element.style.display = 'none'))
  const panel = page.locator('[data-picodash-panel-id="scene-controls"]')
  const trigger = panel.getByRole('button', { name: 'Open actions for Scene Controls' })
  const essentials = panel.locator('[data-group-id="scene-essentials"]')
  const rendering = panel.locator('[data-group-id="scene-rendering"]')
  const panelTransform = await panel.evaluate((element) => getComputedStyle(element).transform)

  const triggerBox = await requiredBox(trigger)
  await page.mouse.move(triggerBox.x + triggerBox.width / 2, triggerBox.y + triggerBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(triggerBox.x - 80, triggerBox.y + 60, { steps: 4 })
  await page.mouse.up()
  await page.keyboard.press('Escape')
  await expect
    .poll(() => panel.evaluate((element) => getComputedStyle(element).transform))
    .toBe(panelTransform)

  await trigger.click()
  const menu = page.getByRole('menu', { name: 'Actions for Scene Controls' })
  await expect(menu).toBeVisible()
  await expect(menu).toHaveAttribute('data-picodash-theme', 'dark')
  await expect(menu).toHaveCSS('pointer-events', 'auto')
  await expect(page.locator('[data-picodash-container]')).toHaveCSS('pointer-events', 'none')
  const menuBox = await requiredBox(menu)
  expect(menuBox.x).toBeGreaterThanOrEqual(0)
  expect(menuBox.y).toBeGreaterThanOrEqual(0)
  expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(640)
  expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(480)

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
    .locator('[data-picodash-panel-id="custom-items"]')
    .evaluate((element: HTMLElement) => (element.style.display = 'none'))
  await page
    .locator('[data-picodash-panel-id="built-in-items"]')
    .evaluate((element: HTMLElement) => (element.style.display = 'none'))
  const panel = page.locator('[data-picodash-panel-id="scene-controls"]')
  const trigger = panel.getByRole('button', { name: 'Open actions for Scene Controls' })
  const quality = panel.locator('[data-item-id="quality"] [aria-haspopup="listbox"]')
  const rendering = panel.locator('[data-group-id="scene-rendering"]')

  await quality.click()
  await page.getByRole('option', { name: 'Final' }).click()
  await rendering.getByRole('button', { name: 'Rendering', exact: true }).click()
  await expect(rendering).toHaveAttribute('data-collapsed', 'true')

  await trigger.click()
  await page.getByRole('menuitem', { name: 'Reset…' }).click()
  const dialog = page.getByRole('alertdialog', { name: 'Reset Scene Controls?' })
  await expect(dialog).toHaveAttribute('data-picodash-theme', 'dark')
  const resetDescriptionId = await dialog.getAttribute('aria-describedby')
  expect(resetDescriptionId).toBeTruthy()
  await expect(page.locator(`[id="${resetDescriptionId}"]`)).toContainText(
    'This restores every registered field to its default value.',
  )
  const dialogBox = await requiredBox(dialog)
  expect(dialogBox.x).toBeGreaterThanOrEqual(0)
  expect(dialogBox.y).toBeGreaterThanOrEqual(0)
  expect(dialogBox.x + dialogBox.width).toBeLessThanOrEqual(640)
  expect(dialogBox.y + dialogBox.height).toBeLessThanOrEqual(480)
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
  const panel = page.locator('[data-picodash-panel-id="scene-controls"]')
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
  expect(JSON.parse(await readFile(jsonPath!, 'utf8'))).toMatchObject({ quality: 'balanced' })

  await openActionSubmenu(page, trigger, 'Export')
  const [yamlDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('menuitem', { name: 'Export YAML' }).click(),
  ])
  expect(yamlDownload.suggestedFilename()).toBe('scene-controls.yaml')
  const yamlPath = await yamlDownload.path()
  expect(yamlPath).not.toBeNull()
  expect(await readFile(yamlPath!, 'utf8')).toContain('quality: balanced')
})

test('imports JSON and YAML atomically and reports invalid files without mutation', async ({
  page,
}) => {
  const panel = page.locator('[data-picodash-panel-id="scene-controls"]')
  const trigger = panel.getByRole('button', { name: 'Open actions for Scene Controls' })
  const status = panel.locator('span[role="status"]')
  const summary = page.locator('[data-item-id="scene-summary"]')

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

  await panel.locator('[data-item-id="quality"] [aria-haspopup="listbox"]').click()
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
  await submenuTrigger.focus()
  await submenuTrigger.press('ArrowRight')
  await expect(page.getByRole('menu')).toHaveCount(2)
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

type CustomGroupId = keyof typeof builtInGroupLabels

async function collapseCustomGroups(
  panel: import('@playwright/test').Locator,
  groupIds: CustomGroupId[],
  { settle = true }: { settle?: boolean } = {},
) {
  for (const groupId of groupIds) {
    const group = panel.locator(`[data-group-id="${groupId}"]`)
    await group
      .getByRole('button', { name: builtInGroupLabels[groupId], exact: true })
      .evaluate((button: HTMLButtonElement) => button.click())
    await expect(group).toHaveAttribute('data-collapsed', 'true')
  }

  if (settle) {
    let lastHeight = -1
    await expect
      .poll(
        async () => {
          const height = await panel.evaluate((el: HTMLElement) => el.offsetHeight)
          const stable = height === lastHeight
          lastHeight = height
          return stable
        },
        { timeout: 1000, intervals: [50] },
      )
      .toBe(true)
  }
}

async function setDocumentVisibility(
  page: import('@playwright/test').Page,
  visibilityState: DocumentVisibilityState,
) {
  await page.evaluate((state) => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: state,
    })
    document.dispatchEvent(new Event('visibilitychange'))
  }, visibilityState)
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
  const source = panel.locator(`[data-group-id="${sourceId}"], [data-item-id="${sourceId}"]`)
  const grip = source.getByRole('button', {
    name: `Reorder ${sourceLabel}`,
    exact: true,
  })
  await grip.scrollIntoViewIfNeeded()
  await expect.poll(() => listTransformsAreNone(list, parentId)).toBe(true)
  await expectContiguousItems(list, parentId)

  const initialOrder = await itemOrder(list, parentId)
  const gripBox = await requiredBox(grip)

  const pointerX = gripBox.x + gripBox.width / 2
  const pointerY = gripBox.y + gripBox.height / 2
  const rootList = panel.locator('[data-picodash-reorder-list="root"]')
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

  const sourceSlot = initialSlots[sourceId]
  const targetSlot = initialSlots[targetId]
  expect(sourceSlot).toBeDefined()
  expect(targetSlot).toBeDefined()
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
  const source = panel.locator(`[data-group-id="${sourceId}"], [data-item-id="${sourceId}"]`)
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
  const sourceCenter = sourceRect!.y + sourceRect!.height / 2
  for (const stop of stops) {
    const targetRect = initialRects[stop.targetId]
    expect(targetRect).toBeDefined()

    const targetCenter = targetRect!.y + targetRect!.height / 2
    const direction = Math.sign(targetCenter - sourceCenter)
    expect(direction).not.toBe(0)
    const sourceLeadingEdge = direction > 0 ? sourceRect!.y + sourceRect!.height : sourceRect!.y
    const targetThreshold = targetCenter - sourceLeadingEdge

    await page.mouse.move(pointerX, pointerY + targetThreshold - direction)
    await expect
      .poll(() => itemOrder(list, parentId))
      .toEqual(orderAtTargetThreshold(initialOrder, sourceId, stop.targetId, false))
    await expectPointerOffset(source, sourceRect!.y, targetThreshold - direction)
    await expectUnchangedOrder(unchangedOrder)

    await page.mouse.move(pointerX, pointerY + targetThreshold + direction)
    await expect
      .poll(() => itemOrder(list, parentId))
      .toEqual(orderAtTargetThreshold(initialOrder, sourceId, stop.targetId, true))
    await expectPointerOffset(source, sourceRect!.y, targetThreshold + direction)
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
    return min - Math.min((min - value) * picodashMotionTokens.dragElastic, 1)
  }
  if (value > max) {
    return max + Math.min((value - max) * picodashMotionTokens.dragElastic, 1)
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
              const id = itemElement.dataset.groupId ?? itemElement.dataset.itemId
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
                return (element.dataset.groupId ?? element.dataset.itemId) !== sourceId
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
      item instanceof HTMLElement ? (item.dataset.groupId ?? item.dataset.itemId ?? '') : '',
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
          element.dataset.groupId ?? element.dataset.itemId ?? '',
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
          element.dataset.groupId ?? element.dataset.itemId ?? '',
          { height: rect.height, y: rect.y },
        ]
      }),
    ),
  ) as Promise<Record<string, ItemRect>>
}

function directItems(list: import('@playwright/test').Locator, parentId: string) {
  return list.locator(`:scope > div > [data-parent-id="${parentId}"]`)
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
          return (element.dataset.groupId ?? element.dataset.itemId) !== sourceId
        })
        .every((item) => {
          const style = getComputedStyle(item)
          const top = Number.parseFloat(style.top)
          return style.transform === 'none' && (!Number.isFinite(top) || Math.abs(top) <= 0.05)
        }),
    sourceId,
  )
}

async function builtInRootStoreOrder(page: Page) {
  return page
    .locator('[data-built-in-root-order]')
    .textContent()
    .then((value) => {
      return value?.split(',').filter(Boolean) ?? []
    })
}

async function builtInDraggingId(page: Page) {
  return page
    .locator('[data-built-in-dragging-id]')
    .textContent()
    .then((value) => value || null)
}

async function activeDisclosureTransitionCount(panel: import('@playwright/test').Locator) {
  return panel
    .locator('[data-picodash-group-disclosure]')
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
