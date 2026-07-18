import { expect, test } from '@playwright/test'

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
  { component: 'TweakerMatrix2D', id: 'alignment', label: 'Alignment' },
  { component: 'TweakerXYPad', id: 'xyPad', label: 'XYPad' },
  { component: 'TweakerGradient', id: 'gradient', label: 'Background Gradient' },
  { component: 'TweakerMediaPreview', id: 'previewAsset', label: 'MediaPreview' },
  { component: 'TweakerDropzone', id: 'droppedFiles', label: 'Dropzone' },
  { component: 'TweakerDisplay', id: 'displayFallback', label: 'Display' },
  { component: 'TweakerDisplay', id: 'display', label: 'Display' },
] as const

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('[data-tweaker-panel-id="built-in-items"]')).toBeVisible()
})

test('presents canonical built-in examples in order with API help and variant descriptions', async ({
  page,
}) => {
  const panel = page.locator('[data-tweaker-panel-id="built-in-items"]')
  const common = panel.locator('[data-tweaker-reorder-list="common-items"]')
  const spatial = panel.locator('[data-tweaker-reorder-list="spatial-items"]')
  const media = panel.locator('[data-tweaker-reorder-list="media-items"]')
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
    ])
  await expect
    .poll(() => itemOrder(spatial, 'spatial-items'))
    .toEqual(['vector3', 'alignment', 'xyPad', 'gradient'])
  await expect.poll(() => itemOrder(media, 'media-items')).toEqual(['previewAsset', 'droppedFiles'])
  await expect
    .poll(() => itemOrder(root, 'root'))
    .toEqual(['common-items', 'spatial-items', 'media-items', 'visualization-items', 'display'])

  for (const item of builtInItems) {
    const row = panel.locator(`[data-item-id="${item.id}"]`)
    await expect(row.locator('label').first()).toHaveText(item.label)
    const help = row.getByRole('button', { name: `Help for ${item.label}`, exact: true })
    await help.scrollIntoViewIfNeeded()
    await page.waitForTimeout(100)
    await help.hover()
    await expect(page.getByRole('tooltip')).toContainText(item.component)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('tooltip')).toBeHidden()
  }

  await expect(panel.locator('[data-item-id="multilineText"]')).toContainText(
    'Setting minRows greater than 1 switches the wrapped input to an auto-growing Textarea.',
  )
  await expect(panel.locator('[data-item-id="sliderMarks"]')).toContainText(
    'The marks prop adds optional reference points along the slider track.',
  )
  await expect(panel.locator('[data-item-id="displayFallback"]')).toContainText(
    'The fallback prop supplies optional content when value is unset.',
  )
  await expect(panel.locator('[data-item-id="text"]')).not.toContainText('minRows')
  await expect(panel.locator('[data-item-id="slider"]')).not.toContainText('marks prop')
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
  await expect(lowerThumb).toHaveAttribute('aria-valuenow', '25')

  const segmented = panel.locator('[data-item-id="segmented"]')
  await segmented.getByRole('radio', { name: 'Open' }).click()
  await expect(segmented.getByRole('radio', { name: 'Open' })).toHaveAttribute('data-state', 'on')

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
