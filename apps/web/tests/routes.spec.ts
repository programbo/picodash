import { expect, test } from '@playwright/test'

test.describe.configure({ mode: 'serial', timeout: 60_000 })

test('renders the three-section evaluation website without horizontal overflow', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('console', (message) => message.type() === 'error' && errors.push(message.text()))
  page.on('pageerror', (error) => errors.push(error.message))

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/', { waitUntil: 'domcontentloaded' })

  await expect(page.locator('[data-product-route="evaluation-home"]')).toHaveCount(1)
  await expect(page.locator('[data-evaluation-section="one"]')).toBeVisible()
  await expect(page.locator('[data-evaluation-section="two"]')).toBeVisible()
  await expect(page.locator('[data-evaluation-section="three"]')).toBeVisible()
  await expect(page.locator('[data-section-one-canvas]')).toBeVisible()
  await expect(page.locator('[data-section-one-viewport-container]')).toHaveCount(1)
  await expect(page.locator('[data-section-one-panel]')).toHaveCount(2)
  await expect(page.locator('[data-section-two-panel]')).toHaveCount(3)
  await expect(page.locator('[data-section-three-dashlists] [data-picodash-list]')).toHaveCount(2)
  await expect(page.locator('main')).toHaveCSS('overflow-x', 'clip')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440)
  expect(errors).toEqual([])
})

test('keeps sections at desktop viewport height and supports theme persistence', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/', { waitUntil: 'domcontentloaded' })

  for (const section of await page.locator('[data-evaluation-section]').all()) {
    await expect(section).toHaveCSS('min-height', '800px')
  }

  await page.getByLabel('Site theme').selectOption('light')
  await expect(page.locator('html')).not.toHaveClass(/dark/)
  await page.reload()
  await expect(page.getByLabel('Site theme')).toHaveValue('light')
})

test('former product routes are unavailable on the single-page site', async ({ request }) => {
  for (const path of ['/docs', '/examples', '/store', '/usage', '/themes', '/more-examples']) {
    const response = await request.get(path)
    expect(response.status(), path).toBe(404)
  }
})
