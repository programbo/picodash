import { expect, test } from '@playwright/test'

test('routes home tabs without recreating the persistent demo shell', async ({ page }) => {
  await page.goto('/')

  const shell = page.locator('[data-persistent-demo-shell]')
  await expect(shell).toHaveAttribute('data-product-route', 'home')
  await shell.evaluate((element) => element.setAttribute('data-persistence-probe', 'kept'))

  await page.getByRole('tab', { name: 'Store' }).click()
  await expect(page).toHaveURL('/store')
  await expect(page.locator('[data-persistence-probe="kept"]')).toHaveCount(1)
  await expect(page.getByText('Live panel state')).toBeVisible()

  await page.getByRole('tab', { name: 'Usage' }).click()
  await expect(page).toHaveURL('/usage')
  await expect(page.getByRole('heading', { name: 'Add a reactive Picodash panel' })).toBeVisible()

  await page.getByRole('tab', { name: 'More examples' }).click()
  await expect(page).toHaveURL('/more-examples')
  await expect(
    page.getByRole('heading', { name: 'More complex Picodash compositions' }),
  ).toBeVisible()
})

test('exposes each state lab tab as a route', async ({ page }) => {
  await page.goto('/state-lab?providerTheme=ocean&sceneTheme=plum')
  await expect(page).toHaveURL('/state-lab/provider?providerTheme=ocean&sceneTheme=plum')
  await expect(page.getByRole('heading', { name: 'Picodash State Lab' })).toBeVisible()
  await expect(page.locator('[data-demo-provider-theme="ocean"]')).toHaveCount(1)

  await page.getByRole('tab', { name: 'Scene' }).click()
  await expect(page).toHaveURL('/state-lab/scene?providerTheme=ocean&sceneTheme=plum')

  await page.getByRole('tab', { name: 'Built-in Items' }).click()
  await expect(page).toHaveURL('/state-lab/built-in-items?providerTheme=ocean&sceneTheme=plum')

  await page.getByRole('tab', { name: 'Custom Items' }).click()
  await expect(page).toHaveURL('/state-lab/custom-items?providerTheme=ocean&sceneTheme=plum')
})

test('seeds query themes in the server render', async ({ request }) => {
  const response = await request.get(
    '/state-lab/provider?providerTheme=ocean&sceneTheme=plum&customTheme=light',
  )
  const html = await response.text()

  expect(response.ok()).toBe(true)
  expect(html).toContain('data-demo-provider-theme="ocean"')
  expect(html).toContain('data-picodash-theme="ocean"')
})

test('preserves the route boundary, geometry fixtures, and the not-found page', async ({
  page,
}) => {
  const galleryResponse = await page.goto('/gallery')
  expect(galleryResponse?.status()).toBe(404)
  expect(page.url()).toMatch(/\/gallery\/?$/)
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()

  await page.goto('/panel-geometry-lab?fixture=peer')
  await expect(page.locator('[data-geometry-fixture="snap-peer"]')).toBeVisible()

  const response = await page.goto('/missing-page')
  expect(response?.status()).toBe(404)
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open home' })).toHaveAttribute('href', '/')
})
