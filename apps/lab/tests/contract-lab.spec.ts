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

  await page.getByRole('button', { name: 'Primary panel' }).click()
  await expect(
    page.locator('[data-contract-lab-primary-visible="false"]'),
  ).toHaveCount(1)
  await expect(page.getByRole('region', { name: 'Contract Lab status' })).toContainText('hidden')
  await page.getByRole('button', { name: 'Primary panel' }).click()
  await expect(
    page.locator('[data-contract-lab-primary-visible="true"]'),
  ).toHaveCount(1)

  await page.getByRole('button', { name: 'Take offline' }).press('Enter')
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
    await expect(page.getByRole('region', { name: 'Contract Lab status' })).toContainText(label)
    await expect(page.locator(`button[data-preset="${preset}"]`)).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })
}

test('exercises placement mode through public controls and DOM', async ({ page }) => {
  await openLab(page)
  await loadPreset(page, 'placement')

  await page
    .locator('[data-picodash-panel-id="contract-placement-primary"]')
    .getByRole('radio', { name: 'fixed', exact: true })
    .click()
  await expect(
    page.locator(
      '[data-picodash-panel-shell][data-fixed-placement="bottom-right"]:has([data-picodash-panel-id="contract-placement-primary"])',
    ),
  ).toBeVisible()
})

test('exercises focus, keyboard ordering, collapse, deregister, and remount', async ({ page }) => {
  await openLab(page)
  await loadPreset(page, 'interaction')

  const panel = page.locator('[data-picodash-panel-id="contract-interaction-primary"]')
  const exposure = panel.locator('[data-item-id="exposure"] input')
  await exposure.focus()
  await expect(exposure).toBeFocused()

  const reorderExposure = panel.getByRole('button', { name: 'Reorder Exposure' })
  await reorderExposure.press('Enter')
  await reorderExposure.press('ArrowDown')
  await reorderExposure.press('Enter')
  await expect
    .poll(() =>
      panel
        .locator('[data-item-id]')
        .evaluateAll((items) => items.map((item) => item.getAttribute('data-item-id'))),
    )
    .toEqual(['enabled', 'frameHealth', 'exposure', 'note'])

  await panel.getByRole('button', { name: 'Collapse panel Interaction Contract' }).click()
  await expect(panel).toHaveAttribute('data-collapsed', 'true')
  await panel.getByRole('button', { name: 'Expand panel Interaction Contract' }).click()
  await expect(panel).toHaveAttribute('data-collapsed', 'false')

  await panel.getByRole('button', { name: 'Close panel Interaction Contract' }).click()
  await expect(panel).toHaveCount(0)
  await page.getByRole('button', { name: 'Remount primary panel' }).click()
  await expect(
    page.locator('[data-picodash-panel-id="contract-interaction-primary"]'),
  ).toBeVisible()
})

test('exercises compound composition through public controls and DOM', async ({ page }) => {
  await openLab(page)
  await loadPreset(page, 'composition')

  await page.getByRole('button', { name: 'Retry connection' }).click()
  await expect(page.getByText('Recovered', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Reset compound' }).click()
  await expect(page.getByText('Disconnected', { exact: true })).toBeVisible()
})

test('exercises overlay opening and dismissal through public controls and DOM', async ({
  page,
}) => {
  await openLab(page)
  await loadPreset(page, 'overlays')

  await page.getByRole('button', { name: 'Open confirmation dialog' }).click()
  await expect(page.getByRole('dialog', { name: 'Overlay contract' })).toBeVisible()
  await page
    .getByRole('dialog', { name: 'Overlay contract' })
    .getByRole('button', { name: 'Dismiss', exact: true })
    .last()
    .click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('exercises invalid and valid document paths through public controls and DOM', async ({
  page,
}) => {
  await openLab(page)
  await loadPreset(page, 'documents')

  await page.getByRole('button', { name: 'Load invalid draft' }).click()
  await page.getByRole('button', { name: 'Validate + apply' }).click()
  await expect(page.getByText('PICODASH_DOCUMENT_INVALID · host preserved')).toBeVisible()

  const documentEditor = page.getByRole('textbox', { name: 'Panel document' })
  await documentEditor.fill('{ "exposure": 1.5, "quality": "final" }')
  await page.getByRole('button', { name: 'Validate + apply' }).click()
  await expect(page.getByText('Applied atomically')).toBeVisible()
  await page.getByRole('button', { name: 'Export document' }).click()
  await expect(documentEditor).toHaveValue(/"exposure": 1.5/)
  await expect(
    page
      .locator('[data-picodash-panel-id="contract-documents-peer"]')
      .getByText('1.2', { exact: true }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Load repair draft' }).click()
  await page.getByRole('button', { name: 'Validate + apply' }).click()
  await expect(page.getByText('PICODASH_REPAIR_REQUIRED · review before apply')).toBeVisible()
  await page.getByRole('button', { name: 'Apply reviewed repair' }).click()
  await expect(page.getByText('Applied reviewed repair')).toBeVisible()
  await page.getByRole('button', { name: 'Reset document' }).click()
  await expect(page.getByText('Reset registered values')).toBeVisible()
  await expect(documentEditor).toHaveValue(/"exposure": 1.2/)
})

test('exercises theme recipes through public controls and DOM', async ({ page }) => {
  await openLab(page)
  await loadPreset(page, 'themes')

  await page
    .locator('[data-picodash-panel-id="contract-themes-primary"]')
    .getByRole('radio', { name: 'contrast', exact: true })
    .click()
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
