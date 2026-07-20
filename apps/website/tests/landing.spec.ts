import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('renders the landing hero with primary and secondary destinations', async ({ page }) => {
  const nav = page.getByRole('navigation', { name: 'Product navigation' })
  const galleryLink = nav.getByRole('link', { name: 'Gallery' })
  const stateLabLink = nav.getByRole('link', { name: 'State Lab' })

  await expect(
    page.getByRole('heading', {
      name: 'A composable React inspector panel library for technical tooling',
    }),
  ).toBeVisible()
  await expect(galleryLink).toHaveAttribute('href', '/gallery')
  await expect(stateLabLink).toHaveAttribute('href', '/state-lab')
  await expect(galleryLink).toBeVisible()
  await expect(page.locator('[data-landing-primary-cta]')).toBeVisible()
  await expect(page.getByText('bun add tweaker', { exact: true })).toBeVisible()
})

test('shows an interactive product showcase with live panel controls', async ({ page }) => {
  const panel = page.locator('[data-landing-panel]')
  const panelHost = page.locator('[data-landing-panel-host]')
  const showcaseSignal = page.locator('[data-landing-surface]')
  const heroHeading = page.getByRole('heading', {
    name: 'A composable React inspector panel library for technical tooling',
  })
  const primaryControl = panel.locator('[data-item-id="exposure"] input[type="range"]')
  const frameTarget = panel.getByText(/Frame target/)
  const switchControl = panel.getByRole('switch', { name: 'Live signal sync' })
  const firstColumn = showcaseSignal.locator('[data-landing-column]').first()

  await expect(panel).toBeVisible()
  await expect(panel.getByText('Quality')).toBeVisible()
  await expect(primaryControl).toBeVisible()
  await expect(switchControl).toBeVisible()
  await expect(frameTarget).toBeVisible()
  await expect(showcaseSignal).toBeVisible()
  await expect(primaryControl).toBeVisible()
  const heroRect = await heroHeading.boundingBox()
  const panelRect = await panel.boundingBox()
  const hostRect = await panelHost.boundingBox()
  if (!heroRect || !panelRect || !hostRect) {
    throw new Error('Failed to measure landing panel or host geometry.')
  }
  expect(panelRect.y).toBeGreaterThanOrEqual(heroRect.y + heroRect.height - 1)
  expect(panelRect.x).toBeGreaterThanOrEqual(hostRect.x)
  expect(panelRect.x + panelRect.width).toBeLessThanOrEqual(hostRect.x + hostRect.width + 1)
  const firstColumnHeightBefore = await firstColumn.evaluate(
    (node) => node.getBoundingClientRect().height,
  )
  const frameTargetBefore = await panel.locator('[data-item-id="frame-target"]').textContent()
  await primaryControl.fill('1.2')
  const frameTargetAfter = await expect
    .poll(() => panel.locator('[data-item-id="frame-target"]').textContent())
    .not.toEqual(frameTargetBefore)
  const firstColumnHeightAfter = await expect
    .poll(() => firstColumn.evaluate((node) => node.getBoundingClientRect().height))
    .not.toEqual(firstColumnHeightBefore)
  expect(frameTargetAfter).not.toEqual(frameTargetBefore)
  expect(firstColumnHeightAfter).not.toEqual(firstColumnHeightBefore)
})

test('keeps landing content within viewport width on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })

  await expect(page.locator('[data-landing-page]')).toBeVisible()
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
  expect(overflow).toBeLessThanOrEqual(2)
  const panel = page.locator('[data-landing-panel]')
  const panelHost = page.locator('[data-landing-panel-host]')
  const heroHeading = page.getByRole('heading', {
    name: 'A composable React inspector panel library for technical tooling',
  })

  const hero = page.getByRole('heading', { name: 'Live demo' })
  await expect(hero).toBeVisible()
  const panelRect = await panel.boundingBox()
  const hostRect = await panelHost.boundingBox()
  const heroRect = await heroHeading.boundingBox()
  if (!panelRect || !hostRect || !heroRect) {
    throw new Error('Failed to measure landing panel geometry on mobile viewport.')
  }
  const viewportWidth = 390
  expect(panelRect.y).toBeGreaterThanOrEqual(heroRect.y + heroRect.height - 1)
  expect(panelRect.x).toBeGreaterThanOrEqual(hostRect.x - 1)
  expect(panelRect.x + panelRect.width).toBeLessThanOrEqual(hostRect.x + hostRect.width + 1)
  expect(panelRect.width).toBeLessThanOrEqual(viewportWidth)
  expect(panelRect.x + panelRect.width).toBeLessThanOrEqual(viewportWidth + 2)
})
