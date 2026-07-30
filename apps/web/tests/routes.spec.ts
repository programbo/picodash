import { expect, test, type Page } from '@playwright/test'

test.describe.configure({ mode: 'serial', timeout: 60_000 })

function observeRuntimeErrors(page: Page) {
  const errors: string[] = []

  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
  page.on('pageerror', (error) => {
    errors.push(`page: ${error.message}`)
  })

  return errors
}

async function expectNoRuntimeErrors(errors: string[]) {
  await expect.poll(() => errors).toEqual([])
}

test('presents the agent-first homepage without runtime errors on desktop and mobile', async ({
  page,
}) => {
  const errors = observeRuntimeErrors(page)

  await page.setViewportSize({ height: 900, width: 1440 })
  await page.goto('/', { waitUntil: 'domcontentloaded' })

  for (const viewport of [
    { height: 900, width: 1440 },
    { height: 844, width: 390 },
  ]) {
    await page.setViewportSize(viewport)
    await expect(page.locator('[data-product-route="home"]')).toHaveCount(1)
    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Dashboard surface, without the ceremony',
      }),
    ).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Product' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Agent guide' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Components' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Examples' })).toBeVisible()
  }

  await expectNoRuntimeErrors(errors)
})

test('renders three scenarios as real compound Dashlet surfaces', async ({ page }) => {
  const errors = observeRuntimeErrors(page)
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const home = page.locator('[data-home-content]')

  for (const title of [
    'Creative controls',
    'Application monitoring',
    'Debug and rollout controls',
  ]) {
    await expect(home.getByRole('heading', { level: 2, name: title })).toBeVisible()
  }

  for (const [triggerName, itemId, panelTitle] of [
    ['Reopen creative controls', 'creative-profile', 'Creative controls'],
    ['Reopen monitoring controls', 'monitoring-compound', 'Monitoring controls'],
  ] as const) {
    const item = page.locator(`[data-item-id="${itemId}"]`)
    if ((await item.count()) === 0) {
      await page.getByRole('button', { name: triggerName }).press('Enter')
    }
    await expect(item).toBeAttached()
    await page.getByRole('button', { name: `Close panel ${panelTitle}` }).press('Enter')
  }

  await expect(
    page.getByText('One registered item coordinates five writable Store fields.'),
  ).toBeAttached()

  await page.getByRole('button', { name: 'Launch debug panel' }).press('Enter')
  await expect(page.locator('[data-item-id="debug-adapter-controls"]')).toBeAttached()
  await expectNoRuntimeErrors(errors)
})

test('opens, closes, and reopens the hidden Built-in Items panel', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })

  const panel = page.locator('[data-picodash-panel-id="built-in-items"]')
  const explore = page.getByRole('button', { name: 'Explore demo' })

  await expect(panel).toHaveCount(0)
  await explore.click()
  await expect(panel).toBeVisible()

  await page.getByRole('button', { name: 'Close panel Built-in Items' }).click()
  await expect(panel).toBeHidden()

  await explore.click()
  await expect(panel).toBeVisible()
})

test('copies the canonical agent prompt and reports success', async ({ context, page }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/', { waitUntil: 'domcontentloaded' })

  await page.getByRole('button', { name: 'Copy agent prompt' }).click()
  await expect(page.getByRole('button', { name: 'Copied prompt' })).toBeVisible()
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain('Use the canonical agent playbook at /docs/get-started/agent')
})

test('navigates the documentation and catalog reference', async ({ page }) => {
  await page.goto('/docs', { waitUntil: 'domcontentloaded' })

  const navigation = page.getByRole('navigation', { name: 'Documentation' })
  await expect(page.locator('[data-product-route="docs"]')).toHaveCount(1)
  await navigation.getByRole('link', { name: 'Agent playbook' }).click()
  await expect(page).toHaveURL('/docs/get-started/agent')
  await expect(page.getByRole('heading', { level: 1, name: 'Agent playbook' })).toBeVisible()

  await navigation.getByRole('link', { name: 'Dashlet components' }).click()
  await expect(page).toHaveURL('/docs/reference/dashlet-components')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Dashlet anatomy components' }),
  ).toBeVisible()
  await expect(
    page.getByRole('table', { name: 'Machine-readable component contracts' }),
  ).toBeVisible()
})

test('permanently redirects legacy product routes to the canonical IA', async ({ request }) => {
  for (const [legacyPath, canonicalPath] of [
    ['/store', '/docs/reference/store'],
    ['/usage', '/docs/get-started/manual'],
    ['/themes', '/docs/guides/dashlet-themes'],
    ['/more-examples', '/examples'],
    ['/usage/components', '/docs/reference/dashlet-components'],
  ] as const) {
    const response = await request.get(legacyPath, { maxRedirects: 0 })

    expect(response.status(), legacyPath).toBe(308)
    expect(response.headers().location, legacyPath).toBe(canonicalPath)
  }
})

test('compiles four public recipes on the examples route without runtime errors', async ({
  page,
}) => {
  const errors = observeRuntimeErrors(page)
  await page.goto('/examples', { waitUntil: 'domcontentloaded' })

  await expect(page.locator('[data-product-route="examples"]')).toHaveCount(1)
  await expect(page.getByRole('heading', { level: 1, name: /Four useful Dashlets/ })).toBeVisible()
  const recipes = page.getByRole('region', { name: 'Picodash example recipes' })

  for (const title of [
    'Performance health',
    'Media transport',
    'Deployment status',
    'Application-specific controls',
  ]) {
    await expect(recipes.getByRole('heading', { level: 2, name: title }).first()).toBeVisible()
  }

  for (const [title, panelId] of [
    ['Performance health', 'example-performance-health'],
    ['Media transport', 'example-media-transport'],
    ['Deployment status', 'example-deployment-status'],
    ['Application-specific controls', 'example-map-overlay'],
  ] as const) {
    const recipe = recipes
      .locator('article')
      .filter({ has: page.getByRole('heading', { level: 2, name: title }) })
    const panel = page.locator(`[data-picodash-panel-id="${panelId}"]`)
    if ((await panel.count()) === 0 || !(await panel.isVisible())) {
      await recipe.getByRole('button', { name: 'Toggle panel' }).press('Enter')
    }
    await expect(panel).toBeVisible()
  }

  await expectNoRuntimeErrors(errors)
})
