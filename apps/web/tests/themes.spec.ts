import { expect, test } from '@playwright/test'

test('switches and persists the site panel theme from the Themes tab', async ({ page }) => {
  await page.goto('/themes')

  await expect(page.getByRole('tab', { name: 'Themes' })).toHaveAttribute('data-selected', 'true')
  await expect(page.getByRole('heading', { name: 'Themes you can read and reuse' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Built-in themes' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Example themes' })).toBeVisible()
  await expect(page.locator('[data-theme-choice="system"]')).toBeVisible()
  await expect(page.locator('[data-theme-code]')).toContainText("data-picodash-theme='dark'")
  await expect(page.locator('[data-theme-swatch]')).toHaveCount(21)

  await page.locator('[data-theme-choice="ocean"]').click()

  const provider = page.locator('[data-picodash-provider-content]')
  await expect(provider).toHaveAttribute('data-picodash-theme', 'ocean')
  await expect(page.locator('[data-theme-code]')).toContainText("data-picodash-theme='ocean'")

  await page.reload()
  await expect(provider).toHaveAttribute('data-picodash-theme', 'ocean')
  await expect(page.locator('[data-theme-choice="ocean"]')).toHaveAttribute('aria-current', 'page')
})

test('keeps System swatches tied to the system color scheme', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/themes')

  const systemSwatches = page.locator('[data-theme-nav-swatch="system"]')
  await expect
    .poll(() => systemSwatches.first().evaluate((element) => (element as HTMLElement).style.backgroundColor))
    .toBe('oklch(0.963 0.002 197.1)')
  const lightSwatches = await systemSwatches.evaluateAll((elements) =>
    elements.map((element) => (element as HTMLElement).style.backgroundColor),
  )

  await page.locator('[data-theme-choice="dark"]').click()
  await expect(page.locator('[data-picodash-provider-content]')).toHaveAttribute(
    'data-picodash-theme',
    'dark',
  )
  expect(
    await systemSwatches.evaluateAll((elements) =>
      elements.map((element) => (element as HTMLElement).style.backgroundColor),
    ),
  ).toEqual(lightSwatches)

  await page.emulateMedia({ colorScheme: 'dark' })
  await expect
    .poll(() =>
      systemSwatches.evaluateAll((elements) =>
        elements.map((element) => (element as HTMLElement).style.backgroundColor),
      ),
    )
    .toEqual([
      'oklch(0.148 0.004 228.8)',
      'oklch(0.218 0.008 223.9)',
      'oklch(0.218 0.008 223.9)',
      'oklch(0.275 0.011 216.9)',
      'oklch(0.987 0.002 197.1)',
      'oklch(1 0 0)',
    ])
})
