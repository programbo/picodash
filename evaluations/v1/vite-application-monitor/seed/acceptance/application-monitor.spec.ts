import { expect, test } from '@playwright/test'

test('advances one native Nexus transaction across host and Panel', async ({ page }) => {
  await page.goto('/')
  const panel = page.getByRole('region', { name: 'Application monitor' })
  const health = page.getByRole('group', { name: 'Service health' })

  await expect(panel).toBeVisible()
  await expect(health).toBeVisible()
  await expect(health.getByText('812', { exact: true })).toBeVisible()
  await expect(health.getByText('74 ms', { exact: true })).toBeVisible()
  await expect(health.getByText('healthy', { exact: false })).toBeVisible()
  await expect(health.getByRole('progressbar', { name: 'Deployment progress' })).toHaveAttribute(
    'aria-valuenow',
    '20',
  )

  await page.getByRole('button', { name: 'Advance sample' }).click()
  await expect(page.getByTestId('host-requests')).toHaveText('930')
  await expect(health.getByText('930', { exact: true })).toBeVisible()
  await expect(health.getByText('92 ms', { exact: true })).toBeVisible()
  await expect(health.getByRole('progressbar', { name: 'Deployment progress' })).toHaveAttribute(
    'aria-valuenow',
    '45',
  )
})

test('exposes semantic streaming and disconnected states', async ({ page }) => {
  await page.goto('/')
  const health = page.getByRole('group', { name: 'Service health' })
  const stream = health.getByRole('img', { name: 'Request-rate history' })
  const initialDescription = await stream.getAttribute('aria-describedby')

  await page.getByRole('button', { name: 'Advance sample' }).click()
  await expect(stream).toBeVisible()
  await expect(stream).toHaveAttribute('aria-describedby', initialDescription!)

  await page.getByRole('button', { name: 'Advance sample' }).click()
  await page.getByRole('button', { name: 'Advance sample' }).click()
  await expect(health.getByText('disconnected', { exact: false })).toBeVisible()
  await expect(health.getByText(/0 requests/i)).toBeVisible()
})

test('bounds history to twelve samples', async ({ page }) => {
  await page.goto('/')
  for (let index = 0; index < 18; index += 1) {
    await page.getByRole('button', { name: 'Advance sample' }).click()
  }
  await expect(page.getByTestId('stream-sample-count')).toHaveText('12')
})

test('enforces role exposure and restores launcher focus', async ({ page }) => {
  await page.goto('/')
  const role = page.getByTestId('viewer-role')

  await role.selectOption('user')
  await expect(page.getByRole('region', { name: 'Application monitor' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /open application monitor/i })).toHaveCount(0)

  await role.selectOption('developer')
  await expect(page.getByRole('region', { name: 'Application monitor' })).toBeVisible()
  await page.getByRole('button', { name: /close application monitor/i }).click()
  const launcher = page.getByRole('button', { name: /open application monitor/i })
  await expect(launcher).toBeFocused()
  await launcher.press('Enter')
  await expect(page.getByRole('region', { name: 'Application monitor' })).toBeVisible()
})
