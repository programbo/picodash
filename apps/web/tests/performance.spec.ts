import { expect, test } from '@playwright/test'

test('changes home tabs without a document navigation or losing provider state', async ({
  page,
}) => {
  await page.goto('/')

  const shell = page.locator('[data-persistent-demo-shell]')
  await shell.evaluate((element) => element.setAttribute('data-performance-probe', 'kept'))
  const navigationEntries = await page.evaluate(
    () => performance.getEntriesByType('navigation').length,
  )

  await page.getByRole('tab', { name: 'Usage' }).click()

  await expect(page).toHaveURL('/usage')
  await expect(page.getByRole('heading', { name: 'Add a reactive Picodash panel' })).toBeVisible()
  await expect(page.locator('[data-performance-probe="kept"]')).toHaveCount(1)
  await expect
    .poll(() => page.evaluate(() => performance.getEntriesByType('navigation').length))
    .toBe(navigationEntries)
})

test('keeps keyboard tab navigation functional when the home tab list overflows', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await page.goto('/')

  const tabList = page.getByRole('tablist', { name: 'Interactive example views' })
  await expect
    .poll(() => tabList.evaluate((element) => element.scrollWidth > element.clientWidth))
    .toBe(true)

  const codeTab = page.getByRole('tab', { name: 'Code' })
  await codeTab.focus()
  await page.keyboard.press('End')

  await expect(page).toHaveURL('/themes')
  await expect(page.getByRole('tab', { name: 'Themes' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('[data-theme-guide]')).toBeVisible()
})

test('defers the chart implementation until its panel surface enters the viewport', async ({
  page,
}) => {
  await page.goto('/')

  const chart = page.locator('[data-item-id="shadcn-frame-chart"] [data-picodash-chart]')
  await expect(chart).toBeAttached()
  await expect(chart.locator('.recharts-wrapper')).toHaveCount(0)

  await chart.scrollIntoViewIfNeeded()

  await expect(chart.locator('.recharts-wrapper')).toHaveCount(1)
})
