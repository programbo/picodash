import { expect, test, type Locator } from '@playwright/test'

async function computedColorForToken(locator: Locator, token: string) {
  return locator.evaluate((element, tokenName) => {
    const probe = document.createElement('span')
    probe.style.color = getComputedStyle(element).getPropertyValue(tokenName)
    document.body.append(probe)
    const color = getComputedStyle(probe).color
    probe.remove()
    return color
  }, token)
}

test('switches and persists the site panel theme from the Themes tab', async ({ page }) => {
  await page.goto('/themes')

  await expect(page.getByRole('tab', { name: 'Themes' })).toHaveAttribute('data-selected', 'true')
  await expect(page.locator('[data-theme-guide]')).toContainText('Put your semantic token recipe')
  await expect(page.locator('[data-theme-guide]')).toContainText(
    '<PicodashProvider<AppTheme> theme="brand">',
  )
  await expect(page.getByRole('heading', { name: 'Built-in themes' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Example themes' })).toBeVisible()
  await expect(page.locator('[data-theme-choice="system"]')).toBeVisible()
  await expect(page.locator('[data-theme-code]')).toContainText("data-picodash-theme='dark'")
  await expect(page.locator('[data-theme-code] [data-theme-swatch]')).toHaveCount(21)

  await page.locator('[data-theme-choice="ocean"]').click()

  const provider = page.locator('[data-picodash-provider-content]')
  await expect(provider).toHaveAttribute('data-picodash-theme', 'ocean')
  await expect(page.locator('[data-theme-code]')).toContainText("data-picodash-theme='ocean'")

  await page.locator('[data-theme-choice="tron"]').click()
  await expect(provider).toHaveAttribute('data-picodash-theme', 'tron')
  await expect(page.locator('[data-theme-code]')).toContainText("data-picodash-theme='tron'")
  await expect(page.locator('[data-theme-code]')).not.toContainText('--tron')
  await expect(page.locator('[data-theme-code]')).not.toContainText('neon')
  const tronPanel = page.locator('[data-picodash-panel]')
  expect(
    await tronPanel.evaluate((element) =>
      getComputedStyle(element).getPropertyValue('--picodash-color-surface').trim(),
    ),
  ).toMatch(/lab\(/)
  expect(
    await tronPanel.evaluate((element) =>
      getComputedStyle(element).getPropertyValue('--picodash-color-text').trim(),
    ),
  ).toMatch(/lab\(/)
  expect(
    await tronPanel.evaluate((element) =>
      getComputedStyle(element).getPropertyValue('--picodash-color-border').trim(),
    ),
  ).toMatch(/lab\(/)
  expect(
    await tronPanel.evaluate((element) =>
      getComputedStyle(element).getPropertyValue('--picodash-theme-border-shadow'),
    ),
  ).toContain('lab(')
  expect(await tronPanel.evaluate((element) => getComputedStyle(element).boxShadow)).toContain(
    'lab(',
  )
  await page.locator("[data-item-id='select'] [data-slot='select-trigger']").click()
  const tronSelect = page.locator("[data-slot='select-content'][data-picodash-theme='tron']")
  await expect(tronSelect).toBeVisible()
  expect(
    await tronSelect.evaluate((element) =>
      getComputedStyle(element).getPropertyValue('--picodash-color-surface'),
    ),
  ).toMatch(/lab\(/)
  await page.keyboard.press('Escape')
  for (const selector of [
    "[data-item-id='text'] [data-slot='input']",
    "[data-item-id='multilineText'] [data-slot='textarea']",
    "[data-item-id='select'] [data-slot='select-trigger']",
    "[id='xyPad:input:pad']",
    "[data-item-id='previewAsset'] .border-picodash-control",
    '[data-picodash-chart]',
  ]) {
    expect(
      await page.locator(selector).evaluate((element) => getComputedStyle(element).boxShadow),
    ).toContain('lab(')
  }
  expect(
    await page
      .locator("[data-item-id='slider'] [data-slot='slider-thumb']")
      .evaluate((element) => getComputedStyle(element, '::before').boxShadow),
  ).toContain('lab(')
  expect(
    await page
      .locator('[data-picodash-panel] h2')
      .evaluate((element) => getComputedStyle(element).textShadow),
  ).not.toBe('none')
  expect(
    await page
      .locator('[id="text:label"]')
      .evaluate((element) => getComputedStyle(element).textShadow),
  ).toBe('none')
  expect(
    await page
      .locator('[id="sparkline:label"]')
      .evaluate((element) => getComputedStyle(element).overflow),
  ).toBe('visible')
  expect(
    await page
      .locator('[data-item-id="segmented"] [data-slot="toggle-group"]')
      .evaluate((element) => getComputedStyle(element).overflow),
  ).toBe('visible')
  expect(
    await page
      .locator('[data-item-id="segmented"] [data-slot="toggle-group"]')
      .evaluate((element) => getComputedStyle(element).boxShadow),
  ).toContain('lab(')
  expect(
    await page
      .locator('[data-picodash-chart] .recharts-cartesian-axis-tick-value')
      .first()
      .evaluate((element) => getComputedStyle(element).fill),
  ).toMatch(/lab\(/)
  expect(
    await page
      .locator('[data-theme-guide]')
      .evaluate((element) => getComputedStyle(element).textShadow),
  ).toBe('none')

  await page.reload()
  await expect(provider).toHaveAttribute('data-picodash-theme', 'tron')
  await expect(page.locator('[data-theme-choice="tron"]')).toHaveAttribute('aria-current', 'page')
})

test('migrates the persisted Cyber example to Tron', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('picodash-demo:provider-theme:v1', 'cyber')
  })
  await page.goto('/themes')

  await expect(page.locator('[data-picodash-provider-content]')).toHaveAttribute(
    'data-picodash-theme',
    'tron',
  )
  await expect(page.locator('[data-theme-choice="tron"]')).toHaveAttribute('aria-current', 'page')
})

test('keeps System swatches tied to the system color scheme', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/themes')

  const systemSwatches = page.locator('[data-theme-nav-swatch="system"]')
  await expect
    .poll(() =>
      systemSwatches.first().evaluate((element) => (element as HTMLElement).style.backgroundColor),
    )
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

test('renders the high-contrast example on the panel only', async ({ page }) => {
  await page.goto('/themes')
  await page.locator('[data-theme-choice="contrast"]').click()

  const panel = page.locator('[data-picodash-panel]')
  await expect(panel).toHaveAttribute('data-picodash-theme', 'contrast')
  await expect(page.locator('[data-theme-code]')).toContainText("data-picodash-theme='contrast'")
  expect(await panel.evaluate((element) => getComputedStyle(element).colorScheme)).toBe('light')
  expect(await panel.evaluate((element) => getComputedStyle(element).color)).toBe('rgb(0, 0, 0)')
  expect(
    await panel
      .locator('[data-slot="select-value"]')
      .evaluate((element) => getComputedStyle(element).getPropertyValue('--picodash-color-text')),
  ).toMatch(/#000|rgb\(0 0 0\)/)
  expect(
    await panel
      .locator('[data-slot="select-value"]')
      .evaluate((element) => getComputedStyle(element).fontFamily),
  ).toContain('Avenir Next')
  expect(
    await panel.locator('h2').evaluate((element) => getComputedStyle(element).textShadow),
  ).not.toBe('none')
  await page.locator("[data-item-id='select'] [data-slot='select-trigger']").click()
  const contrastSelect = page.locator(
    "[data-slot='select-content'][data-picodash-theme='contrast']",
  )
  await expect(contrastSelect).toBeVisible()
  expect(
    await contrastSelect.evaluate((element) =>
      getComputedStyle(element).getPropertyValue('--picodash-color-text'),
    ),
  ).toMatch(/(?:rgb\(0 0 0\)|#000)/)
  expect(
    await page
      .locator('[data-theme-guide]')
      .evaluate((element) => getComputedStyle(element).textShadow),
  ).toBe('none')
})

test('applies the high-contrast theme to fixed panel toggles', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('[data-picodash-panel-id="built-in-items"]')).toBeVisible()

  const example = page.locator('[data-interactive-jsx-example]')
  await example.getByLabel('Provider theme').selectOption('contrast')
  await expect(page.locator('[data-demo-provider-theme]')).toHaveAttribute(
    'data-demo-provider-theme',
    'contrast',
  )
  await example.getByLabel('Panel placement mode').selectOption('fixed')
  await example.getByLabel('Panel placement position').selectOption('top-right')

  const shell = page.locator(
    '[data-picodash-panel-shell]:has([data-picodash-panel-id="built-in-items"])',
  )
  await expect(shell).toHaveAttribute('data-fixed-placement', 'top-right')
  await expect
    .poll(() =>
      shell.evaluate((element) => {
        const rect = element.getBoundingClientRect()
        return {
          position: getComputedStyle(element).position,
          right: Math.round(window.innerWidth - rect.right),
          top: Math.round(rect.top),
        }
      }),
    )
    .toEqual({ position: 'absolute', right: 0, top: 0 })

  const toggle = page.locator('[data-picodash-fixed-toggle]')
  await expect(toggle).toHaveAttribute('data-picodash-theme', 'contrast')
  await expect(toggle).toHaveCSS(
    'color',
    await computedColorForToken(toggle, '--picodash-color-text'),
  )
  await expect(toggle).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')

  await toggle.click()

  await expect(toggle).toHaveAccessibleName('Expand panel Built-in Items')
  await expect(toggle).toHaveCSS(
    'color',
    await computedColorForToken(toggle, '--picodash-color-text-muted'),
  )
  const expectedRevealBackground = await toggle.evaluate((element) => {
    const surface = getComputedStyle(element).getPropertyValue('--picodash-color-surface')
    const probe = document.createElement('span')
    probe.style.backgroundColor = `color-mix(in oklab, ${surface} 72%, transparent)`
    document.body.append(probe)
    const background = getComputedStyle(probe).backgroundColor
    probe.remove()
    return background
  })
  await expect
    .poll(() => toggle.evaluate((element) => getComputedStyle(element).backgroundColor))
    .toBe(expectedRevealBackground)
})
