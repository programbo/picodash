import { expect, test } from '@playwright/test'

test('renders the current alpha shell on desktop without browser errors', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => message.type() === 'error' && errors.push(message.text()))
  page.on('pageerror', (error) => errors.push(error.message))

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/', { waitUntil: 'domcontentloaded' })

  await expect(
    page.getByRole('heading', {
      name: 'Build configurable control panels with typed React components',
      level: 1,
    }),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: 'View current alphas' })).toHaveAttribute(
    'href',
    '#current-alphas',
  )
  await expect(page.getByRole('link', { name: 'Read the contracts' })).toHaveAttribute(
    'href',
    'https://github.com/programbo/picodash/tree/main/docs/reference',
  )
  await expect(page.locator('[data-alpha-product="dashpanel"] [data-picodash-panel]')).toBeVisible()
  await expect(
    page.locator('[data-alpha-product="dashlist"] [data-picodash-dashlist]'),
  ).toBeVisible()
  expect(errors).toEqual([])
})

test('keeps the alpha shell usable at 390px without horizontal overflow', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => message.type() === 'error' && errors.push(message.text()))
  page.on('pageerror', (error) => errors.push(error.message))

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/', { waitUntil: 'domcontentloaded' })

  await expect(
    page.getByRole('heading', {
      name: 'Build configurable control panels with typed React components',
      level: 1,
    }),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: 'View current alphas' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Read the contracts' })).toBeVisible()
  await expect(page.locator('[data-alpha-product="dashpanel"] [data-picodash-panel]')).toBeVisible()
  await expect(
    page.locator('[data-alpha-product="dashlist"] [data-picodash-dashlist]'),
  ).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  expect(errors).toEqual([])
})

test('keeps non-home routes unavailable on the single-route alpha site', async ({ request }) => {
  for (const path of [
    '/docs',
    '/examples',
    '/nexus',
    '/usage',
    '/themes',
    '/more-examples',
    '/lab',
  ]) {
    const response = await request.get(path)
    expect(response.status(), path).toBe(404)
  }
})
