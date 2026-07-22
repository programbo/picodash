import { expect, test, type Locator } from '@playwright/test'
import { requiredBox } from './helpers.ts'

const builtInItems = [
  { component: 'TweakerText', id: 'text', label: 'Text' },
  { component: 'TweakerText', id: 'multilineText', label: 'Text' },
  { component: 'TweakerNumber', id: 'number', label: 'Number' },
  { component: 'TweakerSwitch', id: 'switch', label: 'Switch' },
  { component: 'TweakerSelect', id: 'select', label: 'Select' },
  { component: 'TweakerSlider', id: 'slider', label: 'Slider' },
  { component: 'TweakerSlider', id: 'sliderMarks', label: 'Slider' },
  { component: 'TweakerRange', id: 'range', label: 'Range' },
  { component: 'TweakerSegmented', id: 'segmented', label: 'Segmented' },
  { component: 'TweakerVector3', id: 'vector3', label: 'Vector3' },
  { component: 'TweakerMatrix2D', id: 'alignment', label: 'Matrix2D' },
  { component: 'TweakerXYPad', id: 'xyPad', label: 'XYPad' },
  { component: 'TweakerGradient', id: 'gradient', label: 'Gradient' },
  { component: 'TweakerMediaPreview', id: 'previewAsset', label: 'MediaPreview' },
  { component: 'TweakerDropzone', id: 'droppedFiles', label: 'Dropzone' },
  { component: 'TweakerSparkline', id: 'sparkline', label: 'Sparkline' },
  { component: 'TweakerChart', id: 'shadcn-frame-chart', label: 'Chart' },
  { component: 'TweakerDisplay', id: 'displayFallback', label: 'Display' },
  { component: 'TweakerDisplay', id: 'display', label: 'Display' },
] as const

async function setBooleanSwitch(locator: Locator, value: boolean) {
  await expect(locator).toHaveAttribute('role', 'switch')
  if ((await locator.getAttribute('aria-checked')) !== String(value)) {
    await locator.click()
  }
  await expect(locator).toHaveAttribute('aria-checked', String(value))
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('[data-tweaker-panel-id="built-in-items"]')).toBeVisible()
})

test('reveals a skip link on keyboard focus', async ({ page }) => {
  const skipLink = page.getByRole('link', { name: 'Skip to main content' })

  await expect(skipLink).not.toBeInViewport()
  await page.keyboard.press('Tab')

  await expect(skipLink).toBeFocused()
  await expect(skipLink).toBeInViewport()
  await expect(skipLink).toHaveAttribute('href', '#main-content')
  await expect(page.locator('#main-content')).toHaveCount(1)
})

test('surfaces clipboard failures in code and usage examples', async ({ page }) => {
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: () => Promise.reject(new DOMException('Clipboard denied.', 'NotAllowedError')),
      },
    })
  })

  const example = page.locator('[data-interactive-jsx-example]')
  const copyJsx = example.locator('[data-copy-jsx]')
  await copyJsx.click()
  await expect(copyJsx).toContainText('Copy failed')

  await example.getByRole('tab', { name: 'Usage' }).click()
  const copyInstall = example.locator('[data-copy-code="Install Tweaker"]')
  await copyInstall.click()
  await expect(copyInstall).toContainText('Copy failed')
})

test('keeps the non-fixed panel background attached to the panel at and away from the left edge', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1558, height: 1091 })
  const example = page.locator('[data-interactive-jsx-example]')
  const panel = page.locator('[data-tweaker-panel-id="built-in-items"]')
  const shell = page.locator(
    '[data-tweaker-panel-shell]:has([data-tweaker-panel-id="built-in-items"])',
  )
  const placementMode = example.getByLabel('Panel placement mode')
  const placementPosition = example.getByLabel('Panel placement position')

  await placementPosition.selectOption('top-left')
  await expect(shell).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(shell).toHaveCSS('backdrop-filter', 'none')

  const [initialPanelBox, initialShellBox] = await Promise.all([
    requiredBox(panel),
    requiredBox(shell),
  ])
  expect(initialPanelBox.x).toBeGreaterThanOrEqual(0)
  expect(initialPanelBox.x).toBeLessThanOrEqual(16)
  expect(initialShellBox.width).toBeCloseTo(initialPanelBox.width, 0)

  await placementMode.selectOption('magnetic')
  await expect(placementPosition).toHaveValue('top-left')
  await expect(shell).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(shell).toHaveCSS('backdrop-filter', 'none')
  await placementMode.selectOption('floating')

  const headerBox = await requiredBox(panel.locator('[data-tweaker-panel-header]'))
  const startX = headerBox.x + headerBox.width / 2
  const startY = headerBox.y + headerBox.height / 2
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX + 500, startY + 150, { steps: 12 })
  await page.mouse.up()

  await expect
    .poll(async () => (await panel.boundingBox())?.x ?? 0)
    .toBeGreaterThan(initialPanelBox.x + 400)
  await expect(shell).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(shell).toHaveCSS('backdrop-filter', 'none')
  const [draggedPanelBox, draggedShellBox] = await Promise.all([
    requiredBox(panel),
    requiredBox(shell),
  ])
  expect(draggedShellBox.x).toBeCloseTo(draggedPanelBox.x, 0)
  expect(draggedShellBox.width).toBeCloseTo(draggedPanelBox.width, 0)
})

test('reflects persisted panel placement in the interactive JSX controls after reload', async ({
  page,
}) => {
  const example = page.locator('[data-interactive-jsx-example]')
  const placementMode = example.getByLabel('Panel placement mode')
  const placementPosition = example.getByLabel('Panel placement position')
  const panelShell = page.locator(
    '[data-tweaker-panel-shell]:has([data-tweaker-panel-id="built-in-items"])',
  )

  await placementMode.selectOption('fixed')
  await placementPosition.selectOption('right')
  await expect(panelShell).toHaveAttribute('data-fixed-placement', 'right')

  await page.reload()

  await expect(placementMode).toHaveValue('fixed')
  await expect(placementPosition).toHaveValue('right')
  await expect(panelShell).toHaveAttribute('data-fixed-placement', 'right')
})

test('keeps the expanded panel header toggle transparent until hover', async ({ page }) => {
  const example = page.locator('[data-interactive-jsx-example]')
  await example.getByLabel('Panel placement mode').selectOption('floating')
  await example.getByLabel('Provider theme').selectOption('light')

  const toggle = page.getByRole('button', { name: 'Collapse panel Built-in Items' })
  await page.mouse.move(0, 0)
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(toggle).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')

  await toggle.hover()
  await expect(toggle).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  const hoveredBackground = await toggle.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  )
  expect(hoveredBackground).not.toMatch(/\/\s*0\.5\s*\)$/)
})

test('provides a step-by-step Usage tab for adding a reactive panel', async ({ page }) => {
  const example = page.locator('[data-interactive-jsx-example]')

  await page.setViewportSize({ width: 320, height: 844 })
  await page.getByRole('button', { name: 'Collapse panel Built-in Items' }).click()
  await expect(example.getByRole('checkbox', { name: 'Show all props' })).toBeInViewport()
  await expect(example.getByRole('button', { name: 'Copy JSX' })).toBeInViewport()
  await expect(example.getByRole('tab', { name: 'Usage' })).toBeVisible()
  await expect(example.getByRole('tab', { name: 'More examples' })).toBeInViewport({ ratio: 1 })
  await example.getByRole('tab', { name: 'Usage' }).click()

  const guide = example.locator('[data-usage-guide]')
  await expect(guide).toBeVisible()
  await expect(guide.getByRole('heading', { name: 'Add a reactive Tweaker panel' })).toBeVisible()
  await expect(guide.getByRole('heading', { name: 'Create a stable panel store' })).toBeVisible()
  await expect(guide.getByText('bun add tweaker', { exact: true })).toBeVisible()
  await expect(guide.getByRole('heading', { name: 'Common integration patterns' })).toBeVisible()
  await expect(guide.getByRole('heading', { name: 'Implementation constraints' })).toBeVisible()
  await expect(guide).toHaveCSS('scroll-behavior', 'smooth')

  await guide.getByRole('link', { name: /Create the store/ }).click()
  await expect.poll(() => guide.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)

  await example.getByRole('tab', { name: 'Store' }).click()
  await expect(example.getByLabel('Live Built-in Items panel store')).toBeVisible()
})

test('provides sticky smooth-scroll component navigation in the Code tab', async ({ page }) => {
  const example = page.locator('[data-interactive-jsx-example]')
  const codeGuide = example.locator('[data-code-guide]')
  const codeNavigation = codeGuide.getByRole('navigation', { name: 'Code components' })

  await expect(codeNavigation).toBeVisible()
  await expect(codeGuide).toHaveCSS('scroll-behavior', 'smooth')
  await expect(codeNavigation.getByRole('link')).toHaveCount(builtInItems.length)

  await codeNavigation.getByRole('link', { name: /Chart shadcn-frame-chart/ }).click()
  await expect.poll(() => codeGuide.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
  await expect(example.locator('#code-shadcn-frame-chart')).toBeInViewport()

  await expect(codeNavigation.locator('..')).toHaveCSS('position', 'sticky')
})

test('provides a More examples placeholder with shared section navigation', async ({ page }) => {
  const example = page.locator('[data-interactive-jsx-example]')

  await example.getByRole('tab', { name: 'More examples' }).click()

  const moreExamples = example.locator('[data-more-examples]')
  const navigation = moreExamples.getByRole('navigation', { name: 'More examples' })
  await expect(moreExamples).toBeVisible()
  await expect(
    moreExamples.getByRole('heading', { name: 'More complex Tweaker compositions' }),
  ).toBeVisible()
  await expect(navigation.getByRole('link')).toHaveCount(4)
  await expect(moreExamples.getByText('Coming soon')).toHaveCount(4)
  await expect(moreExamples).toHaveCSS('scroll-behavior', 'smooth')

  await navigation.getByRole('link', { name: /Import and validation/ }).click()
  await expect.poll(() => moreExamples.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
  await expect(example.locator('#example-import-validation')).toBeInViewport()
})

test('edits live provider, panel, and Common inputs props through highlighted JSX', async ({
  context,
  page,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const example = page.locator('[data-interactive-jsx-example]')
  const panel = page.locator('[data-tweaker-panel-id="built-in-items"]')
  const placementMode = example.getByLabel('Panel placement mode')
  const placementPosition = example.getByLabel('Panel placement position')
  const panelShell = page.locator(
    '[data-tweaker-panel-shell]:has([data-tweaker-panel-id="built-in-items"])',
  )

  await expect(example.locator('[data-interactive-tabs]')).toHaveClass(/bg-zinc-950\/78/)
  await expect(placementMode).toHaveValue('floating')
  await expect(placementPosition).toHaveValue('top-right')
  await expect(placementPosition.locator('option')).toHaveText([
    'top-left',
    'top-right',
    'bottom-left',
    'bottom-right',
  ])

  await placementMode.selectOption('magnetic')
  await expect(placementPosition).toHaveValue('top-right')
  await expect(placementPosition.locator('option')).toHaveText([
    'top-left',
    'top',
    'top-right',
    'right',
    'bottom-right',
    'bottom',
    'bottom-left',
    'left',
  ])
  await placementPosition.selectOption('bottom')
  await placementMode.selectOption('fixed')
  await expect(placementPosition).toHaveValue('bottom-left')
  await expect(placementPosition.locator('option')).toHaveText([
    'top-left',
    'top-right',
    'bottom-left',
    'bottom-right',
    'left',
    'right',
  ])
  await expect(panelShell).toHaveAttribute('data-fixed-placement', 'bottom-left')

  await placementPosition.selectOption('right')
  await expect(panelShell).toHaveAttribute('data-fixed-placement', 'right')
  await placementMode.selectOption('floating')
  await expect(placementPosition).toHaveValue('top-right')
  await expect(panelShell).not.toHaveAttribute('data-fixed-placement')

  const showAllProps = example.getByRole('checkbox', { name: 'Show all props' })
  const textDeclaration = example.locator('[data-jsx-control="text"]')
  await expect(showAllProps).not.toBeChecked()
  await expect(textDeclaration.getByText('contentLayout', { exact: true })).toHaveCount(0)
  await showAllProps.check()
  const hiddenContentLayout = textDeclaration.getByText('contentLayout', { exact: true })
  await expect(hiddenContentLayout).toBeVisible()
  await expect(hiddenContentLayout.locator('..')).toHaveClass(/opacity-60/)
  const textDeclarationLines = await textDeclaration.locator(':scope > span').allTextContents()
  const textDescriptionIndex = textDeclarationLines.findIndex((line) =>
    line.includes('description='),
  )
  const textContentLayoutIndex = textDeclarationLines.findIndex((line) =>
    line.includes('contentLayout='),
  )
  expect(textDescriptionIndex).toBeGreaterThan(0)
  expect(textDescriptionIndex).toBeLessThan(textContentLayoutIndex)
  await expect(example.getByText('defaultPlacement', { exact: true })).toBeVisible()
  const numberDeclaration = example.locator('[data-jsx-control="number"]')
  const numberRow = panel.locator('[data-item-id="number"]')
  await example.getByLabel('Content layout for number').selectOption('block')
  await expect(numberRow).toHaveAttribute('data-content-layout', 'block')
  await setBooleanSwitch(example.getByLabel('Disabled for number'), true)
  await expect(numberRow.locator('input')).toBeDisabled()
  await setBooleanSwitch(example.getByLabel('Disabled for number'), false)
  await setBooleanSwitch(example.getByLabel('Read only for number'), true)
  await expect(numberRow.locator('input')).toHaveAttribute('readonly', '')
  await setBooleanSwitch(example.getByLabel('Read only for number'), false)
  await setBooleanSwitch(example.getByLabel('Reorderable for number'), false)
  await expect(numberDeclaration.getByLabel('Reorderable for number')).toHaveAttribute(
    'aria-checked',
    'false',
  )
  await setBooleanSwitch(example.getByLabel('Visible for number'), false)
  await expect(numberRow).toBeHidden()
  await setBooleanSwitch(example.getByLabel('Visible for number'), true)
  await expect(numberRow).toBeVisible()
  await numberDeclaration.locator('[data-jsx-help="TweakerNumber"]').hover()
  const propTypeTooltip = page.locator('[data-jsx-prop-type-tooltip="TweakerNumber"]:visible')
  await expect(propTypeTooltip).toContainText('// TweakerNumber')
  await expect(propTypeTooltip).toContainText('type TweakerNumberProps = {')
  await expect(propTypeTooltip).toContainText('field: string')
  await expect(propTypeTooltip.locator('code')).toHaveCSS('white-space', 'pre')
  await expect(propTypeTooltip.locator('.hljs-comment')).toHaveText('// TweakerNumber')
  await expect(propTypeTooltip.locator('.hljs-keyword').first()).toContainText('type')
  await page.keyboard.press('Escape')
  await showAllProps.uncheck()
  await expect(hiddenContentLayout).toHaveCount(0)

  const darkSurface = await panel.evaluate((element) => getComputedStyle(element).backgroundColor)
  await expect(panel).toHaveCSS('backdrop-filter', /blur/)
  await expect(panel).toHaveClass(/bg-\(--tweaker-color-surface\)\/72/)
  await example.getByLabel('Provider theme').selectOption('light')
  await expect(panel).toHaveAttribute('data-tweaker-theme', 'light')
  await expect(panel).toHaveCSS('color-scheme', 'light')
  await expect
    .poll(() => panel.evaluate((element) => getComputedStyle(element).backgroundColor))
    .not.toBe(darkSurface)

  await example.getByLabel('Provider theme').selectOption('ocean')
  await expect(panel).toHaveAttribute('data-tweaker-theme', 'ocean')

  await example.getByLabel('Panel title').fill('Live Built-ins')
  await expect(panel).toContainText('Live Built-ins')

  await example.getByLabel('Common inputs group label').fill('Everyday controls')
  await expect(panel).toContainText('Everyday controls')

  const multilineRow = panel.locator('[data-item-id="multilineText"]')
  await expect(multilineRow.locator('textarea')).toBeVisible()
  await setBooleanSwitch(example.getByLabel('Multiline text'), false)
  await expect(multilineRow.locator('input')).toBeVisible()
  await setBooleanSwitch(example.getByLabel('Multiline text'), true)
  await expect(multilineRow.locator('textarea')).toBeVisible()

  await example.getByLabel('Panel width').fill('420')
  await expect(panel).toHaveAttribute('data-example-width', '420')
  await example.getByLabel('Panel width').fill('999')
  await example.getByLabel('Panel width').press('Escape')
  await expect(example.getByLabel('Panel width')).toHaveValue('420')
  await expect(panel).toHaveAttribute('data-example-width', '420')

  await example.getByLabel('Slider maximum', { exact: true }).fill('80')
  await expect(panel.locator('[data-item-id="slider"]').getByRole('slider')).toHaveAttribute(
    'max',
    '80',
  )

  const densityOptionsVariable = example.locator('[data-jsx-variable="densityOptions"]')
  await densityOptionsVariable.hover()
  await expect(page.getByRole('tooltip').filter({ hasText: '"label": "Compact"' })).toBeVisible()

  const alignmentOptionsVariable = example.locator('[data-jsx-variable="alignmentOptions"]')
  await alignmentOptionsVariable.scrollIntoViewIfNeeded()
  await alignmentOptionsVariable.hover()
  const variableTooltip = page.getByRole('tooltip').filter({ hasText: '"aria-label": "Top left"' })
  const tooltipBox = await requiredBox(variableTooltip)
  await page.mouse.move(tooltipBox.x + tooltipBox.width / 2, tooltipBox.y + tooltipBox.height / 2)
  await expect(variableTooltip).toBeVisible()
  await page.mouse.wheel(0, 160)
  await expect
    .poll(() => variableTooltip.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0)

  await expect(example.getByText('description="', { exact: false })).toHaveCount(
    builtInItems.length,
  )
  await example.getByLabel('Description for text').fill('A "quoted" description.')
  await expect(panel.locator('[data-item-id="text"]')).toContainText('A "quoted" description.')
  await example.getByRole('button', { name: 'Copy JSX' }).click()
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain('description={"A \\"quoted\\" description."}')
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain('title={"Live Built-ins"}')
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain('defaultPlacement={{ mode: "floating", position: "top-right" }}')
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain('label={"Everyday controls"}')
  await example.getByLabel('Description for text').fill('')
  await expect(panel.locator('[data-item-id="text"]')).not.toContainText('A "quoted" description.')
  await expect(example.getByText('sliderMarks', { exact: true }).first()).toBeVisible()
  await expect(example.locator('[data-jsx-control="text"] > span')).toHaveCount(7)
  for (const groupId of ['spatial-items', 'media-items', 'chart-items', 'visualization-items']) {
    await expect(example.getByText(groupId, { exact: true })).toBeVisible()
  }
  await expect(example.locator('[data-jsx-control="displayFallback"]')).toContainText(
    'TweakerDisplay',
  )
  await expect(example.locator('[data-jsx-control="display"]')).toContainText('TweakerDisplay')
  const sparklineSurface = panel.locator('[data-item-id="sparkline"] [data-tweaker-sparkline]')
  await setBooleanSwitch(example.getByLabel('Sparkline continuous streaming'), false)
  await expect(sparklineSurface).toHaveAttribute('data-continuous', 'false')
  await setBooleanSwitch(example.getByLabel('Sparkline continuous streaming'), true)
  await expect(sparklineSurface).toHaveAttribute('data-continuous', 'true')
  await sparklineSurface.scrollIntoViewIfNeeded()
  const editedVelocityPaths = [
    sparklineSurface.locator('[data-sparkline-series="x"]'),
    sparklineSurface.locator('[data-sparkline-series="y"]'),
  ]
  await page.mouse.move(180, 140)
  await page.mouse.move(620, 340, { steps: 6 })
  const pathsBeforePointLimitEdit = await Promise.all(
    editedVelocityPaths.map((path) => path.getAttribute('d')),
  )
  const maximumPoints = example.getByLabel('Sparkline maximum points')
  await maximumPoints.click()
  await maximumPoints.selectText()
  await maximumPoints.pressSequentially('112')
  await maximumPoints.press('Tab')
  await expect(maximumPoints).toHaveValue('112')
  await expect(sparklineSurface).toHaveAttribute('data-max-points', '112')
  await expect
    .poll(() => Promise.all(editedVelocityPaths.map((path) => path.getAttribute('d'))))
    .not.toEqual(pathsBeforePointLimitEdit)
  const sparklineDeclaration = example.locator('[data-jsx-control="sparkline"]')
  const pathsBeforeAutoscaleEdit = await Promise.all(
    editedVelocityPaths.map((path) => path.getAttribute('d')),
  )
  await setBooleanSwitch(example.getByLabel('Sparkline automatic scale'), true)
  await expect(sparklineSurface).toHaveAttribute('data-autoscale', 'true')
  await expect(example.getByLabel('Sparkline automatic scale')).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await expect(sparklineDeclaration).not.toContainText('minValue')
  await expect(sparklineDeclaration).not.toContainText('maxValue')
  await expect
    .poll(() => Promise.all(editedVelocityPaths.map((path) => path.getAttribute('d'))))
    .not.toEqual(pathsBeforeAutoscaleEdit)
  await setBooleanSwitch(example.getByLabel('Sparkline automatic scale'), false)
  await expect(sparklineSurface).toHaveAttribute('data-autoscale', 'false')
  await expect(sparklineDeclaration).toContainText('minValue')
  await expect(sparklineDeclaration).toContainText('maxValue')
  await setBooleanSwitch(example.getByLabel('Sparkline continuous streaming'), false)
  await setBooleanSwitch(example.getByLabel('Sparkline show baseline'), false)
  await expect(sparklineSurface.locator('[data-sparkline-baseline]')).toHaveCount(0)
  await setBooleanSwitch(example.getByLabel('Sparkline show baseline'), true)
  const restoredBaseline = sparklineSurface.locator('[data-sparkline-baseline]')
  await expect(restoredBaseline).toHaveAttribute('visibility', 'visible')
  await expect(restoredBaseline).toHaveAttribute('d', /M 0/)
  await setBooleanSwitch(example.getByLabel('Sparkline continuous streaming'), true)
  const matrixDeclaration = example.locator('[data-jsx-control="alignment"]')
  const matrixRole = example.getByLabel('Matrix2D selection role')
  await matrixRole.selectOption('toggle')
  await expect(matrixDeclaration.getByLabel('Matrix2D selection role')).toHaveValue('toggle')
  await expect(
    panel.locator('[data-item-id="alignment"] [data-alignment-index="0"]'),
  ).not.toHaveAttribute('role', 'radio')
  await matrixRole.selectOption('radio')
  await expect(
    panel.locator('[data-item-id="alignment"] [data-alignment-index="0"]'),
  ).toHaveAttribute('role', 'radio')

  const chartDeclaration = example.locator('[data-jsx-control="shadcn-frame-chart"]')
  const chartSurface = panel.locator('[data-item-id="shadcn-frame-chart"] [data-tweaker-chart]')
  const chartType = example.getByLabel('Chart type')
  for (const [type, specificProp] of [
    ['area', 'areaChartProps'],
    ['bar', 'barChartProps'],
    ['line', 'lineChartProps'],
    ['pie', 'pieProps'],
    ['radar', 'radarChartProps'],
    ['radial', 'radialBarChartProps'],
  ] as const) {
    await chartType.selectOption(type)
    await expect(chartSurface).toHaveAttribute('data-tweaker-chart', type)
    await expect(chartDeclaration).toContainText(specificProp)
  }
  await chartType.selectOption('line')
  const chartPlot = chartSurface.locator('.recharts-wrapper')
  const chartBox = await requiredBox(chartPlot)
  await page.mouse.move(chartBox.x + chartBox.width * 0.45, chartBox.y + chartBox.height * 0.45)
  const chartTooltip = chartSurface.locator('.recharts-default-tooltip')
  await expect(chartTooltip).toBeVisible()
  await expect
    .poll(() => chartTooltip.evaluate((element) => getComputedStyle(element).backgroundColor))
    .not.toBe('rgb(255, 255, 255)')
  for (const controlId of ['multilineText', 'sliderMarks']) {
    const declaration = example.locator(`[data-jsx-control="${controlId}"]`)
    await expect(declaration.locator(':scope > span:nth-last-child(2)')).toContainText(
      'description=',
    )
    await expect(declaration.locator(':scope > span:last-child')).toHaveText('/>')
  }

  await example.getByRole('button', { name: 'Open live panel store' }).click()
  await expect(example.getByRole('tab', { name: 'Store' })).toHaveAttribute('data-selected', 'true')
  await example.getByRole('tab', { name: 'Code' }).click()

  await example.getByRole('tab', { name: 'Store' }).click()
  await expect(example.getByLabel('Live Built-in Items panel store')).toContainText('panelId')
  await expect(example.getByLabel('Live Built-in Items panel store')).toContainText(
    'built-in-items',
  )
  await expect(example.getByLabel('Live Built-in Items panel store')).toContainText('slider')
  const storeTree = example.getByRole('tree', { name: 'Collapsible live panel state' })
  await storeTree.getByRole('button', { name: 'collapse JSON' }).first().click()
  await expect(storeTree).not.toContainText('panelId')
  await storeTree.getByRole('button', { name: 'expand JSON' }).click()
  await expect(storeTree).toContainText('panelId')
  await example.getByRole('tab', { name: 'Code' }).click()

  await setBooleanSwitch(example.getByLabel('Panel collapsible'), false)
  await expect(panel.getByRole('button', { name: /Collapse panel/ })).toHaveCount(0)
  await expect
    .poll(async () => {
      const [panelBox, titleBox] = await Promise.all([
        panel.boundingBox(),
        panel.getByRole('heading', { name: 'Live Built-ins' }).boundingBox(),
      ])
      return panelBox && titleBox ? Math.round(titleBox.x - panelBox.x) : null
    })
    .toBeGreaterThanOrEqual(12)
})

test('keeps the JSX left aligned until viewport centering clears the panel', async ({ page }) => {
  const example = page.locator('[data-interactive-jsx-example]')
  const content = example.locator(':scope > div')
  const panel = page.locator('[data-tweaker-panel-id="built-in-items"]')

  await page.setViewportSize({ width: 1600, height: 1000 })
  await expect
    .poll(async () => {
      const [contentBox, panelBox] = await Promise.all([content.boundingBox(), panel.boundingBox()])
      return contentBox && panelBox
        ? {
            contentLeft: Math.round(contentBox.x),
            gap: Math.round(panelBox.x - (contentBox.x + contentBox.width)),
          }
        : null
    })
    .toEqual({ contentLeft: 32, gap: 16 })

  await page.setViewportSize({ width: 2476, height: 1000 })
  await expect
    .poll(async () => {
      const contentBox = await content.boundingBox()
      return contentBox ? Math.round(contentBox.x + contentBox.width / 2) : null
    })
    .toBe(1238)
})

test('presents canonical built-in examples in order with API help and variant descriptions', async ({
  page,
}) => {
  const panel = page.locator('[data-tweaker-panel-id="built-in-items"]')
  const common = panel.locator('[data-tweaker-reorder-list="common-items"]')
  const spatial = panel.locator('[data-tweaker-reorder-list="spatial-items"]')
  const media = panel.locator('[data-tweaker-reorder-list="media-items"]')
  const charts = panel.locator('[data-tweaker-reorder-list="chart-items"]')
  const displays = panel.locator('[data-tweaker-reorder-list="visualization-items"]')
  const root = panel.locator('[data-tweaker-reorder-list="root"]')

  await expect
    .poll(() => itemOrder(common, 'common-items'))
    .toEqual([
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
    ])
  await expect.poll(() => itemOrder(spatial, 'spatial-items')).toEqual(['xyPad', 'gradient'])
  await expect.poll(() => itemOrder(media, 'media-items')).toEqual(['previewAsset', 'droppedFiles'])
  await expect
    .poll(() => itemOrder(charts, 'chart-items'))
    .toEqual(['sparkline', 'shadcn-frame-chart'])
  await expect
    .poll(() => itemOrder(displays, 'visualization-items'))
    .toEqual(['displayFallback', 'display'])
  await expect
    .poll(() => itemOrder(root, 'root'))
    .toEqual(['common-items', 'spatial-items', 'media-items', 'chart-items', 'visualization-items'])

  await expect(panel.locator('[data-group-id="chart-items"]')).toContainText('Charts')
  await expect(panel.locator('[data-item-id="sparkline"] label')).toHaveText('Sparkline')
  await expect(panel.locator('[data-item-id="shadcn-frame-chart"] label')).toHaveText('Chart')
  const sparkline = panel.locator('[data-item-id="sparkline"] [data-tweaker-sparkline]')
  await sparkline.scrollIntoViewIfNeeded()
  const velocityXPath = sparkline.locator('[data-sparkline-series="x"]')
  const velocityYPath = sparkline.locator('[data-sparkline-series="y"]')
  await expect(velocityXPath).toHaveCount(1)
  await expect(velocityYPath).toHaveCount(1)
  await page.mouse.move(120, 160)
  await page.mouse.move(520, 300, { steps: 6 })
  await expect.poll(() => velocityXPath.getAttribute('d')).not.toBe('')
  await expect.poll(() => velocityYPath.getAttribute('d')).not.toBe('')
  const movingPaths = await Promise.all([
    velocityXPath.getAttribute('d'),
    velocityYPath.getAttribute('d'),
  ])
  await expect
    .poll(() => Promise.all([velocityXPath.getAttribute('d'), velocityYPath.getAttribute('d')]))
    .not.toEqual(movingPaths)
  const decayingPaths = await Promise.all([
    velocityXPath.getAttribute('d'),
    velocityYPath.getAttribute('d'),
  ])
  await page.mouse.move(860, 180, { steps: 6 })
  await expect
    .poll(() => Promise.all([velocityXPath.getAttribute('d'), velocityYPath.getAttribute('d')]))
    .not.toEqual(decayingPaths)
  await expect(panel.locator('[data-group-id="visualization-items"]')).toContainText(
    'Display variants',
  )

  for (const item of builtInItems) {
    const row = panel.locator(`[data-item-id="${item.id}"]`)
    await expect(row.locator('label').first()).toHaveText(item.label)
    const help = row.getByRole('button', { name: `Help for ${item.label}`, exact: true })
    await help.scrollIntoViewIfNeeded()
    await page.mouse.move(0, 0)
    await help.hover()
    await expect(page.getByRole('tooltip')).toContainText(item.component)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('tooltip')).toBeHidden()
  }

  const textHelp = panel
    .locator('[data-item-id="text"]')
    .getByRole('button', { name: 'Help for Text' })
  await page.mouse.move(0, 0)
  await textHelp.hover()
  await expect(page.getByRole('tooltip')).toContainText('type TweakerTextProps = {')
  await expect(page.getByRole('tooltip')).toContainText('field: string')
  await page.keyboard.press('Escape')

  await expect(panel.locator('[data-item-id="multilineText"]')).toContainText(
    'The multiline prop switches the wrapped input to an auto-growing Textarea.',
  )
  await expect(panel.locator('[data-item-id="sliderMarks"]')).toContainText(
    'The marks prop adds optional reference points along the slider track.',
  )
  await expect(panel.locator('[data-item-id="displayFallback"]')).toContainText(
    'The fallback prop supplies optional content when value is unset.',
  )
  await expect(panel.locator('[data-item-id="text"]')).not.toContainText('multiline')
  await expect(panel.locator('[data-item-id="slider"]')).not.toContainText('marks prop')
})

test('mirrors panel hover and focus on the matching JSX declaration', async ({ page }) => {
  const panel = page.locator('[data-tweaker-panel-id="built-in-items"]')
  const codeViewport = page.locator('[data-code-guide]')
  const declaration = page.locator('[data-jsx-control="multilineText"]')
  const row = panel.locator('[data-item-id="multilineText"]')

  await row.hover()
  await expect(declaration).toHaveAttribute('data-jsx-hovered', 'true')
  await expect(declaration).toHaveCSS('border-left-color', /.+/)

  await row.getByRole('textbox').focus()
  await expect(declaration).toHaveAttribute('data-jsx-focused', 'true')
  await expect(declaration).toHaveCSS('box-shadow', /.+/)

  const vectorDeclaration = page.locator('[data-jsx-control="vector3"]')
  await codeViewport.evaluate((element) => {
    element.scrollTop = 0
  })
  await panel
    .locator('[data-item-id="vector3"]')
    .getByRole('spinbutton', { name: 'X axis' })
    .focus()

  await expect.poll(() => codeViewport.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
  await expect
    .poll(() =>
      vectorDeclaration.evaluate((element) => {
        const viewport = element.closest('[data-code-guide]')
        if (!viewport) return false
        const viewportBounds = viewport.getBoundingClientRect()
        const declarationBounds = element.getBoundingClientRect()
        return (
          declarationBounds.top >= viewportBounds.top &&
          declarationBounds.bottom <= viewportBounds.bottom
        )
      }),
    )
    .toBe(true)
})

test('updates Text, Range, Segmented, Vector3, and consumer-defined Matrix2D inputs', async ({
  page,
}) => {
  const panel = page.locator('[data-tweaker-panel-id="built-in-items"]')

  const text = panel.locator('[data-item-id="text"]').getByRole('textbox')
  await text.fill('Gallery')
  await expect(text).toHaveValue('Gallery')

  const range = panel.locator('[data-item-id="range"]')
  const lowerThumb = range.getByRole('slider', { name: 'Lower value' })
  await lowerThumb.focus()
  await lowerThumb.press('ArrowRight')
  await expect(lowerThumb).toHaveValue('25')

  const segmented = panel.locator('[data-item-id="segmented"]')
  await segmented.getByRole('radio', { name: 'Open' }).click()
  await expect(segmented.getByRole('radio', { name: 'Open' })).toHaveAttribute(
    'data-selected',
    'true',
  )

  const vector = panel.locator('[data-item-id="vector3"]')
  await vector.getByRole('spinbutton', { name: 'X axis' }).fill('4.5')
  await expect(vector.getByRole('spinbutton', { name: 'X axis' })).toHaveValue('4.5')

  const alignment = panel.locator('[data-item-id="alignment"]')
  const bottomRight = alignment.getByRole('radio', { name: 'Bottom right' })
  await bottomRight.click()
  await expect(bottomRight).toHaveAttribute('aria-checked', 'true')
  await expect(bottomRight).toHaveAttribute('data-state', 'on')

  const middleCenter = alignment.getByRole('radio', { name: 'Middle center' })
  await middleCenter.click()
  await middleCenter.press('ArrowRight')
  await expect(middleCenter).toHaveAttribute('aria-checked', 'false')
  await expect(alignment.getByRole('radio', { name: 'Middle right' })).toHaveAttribute(
    'aria-checked',
    'true',
  )
})

function itemOrder(list: import('@playwright/test').Locator, parentId: string) {
  return list
    .locator(`:scope > div > [data-parent-id="${parentId}"]`)
    .evaluateAll((items) =>
      items.map((item) =>
        item instanceof HTMLElement ? (item.dataset.groupId ?? item.dataset.itemId ?? '') : '',
      ),
    )
}
