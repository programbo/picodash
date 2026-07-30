import { expect, test } from '@playwright/test'

test('synchronizes the external store through one adapter', async ({ page }) => {
  await page.goto('/')
  const panel = page.getByRole('region', { name: 'Debug and feature controls' })
  const rollout = page.getByRole('group', { name: 'Feature rollout' })

  await expect(panel).toBeVisible()
  await expect(rollout).toBeVisible()

  await page.getByRole('button', { name: 'Toggle feature from host' }).click()
  await expect(rollout.getByRole('checkbox', { name: 'New search' })).toBeChecked()

  await rollout.getByRole('slider', { name: 'Rollout percent' }).fill('40')
  await expect(page.getByTestId('host-rollout')).toHaveText('40%')
})

test('resets a compound feature rollout atomically', async ({ page }) => {
  await page.goto('/')
  const rollout = page.getByRole('group', { name: 'Feature rollout' })
  await rollout.getByRole('checkbox', { name: 'New search' }).check()
  await rollout.getByRole('slider', { name: 'Rollout percent' }).fill('80')
  await rollout.getByRole('button', { name: /reset feature rollout/i }).click()

  await expect(page.getByTestId('host-new-search')).toHaveText('Disabled')
  await expect(page.getByTestId('host-rollout')).toHaveText('10%')
})

test('runs explicit domain actions with accessible outcomes', async ({ page }) => {
  await page.goto('/')
  const panel = page.getByRole('region', { name: 'Debug and feature controls' })

  await panel.getByRole('button', { name: 'Clear cache' }).click()
  await expect(page.getByTestId('host-cache-entries')).toHaveText('0')
  await expect(page.getByRole('status')).toContainText(/cache cleared/i)

  await panel.getByRole('button', { name: 'Simulate failure' }).click()
  await expect(page.getByTestId('host-last-action')).toHaveText('failure-simulated')
  await expect(page.getByRole('alert')).toContainText(/simulated failure/i)
})

test('gates all debug affordances and restores launcher focus', async ({ page }) => {
  await page.goto('/')
  const role = page.getByTestId('viewer-role')

  await role.selectOption('operator')
  await expect(page.getByRole('region', { name: 'Debug and feature controls' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /open debug and feature controls/i })).toHaveCount(
    0,
  )

  await role.selectOption('developer')
  await expect(page.getByRole('region', { name: 'Debug and feature controls' })).toBeVisible()
  await page.getByRole('button', { name: /close debug and feature controls/i }).click()
  const launcher = page.getByRole('button', { name: /open debug and feature controls/i })
  await expect(launcher).toBeFocused()
  await launcher.press('Enter')
  await expect(page.getByRole('region', { name: 'Debug and feature controls' })).toBeVisible()
})
