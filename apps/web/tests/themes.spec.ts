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

async function computedDescriptionColor(locator: Locator) {
  return locator.evaluate((element) => {
    const probe = document.createElement('span')
    probe.style.color =
      'color-mix(in oklab, var(--picodash-color-text-muted) 70%, var(--picodash-color-text))'
    element.append(probe)
    const color = getComputedStyle(probe).color
    probe.remove()
    return color
  })
}

test('switches and persists the site panel theme from the Themes tab', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'no-preference' })
  await page.goto('/themes')

  await expect(page.getByRole('tab', { name: 'Themes' })).toHaveAttribute('data-selected', 'true')
  await expect(page.locator('[data-theme-guide]')).toContainText('Put your semantic token recipe')
  await expect(page.locator('[data-theme-guide]')).toContainText(
    '<PicodashProvider<AppTheme> theme="brand">',
  )
  await expect(page.getByRole('button', { name: 'Built-in themes' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Example themes' })).toBeVisible()
  await expect(page.locator('[data-theme-choice="system"]')).toBeVisible()
  await expect(page.locator('[data-item-id="themes-navigation-system"]')).toContainText(
    'Your preferred theme is set to dark',
  )
  const sideNav = page.locator('[data-guide-navigation-panel="themes-navigation"]')
  await expect(sideNav).toHaveCSS('background-image', 'none')
  await expect(sideNav).not.toHaveCSS('border-color', 'rgba(0, 0, 0, 0)')
  const sideNavHeader = sideNav.locator('[data-picodash-panel-header]')
  expect(await sideNavHeader.evaluate((element) => getComputedStyle(element).color)).toBe(
    await computedColorForToken(sideNav, '--picodash-color-focus'),
  )
  await expect(sideNavHeader).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  const sideNavGroupHeaders = sideNav.locator('[data-item-kind="group"] > div:first-child')
  await expect(sideNavGroupHeaders).toHaveCount(2)
  const sideNavGroupList = sideNav.locator('[data-item-kind="group"]').first().locator('..')
  await expect(sideNavGroupList).toHaveCSS('row-gap', '0px')
  await expect(sideNavGroupList).toHaveCSS('padding-bottom', '0px')
  expect(
    await sideNavGroupList.evaluate((groupList) => {
      const groups = groupList.querySelectorAll<HTMLElement>(':scope > [data-item-kind="group"]')
      const firstRect = groups[0]?.getBoundingClientRect()
      const secondRect = groups[1]?.getBoundingClientRect()
      const finalRect = groups[groups.length - 1]?.getBoundingClientRect()
      const listRect = groupList.getBoundingClientRect()

      return {
        betweenGroups: firstRect && secondRect ? secondRect.top - firstRect.bottom : null,
        belowFinalGroup: finalRect ? listRect.bottom - finalRect.bottom : null,
      }
    }),
  ).toEqual({ belowFinalGroup: 0, betweenGroups: 0 })
  expect(
    await sideNavGroupHeaders
      .first()
      .locator('button')
      .evaluate((element) => getComputedStyle(element).color),
  ).toBe(await computedColorForToken(sideNav, '--picodash-color-info'))
  expect(
    await sideNavGroupHeaders
      .nth(1)
      .locator('button')
      .evaluate((element) => getComputedStyle(element).color),
  ).toBe(await computedColorForToken(sideNav, '--picodash-color-warning'))
  for (const groupHeader of await sideNavGroupHeaders.all()) {
    await expect(groupHeader).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    expect(
      await groupHeader.evaluate((header) => {
        const button = header.querySelector('button')
        if (!button) {
          throw new Error('Expected the group header to contain its disclosure button')
        }

        const headerRect = header.getBoundingClientRect()
        const buttonRect = button.getBoundingClientRect()
        const headerStyle = getComputedStyle(header)
        return {
          bottom:
            headerRect.bottom -
            buttonRect.bottom -
            Number.parseFloat(headerStyle.borderBottomWidth),
          left: buttonRect.left - headerRect.left,
          right: headerRect.right - buttonRect.right,
          top: buttonRect.top - headerRect.top - Number.parseFloat(headerStyle.borderTopWidth),
        }
      }),
    ).toEqual({ bottom: 0, left: 0, right: 0, top: 0 })
  }
  await expect(sideNav.locator('[data-item-id="themes-navigation-system"]')).not.toHaveCSS(
    'border-bottom-color',
    'rgba(0, 0, 0, 0)',
  )
  await expect(sideNav.locator('[data-item-id="themes-navigation-light"]')).toHaveCSS(
    'border-bottom-color',
    'rgba(0, 0, 0, 0)',
  )
  const plumItem = sideNav.locator('[data-item-id="themes-navigation-plum"]')
  const plumStaticSlot = plumItem.locator('[data-picodash-reorder-slot="static"]')
  await expect(plumItem.getByRole('button', { name: 'Reorder Plum' })).toHaveCount(0)
  await plumStaticSlot.evaluate((element) => (element as HTMLElement).focus())
  await expect(plumStaticSlot).not.toBeFocused()
  for (const { label, token } of [
    { label: 'Code', token: '--picodash-color-focus' },
    { label: 'Store', token: '--picodash-color-info' },
    { label: 'Usage', token: '--picodash-color-warning' },
    { label: 'Themes', token: '--picodash-color-accent' },
  ]) {
    const headerSwatch = page.getByRole('tab', { name: label }).locator('span').first()
    expect(await computedColorForToken(sideNav, token)).toBe(
      await headerSwatch.evaluate((element) => getComputedStyle(element).backgroundColor),
    )
  }
  await expect(page.locator('[data-theme-code]')).toContainText("data-picodash-theme='dark'")
  await expect(page.locator('[data-theme-code] [data-theme-swatch]')).toHaveCount(21)

  const oceanChoice = page.locator('[data-theme-choice="ocean"]')
  await page.locator('[id="themes-navigation-ocean:label"]').click()

  const provider = page.locator('[data-picodash-provider-content]')
  await expect(oceanChoice).toBeFocused()
  await expect(provider).toHaveAttribute('data-picodash-theme', 'ocean')
  await expect(page.locator('[data-theme-code]')).toContainText("data-picodash-theme='ocean'")

  await page.locator('[data-theme-choice="tron"]').focus()
  await expect(provider).toHaveAttribute('data-picodash-theme', 'tron')
  await expect(page.locator('[data-theme-code]')).toContainText("data-picodash-theme='tron'")
  await expect(page.locator('[data-theme-code]')).not.toContainText('--tron')
  await expect(page.locator('[data-theme-code]')).not.toContainText('neon')
  const tronPanel = page.locator('[data-picodash-panel-id="built-in-items"]')
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
  expect(await tronPanel.evaluate((element) => getComputedStyle(element).borderColor)).toBe(
    'rgba(0, 0, 0, 0)',
  )
  const tronBorder = await tronPanel.evaluate((element) => {
    const style = getComputedStyle(element, '::before')
    return {
      animationDuration: style.animationDuration,
      animationName: style.animationName,
      backgroundImage: style.backgroundImage,
      content: style.content,
      transform: style.transform,
      willChange: style.willChange,
    }
  })
  expect(tronBorder.content).not.toBe('none')
  expect(tronBorder.backgroundImage).toContain('conic-gradient')
  expect(tronBorder.animationName).toBe('picodash-tron-panel-border-spin')
  expect(tronBorder.animationDuration).toBe('10s')
  expect(tronBorder.willChange).toContain('transform')
  expect(
    await tronPanel.evaluate((element) => {
      const panelRect = element.getBoundingClientRect()
      const shellRect = element.closest('[data-picodash-panel-shell]')!.getBoundingClientRect()
      return {
        contain: getComputedStyle(element).contain,
        leftOffset: panelRect.left - shellRect.left,
        position: getComputedStyle(element).position,
        topOffset: panelRect.top - shellRect.top,
      }
    }),
  ).toEqual({
    contain: 'paint',
    leftOffset: 0,
    position: 'static',
    topOffset: 0,
  })
  await expect
    .poll(() => tronPanel.evaluate((element) => getComputedStyle(element, '::before').transform))
    .not.toBe(tronBorder.transform)
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
      .locator('[data-picodash-panel-id="built-in-items"] h2')
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

  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
  await expect
    .poll(() =>
      tronPanel.evaluate((element) => {
        const style = getComputedStyle(element, '::before')
        return {
          animationName: style.animationName,
          transform: style.transform,
          willChange: style.willChange,
        }
      }),
    )
    .toEqual({
      animationName: 'none',
      transform: expect.not.stringMatching(/^none$/),
      willChange: 'auto',
    })

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
  const systemThemeItem = page.locator('[data-item-id="themes-navigation-system"]')
  await expect(systemThemeItem).toContainText('Your preferred theme is set to light')
  await expect(systemThemeItem.locator('[id$=":description"]')).toHaveCSS('text-align', 'right')
  await expect(systemThemeItem.locator('[id$=":description"]')).toHaveCSS('padding-top', '2px')
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
  await expect(systemThemeItem).toContainText('Your preferred theme is set to dark')
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

test('defaults the System theme description to Dark without a color scheme API', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: undefined,
    })
  })
  await page.goto('/themes')

  await expect(page.locator('[data-item-id="themes-navigation-system"]')).toContainText(
    'No system theme set - defaulting to Dark',
  )
})

test('renders the high-contrast example on the panel only', async ({ page }) => {
  await page.goto('/themes')
  await page.locator('[data-theme-choice="contrast"]').click()

  const panel = page.locator('[data-picodash-panel-id="built-in-items"]')
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

test('strengthens item descriptions across themes without matching primary text', async ({
  page,
}) => {
  await page.goto('/themes')

  const panel = page.locator('[data-picodash-panel-id="built-in-items"]')
  const description = panel.locator('[id="multilineText:description"]')

  for (const theme of ['dark', 'light', 'ocean', 'plum', 'tron', 'contrast']) {
    await page.locator(`[data-theme-choice="${theme}"]`).click()
    await expect(panel).toHaveAttribute('data-picodash-theme', theme)

    const descriptionColor = await computedDescriptionColor(description)
    await expect(description).toHaveCSS('color', descriptionColor)
    expect(descriptionColor).not.toBe(
      await computedColorForToken(description, '--picodash-color-text-muted'),
    )
    expect(descriptionColor).not.toBe(
      await computedColorForToken(description, '--picodash-color-text'),
    )
  }

  await expect(description).not.toHaveCSS('color', 'rgb(0, 0, 0)')
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
