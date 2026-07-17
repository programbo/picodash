import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Tweaker State Lab' })).toBeVisible()
})

test('updates common, spatial, and gradient values through accessible controls', async ({
  page,
}) => {
  const density = page.locator('[data-control-id="density"]')
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

  const chart = page.locator('[data-control-id="shadcn-frame-chart"]')
  await expect(chart.locator('svg.recharts-surface')).toBeVisible()
  await expect(chart.locator('.recharts-line-curve')).toHaveCount(2)
})

test('animates transient visual paths and switches deterministic signal mode', async ({ page }) => {
  const velocity = page.locator('[data-control-id="mouse-velocity"]')
  const surface = velocity.getByRole('region', { name: 'Pointer velocity sampling surface' })
  const description = velocity.getByText('Move across the plot.', { exact: false })
  const velocityXPath = velocity.locator('path.stroke-chart-1')
  const velocityYPath = velocity.locator('path.stroke-chart-3')
  await surface.scrollIntoViewIfNeeded()
  await expect(surface).toBeVisible()
  const surfaceBox = await surface.boundingBox()
  const descriptionBox = await description.boundingBox()
  expect(surfaceBox).not.toBeNull()
  expect(descriptionBox).not.toBeNull()
  if (surfaceBox && descriptionBox) {
    expect(descriptionBox.y).toBeGreaterThanOrEqual(surfaceBox.y + surfaceBox.height)
  }
  const initialVelocityXPath = await velocityXPath.getAttribute('d')
  const initialVelocityYPath = await velocityYPath.getAttribute('d')
  const box = await surface.boundingBox()
  expect(box).not.toBeNull()
  if (!box) return

  await page.mouse.move(box.x + 8, box.y + 8)
  await page.mouse.move(box.x + box.width - 8, box.y + box.height - 8, { steps: 8 })
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
