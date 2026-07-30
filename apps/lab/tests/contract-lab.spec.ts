import { expect, test, type Page } from '@playwright/test'

const presets = [
  ['placement', 'Placement'],
  ['interaction', 'Interaction'],
  ['composition', 'Composition'],
  ['overlays', 'Overlays'],
  ['documents', 'Documents'],
  ['themes', 'Themes'],
] as const

async function openLab(page: Page) {
  await page.goto('/lab')
  await expect(page.locator('[data-contract-lab-status]')).toHaveAttribute('data-ready', 'true')
}

async function loadPreset(page: Page, preset: (typeof presets)[number][0]) {
  await page.evaluate((nextPreset) => {
    const driver = (
      window as Window & {
        __PICODASH_LAB__?: {
          loadPreset(value: string): void
          version: number
        }
      }
    ).__PICODASH_LAB__

    if (driver?.version !== 1) {
      throw new Error('Contract Lab driver v1 is unavailable')
    }
    driver.loadPreset(nextPreset)
  }, preset)
}

test('publishes a stable driver and independent host status', async ({ page }) => {
  await openLab(page)

  await expect(page.locator('[data-product-route="contract-lab"]')).toHaveCount(1)
  await expect(page.locator('[data-contract-lab-console]')).toBeVisible()
  await expect(page.locator('[data-contract-lab-specimen]')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Contract Lab status' })).toContainText('clear')
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as Window & {
              __PICODASH_LAB__?: { version: number }
            }
          ).__PICODASH_LAB__?.version,
      ),
    )
    .toBe(1)

  await page.getByRole('button', { name: 'Take offline' }).click()
  await expect(page.locator('[data-contract-lab-specimen]')).toHaveCount(0)
  await expect(page.locator('[data-contract-lab-specimen-offline]')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Contract Lab status' })).toContainText('offline')

  await page.getByRole('button', { name: 'Reopen primary specimen' }).click()
  await expect(page.locator('[data-contract-lab-specimen]')).toBeVisible()
})

for (const [preset, label] of presets) {
  test(`loads the ${preset} preset through the public driver`, async ({ page }) => {
    await openLab(page)
    await loadPreset(page, preset)

    await expect(page.locator('[data-contract-lab-specimen]')).toHaveAttribute(
      'data-preset',
      preset,
    )
    await expect(page.locator('[data-contract-lab-specimen]')).toContainText(label)
    await expect(page.getByRole('region', { name: 'Contract Lab status' })).toContainText(label)
    await expect(page.getByRole('radio', { name: new RegExp(label) })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })
}

test('exercises placement mode through public controls and DOM', async ({ page }) => {
  await openLab(page)
  await loadPreset(page, 'placement')

  await page.getByRole('button', { name: 'fixed' }).click()
  await expect(page.getByText('fixed panel')).toBeVisible()
  await expect(page.getByText('Docked · bottom-right')).toBeVisible()
})

test('exercises keyboard-operable ordering through public controls and DOM', async ({ page }) => {
  await openLab(page)
  await loadPreset(page, 'interaction')

  await page.getByRole('button', { name: 'Move Exposure down' }).click()
  await expect(page.getByRole('list', { name: 'Reorderable Dashlets' }).locator('li')).toHaveText([
    'Pinned input↑↓',
    'Frame health↑↓',
    'Exposure↑↓',
    'Recovery action↑↓',
  ])
})

test('exercises compound composition through public controls and DOM', async ({ page }) => {
  await openLab(page)
  await loadPreset(page, 'composition')

  await page.getByLabel('Quality').selectOption('final')
  await page.getByRole('button', { name: 'Retry connection' }).click()
  await expect(page.getByText('Connection restored. No queued changes.')).toBeVisible()
})

test('exercises overlay opening and dismissal through public controls and DOM', async ({
  page,
}) => {
  await openLab(page)
  await loadPreset(page, 'overlays')

  await page.getByRole('button', { name: 'Open confirmation dialog' }).click()
  await expect(page.getByRole('dialog', { name: 'Overlay contract' })).toBeVisible()
  await page.getByRole('button', { name: 'Dismiss' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('exercises invalid and valid document paths through public controls and DOM', async ({
  page,
}) => {
  await openLab(page)
  await loadPreset(page, 'documents')

  await page.getByRole('button', { name: 'Load invalid draft' }).click()
  await page.getByRole('button', { name: 'Validate + apply' }).click()
  await expect(page.getByRole('status')).toContainText('PICODASH_DOCUMENT_INVALID · host preserved')

  await page.getByLabel('Panel document').fill('{ "exposure": 1.5 }')
  await page.getByRole('button', { name: 'Validate + apply' }).click()
  await expect(page.getByRole('status')).toContainText('Applied atomically')
})

test('exercises theme recipes through public controls and DOM', async ({ page }) => {
  await openLab(page)
  await loadPreset(page, 'themes')

  await page.getByRole('button', { name: 'contrast' }).click()
  await expect(page.locator('[data-theme-probe]')).toHaveAttribute('data-theme-probe', 'contrast')
})

test('resets to the canonical placement preset through the public driver', async ({ page }) => {
  await openLab(page)
  await loadPreset(page, 'themes')
  await page.evaluate(() => {
    const driver = (
      window as Window & {
        __PICODASH_LAB__?: { reset(): void }
      }
    ).__PICODASH_LAB__
    if (driver === undefined) throw new Error('Contract Lab driver is unavailable')
    driver.reset()
  })

  await expect(page.locator('[data-contract-lab-specimen]')).toHaveAttribute(
    'data-preset',
    'placement',
  )
  await expect(page.getByRole('region', { name: 'Contract Lab status' })).toContainText('reset')
})
