import { expect, test } from '@playwright/test'

test('synchronizes React-owned creative state in both directions', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('region', { name: 'Creative controls' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Atmosphere' })).toBeVisible()

  await page.getByTestId('host-exposure').fill('1.6')
  await expect(page.getByRole('slider', { name: 'Exposure' })).toHaveValue('1.6')
  await expect(page.getByTestId('scene-summary')).toContainText('1.6 EV')

  await page.getByRole('slider', { name: 'Exposure' }).fill('0.8')
  await expect(page.getByTestId('host-exposure')).toHaveValue('0.8')
  await expect(page.getByTestId('scene-summary')).toContainText('0.8 EV')

  await page.getByRole('spinbutton', { name: 'Temperature' }).fill('7200')
  await expect(page.getByTestId('host-temperature')).toHaveValue('7200')
  await expect(page.getByTestId('scene-summary')).toContainText('7200 K')
})

test('resets the compound as one unit', async ({ page }) => {
  await page.goto('/')
  const atmosphere = page.getByRole('group', { name: 'Atmosphere' })

  await atmosphere.getByRole('slider', { name: 'Exposure' }).fill('0.7')
  await atmosphere.getByRole('spinbutton', { name: 'Temperature' }).fill('8000')
  await atmosphere.getByRole('slider', { name: 'Vignette' }).fill('0.7')
  await atmosphere.getByRole('button', { name: /reset atmosphere/i }).click()

  await expect(page.getByTestId('scene-summary')).toContainText('1.2 EV')
  await expect(page.getByTestId('scene-summary')).toContainText('6500 K')
  await expect(page.getByTestId('scene-summary')).toContainText('vignette 0.25')
})

test('dismisses, restores focus, reopens, and changes theme', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('button', { name: /close creative controls/i }).click()
  const launcher = page.getByRole('button', { name: /open creative controls/i })
  await expect(launcher).toBeVisible()
  await expect(launcher).toBeFocused()

  await launcher.press('Enter')
  await expect(page.getByRole('region', { name: 'Creative controls' })).toBeVisible()

  const theme = page.getByRole('combobox', { name: 'Panel theme' })
  await theme.selectOption('light')
  await expect(page.getByRole('region', { name: 'Creative controls' })).toHaveAttribute(
    'data-picodash-theme',
    'light',
  )
  await theme.selectOption('system')
})
