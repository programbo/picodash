import { expect, test, type Page } from '@playwright/test'

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
    itemCount: 6,
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

test('serves the standalone documentation route', async ({ page }) => {
  await page.goto('/docs')

  await expect(page.locator('[data-product-route="docs"]')).toHaveCount(1)
  await expect(page.getByRole('link', { name: 'Picodash' }).locator('svg')).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Documentation' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Introduction', level: 1 })).toBeVisible()
  await expect(page.locator('[data-persistent-demo-shell]')).toHaveCount(0)
})

test('serves the catalog-backed reference routes and permanent legacy redirect', async ({
  page,
  request,
}) => {
  for (const [path, heading] of [
    ['/docs/reference/dashlets', 'Built-in Panel controls'],
    ['/docs/reference/dashlet-components', 'Dashlet anatomy components'],
    ['/docs/reference/ui', 'UI foundations'],
  ] as const) {
    await page.goto(path)
    await expect(page.locator('[data-docs-reference]')).toHaveCount(1)
    await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()
    await expect(
      page.getByRole('table', { name: 'Machine-readable component contracts' }),
    ).toBeVisible()
  }

  const redirect = await request.get('/usage/components', { maxRedirects: 0 })
  expect(redirect.status()).toBe(308)
  expect(redirect.headers().location).toBe('/docs/reference/dashlet-components')
})

test('keeps Lab and retired routes out of the public website', async ({ page, request }) => {
  const galleryResponse = await page.goto('/gallery')
  expect(galleryResponse?.status()).toBe(404)
  expect(page.url()).toMatch(/\/gallery\/?$/)
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()

  for (const path of [
    '/lab',
    '/lab/state',
    '/state-lab',
    '/panel-geometry-lab',
    '/panel-interaction-lab',
    '/dashlet-lab',
  ]) {
    expect((await request.get(path)).status()).toBe(404)
  }
})
