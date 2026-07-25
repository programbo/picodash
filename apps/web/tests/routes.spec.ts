import { expect, test, type Page } from '@playwright/test'
import { labURL } from './urls'

async function expectSharedHomeLayout(page: Page) {
  const content = page.locator('[data-home-content]')
  await expect(content).toHaveCount(1)
  await expect(content).toHaveCSS('overflow-y', 'visible')
  await expect(content).toHaveCSS('min-height', /\d+px/)
  await expect(page.locator('html')).toHaveCSS('scroll-behavior', 'smooth')
  await expect(page.locator('[data-home-toolbar]')).toHaveCSS('position', 'sticky')
}

async function expectGuidePanel(
  page: Page,
  {
    accessibleName,
    itemCount,
    itemLabels,
    panelId,
  }: {
    accessibleName: string
    itemCount: number
    itemLabels?: readonly string[]
    panelId: string
  },
) {
  const panel = page.locator(`[data-guide-navigation-panel="${panelId}"]`)
  const boundary = page.locator(`[data-guide-navigation-boundary="${panelId}"]`)

  await expect(panel).toHaveCount(1)
  await expect(panel).toHaveAttribute('role', 'navigation')
  await expect(panel).toHaveAccessibleName(accessibleName)
  await expect(panel).toHaveAttribute('data-picodash-theme', 'sidenav')
  await expect(panel.locator('[data-item-kind="control"]')).toHaveCount(itemCount)
  await expect(panel.locator('[data-item-kind="control"] [id$=":label"]')).toHaveText(
    itemLabels ??
      Array.from({ length: itemCount }, (_, index) => String(index + 1).padStart(2, '0')),
  )
  await expect(boundary).toHaveCSS('position', 'sticky')
  await expect(page.locator(`[data-guide-content="${panelId}"]`)).toBeVisible()
}

test('routes home tabs without recreating the persistent demo shell', async ({ page }) => {
  await page.goto('/')

  const shell = page.locator('[data-persistent-demo-shell]')
  await expect(shell).toHaveAttribute('data-product-route', 'home')
  await expectSharedHomeLayout(page)
  await expectGuidePanel(page, {
    accessibleName: 'Code components',
    itemCount: 19,
    panelId: 'code-navigation',
  })
  await shell.evaluate((element) => element.setAttribute('data-persistence-probe', 'kept'))

  await page.getByRole('tab', { name: 'Store' }).click()
  await expect(page).toHaveURL('/store')
  await expectSharedHomeLayout(page)
  await expect(page.locator('[data-persistence-probe="kept"]')).toHaveCount(1)
  await expect(page.getByText('Live panel state')).toBeVisible()

  await page.getByRole('tab', { name: 'Usage' }).click()
  await expect(page).toHaveURL('/usage')
  await expectSharedHomeLayout(page)
  await expectGuidePanel(page, {
    accessibleName: 'Usage guide steps',
    itemCount: 5,
    panelId: 'usage-navigation',
  })
  await expect(page.getByRole('heading', { name: 'Add a reactive Picodash panel' })).toBeVisible()

  await page.getByRole('tab', { name: 'More examples' }).click()
  await expect(page).toHaveURL('/more-examples')
  await expectSharedHomeLayout(page)
  await expectGuidePanel(page, {
    accessibleName: 'More examples',
    itemCount: 4,
    panelId: 'more-examples-navigation',
  })
  await expect(
    page.getByRole('heading', { name: 'More complex Picodash compositions' }),
  ).toBeVisible()

  await page.getByRole('tab', { name: 'Themes' }).click()
  await expect(page).toHaveURL('/themes')
  await expectSharedHomeLayout(page)
  await expectGuidePanel(page, {
    accessibleName: 'Themes',
    itemCount: 7,
    itemLabels: ['System', 'Dark', 'Light', 'Ocean', 'Plum', 'Tron', 'Contrast'],
    panelId: 'themes-navigation',
  })
  await expect(page.locator('[data-theme-guide]')).toBeVisible()
})

test('keeps all home tabs reachable on narrow screens', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await page.goto('/')

  const tabList = page.getByRole('tablist', { name: 'Interactive example views' })
  await expect(tabList).toHaveCSS('overflow-x', 'auto')
  await page.waitForFunction(() => {
    const list = document.querySelector<HTMLElement>(
      '[role="tablist"][aria-label="Interactive example views"]',
    )
    return list !== null && list.scrollWidth > list.clientWidth
  })
})

test('exposes each state lab tab as a route', async ({ page }) => {
  await page.goto(`${labURL}/lab/state?providerTheme=ocean&sceneTheme=plum`)
  await expect(page).toHaveURL(`${labURL}/lab/state/provider?providerTheme=ocean&sceneTheme=plum`)
  await expect(page.getByRole('heading', { name: 'Picodash State Lab' })).toBeVisible()
  await expect(page.locator('[data-demo-provider-theme="ocean"]')).toHaveCount(1)

  await page.getByRole('tab', { name: 'Scene' }).click()
  await expect(page).toHaveURL(`${labURL}/lab/state/scene?providerTheme=ocean&sceneTheme=plum`)

  await page.getByRole('tab', { name: 'Built-in Items' }).click()
  await expect(page).toHaveURL(
    `${labURL}/lab/state/built-in-items?providerTheme=ocean&sceneTheme=plum`,
  )

  await page.getByRole('tab', { name: 'Custom Items' }).click()
  await expect(page).toHaveURL(
    `${labURL}/lab/state/custom-items?providerTheme=ocean&sceneTheme=plum`,
  )
})

test('seeds query themes in the server render', async ({ request }) => {
  const response = await request.get(
    `${labURL}/lab/state/provider?providerTheme=ocean&sceneTheme=plum&customTheme=light`,
  )
  const html = await response.text()

  expect(response.ok()).toBe(true)
  expect(html).toContain('data-demo-provider-theme="ocean"')
  expect(html).toContain('data-picodash-theme="ocean"')
})

test('resolves system theme changes from the browser color scheme', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto(`${labURL}/lab/state/provider?providerTheme=system`)

  expect(
    await page.evaluate(() => window.matchMedia('(prefers-color-scheme: light)').matches),
  ).toBe(true)

  const providerTheme = page.locator('[data-demo-provider-theme]')
  await expect(providerTheme).toHaveAttribute('data-demo-provider-theme', 'light')

  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(providerTheme).toHaveAttribute('data-demo-provider-theme', 'dark')
})

test('exposes isolated debugging labs on their singular routes', async ({ page }) => {
  await page.goto(`${labURL}/lab/panel-interaction`)
  await expect(page).toHaveURL(`${labURL}/lab/panel-interaction`)
  await expect(page.locator('[data-product-route="panel-interaction-lab"]')).toHaveCount(1)

  await page.goto(`${labURL}/lab/dashlets`)
  await expect(page).toHaveURL(`${labURL}/lab/dashlets`)
  await expect(page.locator('[data-product-route="dashlet-lab"]')).toHaveCount(1)
})

test('keeps lab routes out of the product app and preserves both not-found boundaries', async ({
  page,
  request,
}) => {
  const galleryResponse = await page.goto('/gallery')
  expect(galleryResponse?.status()).toBe(404)
  expect(page.url()).toMatch(/\/gallery\/?$/)
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()

  for (const path of [
    '/state-lab',
    '/panel-geometry-lab',
    '/panel-interaction-lab',
    '/dashlet-lab',
  ]) {
    expect((await request.get(path)).status()).toBe(404)
  }

  await page.goto(`${labURL}/lab/panel-geometry?fixture=peer`)
  await expect(page.locator('[data-geometry-fixture="snap-peer"]')).toBeVisible()

  const response = await page.goto(`${labURL}/missing-page`)
  expect(response?.status()).toBe(404)
})
