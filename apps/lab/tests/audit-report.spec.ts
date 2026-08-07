import { expect, test } from '@playwright/test'

const auditId = 'homepage-examples-2026-07-31'

test('renders a complete visual audit with loadable evidence', async ({ page }) => {
  await page.goto(`/audit/${auditId}`)

  await expect(page.locator('[data-product-route="audit"]')).toHaveAttribute(
    'data-audit-id',
    auditId,
  )
  await expect(
    page.getByRole('heading', { name: 'Homepage and examples visual audit' }),
  ).toBeVisible()
  await expect(page.locator('article')).toHaveCount(6)
  await expect(page.getByRole('link', { name: 'http://localhost:6030/' }).first()).toBeVisible()

  const evidence = page.locator('article img')
  await expect(evidence).toHaveCount(10)
  for (let index = 0; index < 10; index += 1) {
    const image = evidence.nth(index)
    await image.scrollIntoViewIfNeeded()
    await expect
      .poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0)
  }
})

test('returns not found for an unknown audit id', async ({ page }) => {
  const response = await page.goto('/audit/not-a-real-audit')

  expect(response?.status()).toBe(404)
})
