import { expect, test, type Locator } from '@playwright/test'

const builtInIds = [
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
  'alignmentPreset',
  'xyPad',
  'gradient',
  'previewAsset',
  'droppedFiles',
  'sparkline',
  'shadcn-frame-chart',
  'displayFallback',
  'display',
] as const

function builtInItem(panel: Locator, id: (typeof builtInIds)[number]) {
  return panel.locator(`[data-item-id="${id}"]`)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/dashlet-lab')
  await expect(page.locator('[data-dashlet-lab]')).toBeVisible()
  await expect(page.locator('[data-dashlet-panel="built-ins"]')).toBeVisible()
  await expect(page.locator('[data-dashlet-panel="examples"]')).toBeVisible()
})

test('renders every built-in Dashlet and every app example in stable groups', async ({ page }) => {
  const builtIns = page.locator('[data-dashlet-panel="built-ins"]')
  const examples = page.locator('[data-dashlet-panel="examples"]')

  await expect(builtIns.locator('[data-group-id]')).toHaveCount(5)
  for (const id of builtInIds) {
    await expect(builtIns.locator(`[data-item-id="${id}"]`)).toBeVisible()
  }
  await expect(examples.locator('[data-group-id="app-examples"]')).toBeVisible()
  await expect(examples.locator('[data-item-id="presetName"]')).toBeVisible()
  await expect(examples.locator('[data-item-id="mouse-velocity"]')).toBeVisible()
  await expect(examples.locator('[data-item-id="signal-visualizer"]')).toBeVisible()
  await expect(builtIns.locator('[data-picodash-sparkline]')).toBeVisible()
  await expect(builtIns.locator('[data-picodash-chart="line"]')).toBeVisible()
})

test('exercises form and direct-manipulation Dashlets through their accessible controls', async ({
  page,
}) => {
  const builtIns = page.locator('[data-dashlet-panel="built-ins"]')
  const text = builtInItem(builtIns, 'text').getByRole('textbox', { name: 'Text' })
  const multilineText = builtInItem(builtIns, 'multilineText').getByRole('textbox', {
    name: 'Text',
  })
  const number = builtInItem(builtIns, 'number').getByRole('textbox', { name: 'Number' })
  const select = builtInItem(builtIns, 'select')
  const switchControl = builtInItem(builtIns, 'switch').getByRole('switch', { name: 'Switch' })

  await text.fill('Lab note')
  await multilineText.fill('A multiline lab note')
  await expect(multilineText).toHaveValue('A multiline lab note')
  await expect(page.locator('[data-dashlet-state]')).toContainText('Lab note')

  await number.fill('42')
  await number.press('Enter')
  await expect(number).toHaveValue('42')

  const selectTrigger = select.getByRole('button', { name: 'Balanced Select' })
  await selectTrigger.focus()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Home')
  await page.keyboard.press('Enter')
  await expect(select).toContainText('Compact')

  // React Aria gives each thumb its current value as its accessible name. The label is on the
  // parent group, so the Lab-owned item selector plus role is stable across value changes.
  const slider = builtInItem(builtIns, 'slider')
    .getByRole('group', { name: 'Slider', exact: true })
    .getByRole('slider')
  const markedSlider = builtInItem(builtIns, 'sliderMarks')
    .getByRole('group', { name: 'Slider', exact: true })
    .getByRole('slider')

  await slider.focus()
  await page.keyboard.press('ArrowRight')
  await expect(slider).toHaveValue('49')
  await expect(page.locator('[data-dashlet-state]')).toContainText('49')
  await expect(builtInItem(builtIns, 'displayFallback')).toContainText('Waiting')
  await expect(builtInItem(builtIns, 'display')).toContainText('Slider 49 / switch on')

  await markedSlider.focus()
  await page.keyboard.press('ArrowRight')
  await expect(markedSlider).toHaveValue('0.51')
  await expect(builtInItem(builtIns, 'sliderMarks')).toContainText('51%')

  const range = builtInItem(builtIns, 'range')
  const lowerRange = range.getByRole('slider', { name: 'Lower value Range' })
  await lowerRange.focus()
  await page.keyboard.press('ArrowRight')
  await expect(lowerRange).toHaveValue('25')
  await expect(range).toContainText('25–76')

  const segmentedOpen = builtInItem(builtIns, 'segmented').getByRole('radio', { name: 'Open' })
  await segmentedOpen.focus()
  await page.keyboard.press('Space')
  await expect(segmentedOpen).toBeChecked()

  const vectorX = builtInItem(builtIns, 'vector3').getByRole('spinbutton', { name: 'X axis' })
  await vectorX.fill('2.5')
  await vectorX.press('Enter')
  await expect(vectorX).toHaveValue('2.5')

  const topLeft = builtInItem(builtIns, 'alignment').getByRole('radio', { name: 'Top left' })
  await topLeft.focus()
  await page.keyboard.press('Space')
  await expect(topLeft).toBeChecked()

  const bottomRight = builtInItem(builtIns, 'alignmentPreset').getByRole('radio', {
    name: 'Bottom right',
  })
  await bottomRight.focus()
  await page.keyboard.press('Space')
  await expect(bottomRight).toBeChecked()

  const xyPadX = builtInItem(builtIns, 'xyPad').getByRole('slider', {
    name: 'Two-dimensional value, X axis',
  })
  await xyPadX.focus()
  await page.keyboard.press('ArrowRight')
  await expect(xyPadX).toHaveValue('0.69')

  const gradient = builtInItem(builtIns, 'gradient')
  const gradientStop = gradient.getByRole('slider', { name: /Gradient stop at .* percent/ }).first()
  await gradientStop.focus()
  await page.keyboard.press('ArrowRight')
  await expect(gradientStop).toHaveAttribute('aria-valuenow', '1')
  const gradientRotation = gradient.getByRole('slider', { name: 'Gradient rotation' })
  await gradientRotation.focus()
  await page.keyboard.press('ArrowRight')
  await expect(gradient).toContainText('136°')

  await switchControl.focus()
  await page.keyboard.press('Space')
  await expect(page.locator('[data-dashlet-state]')).toContainText('"switch": false')
  await expect(builtInItem(builtIns, 'slider')).toHaveCount(0)
  await expect(builtInItem(builtIns, 'display')).toContainText('switch off')
})

test('exercises media and visualization Dashlets with their lab controls', async ({ page }) => {
  const controls = page.locator('[data-dashlet-lab-controls]')
  const builtIns = page.locator('[data-dashlet-panel="built-ins"]')
  const mediaPreview = builtInItem(builtIns, 'previewAsset').getByRole('img', {
    name: 'Picodash mark',
  })
  const dropzone = builtInItem(builtIns, 'droppedFiles')
  const sparkline = builtInItem(builtIns, 'sparkline').locator('[data-picodash-sparkline]')
  const chart = builtInItem(builtIns, 'shadcn-frame-chart').locator('[data-picodash-chart]')

  await expect(mediaPreview).toHaveAttribute('src', '/favicon.svg')
  await dropzone.locator('input[type="file"]').setInputFiles({
    buffer: Buffer.from('dashlet preview'),
    mimeType: 'image/png',
    name: 'dashlet-preview.png',
  })
  await expect(dropzone).toContainText('1 of 3 files selected')
  await expect(dropzone.getByRole('list', { name: 'Selected files' })).toContainText(
    'dashlet-preview.png',
  )

  await controls.getByLabel('Autoscale sparkline').check()
  await controls.getByLabel('Show sparkline baseline').uncheck()
  await expect(sparkline).toHaveAttribute('data-autoscale', 'true')
  await expect(sparkline).not.toHaveAttribute('data-show-baseline')

  for (const type of ['area', 'bar', 'pie', 'radar', 'radial', 'line']) {
    await controls.getByLabel('Chart variant').selectOption(type)
    await expect(chart).toHaveAttribute('data-picodash-chart', type)
  }

  const examples = page.locator('[data-dashlet-panel="examples"]')
  const spectrum = examples.getByRole('radio', { name: 'Show spectrum' })
  await spectrum.focus()
  await page.keyboard.press('Space')
  await expect(examples.getByRole('img', { name: 'Synthetic signal spectrum' })).toBeVisible()
  await expect(page.locator('[data-dashlet-state]')).toContainText('spectrum')
  await page.mouse.move(100, 100)
  await page.mouse.move(300, 240, { steps: 4 })
  await expect
    .poll(async () => examples.locator('[data-pointer-velocity-fps]').textContent())
    .not.toBe('0 FPS')
})

test('keeps invalid drafts and exercises the repair proposal abort and accept paths', async ({
  page,
}) => {
  const examples = page.locator('[data-dashlet-panel="examples"]')
  const input = examples.locator('[data-validated-preset-name]')
  const importInput = examples.locator('input[data-picodash-panel-import]')

  await input.fill('x')
  await expect(input).toHaveAttribute('aria-invalid', 'true')
  await expect(examples.getByText('Preset name must contain at least 3 characters.')).toBeVisible()
  await input.fill('Gallery')
  await expect(input).toHaveAttribute('aria-invalid', 'false')

  const repairFile = {
    buffer: Buffer.from('{"presetName":"x"}'),
    mimeType: 'application/json',
    name: 'repair.json',
  }
  await importInput.setInputFiles(repairFile)
  const dialog = page.getByRole('alertdialog', { name: 'Review import for App example Dashlets' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Abort' }).click()
  await expect(input).toHaveValue('Gallery')

  await importInput.setInputFiles(repairFile)
  await dialog.getByRole('button', { name: 'Accept changes' }).click()
  await expect(input).toHaveValue('Studio')
  await expect(page.locator('[data-dashlet-state]')).toContainText('Studio')
})

test('switches theme and provider registration lifecycle', async ({ page }) => {
  const controls = page.locator('[data-dashlet-lab-controls]')
  const builtIns = page.locator('[data-dashlet-panel="built-ins"]')
  await controls.getByRole('button', { name: 'Use light theme' }).click()
  await expect(builtIns).toHaveAttribute('data-picodash-theme', 'light')

  await controls.getByRole('button', { name: 'Mount lifecycle panel' }).click()
  const lifecycle = page.locator('[data-dashlet-panel="lifecycle"]')
  await expect(lifecycle).toBeVisible()
  await expect(page.locator('[data-dashlet-state]')).toContainText('dashlet-lab-lifecycle')
  await controls.getByRole('button', { name: 'Toggle lifecycle panel visibility' }).click()
  await expect(lifecycle).toBeHidden()
  await controls.getByRole('button', { name: 'Unmount lifecycle panel' }).click()
  await expect(lifecycle).toHaveCount(0)
})
