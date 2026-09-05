import { devices, expect, test, type Locator, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createPicodashDevBridgeClient } from '@picodash/dev-bridge'

const consoleErrors = new WeakMap<Page, string[]>()
const persistenceProbeStorageKey = 'picodash-contract-lab-web-storage-probe-v1'
const focusedPlacementPersistenceStorageKey = 'picodash-contract-lab-focused-placement-v1'
const focusedPlacementPanelScopeId = 'contract-lab-focused-placement-panel'
const standaloneListScopeId = 'contract-lab-standalone-list'

test.beforeEach(async ({ page }) => {
  const errors: string[] = []
  consoleErrors.set(page, errors)
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => {
    errors.push(error.message)
  })
})

test.afterEach(async ({ page }) => {
  expect(consoleErrors.get(page) ?? [], 'unexpected browser errors').toEqual([])
})

const presets = [
  ['placement', 'Placement'],
  ['interaction', 'Interaction'],
  ['composition', 'Style lab'],
  ['overlays', 'Overlays'],
  ['documents', 'Documents'],
  ['themes', 'Themes'],
] as const

async function openLab(page: Page) {
  await page.goto('/lab')
  await expect(page.locator('[data-contract-lab-status]')).toHaveAttribute('data-ready', 'true')
  await expect(page.getByRole('region', { name: 'Contract Lab status' })).toContainText(
    'Diagnostics',
  )
}

async function samplePanelHeightTransition(page: Page, panel: Locator, action: Locator) {
  const before = await panel.evaluate((element) => element.getBoundingClientRect().height)
  await action.evaluate((element) => {
    if (!(element instanceof HTMLElement)) throw new TypeError('Panel action must be an element.')
    element.click()
  })
  const midpoint = await panel.evaluate(
    (element) =>
      new Promise<number>((resolve, reject) => {
        const deadline = performance.now() + 1_000
        const inspect = () => {
          const animation = element.getAnimations().find((candidate) => {
            const effect = candidate.effect
            return (
              effect instanceof KeyframeEffect &&
              effect.getKeyframes().some((keyframe) => 'blockSize' in keyframe)
            )
          })
          if (!animation) {
            if (performance.now() >= deadline) {
              reject(new TypeError('Expected an active block-size animation.'))
              return
            }
            requestAnimationFrame(inspect)
            return
          }
          const duration = animation.effect?.getTiming().duration
          if (typeof duration !== 'number') {
            reject(new TypeError('Expected a numeric block-size animation duration.'))
            return
          }
          animation.pause()
          animation.currentTime = duration / 2
          requestAnimationFrame(() => {
            const midpoint = element.getBoundingClientRect().height
            animation.play()
            void animation.finished.then(() => resolve(midpoint), reject)
          })
        }
        inspect()
      }),
  )
  await expect(panel).not.toHaveAttribute('data-picodash-height-motion')
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)))
  const after = await panel.evaluate((element) => element.getBoundingClientRect().height)
  return { before, samples: [midpoint], after }
}

async function pausePanelTranslateAnimationAfter(
  panel: Locator,
  minimumElapsed: number,
  seekToStart = false,
  keepPaused = false,
) {
  return panel.evaluate(
    (element, { elapsedThreshold, resetToStart, retainPause }) =>
      new Promise<{ x: number; y: number }>((resolve, reject) => {
        const deadline = performance.now() + 1_000
        const inspect = () => {
          const animation = element.getAnimations().find((candidate) => {
            const effect = candidate.effect
            return (
              effect instanceof KeyframeEffect &&
              effect.getKeyframes().some((keyframe) => typeof keyframe.translate === 'string')
            )
          })
          if (!animation) {
            if (performance.now() >= deadline) {
              reject(new TypeError('Expected an active Panel translate animation.'))
              return
            }
            requestAnimationFrame(inspect)
            return
          }
          const duration = animation.effect?.getTiming().duration
          if (typeof duration !== 'number') {
            reject(new TypeError('Expected a numeric Panel translate animation duration.'))
            return
          }
          const currentTime = animation.currentTime
          if (typeof currentTime !== 'number' || currentTime < elapsedThreshold) {
            if (performance.now() >= deadline) {
              reject(new TypeError('Panel translate animation did not reach the expected time.'))
              return
            }
            requestAnimationFrame(inspect)
            return
          }
          animation.pause()
          if (resetToStart) animation.currentTime = 0
          requestAnimationFrame(() => {
            const rect = element.getBoundingClientRect()
            if (!retainPause) animation.play()
            resolve({ x: rect.x, y: rect.y })
          })
        }
        inspect()
      }),
    { elapsedThreshold: minimumElapsed, resetToStart: seekToStart, retainPause: keepPaused },
  )
}

test('keeps the versioned driver, Console, and status available while the specimen is offline', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('Web Storage blocked', 'SecurityError')
      },
    })
  })
  await openLab(page)
  await page.getByRole('button', { name: /^Documents:/ }).click()

  await expect(page.locator('[data-product-route="contract-lab"]')).toHaveCount(1)
  await expect(page.locator('[data-contract-lab-persistence-status]')).toHaveText(
    'Persistence status: unavailable',
  )
  await expect(page.getByRole('button', { name: 'Write metadata probe' })).toBeDisabled()
  await expect(page.locator('[data-contract-lab-console]')).toBeVisible()
  await expect(page.locator('[data-contract-lab-specimen]')).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as Window & {
              __PICODASH_LAB__?: { version: number; loadPreset(value: string): void; reset(): void }
            }
          ).__PICODASH_LAB__?.version,
      ),
    )
    .toBe(1)

  await page.getByRole('button', { name: 'Take specimen offline' }).click()
  await expect(page.locator('[data-contract-lab-console]')).toBeVisible()
  await expect(page.locator('[data-contract-lab-status]')).toBeVisible()
  await expect(page.locator('[data-contract-lab-specimen]')).toHaveCount(0)
  await expect(page.locator('[data-contract-lab-specimen-offline]')).toContainText(
    'The Lab Console and status remain available.',
  )
  await expect(page.getByRole('region', { name: 'Contract Lab status' })).toContainText(
    /Diagnostics\s*clear/,
  )
  await expect(page.getByRole('button', { name: 'Reopen primary specimen' })).toBeVisible()
  await page.getByRole('button', { name: 'Reopen primary specimen' }).click()
  await expect(page.locator('[data-contract-lab-specimen]')).toBeVisible({ timeout: 10_000 })
})

test('loads all six accepted presets, persists the selection for the session, and resets to placement', async ({
  page,
}) => {
  await openLab(page)

  for (const [id, label] of presets) {
    await page.getByRole('button', { name: new RegExp(`^${label}:`) }).click()
    await expect(page.locator('[data-contract-lab-specimen]')).toHaveAttribute('data-preset', id)
    await expect(page.getByRole('region', { name: 'Contract Lab status' })).toContainText(label)
  }

  await page.reload()
  await expect(page.locator('[data-contract-lab-status]')).toHaveAttribute('data-ready', 'true')
  await expect(page.locator('[data-contract-lab-specimen]')).toHaveAttribute(
    'data-preset',
    'themes',
  )

  await page.getByRole('button', { name: 'Reset lab' }).click()
  await expect(page.locator('[data-contract-lab-specimen]')).toHaveAttribute(
    'data-preset',
    'placement',
  )
  await expect(page.getByRole('region', { name: 'Contract Lab status' })).toContainText('Placement')
})

test('renders the two-panel Dashlet style lab with the accepted groups and lanes', async ({
  page,
}) => {
  await openLab(page)
  await page.getByRole('button', { name: /^Style lab:/ }).click()

  const basicsPanel = page.getByRole('complementary', { name: 'Basics & readout' })
  const choicesPanel = page.getByRole('complementary', { name: 'Choices & temporal' })
  await expect(page.locator('[data-style-lab-panel]')).toHaveCount(2)
  await expect(page.locator('[data-picodash-dashlet^="style-lab-"]')).toHaveCount(22)
  await expect(basicsPanel).toHaveAttribute('data-picodash-placement', 'hybrid-docked')
  await expect(choicesPanel).toHaveAttribute('data-picodash-placement', 'hybrid-docked')
  const activeStylePanel = page.locator('[data-style-lab-panel][data-active="true"]')
  const inactiveStylePanel = page.locator('[data-style-lab-panel]:not([data-active])')
  await expect(activeStylePanel).toHaveCount(1)
  await expect(inactiveStylePanel).toHaveCount(1)
  const [activeLayer, inactiveLayer] = await Promise.all([
    activeStylePanel.evaluate((element) => Number(getComputedStyle(element).zIndex)),
    inactiveStylePanel.evaluate((element) => Number(getComputedStyle(element).zIndex)),
  ])
  expect(activeLayer).toBeGreaterThan(inactiveLayer)
  const [basicsBox, choicesBox] = await Promise.all([
    basicsPanel.boundingBox(),
    choicesPanel.boundingBox(),
  ])
  if (!basicsBox || !choicesBox) throw new Error('Style Lab Panels did not expose geometry')
  expect(
    basicsBox.x + basicsBox.width <= choicesBox.x ||
      choicesBox.x + choicesBox.width <= basicsBox.x ||
      basicsBox.y + basicsBox.height <= choicesBox.y ||
      choicesBox.y + choicesBox.height <= basicsBox.y,
  ).toBe(true)
  await expect(
    page.locator('[data-contract-lab-status] dt', { hasText: 'Diagnostics' }).locator('..'),
  ).toContainText('1')

  const basicsList = basicsPanel.getByRole('list', { name: 'Basics and readout Dashlets' })
  const choicesList = choicesPanel.getByRole('list', { name: 'Choices and temporal Dashlets' })
  await expect(basicsList.getByRole('group', { name: 'Basics' })).toBeVisible()
  await expect(basicsList.getByRole('group', { name: 'Readout' })).toBeVisible()
  await expect(choicesList.getByRole('group', { name: 'Choices' })).toBeVisible()
  await expect(choicesList.getByRole('group', { name: 'Temporal' })).toBeVisible()

  await expect(basicsList.locator('[data-style-lab-lane="start"]')).toHaveAttribute(
    'data-picodash-dashlet',
    'style-lab-search',
  )
  await expect(choicesList.locator('[data-style-lab-lane="auto"]')).toHaveAttribute(
    'data-picodash-dashlet',
    'style-lab-color',
  )
  await expect(basicsList.locator('[data-style-lab-lane="end"]')).toHaveAttribute(
    'data-picodash-dashgroup',
    'style-lab-readout',
  )
  await expect(
    basicsList
      .getByRole('group', { name: 'Basics' })
      .locator('[data-picodash-dashlet="style-lab-range"]'),
  ).toBeVisible()

  const numberDashlet = basicsList.locator('[data-picodash-dashlet="style-lab-number"]')
  const numberControl = numberDashlet.getByRole('textbox', { name: 'NumberDashlet' })
  await expect(numberControl).toHaveValue('1.235')
  await numberDashlet.scrollIntoViewIfNeeded()
  await numberDashlet.getByText('NumberDashlet', { exact: true }).click()
  await expect(numberControl).toBeFocused()
  const numberHelp = numberDashlet.getByRole('button', { name: 'Help for NumberDashlet' })
  await numberHelp.focus()
  await numberHelp.press('Enter')
  const numberHelpDialog = page.getByRole('dialog', { name: 'Help for NumberDashlet' })
  await expect(numberHelpDialog).toContainText(
    'The displayed value is rounded without changing the canonical number.',
  )
  await page.keyboard.press('Escape')
  await expect(numberHelp).toBeFocused()

  const sliderDashlet = basicsList.locator('[data-picodash-dashlet="style-lab-slider"]')
  await sliderDashlet.scrollIntoViewIfNeeded()
  const sliderControl = sliderDashlet.getByRole('slider')
  await expect(sliderControl).toHaveAccessibleDescription('Read only.')
  await expect(sliderControl).not.toHaveAttribute('aria-readonly')
  await expect(sliderControl).toBeEnabled()
  const sliderValue = await sliderControl.inputValue()
  await sliderControl.press('ArrowRight')
  await expect(sliderControl).toHaveValue(sliderValue)

  const rangeDashlet = basicsList.locator('[data-picodash-dashlet="style-lab-range"]')
  const rangeThumbs = rangeDashlet.getByRole('slider')
  await expect(rangeThumbs).toHaveCount(2)
  const rangeStart = rangeThumbs.nth(0)
  const rangeEnd = rangeThumbs.nth(1)
  for (const thumb of [rangeStart, rangeEnd]) {
    await expect(thumb).toHaveAccessibleDescription('Read only.')
    await expect(thumb).not.toHaveAttribute('aria-readonly')
    await expect(thumb).toBeEnabled()
  }
  const rangeStartValue = await rangeStart.inputValue()
  await rangeStart.press('ArrowRight')
  await expect(rangeStart).toHaveValue(rangeStartValue)

  const sliderTrack = sliderDashlet.locator('.picodash-dashlist-slider-track')
  const sliderMarks = sliderTrack.locator('[data-picodash-dashlist-slider-marks]')
  await expect(sliderMarks).toHaveAttribute('aria-hidden', 'true')
  await expect(sliderMarks.locator('[data-picodash-dashlist-slider-mark]')).toHaveCount(3)

  const readSliderMarkGeometry = async () =>
    sliderTrack.evaluate((track) => {
      const trackRect = track.getBoundingClientRect()
      const layer = track.querySelector<HTMLElement>('[data-picodash-dashlist-slider-marks]')
      if (!layer) throw new Error('Slider mark layer was not rendered')
      const layerRect = layer.getBoundingClientRect()
      return {
        direction: getComputedStyle(track).direction,
        pointerEvents: getComputedStyle(layer).pointerEvents,
        track: { left: trackRect.left, right: trackRect.right, width: trackRect.width },
        layer: { left: layerRect.left, right: layerRect.right },
        marks: [...layer.querySelectorAll<HTMLElement>('[data-picodash-dashlist-slider-mark]')].map(
          (mark) => {
            const rect = mark.getBoundingClientRect()
            return {
              value: mark.getAttribute('data-picodash-dashlist-slider-mark'),
              center: rect.left + rect.width / 2,
            }
          },
        ),
      }
    })

  const ltrMarks = await readSliderMarkGeometry()
  expect(ltrMarks.direction).toBe('ltr')
  expect(ltrMarks.pointerEvents).toBe('none')
  expect(ltrMarks.layer.left).toBeCloseTo(ltrMarks.track.left, 0)
  expect(ltrMarks.layer.right).toBeCloseTo(ltrMarks.track.right, 0)
  expect(ltrMarks.marks.map((mark) => mark.value)).toEqual(['0', '50', '100'])
  expect(ltrMarks.marks[0].center).toBeCloseTo(ltrMarks.track.left, 0)
  expect(ltrMarks.marks[1].center).toBeCloseTo(ltrMarks.track.left + ltrMarks.track.width / 2, 0)
  expect(ltrMarks.marks[2].center).toBeCloseTo(ltrMarks.track.right, 0)

  await basicsPanel.evaluate((panel) => panel.setAttribute('dir', 'rtl'))
  await expect.poll(async () => (await readSliderMarkGeometry()).direction).toBe('rtl')
  const rtlMarks = await readSliderMarkGeometry()
  expect(rtlMarks.marks[0].center).toBeCloseTo(rtlMarks.track.right, 0)
  expect(rtlMarks.marks[1].center).toBeCloseTo(rtlMarks.track.left + rtlMarks.track.width / 2, 0)
  expect(rtlMarks.marks[2].center).toBeCloseTo(rtlMarks.track.left, 0)
  await basicsPanel.evaluate((panel) => panel.removeAttribute('dir'))

  const focusWithKeyboard = async (control: Locator) => {
    for (let index = 0; index < 240; index += 1) {
      if (await control.evaluate((element) => element === document.activeElement)) return
      await page.keyboard.press('Tab')
    }
    throw new Error('keyboard traversal did not reach the target control')
  }
  const expectKeyboardOutline = async (
    control: Locator,
    outlineTarget: Locator = control,
    stateTarget: Locator = outlineTarget,
  ) => {
    await focusWithKeyboard(control)
    expect(
      await stateTarget.evaluate((element) => element.hasAttribute('data-focus-visible')),
    ).toBe(true)
    const outline = await outlineTarget.evaluate((element) => {
      const style = getComputedStyle(element)
      return { style: style.outlineStyle, width: style.outlineWidth }
    })
    expect(outline.style).not.toBe('none')
    expect(outline.width).not.toBe('0px')
  }

  const switchControl = basicsList.getByRole('switch', { name: 'SwitchDashlet' })
  await expectKeyboardOutline(switchControl, switchControl.locator('xpath=ancestor::label[1]'))

  const colorControl = choicesList.getByRole('textbox', { name: 'ColorDashlet', exact: true })
  await expect(colorControl).toHaveValue('rgba(125, 211, 252, 0.5)')
  await colorControl.fill('rgba(10, 20, 30, 0.25)')
  await colorControl.press('Tab')
  await expect(colorControl).toHaveValue('rgba(10, 20, 30, 0.25)')
  await expectKeyboardOutline(colorControl)

  const choiceControl = choicesList
    .getByRole('radiogroup', { name: 'RadioGroupDashlet' })
    .getByRole('radio', { name: 'Option B', exact: true })
  await expectKeyboardOutline(choiceControl, choiceControl.locator('xpath=ancestor::label[1]'))

  const radioDashlet = choicesList.locator('[data-picodash-dashlet="style-lab-radio-group"]')
  const checkboxGroupDashlet = choicesList.locator(
    '[data-picodash-dashlet="style-lab-checkbox-group"]',
  )
  const segmentedDashlet = choicesList.locator('[data-picodash-dashlet="style-lab-segmented"]')
  await expect(radioDashlet.locator('[data-picodash-dashlist-radio-marker]')).toHaveCount(3)
  await expect(
    checkboxGroupDashlet.locator('[data-picodash-dashlist-checkbox-marker]'),
  ).toHaveCount(3)
  await expect(segmentedDashlet.locator('[data-picodash-dashlist-segment-marker]')).toHaveCount(3)

  const selectedMarkers = [
    {
      marker: choiceControl
        .locator('xpath=ancestor::label[1]')
        .locator('[data-picodash-dashlist-radio-marker]'),
      pseudo: '::after',
    },
    {
      marker: checkboxGroupDashlet
        .getByRole('checkbox', { name: 'Option A', exact: true })
        .locator('xpath=ancestor::label[1]')
        .locator('[data-picodash-dashlist-checkbox-marker]'),
      pseudo: '::before',
    },
    {
      marker: segmentedDashlet
        .getByRole('radio', { name: 'Option B', exact: true })
        .locator('xpath=ancestor::label[1]')
        .locator('[data-picodash-dashlist-segment-marker]'),
      pseudo: '::before',
    },
  ]
  const readMarkerPresentation = (marker: Locator, pseudo: string) =>
    marker.evaluate((element, pseudoElement) => {
      const rect = element.getBoundingClientRect()
      const owner = element.closest('label') ?? element.parentElement ?? element
      const pseudoStyle = getComputedStyle(element, pseudoElement)
      return {
        direction: getComputedStyle(owner).direction,
        width: rect.width,
        height: rect.height,
        visibility: pseudoStyle.visibility,
        color: pseudoStyle.color,
      }
    }, pseudo)
  const assertSelectedMarkers = async (direction: 'ltr' | 'rtl') => {
    for (const { marker, pseudo } of selectedMarkers) {
      const presentation = await readMarkerPresentation(marker, pseudo)
      expect(presentation.direction).toBe(direction)
      expect(presentation.width).toBeGreaterThan(0)
      expect(presentation.height).toBeGreaterThan(0)
      expect(presentation.visibility).toBe('visible')
      expect(presentation.color).not.toBe('rgba(0, 0, 0, 0)')
    }
  }
  await assertSelectedMarkers('ltr')
  await choicesPanel.evaluate((panel) => panel.setAttribute('dir', 'rtl'))
  await assertSelectedMarkers('rtl')
  await page.emulateMedia({ forcedColors: 'active' })
  await assertSelectedMarkers('rtl')
  await page.emulateMedia({ forcedColors: 'none' })
  await choicesPanel.evaluate((panel) => panel.removeAttribute('dir'))

  const selectTrigger = choicesList.getByRole('button', {
    name: 'Option B SelectDashlet',
    exact: true,
  })
  const inheritedChoicePresentation = await selectTrigger.evaluate((element) => {
    const carrier = element.closest('[data-picodash-theme][data-picodash-density]')
    return {
      theme: carrier?.getAttribute('data-picodash-theme'),
      density: carrier?.getAttribute('data-picodash-density'),
    }
  })
  await selectTrigger.press('Enter')
  const choicePopup = page.locator('.picodash-dashlist-popover')
  await expect(choicePopup).toBeVisible()
  await expect(choicesList.locator('.picodash-dashlist-popover')).toHaveCount(0)
  const popupPresentation = await choicePopup.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      theme: element.getAttribute('data-picodash-theme'),
      density: element.getAttribute('data-picodash-density'),
      backgroundColor: style.backgroundColor,
      borderStyle: style.borderTopStyle,
      borderWidth: style.borderTopWidth,
      semanticLayer: Number.parseInt(style.getPropertyValue('--picodash-layer-popover'), 10),
      resolvedLayer: Number.parseInt(style.zIndex, 10),
    }
  })
  expect(popupPresentation.theme).toBe(inheritedChoicePresentation.theme)
  expect(popupPresentation.density).toBe(inheritedChoicePresentation.density)
  expect(popupPresentation.backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
  expect(popupPresentation.borderStyle).not.toBe('none')
  expect(popupPresentation.borderWidth).not.toBe('0px')
  expect(popupPresentation.resolvedLayer).toBeGreaterThanOrEqual(popupPresentation.semanticLayer)
  await choicePopup.getByRole('option', { name: 'Option C', exact: true }).click()
  await expect(choicePopup).toHaveCount(0)
  await expect(
    choicesList.getByRole('button', { name: 'Option C SelectDashlet', exact: true }),
  ).toBeFocused()

  const gallery = page.getByRole('list', { name: 'Dashlet gallery' })
  for (const group of [
    'Common inputs',
    'Direct manipulation',
    'Media and files',
    'Charts',
    'Readouts',
    'Compound recipes',
  ]) {
    await expect(gallery.getByRole('group', { name: group, exact: true })).toBeVisible()
  }
  await expect(page.getByRole('img', { name: 'Request trend' })).toBeVisible()

  const minimizeBasics = basicsPanel.getByRole('button', {
    name: 'Minimize panel Basics & readout',
  })
  await minimizeBasics.focus()
  await minimizeBasics.press('Enter')
  const revealBasics = page.getByRole('button', {
    name: 'Reveal panel Basics & readout',
  })
  await expect(revealBasics).toBeFocused()
  await expect(revealBasics).toHaveAttribute('aria-expanded', 'false')
  await expect(page.locator('[data-style-lab-panel="basics-readout"]')).toHaveAttribute(
    'aria-hidden',
    'true',
  )
  await revealBasics.press('Enter')
  await expect(minimizeBasics).toBeFocused()
  await expect(minimizeBasics).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('[data-style-lab-panel="basics-readout"]')).not.toHaveAttribute(
    'aria-hidden',
  )
  await expect(basicsList).toBeVisible()

  const styleBoundary = page.locator('[data-contract-lab-style-lab]')
  await styleBoundary.evaluate((element) => {
    element.style.blockSize = '30rem'
    element.style.minBlockSize = '30rem'
  })
  await styleBoundary.scrollIntoViewIfNeeded()
  const automaticBand = basicsList.locator('[data-picodash-dashlist-band="automatic"]')
  await expect
    .poll(() => automaticBand.evaluate((element) => getComputedStyle(element).overflowY))
    .toBe('auto')
  await expect
    .poll(() => automaticBand.evaluate((element) => element.scrollHeight > element.clientHeight))
    .toBe(true)
  const pinnedGeometry = await basicsList.evaluate((list) => {
    const listRect = list.getBoundingClientRect()
    const start = list.querySelector<HTMLElement>('[data-picodash-dashlist-band="start"]')!
    const automatic = list.querySelector<HTMLElement>('[data-picodash-dashlist-band="automatic"]')!
    const end = list.querySelector<HTMLElement>('[data-picodash-dashlist-band="end"]')!
    return {
      automaticBottom: automatic.getBoundingClientRect().bottom,
      endBottom: end.getBoundingClientRect().bottom,
      endTop: end.getBoundingClientRect().top,
      listBottom: listRect.bottom,
      listTop: listRect.top,
      startTop: start.getBoundingClientRect().top,
    }
  })
  expect(pinnedGeometry.startTop).toBeGreaterThanOrEqual(pinnedGeometry.listTop - 1)
  expect(pinnedGeometry.endTop).toBeGreaterThanOrEqual(pinnedGeometry.automaticBottom - 1)
  expect(pinnedGeometry.endBottom).toBeLessThanOrEqual(pinnedGeometry.listBottom + 1)
})

test('opens, cancels, and restores focus for the landed shared AlertDialog', async ({ page }) => {
  await openLab(page)
  await page.getByRole('button', { name: /^Overlays:/ }).click()

  const trigger = page.getByRole('button', { name: 'Open shared AlertDialog' })
  await trigger.focus()
  await trigger.press('Enter')
  const dialog = page.getByRole('alertdialog', { name: 'Contract Lab confirmation' })
  await expect(dialog).toBeVisible()
  const choiceTrigger = dialog.getByRole('button', { name: /AlertDialog choice/ })
  await choiceTrigger.click()
  const choicePopover = page.locator('[data-slot="popover"]')
  const dialogOverlay = page.locator('[data-slot="alert-dialog-overlay"]')
  await expect(choicePopover).toBeVisible()
  expect(
    await choicePopover.evaluate((element) => Number(getComputedStyle(element).zIndex)),
  ).toBeGreaterThan(
    await dialogOverlay.evaluate((element) => Number(getComputedStyle(element).zIndex)),
  )
  expect(
    await dialog.evaluate((element) =>
      element.contains(document.querySelector('[data-slot="popover"]')),
    ),
  ).toBe(false)
  await choicePopover.getByRole('option', { name: 'Details' }).click()
  await expect(choicePopover).toHaveCount(0)
  await expect(choiceTrigger).toBeFocused()
  await expect(choiceTrigger).toContainText('Details')
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

test('proves regular and compact UI geometry plus coarse-pointer hit targets', async ({
  page,
  browser,
}) => {
  await openLab(page)
  expect(
    await page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches),
  ).toBe(false)
  await page.getByRole('button', { name: /^Placement:/ }).click()
  const focusedPanel = page.getByRole('complementary', { name: 'Placement Panel' })
  const portalTarget = page.locator('[data-contract-lab-focused-portal-target]')
  await expect(focusedPanel).toBeVisible()
  await expect(page.getByRole('complementary')).toHaveCount(2)
  await expect(portalTarget.locator('[data-contract-lab-focused-placement-panel]')).toHaveCount(1)
  const placementBoundary = page.locator('[data-contract-lab-focused-boundary]')
  const placementState = page.getByRole('status', { name: 'Current panel placement' })
  const boundaryBox = (await placementBoundary.boundingBox())!
  const assertPlacementGeometry = async () => {
    const panelBox = (await focusedPanel.boundingBox())!
    expect(panelBox.x).toBeGreaterThanOrEqual(boundaryBox.x)
    expect(panelBox.y).toBeGreaterThanOrEqual(boundaryBox.y)
    expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(boundaryBox.x + boundaryBox.width)
    expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(boundaryBox.y + boundaryBox.height)
  }
  await assertPlacementGeometry()
  await expect(focusedPanel).toHaveAttribute('data-picodash-placement', 'floating-free')
  await expect(placementState).toHaveText('Floating: free')

  const header = focusedPanel.locator(':scope > [data-slot="dash-header"]')
  await expect(header).toHaveAttribute('data-picodash-panel-drag-surface', 'true')
  const moveControl = focusedPanel.getByRole('button', {
    name: 'Move panel Placement Panel',
  })
  await expect(moveControl).not.toHaveAttribute('data-icon-only')
  const titleDragSurface = focusedPanel.locator('[data-picodash-panel-title-drag-surface]')
  const actionMenu = focusedPanel.getByRole('button', { name: 'Actions for Placement Panel' })
  await expect(actionMenu.locator('svg')).toHaveAttribute('fill', 'currentColor')
  await actionMenu.click()
  const placementSubmenuTrigger = page.getByRole('menuitem', { name: 'Placement', exact: true })
  await placementSubmenuTrigger.press('ArrowRight')
  const placementSubmenu = page.locator('[data-slot="action-menu"].picodash-action-submenu-menu')
  await expect(placementSubmenu).toBeVisible()
  const submenuPresentation = await placementSubmenu.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      backgroundColor: style.backgroundColor,
      borderStyle: style.borderTopStyle,
      borderWidth: style.borderTopWidth,
    }
  })
  expect(submenuPresentation.backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
  expect(submenuPresentation.borderStyle).not.toBe('none')
  expect(submenuPresentation.borderWidth).not.toBe('0px')
  await placementSubmenu.press('Escape')
  await placementSubmenuTrigger.press('Escape')
  const headerBox = (await header.boundingBox())!
  for (const button of await header.locator('[data-slot="button"][data-icon-only]').all()) {
    const buttonBox = (await button.boundingBox())!
    expect(
      Math.abs(buttonBox.y + buttonBox.height / 2 - (headerBox.y + headerBox.height / 2)),
    ).toBeLessThanOrEqual(1)
  }

  await page.getByRole('button', { name: 'Fixed', exact: true }).click()
  await expect(focusedPanel).toHaveAttribute('data-picodash-placement', 'fixed-docked')
  await expect(placementState).toHaveText('Fixed: docked full-right')
  await expect(moveControl).toBeDisabled()
  await assertPlacementGeometry()

  await page.getByRole('button', { name: 'Hybrid', exact: true }).click()
  await expect(focusedPanel).toHaveAttribute('data-picodash-placement', 'hybrid-docked')
  await expect(placementState).toHaveText('Hybrid: docked full-left')
  await expect(moveControl).toBeEnabled()
  const beforePickup = (await focusedPanel.boundingBox())!
  const moveBox = (await moveControl.boundingBox())!
  await page.mouse.move(moveBox.x + moveBox.width / 2, moveBox.y + moveBox.height / 2)
  await page.mouse.down()
  await page.mouse.up()
  const afterPickup = (await focusedPanel.boundingBox())!
  expect(afterPickup.x).toBeCloseTo(beforePickup.x, 0)
  expect(afterPickup.y).toBeCloseTo(beforePickup.y, 0)

  const titleBox = (await titleDragSurface.boundingBox())!
  await page.mouse.move(titleBox.x + titleBox.width / 2, titleBox.y + titleBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(titleBox.x + titleBox.width / 2 + 64, titleBox.y + titleBox.height / 2 + 40)
  await page.mouse.up()
  await expect(focusedPanel).toHaveAttribute('data-picodash-placement', 'hybrid-free')
  await expect(placementState).toHaveText('Hybrid: free')
  await assertPlacementGeometry()

  await page.getByRole('button', { name: 'Floating', exact: true }).click()
  await expect(focusedPanel).toHaveAttribute('data-picodash-placement', 'floating-free')
  await expect(placementState).toHaveText('Floating: free')
  const beforePointer = (await focusedPanel.boundingBox())!
  const floatingTitleBox = (await titleDragSurface.boundingBox())!
  await page.mouse.move(
    floatingTitleBox.x + floatingTitleBox.width / 2,
    floatingTitleBox.y + floatingTitleBox.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    floatingTitleBox.x + floatingTitleBox.width / 2 + 48,
    floatingTitleBox.y + floatingTitleBox.height / 2 + 32,
  )
  await page.mouse.up()
  const afterPointer = (await focusedPanel.boundingBox())!
  expect(afterPointer.x).toBeGreaterThan(beforePointer.x)
  expect(afterPointer.y).toBeGreaterThan(beforePointer.y)
  expect(afterPointer.x).toBeGreaterThanOrEqual(boundaryBox.x)
  expect(afterPointer.y).toBeGreaterThanOrEqual(boundaryBox.y)
  expect(afterPointer.x + afterPointer.width).toBeLessThanOrEqual(boundaryBox.x + boundaryBox.width)
  expect(afterPointer.y + afterPointer.height).toBeLessThanOrEqual(
    boundaryBox.y + boundaryBox.height,
  )

  await portalTarget.evaluate((target) => document.body.append(target))
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
      ),
  )
  const beforeBoundaryTranslation = (await focusedPanel.boundingBox())!
  await placementBoundary.evaluate((boundary) => {
    boundary.style.transform = 'translate(20px, 12px)'
  })
  await expect
    .poll(async () => (await focusedPanel.boundingBox())?.x)
    .toBeCloseTo(beforeBoundaryTranslation.x + 20, 0)
  await expect
    .poll(async () => (await focusedPanel.boundingBox())?.y)
    .toBeCloseTo(beforeBoundaryTranslation.y + 12, 0)
  await placementBoundary.evaluate((boundary) => {
    boundary.style.transform = ''
  })
  await portalTarget.evaluate((target) => {
    document.querySelector('[data-contract-lab-focused-boundary]')?.append(target)
  })
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
      ),
  )

  await moveControl.focus()
  const beforeKeyboard = (await focusedPanel.boundingBox())!
  await moveControl.press('Enter')
  await moveControl.press('Shift+ArrowRight')
  await moveControl.press('Enter')
  const afterKeyboard = (await focusedPanel.boundingBox())!
  expect(afterKeyboard.x).toBeCloseTo(beforeKeyboard.x + 10, 0)
  expect(afterKeyboard.y).toBeCloseTo(beforeKeyboard.y, 0)
  await expect(focusedPanel).toHaveAttribute('data-picodash-placement', 'floating-free')
  await expect(moveControl).toBeFocused()

  const beforeKeyboardCancel = (await focusedPanel.boundingBox())!
  await moveControl.press('Enter')
  await moveControl.press('Shift+ArrowRight')
  const duringKeyboardCancel = (await focusedPanel.boundingBox())!
  expect(duringKeyboardCancel.x).toBeCloseTo(beforeKeyboardCancel.x + 10, 0)
  expect(duringKeyboardCancel.y).toBeCloseTo(beforeKeyboardCancel.y, 0)
  await moveControl.press('Escape')
  const afterKeyboardCancel = (await focusedPanel.boundingBox())!
  expect(afterKeyboardCancel.x).toBeCloseTo(beforeKeyboardCancel.x, 0)
  expect(afterKeyboardCancel.y).toBeCloseTo(beforeKeyboardCancel.y, 0)
  await expect(focusedPanel).toHaveAttribute('data-picodash-placement', 'floating-free')
  await expect(moveControl).toBeFocused()
  await expect(focusedPanel.getByRole('button', { name: 'Reset panel layout' })).toBeVisible()
  await focusedPanel.getByRole('button', { name: 'Reset panel layout' }).click()
  await expect(focusedPanel).toBeVisible()
  await assertPlacementGeometry()
  const localCount = page.getByRole('status', { name: 'Local child count' })
  await focusedPanel.getByRole('button', { name: 'Increment local count' }).click()
  await expect(localCount).toHaveText('1')
  const collapsedMotion = await samplePanelHeightTransition(
    page,
    focusedPanel,
    focusedPanel.getByRole('button', { name: 'Collapse panel Placement Panel' }),
  )
  expect(collapsedMotion.after).toBeLessThan(collapsedMotion.before)
  expect(
    collapsedMotion.samples.some(
      (height) => height < collapsedMotion.before - 1 && height > collapsedMotion.after + 1,
    ),
  ).toBe(true)
  const expandedMotion = await samplePanelHeightTransition(
    page,
    focusedPanel,
    focusedPanel.getByRole('button', { name: 'Expand panel Placement Panel' }),
  )
  expect(expandedMotion.after).toBeGreaterThan(expandedMotion.before)
  expect(
    expandedMotion.samples.some(
      (height) => height > expandedMotion.before + 1 && height < expandedMotion.after - 1,
    ),
  ).toBe(true)
  await focusedPanel.getByRole('button', { name: 'Collapse panel Placement Panel' }).press('Enter')
  await expect(
    focusedPanel.getByRole('button', { name: 'Expand panel Placement Panel' }),
  ).toBeFocused()
  await focusedPanel.getByRole('button', { name: 'Expand panel Placement Panel' }).press('Enter')
  await expect(localCount).toHaveText('1')
  await focusedPanel.getByRole('button', { name: 'Close panel Placement Panel' }).press('Enter')
  await expect(focusedPanel).toBeHidden()
  const reopen = page.getByRole('button', { name: 'Show panel' })
  await reopen.press('Enter')
  await expect(focusedPanel).toBeVisible()
  await expect(localCount).toHaveText('1')
  await expect(page.getByRole('button', { name: 'Collapse panel Placement Panel' })).toBeFocused()
  for (const option of ['light', 'dark', 'system']) {
    await page.getByRole('button', { name: `Use ${option} theme` }).click()
    await expect(page.getByRole('button', { name: `Use ${option} theme` })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  }
  await page.getByRole('button', { name: /^Overlays:/ }).click()
  const regularTrigger = page.getByRole('button', { name: 'Open shared AlertDialog' })
  const regular = await regularTrigger.evaluate((element) => {
    const style = getComputedStyle(element)
    const rect = element.getBoundingClientRect()
    return {
      density: element.closest('[data-picodash-density]')?.getAttribute('data-picodash-density'),
      height: rect.height,
      width: rect.width,
      controlHeight: style.getPropertyValue('--picodash-control-height-md').trim(),
      fontSize: style.fontSize,
    }
  })
  expect(regular.density).toBe('regular')
  expect(regular.height).toBe(32)
  expect(regular.controlHeight).toBe('2rem')

  await page.getByRole('button', { name: /^Themes:/ }).click()
  const compactTrigger = page.getByRole('button', { name: 'Open shared AlertDialog' })
  const compact = await compactTrigger.evaluate((element) => {
    const style = getComputedStyle(element)
    const rect = element.getBoundingClientRect()
    return {
      density: element.closest('[data-picodash-density]')?.getAttribute('data-picodash-density'),
      height: rect.height,
      width: rect.width,
      controlHeight: style.getPropertyValue('--picodash-control-height-md').trim(),
      fontSize: style.fontSize,
    }
  })
  expect(compact.density).toBe('compact')
  expect(compact.height).toBe(28)
  expect(compact.height).toBeLessThan(regular.height)
  expect(compact.controlHeight).toBe('1.75rem')
  expect(compact.fontSize).toBe(regular.fontSize)

  const coarseContext = await browser.newContext({
    ...devices['iPhone 13'],
    baseURL: new URL(page.url()).origin,
  })
  try {
    const coarseErrors: string[] = []
    const coarsePage = await coarseContext.newPage()
    coarsePage.on('console', (message) => {
      if (message.type() === 'error') coarseErrors.push(message.text())
    })
    coarsePage.on('pageerror', (error) => coarseErrors.push(error.message))
    await openLab(coarsePage)
    await coarsePage.getByRole('button', { name: /^Placement:/ }).click()
    const coarsePanel = coarsePage.getByRole('complementary', { name: 'Placement Panel' })
    const coarseBoundary = coarsePage.locator('[data-contract-lab-focused-boundary]')
    await expect(coarsePanel).toBeVisible()
    const coarsePanelBox = (await coarsePanel.boundingBox())!
    const coarseBoundaryBox = (await coarseBoundary.boundingBox())!
    expect(coarsePanelBox.x).toBeGreaterThanOrEqual(coarseBoundaryBox.x)
    expect(coarsePanelBox.x + coarsePanelBox.width).toBeLessThanOrEqual(
      coarseBoundaryBox.x + coarseBoundaryBox.width,
    )
    expect(coarsePanelBox.y + coarsePanelBox.height).toBeLessThanOrEqual(
      coarseBoundaryBox.y + coarseBoundaryBox.height,
    )
    await coarsePage.addStyleTag({ content: ':root { font-size: 12px; }' })
    await expect
      .poll(() => coarsePage.evaluate(() => getComputedStyle(document.documentElement).fontSize))
      .toBe('12px')
    await coarsePage.getByRole('button', { name: /^Style lab:/ }).click()
    await coarsePage.getByRole('button', { name: /^Style lab:/ }).press('Enter')
    const coarseReorder = coarsePage.getByRole('button', { name: 'Reorder NumberDashlet' })
    const coarseReorderBounds = await coarseReorder.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return { width: rect.width, height: rect.height }
    })
    expect(coarseReorderBounds.width).toBeGreaterThanOrEqual(44)
    expect(coarseReorderBounds.height).toBeGreaterThanOrEqual(44)

    for (const control of [
      coarsePage.getByRole('button', { name: 'Help for NumberDashlet' }),
      coarsePage
        .locator('[data-picodash-dashlet="style-lab-checkbox"]')
        .locator('.picodash-dashlist-checkbox'),
      coarsePage
        .locator('[data-picodash-dashlet="style-lab-slider"]')
        .locator('[data-picodash-dashlist-slider-thumb]'),
      coarsePage
        .locator('[data-picodash-dashlet="style-lab-range"]')
        .locator('[data-picodash-dashlist-range-slider-thumb]')
        .first(),
    ]) {
      await control.scrollIntoViewIfNeeded()
      const bounds = await control.evaluate((element) => {
        const rect = element.getBoundingClientRect()
        return { width: rect.width, height: rect.height }
      })
      expect(bounds.width).toBeGreaterThanOrEqual(44)
      expect(bounds.height).toBeGreaterThanOrEqual(44)
    }

    const temporalSelectors = {
      date: '[data-picodash-dashlet="style-lab-date"] .picodash-dashlist-date-field [role="spinbutton"]',
      time: '[data-picodash-dashlet="style-lab-time"] .picodash-dashlist-time-field [role="spinbutton"]',
      dateTime:
        '[data-picodash-dashlet="style-lab-date-time"] .picodash-dashlist-date-time-field [role="spinbutton"]',
      dateRange:
        '[data-picodash-dashlet="style-lab-date-range"] .picodash-dashlist-date-range-field [role="spinbutton"]',
    } as const
    for (const selector of Object.values(temporalSelectors)) {
      const targets = coarsePage.locator(selector)
      await expect(targets).not.toHaveCount(0)
      await targets.first().scrollIntoViewIfNeeded()
      const bounds = await targets.evaluateAll((elements) =>
        elements.map((element) => {
          const rect = element.getBoundingClientRect()
          return { width: rect.width, height: rect.height }
        }),
      )
      for (const bound of bounds) {
        expect(bound.width).toBeGreaterThanOrEqual(44)
        expect(bound.height).toBeGreaterThanOrEqual(44)
      }
    }

    const colorInput = coarsePage.locator(
      '[data-picodash-dashlet="style-lab-color"] .picodash-dashlist-color-field input',
    )
    await expect(colorInput).toHaveCount(1)
    await colorInput.scrollIntoViewIfNeeded()
    const colorInputBounds = await colorInput.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return { width: rect.width, height: rect.height }
    })
    expect(colorInputBounds.width).toBeGreaterThanOrEqual(44)
    expect(colorInputBounds.height).toBeGreaterThanOrEqual(44)

    const segmentedDashlet = coarsePage.locator('[data-picodash-dashlet="style-lab-segmented"]')
    const selectedSegment = segmentedDashlet.locator(
      '[data-picodash-dashlist-segment][data-selected]',
    )
    const unselectedSegment = segmentedDashlet
      .locator('[data-picodash-dashlist-segment]:not([data-selected])')
      .first()
    await selectedSegment.scrollIntoViewIfNeeded()
    const segmentedPresentation = await selectedSegment.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      return {
        width: rect.width,
        height: rect.height,
        backgroundColor: style.backgroundColor,
        borderColor: style.borderColor,
      }
    })
    const unselectedSegmentPresentation = await unselectedSegment.evaluate((element) => {
      const style = getComputedStyle(element)
      return {
        backgroundColor: style.backgroundColor,
        borderColor: style.borderColor,
      }
    })
    expect(segmentedPresentation.width).toBeGreaterThanOrEqual(44)
    expect(segmentedPresentation.height).toBeGreaterThanOrEqual(44)
    expect(segmentedPresentation.backgroundColor).not.toBe(
      unselectedSegmentPresentation.backgroundColor,
    )
    expect(segmentedPresentation.borderColor).not.toBe(unselectedSegmentPresentation.borderColor)

    const multiSelectDashlet = coarsePage.locator(
      '[data-picodash-dashlet="style-lab-multi-select"]',
    )
    const removeTag = multiSelectDashlet.locator('[data-picodash-dashlist-tag-remove]').first()
    await removeTag.scrollIntoViewIfNeeded()
    const removeTagBounds = await removeTag.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return { width: rect.width, height: rect.height }
    })
    expect(removeTagBounds.width).toBeGreaterThanOrEqual(44)
    expect(removeTagBounds.height).toBeGreaterThanOrEqual(44)

    const selectDashlet = coarsePage.locator('[data-picodash-dashlet="style-lab-select"]')
    const selectTrigger = selectDashlet.getByRole('button', {
      name: 'Option B SelectDashlet',
      exact: true,
    })
    await selectTrigger.press('Enter')
    const popupOption = coarsePage.locator(".picodash-dashlist-listbox [role='option']").first()
    await expect(popupOption).toBeVisible()
    const popupOptionBounds = await popupOption.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return { width: rect.width, height: rect.height }
    })
    expect(popupOptionBounds.width).toBeGreaterThanOrEqual(44)
    expect(popupOptionBounds.height).toBeGreaterThanOrEqual(44)
    await selectTrigger.press('Escape')
    await expect(popupOption).toHaveCount(0)

    await coarsePage.getByRole('button', { name: /^Themes:/ }).press('Enter')
    const coarseTrigger = coarsePage.getByRole('button', { name: 'Open shared AlertDialog' })
    const coarse = await coarseTrigger.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return {
        coarsePointer: matchMedia('(pointer: coarse)').matches,
        width: rect.width,
        height: rect.height,
      }
    })
    expect(coarse.coarsePointer).toBe(true)
    expect(coarse.width).toBeGreaterThanOrEqual(44)
    expect(coarse.height).toBeGreaterThanOrEqual(44)

    await coarsePage.getByRole('button', { name: 'Open shared ActionMenu' }).press('Enter')
    for (const menuItem of [
      coarsePage.getByRole('menuitem', { name: 'Inspect shared action' }),
      coarsePage.getByRole('menuitem', { name: 'More shared actions' }),
    ]) {
      const bounds = await menuItem.evaluate((element) => {
        const rect = element.getBoundingClientRect()
        return { width: rect.width, height: rect.height }
      })
      expect(bounds.width).toBeGreaterThanOrEqual(44)
      expect(bounds.height).toBeGreaterThanOrEqual(44)
    }
    const pageOverflow = await coarsePage.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    }))
    expect(pageOverflow.documentWidth).toBeLessThanOrEqual(pageOverflow.viewportWidth)
    expect(pageOverflow.bodyWidth).toBeLessThanOrEqual(pageOverflow.viewportWidth)
    expect(coarseErrors).toEqual([])
  } finally {
    await coarseContext.close()
  }
})

test('proves live magnetic placement, Hybrid dock intent, and docked visibility', async ({
  page,
}) => {
  await openLab(page)
  await page.getByRole('button', { name: /^Placement:/ }).click()
  const panel = page.locator('[data-contract-lab-focused-placement-panel]')
  const panelByRole = page.getByRole('complementary', { name: 'Placement Panel' })
  const dragSurface = panelByRole.locator('[data-picodash-panel-drag-surface]')
  const boundary = page.locator('[data-contract-lab-focused-boundary]')
  const showPanel = page.getByRole('button', { name: 'Show panel' })
  await expect.poll(async () => (await boundary.boundingBox())?.height).toBeGreaterThanOrEqual(768)
  const assertFullRightMinimize = async () => {
    const minimize = page.getByRole('button', { name: 'Minimize panel Placement Panel' })
    await expect(minimize.locator('svg')).toHaveAttribute('data-picodash-arrow-direction', 'right')
    await minimize.click()

    const reveal = page.getByRole('button', { name: 'Reveal panel Placement Panel' })
    await expect(reveal).toBeVisible()
    await expect(reveal).toBeFocused()
    await expect(reveal.locator('svg')).toHaveAttribute('data-picodash-arrow-direction', 'left')
    await expect(panel).toHaveAttribute('data-picodash-docked-minimized', 'true')
    await expect(panel).toHaveAttribute('aria-hidden', 'true')
    await expect(panel.locator('[data-picodash-panel-body]')).not.toHaveAttribute('hidden')
    await expect
      .poll(() => panel.evaluate((element) => getComputedStyle(element).opacity))
      .toBe('0')
    const minimizedBoundaryBox = (await boundary.boundingBox())!
    await expect
      .poll(async () => (await panel.boundingBox())?.x)
      .toBeGreaterThanOrEqual(minimizedBoundaryBox.x + minimizedBoundaryBox.width - 1)
    const revealBox = (await reveal.boundingBox())!
    expect(revealBox.x + revealBox.width).toBeCloseTo(
      minimizedBoundaryBox.x + minimizedBoundaryBox.width,
      0,
    )

    await reveal.click()
    await expect(minimize).toBeFocused()
    await expect(panel).not.toHaveAttribute('data-picodash-docked-minimized')
    await expect
      .poll(() => panel.evaluate((element) => getComputedStyle(element).opacity))
      .toBe('1')
  }

  await page.getByRole('button', { name: 'Fixed', exact: true }).click()
  await assertFullRightMinimize()

  for (const mode of ['Fixed', 'Hybrid'] as const) {
    await page.getByRole('button', { name: mode, exact: true }).click()
    await panel.locator('[aria-label="Close panel Placement Panel"]').click()
    await expect(panel).toHaveAttribute('hidden', '')
    expect(await panel.evaluate((element) => getComputedStyle(element).display)).toBe('none')
    expect(await panel.boundingBox()).toBeNull()
    await showPanel.click()
  }

  await page.getByRole('button', { name: 'Floating', exact: true }).click()
  await panel.evaluate((element) => {
    element.style.setProperty('--picodash-panel-snap-duration', '320ms')
    element.style.setProperty('--picodash-panel-detach-duration', '280ms')
  })
  const boundaryBox = (await boundary.boundingBox())!
  let panelBox = (await panelByRole.boundingBox())!
  let moveBox = (await dragSurface.boundingBox())!
  let pointer = { x: moveBox.x + moveBox.width / 2, y: moveBox.y + moveBox.height / 2 }
  await page.mouse.move(pointer.x, pointer.y)
  await page.mouse.down()
  await expect(panel).toHaveAttribute('data-picodash-placement', 'floating-free-preview')
  await page.mouse.move(
    pointer.x + boundaryBox.x + 8 - panelBox.x,
    pointer.y + boundaryBox.y + 8 - panelBox.y,
  )
  await expect
    .poll(() =>
      panel.evaluate((element) => ({
        magnetic: element.getAttribute('data-picodash-magnetic'),
        motion: element.getAttribute('data-picodash-magnetic-motion'),
        hasExpectedAnimation: element.getAnimations().some((animation) => {
          const effect = animation.effect
          return (
            effect instanceof KeyframeEffect &&
            effect.getTiming().duration === 320 &&
            effect.getKeyframes().length === 3 &&
            effect.getKeyframes().every((keyframe) => typeof keyframe.translate === 'string')
          )
        }),
      })),
    )
    .toEqual({ magnetic: 'snapped', motion: 'snap', hasExpectedAnimation: true })
  await expect.poll(async () => (await panel.boundingBox())?.x).toBeCloseTo(boundaryBox.x + 8, 0)
  await expect.poll(async () => (await panel.boundingBox())?.y).toBeCloseTo(boundaryBox.y + 8, 0)
  await page.mouse.up()
  await expect(panel).toHaveAttribute('data-picodash-placement', 'floating-snapped')

  moveBox = (await dragSurface.boundingBox())!
  pointer = { x: moveBox.x + moveBox.width / 2, y: moveBox.y + moveBox.height / 2 }
  await page.mouse.move(pointer.x, pointer.y)
  await page.mouse.down()
  await page.mouse.move(pointer.x + 24, pointer.y)
  await expect(panel).toHaveAttribute('data-picodash-magnetic', 'resisted')
  const resistedX = (await panel.boundingBox())!.x
  expect(resistedX).toBeGreaterThan(boundaryBox.x + 8)
  expect(resistedX).toBeLessThan(boundaryBox.x + 8 + 24)
  await page.mouse.move(pointer.x + 44, pointer.y)
  await expect
    .poll(() =>
      panel.evaluate((element) => ({
        magnetic: element.getAttribute('data-picodash-magnetic'),
        motion: element.getAttribute('data-picodash-magnetic-motion'),
        hasExpectedAnimation: element.getAnimations().some((animation) => {
          const effect = animation.effect
          return (
            effect instanceof KeyframeEffect &&
            effect.getTiming().duration === 280 &&
            effect.getKeyframes().length === 3 &&
            effect.getKeyframes().every((keyframe) => typeof keyframe.translate === 'string')
          )
        }),
      })),
    )
    .toEqual({ magnetic: null, motion: 'detach', hasExpectedAnimation: true })
  await page.mouse.up()
  await expect(panel).toHaveAttribute('data-picodash-placement', 'floating-free')

  const freeStart = (await panel.boundingBox())!
  moveBox = (await dragSurface.boundingBox())!
  pointer = { x: moveBox.x + moveBox.width / 2, y: moveBox.y + moveBox.height / 2 }
  await page.mouse.move(pointer.x, pointer.y)
  await page.mouse.down()
  await page.mouse.move(
    pointer.x + boundaryBox.x + 8 - freeStart.x,
    pointer.y + boundaryBox.y + 8 - freeStart.y,
  )
  await expect(panel).toHaveAttribute('data-picodash-magnetic', 'snapped')
  await page.mouse.move(pointer.x + boundaryBox.x + 96 - freeStart.x, pointer.y + 80)
  await expect(panel).not.toHaveAttribute('data-picodash-magnetic')
  await expect(panel).toHaveAttribute('data-picodash-magnetic-motion', 'detach')
  await expect.poll(async () => (await panel.boundingBox())?.x).toBeGreaterThan(boundaryBox.x + 48)
  await expect(panel).not.toHaveAttribute('data-picodash-magnetic-motion')
  const releasedFreePreview = (await panel.boundingBox())!
  await page.mouse.up()
  await expect
    .poll(async () => (await panel.boundingBox())?.x)
    .toBeCloseTo(releasedFreePreview.x, 0)

  await panel.evaluate((element) => {
    element.style.setProperty('--picodash-panel-snap-duration', '1000ms')
    element.style.setProperty('--picodash-panel-detach-duration', '1000ms')
    element.style.setProperty('--picodash-panel-snap-bounce', '0')
    element.style.setProperty('--picodash-panel-detach-bounce', '0')
  })
  const continuityStart = (await panel.boundingBox())!
  moveBox = (await dragSurface.boundingBox())!
  pointer = { x: moveBox.x + moveBox.width / 2, y: moveBox.y + moveBox.height / 2 }
  await page.mouse.move(pointer.x, pointer.y)
  await page.mouse.down()
  await page.mouse.move(
    pointer.x + boundaryBox.x + 8 - continuityStart.x,
    pointer.y + boundaryBox.y + 8 - continuityStart.y,
  )
  await expect(panel).toHaveAttribute('data-picodash-magnetic-motion', 'snap')
  const interruptedPosition = await pausePanelTranslateAnimationAfter(panel, 200, false, true)
  await page.mouse.move(
    pointer.x + boundaryBox.x + 96 - continuityStart.x,
    pointer.y + boundaryBox.y + 80 - continuityStart.y,
  )
  await expect(panel).toHaveAttribute('data-picodash-magnetic-motion', 'detach')
  const replacementStart = await pausePanelTranslateAnimationAfter(panel, 0, true)
  expect(replacementStart.x).toBeCloseTo(interruptedPosition.x, 0)
  expect(replacementStart.y).toBeCloseTo(interruptedPosition.y, 0)
  await page.mouse.up()

  const panelBody = panel.locator('[data-picodash-panel-body]')
  await panelBody.evaluate((body) => {
    const spacer = body.ownerDocument.createElement('div')
    spacer.dataset.contractLabTallPanelProbe = 'true'
    spacer.style.blockSize = '60rem'
    spacer.style.flex = '0 0 60rem'
    body.append(spacer)
  })
  await expect.poll(async () => (await panel.boundingBox())?.height).toBeGreaterThan(600)
  await expect.poll(() => panel.evaluate((element) => element.getAnimations().length)).toBe(0)
  panelBox = (await panelByRole.boundingBox())!
  moveBox = (await dragSurface.boundingBox())!
  pointer = { x: moveBox.x + moveBox.width / 2, y: moveBox.y + moveBox.height / 2 }
  const contractedTop = boundaryBox.y + boundaryBox.height - 220
  await page.mouse.move(pointer.x, pointer.y)
  await page.mouse.down()
  await page.mouse.move(pointer.x, pointer.y + contractedTop - panelBox.y)
  await expect(panel).toHaveAttribute('data-picodash-placement', 'floating-free-preview')
  await expect.poll(async () => (await panel.boundingBox())?.height).toBeLessThanOrEqual(221)
  await expect
    .poll(() => panelBody.evaluate((body) => body.scrollHeight > body.clientHeight))
    .toBe(true)
  const contractedPanelBox = (await panel.boundingBox())!
  expect(contractedPanelBox.y + contractedPanelBox.height).toBeLessThanOrEqual(
    boundaryBox.y + boundaryBox.height + 1,
  )
  await page.mouse.up()
  await panelBody
    .locator('[data-contract-lab-tall-panel-probe]')
    .evaluate((probe) => probe.remove())

  await page.getByRole('button', { name: 'Hybrid', exact: true }).click()
  moveBox = (await dragSurface.boundingBox())!
  pointer = { x: moveBox.x + moveBox.width / 2, y: moveBox.y + moveBox.height / 2 }
  await page.mouse.move(pointer.x, pointer.y)
  await page.mouse.down()
  await page.mouse.move(pointer.x + 96, pointer.y, { steps: 4 })
  await page.mouse.up()
  await expect(panel).toHaveAttribute('data-picodash-placement', 'hybrid-free')

  panelBox = (await panelByRole.boundingBox())!
  moveBox = (await dragSurface.boundingBox())!
  pointer = { x: moveBox.x + moveBox.width / 2, y: moveBox.y + moveBox.height / 2 }
  const rightEdgePointerX =
    pointer.x + boundaryBox.x + boundaryBox.width - panelBox.width - panelBox.x
  const dockPreview = page.locator(
    '[data-contract-lab-focused-portal-target] [data-picodash-panel-dock-preview]',
  )
  await page.mouse.move(pointer.x, pointer.y)
  await page.mouse.down()
  await page.mouse.move(rightEdgePointerX, boundaryBox.y + 20, { steps: 4 })
  await expect(dockPreview).toHaveAttribute('data-picodash-dock-position', 'top-right')
  await expect.poll(async () => (await dockPreview.boundingBox())?.y).toBeCloseTo(boundaryBox.y, 0)

  await page.mouse.move(rightEdgePointerX, boundaryBox.y + boundaryBox.height / 2)
  await expect(dockPreview).toHaveAttribute('data-picodash-dock-position', 'full-right')
  await expect
    .poll(async () => (await dockPreview.boundingBox())?.height)
    .toBeCloseTo(boundaryBox.height, 0)

  await page.mouse.move(rightEdgePointerX - 200, boundaryBox.y + boundaryBox.height / 2)
  await expect(dockPreview).not.toHaveAttribute('data-picodash-dock-position')
  await expect
    .poll(() => dockPreview.evaluate((element) => getComputedStyle(element).opacity))
    .toBe('0')

  await page.mouse.move(rightEdgePointerX, boundaryBox.y + boundaryBox.height / 2)
  await expect(dockPreview).toHaveAttribute('data-picodash-dock-position', 'full-right')
  await page.mouse.up()
  await expect(panel).toHaveAttribute('data-picodash-placement', 'hybrid-docked')
  await expect(page.getByRole('status', { name: 'Current panel placement' })).toHaveText(
    'Hybrid: docked full-right',
  )
  await assertFullRightMinimize()

  panelBox = (await panelByRole.boundingBox())!
  moveBox = (await dragSurface.boundingBox())!
  pointer = { x: moveBox.x + moveBox.width / 2, y: moveBox.y + moveBox.height / 2 }
  const topRightPointerX =
    pointer.x + boundaryBox.x + boundaryBox.width - panelBox.width - panelBox.x
  await page.mouse.move(pointer.x, pointer.y)
  await page.mouse.down()
  await page.mouse.move(pointer.x - 50, pointer.y + 50)
  await page.mouse.move(topRightPointerX, boundaryBox.y + 20)
  await expect(dockPreview).toHaveAttribute('data-picodash-dock-position', 'top-right')
  await page.mouse.up()
  await expect(page.getByRole('status', { name: 'Current panel placement' })).toHaveText(
    'Hybrid: docked top-right',
  )

  await page.getByRole('button', { name: 'Floating', exact: true }).click()
  await page.getByRole('button', { name: 'Same edge', exact: true }).click()
  const fixedCorner = page.getByRole('complementary', { name: 'Fixed allocation corner' })
  await expect(fixedCorner).toBeVisible()

  await page.getByRole('button', { name: 'Hybrid', exact: true }).click()
  moveBox = (await dragSurface.boundingBox())!
  pointer = { x: moveBox.x + moveBox.width / 2, y: moveBox.y + moveBox.height / 2 }
  await page.mouse.move(pointer.x, pointer.y)
  await page.mouse.down()
  await page.mouse.move(pointer.x + 80, pointer.y + 80)
  await page.mouse.up()
  await expect(panel).toHaveAttribute('data-picodash-placement', 'hybrid-free')

  panelBox = (await panelByRole.boundingBox())!
  moveBox = (await dragSurface.boundingBox())!
  pointer = { x: moveBox.x + moveBox.width / 2, y: moveBox.y + moveBox.height / 2 }
  const allocatedRightPointerX =
    pointer.x + boundaryBox.x + boundaryBox.width - panelBox.width - panelBox.x
  await page.mouse.move(pointer.x, pointer.y)
  await page.mouse.down()
  await page.mouse.move(allocatedRightPointerX, boundaryBox.y + boundaryBox.height / 2)
  await expect(dockPreview).toHaveAttribute('data-picodash-dock-position', 'full-right')
  await expect
    .poll(async () => (await dockPreview.boundingBox())?.y)
    .toBeCloseTo(boundaryBox.y + boundaryBox.height / 3, 0)
  await expect
    .poll(async () => (await dockPreview.boundingBox())?.height)
    .toBeCloseTo((boundaryBox.height * 2) / 3, 0)
  const allocatedPreviewBox = (await dockPreview.boundingBox())!
  await page.mouse.up()
  await expect(panel).toHaveAttribute('data-picodash-placement', 'hybrid-docked')
  await expect
    .poll(async () => (await panelByRole.boundingBox())?.y)
    .toBeCloseTo(allocatedPreviewBox.y, 0)
  await expect
    .poll(async () => (await panelByRole.boundingBox())?.height)
    .toBeCloseTo(allocatedPreviewBox.height, 0)
  const hybridAllocatedBox = (await panelByRole.boundingBox())!
  expect((await fixedCorner.boundingBox())?.height).toBeCloseTo(boundaryBox.height / 3, 0)

  await page.getByRole('button', { name: 'Fixed', exact: true }).click()
  await expect
    .poll(async () => (await panelByRole.boundingBox())?.y)
    .toBeCloseTo(hybridAllocatedBox.y, 0)
  await expect
    .poll(async () => (await panelByRole.boundingBox())?.height)
    .toBeCloseTo(hybridAllocatedBox.height, 0)

  await page.getByRole('button', { name: 'Adjacent edges', exact: true }).click()
  const adjacentCorner = page.getByRole('complementary', { name: 'Fixed adjacent corner' })
  const adjacentEdge = page.getByRole('complementary', { name: 'Hybrid adjacent edge' })
  await expect(adjacentCorner).toBeVisible()
  await expect(adjacentEdge).toBeVisible()
  const adjacentCornerBox = (await adjacentCorner.boundingBox())!
  const adjacentEdgeBox = (await adjacentEdge.boundingBox())!
  const orthogonalSideBox = (await panelByRole.boundingBox())!
  expect(adjacentEdgeBox.x).toBeCloseTo(adjacentCornerBox.x + adjacentCornerBox.width, 0)
  expect(adjacentEdgeBox.x + adjacentEdgeBox.width).toBeCloseTo(
    boundaryBox.x + boundaryBox.width,
    0,
  )
  expect(adjacentEdgeBox.x + adjacentEdgeBox.width).toBeGreaterThan(orthogonalSideBox.x)
})

test('persists, restores, resets, and safely recovers settled DashPanel layout', async ({
  page,
}) => {
  await openLab(page)

  const panel = page.getByRole('complementary', { name: 'Placement Panel' })
  const boundary = page.locator('[data-contract-lab-focused-boundary]')
  const moveControl = panel.getByRole('button', { name: 'Move panel Placement Panel' })
  const readPreferredOffset = async () => {
    const [panelBox, boundaryBox] = await Promise.all([panel.boundingBox(), boundary.boundingBox()])
    if (!panelBox || !boundaryBox) throw new Error('Placement geometry was unavailable.')
    return { x: panelBox.x - boundaryBox.x, y: panelBox.y - boundaryBox.y }
  }

  await expect(panel).toBeVisible()
  await moveControl.focus()
  await moveControl.press('Enter')
  await moveControl.press('Shift+ArrowRight')
  await moveControl.press('Shift+ArrowDown')
  await moveControl.press('Enter')
  await expect.poll(readPreferredOffset).toEqual({ x: 34, y: 34 })

  await expect
    .poll(() => page.evaluate(() => window.sessionStorage.getItem('picodash-dev-bridge-tab')))
    .toEqual(expect.any(String))
  const browserTabId = await page.evaluate(() =>
    window.sessionStorage.getItem('picodash-dev-bridge-tab'),
  )
  const credential = JSON.parse(
    await readFile(resolve(process.cwd(), '../../.picodash/dev-bridge.json'), 'utf8'),
  ) as { url: string; token: string }
  const client = createPicodashDevBridgeClient({ baseUrl: credential.url, token: credential.token })
  const placementSession = async () =>
    (await client.listSessions()).find(
      (item) =>
        item.registrationId === 'contract-lab-focused-placement' &&
        item.browserTabId === browserTabId,
    )
  await expect.poll(placementSession).toBeTruthy()
  const settledSession = (await placementSession())!
  const settledSnapshot = await client.inspect(settledSession)
  expect(
    settledSnapshot.snapshot.scopes?.find((scope) => scope.id === focusedPlacementPanelScopeId)
      ?.metadata,
  ).toEqual({
    dashPanel: {
      placement: { mode: 'floating', disposition: { kind: 'free' } },
      preferredPosition: { x: 34, y: 34 },
    },
  })
  await expect
    .poll(() =>
      page.evaluate(
        (storageKey) => localStorage.getItem(storageKey),
        focusedPlacementPersistenceStorageKey,
      ),
    )
    .toContain('"preferredPosition":{"x":34,"y":34}')

  await page.reload()
  await expect(page.locator('[data-contract-lab-status]')).toHaveAttribute('data-ready', 'true')
  await expect(panel).toBeVisible()
  await expect
    .poll(async () => {
      const current = await placementSession()
      return current && current.generation > settledSession.generation
    })
    .toBeTruthy()
  const restoredSession = (await placementSession())!
  const restoredSnapshot = await client.inspect(restoredSession)
  expect(
    restoredSnapshot.snapshot.scopes?.find((scope) => scope.id === focusedPlacementPanelScopeId)
      ?.metadata,
  ).toEqual({
    dashPanel: {
      placement: { mode: 'floating', disposition: { kind: 'free' } },
      preferredPosition: { x: 34, y: 34 },
    },
  })
  await expect.poll(readPreferredOffset).toEqual({ x: 34, y: 34 })

  await panel.getByRole('button', { name: 'Reset panel layout' }).click()
  await expect.poll(readPreferredOffset).toEqual({ x: 24, y: 24 })
  await expect
    .poll(async () => {
      const current = await placementSession()
      if (!current) return 'session unavailable'
      const snapshot = await client.inspect(current)
      return snapshot.snapshot.scopes?.find((scope) => scope.id === focusedPlacementPanelScopeId)
        ?.metadata
    })
    .toBeUndefined()

  await page.reload()
  await expect(page.locator('[data-contract-lab-status]')).toHaveAttribute('data-ready', 'true')
  await expect(panel).toBeVisible()
  await expect.poll(readPreferredOffset).toEqual({ x: 24, y: 24 })

  await page.evaluate(
    ({ storageKey, scopeId }) => {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          kind: 'picodash-nexus-envelope',
          formatVersion: 1,
          nexusId: 'contract-lab-focused-placement',
          schemaVersion: 1,
          revision: 42,
          writerId: 'm3-invalid-layout-fixture',
          valueOwner: 'nexus',
          values: {},
          scopes: [[scopeId, { dashPanel: { invalid: true } }]],
        }),
      )
    },
    {
      storageKey: focusedPlacementPersistenceStorageKey,
      scopeId: focusedPlacementPanelScopeId,
    },
  )
  await page.reload()
  await expect(page.locator('[data-contract-lab-status]')).toHaveAttribute('data-ready', 'true')
  await expect(panel).toBeVisible()
  await expect.poll(readPreferredOffset).toEqual({ x: 24, y: 24 })
  await expect
    .poll(async () => {
      const current = await placementSession()
      if (!current) return undefined
      const snapshot = await client.inspect(current)
      return snapshot.snapshot.diagnostics?.find(
        (diagnostic) =>
          diagnostic.code === 'metadata_quarantined' &&
          diagnostic.identity.kind === 'scope-metadata' &&
          diagnostic.identity.scopeId === focusedPlacementPanelScopeId,
      )
    })
    .toMatchObject({
      code: 'metadata_quarantined',
      identity: { kind: 'scope-metadata', scopeId: focusedPlacementPanelScopeId },
    })
  const recoveredSession = (await placementSession())!
  const recoveredSnapshot = await client.inspect(recoveredSession)
  expect(
    recoveredSnapshot.snapshot.scopes?.find((scope) => scope.id === focusedPlacementPanelScopeId)
      ?.metadata,
  ).toBeUndefined()
})

test('connects the real browser specimen through the dev bridge and rejects the retired generation', async ({
  page,
}) => {
  await openLab(page)
  await page.getByRole('button', { name: /^Documents:/ }).click()
  await page.evaluate((key) => localStorage.removeItem(key), persistenceProbeStorageKey)
  await page.reload()
  await expect(page.locator('[data-contract-lab-status]')).toHaveAttribute('data-ready', 'true')
  const persistencePage = await page.context().newPage()
  await persistencePage.goto('/lab')
  await expect(persistencePage.locator('[data-contract-lab-status]')).toHaveAttribute(
    'data-ready',
    'true',
  )
  await persistencePage.getByRole('button', { name: /^Documents:/ }).click()
  const persistenceStatus = page.locator('[data-contract-lab-persistence-status]')
  const persistenceStatusPeer = persistencePage.locator('[data-contract-lab-persistence-status]')
  await expect(persistenceStatus).toHaveText('Persistence status: clean')
  await expect(persistenceStatusPeer).toHaveText('Persistence status: clean')
  await page.getByRole('button', { name: 'Write metadata probe' }).press('Enter')
  await expect(page.locator('[data-contract-lab-persistence-command]')).toHaveText(
    'Metadata write accepted.',
  )
  await expect(persistenceStatusPeer).toHaveText('Persistence status: conflict')
  const peerStatusBeforeUnrelated = await persistenceStatusPeer.textContent()
  const peerCommandBeforeUnrelated = await persistencePage
    .locator('[data-contract-lab-persistence-command]')
    .textContent()
  await page.evaluate(() => localStorage.setItem('contract-lab-unrelated-key', 'ignored'))
  await expect(persistenceStatusPeer).toHaveText(peerStatusBeforeUnrelated ?? '')
  await expect(persistencePage.locator('[data-contract-lab-persistence-command]')).toHaveText(
    peerCommandBeforeUnrelated ?? '',
  )
  await persistencePage.close()
  await expect
    .poll(() => page.evaluate(() => window.sessionStorage.getItem('picodash-dev-bridge-tab')))
    .toEqual(expect.any(String))
  const browserTabId = await page.evaluate(() =>
    window.sessionStorage.getItem('picodash-dev-bridge-tab'),
  )
  const credential = JSON.parse(
    await readFile(resolve(process.cwd(), '../../.picodash/dev-bridge.json'), 'utf8'),
  ) as { url: string; token: string }
  const client = createPicodashDevBridgeClient({ baseUrl: credential.url, token: credential.token })
  const matches = (items: Awaited<ReturnType<typeof client.listSessions>>) =>
    items.find(
      (item) =>
        item.registrationId === 'contract-lab-specimen' && item.browserTabId === browserTabId,
    )
  await expect.poll(async () => matches(await client.listSessions())).toBeTruthy()
  const initial = matches(await client.listSessions())!
  const initialSnapshot = await client.inspect(initial)
  expect(initialSnapshot.snapshot.values?.specimenMetric).toBe(24)
  expect(initialSnapshot.snapshot.values?.specimenUnit).toBe('requests/minute')
  expect(initialSnapshot.snapshot.diagnostics).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        code: 'metadata_quarantined',
        identity: { kind: 'scope-metadata', scopeId: 'quarantined-panel' },
      }),
    ]),
  )
  await expect(
    page.locator('[data-contract-lab-status] dt', { hasText: 'Diagnostics' }).locator('..'),
  ).toContainText('1')
  await expect(page.locator('[data-contract-lab-migration]')).toContainText('legacyMetric')
  await expect(page.locator('[data-contract-lab-quarantine-default]')).toContainText(
    'Layout changes are rejected and return to this position',
  )
  await page.getByRole('button', { name: 'Replace quarantined metadata' }).press('Enter')
  await expect(page.locator('[data-contract-lab-quarantine-state]')).toHaveText(
    'Quarantined metadata replaced.',
  )
  const recoveredSnapshot = await client.inspect(matches(await client.listSessions())!)
  expect(recoveredSnapshot.snapshot.diagnostics ?? []).not.toEqual(
    expect.arrayContaining([expect.objectContaining({ code: 'metadata_quarantined' })]),
  )
  await expect(
    page.locator('[data-contract-lab-status] dt', { hasText: 'Diagnostics' }).locator('..'),
  ).toContainText('clear')
  const write = await client.setValues(initial, {
    type: 'set_values',
    requestId: 'lab-set-42',
    values: { specimenMetric: 42 },
  })
  expect(write.type).toBe('command_result')
  await expect(page.locator('[data-contract-lab-bound-display]')).toHaveText('42')
  await expect(page.locator('[data-contract-lab-bound-input]')).toHaveValue('42')
  await expect
    .poll(async () =>
      (await client.listSessions()).find((item) => item.sessionId === initial.sessionId),
    )
    .toBeTruthy()
  const current = (await client.listSessions()).find(
    (item) => item.sessionId === initial.sessionId,
  )!
  const wait = await client.wait(current, {
    type: 'wait',
    requestId: 'lab-wait-42',
    timeoutMs: 1000,
    condition: { type: 'value_equals', field: 'specimenMetric', value: 42 },
  })
  expect(wait.type).toBe('wait_result')
  expect((wait as { outcome: string }).outcome).toBe('satisfied')

  await page.getByRole('button', { name: 'Capture document' }).press('Enter')
  await expect(page.locator('[data-contract-lab-document-status]')).toHaveText(
    'Document captured for local restore.',
  )
  const beforeDocumentMutation = matches(await client.listSessions())!
  const documentMutation = await client.setValues(beforeDocumentMutation, {
    type: 'set_values',
    requestId: 'lab-document-mutation-33',
    values: { specimenMetric: 33 },
  })
  expect(documentMutation.type).toBe('command_result')
  await expect(page.locator('[data-contract-lab-bound-display]')).toHaveText('33')
  await page.getByRole('button', { name: 'Restore captured document' }).press('Enter')
  await expect(page.locator('[data-contract-lab-document-status]')).toHaveText(
    'Captured document restored.',
  )
  await expect(page.locator('[data-contract-lab-bound-display]')).toHaveText('42')
  await expect(page.locator('[data-contract-lab-bound-input]')).toHaveValue('42')
  const restoredSession = matches(await client.listSessions())!
  const restoredSnapshot = await client.inspect(restoredSession)
  expect(restoredSnapshot.snapshot.values?.specimenMetric).toBe(42)
  const restoredWait = await client.wait(restoredSession, {
    type: 'wait',
    requestId: 'lab-wait-document-restore-42',
    timeoutMs: 1000,
    condition: {
      type: 'value_equals',
      field: 'specimenMetric',
      value: 42,
      afterSequence: beforeDocumentMutation.sequence,
    },
  })
  expect(restoredWait.type).toBe('wait_result')
  expect((restoredWait as { outcome: string }).outcome).toBe('satisfied')

  const boundInput = page.locator('[data-contract-lab-bound-input]')
  const specimenPanel = page.getByRole('complementary', { name: 'Primary Panel' })
  await boundInput.fill('37')
  await expect
    .poll(async () => {
      const session = matches(await client.listSessions())!
      const snapshot = await client.inspect(session)
      return snapshot.snapshot.values?.specimenMetric
    })
    .toBe(37)
  await boundInput.fill('not-a-number')
  await expect(page.locator('[data-picodash-dashlet-binding-issues="metric"]')).toContainText(
    'Metric must be a finite number.',
  )
  expect(
    (await client.inspect(matches(await client.listSessions())!)).snapshot.values?.specimenMetric,
  ).toBe(37)

  await page.getByRole('button', { name: 'Close panel Primary Panel' }).press('Enter')
  await expect(specimenPanel).toBeHidden()
  const hiddenSession = matches(await client.listSessions())!
  const hiddenWrite = await client.setValues(hiddenSession, {
    type: 'set_values',
    requestId: 'lab-hidden-set-42',
    values: { specimenMetric: 42 },
  })
  expect(hiddenWrite.type).toBe('command_result')
  await expect
    .poll(
      async () =>
        (await client.inspect(matches(await client.listSessions())!)).snapshot.values
          ?.specimenMetric,
    )
    .toBe(42)
  const beforeReopen = matches(await client.listSessions())!
  await page.getByRole('button', { name: 'Show primary panel' }).press('Enter')
  await expect(specimenPanel).toBeVisible()
  await expect(page.getByRole('button', { name: 'Collapse panel Primary Panel' })).toBeFocused()
  await expect(page.locator('[data-contract-lab-bound-display]')).toHaveText('42')
  await expect(boundInput).toHaveValue('not-a-number')
  await expect(boundInput).toHaveAttribute('data-stale', 'true')
  expect(matches(await client.listSessions())!).toMatchObject({
    sessionId: beforeReopen.sessionId,
    generation: beforeReopen.generation,
  })
  await boundInput.fill('37')
  await expect(boundInput).toHaveAttribute('data-stale', 'true')
  const beforeOverwriteSession = matches(await client.listSessions())!
  await page.getByRole('button', { name: 'Overwrite value…' }).press('Enter')
  const overwriteDialog = page.getByRole('alertdialog', { name: 'Overwrite the current value?' })
  await expect(overwriteDialog).toBeVisible()
  await overwriteDialog.getByRole('button', { name: 'Cancel' }).press('Enter')
  await expect(overwriteDialog).toHaveCount(0)
  await expect(boundInput).toHaveValue('37')
  await expect(boundInput).toHaveAttribute('data-stale', 'true')
  expect(
    (await client.inspect(matches(await client.listSessions())!)).snapshot.values?.specimenMetric,
  ).toBe(42)
  await page.getByRole('button', { name: 'Overwrite value…' }).press('Enter')
  await expect(overwriteDialog).toBeVisible()
  const changedWhileConfirming = await client.setValues(matches(await client.listSessions())!, {
    type: 'set_values',
    requestId: 'lab-stale-overwrite-plan',
    values: { specimenMetric: 39 },
  })
  expect(changedWhileConfirming.type).toBe('command_result')
  await overwriteDialog.getByRole('button', { name: 'Overwrite value' }).press('Enter')
  await expect(boundInput).toHaveValue('37')
  await expect(boundInput).toHaveAttribute('data-stale', 'true')
  await expect(
    page.locator('[data-picodash-dashlist] div[role="status"]').filter({
      hasText: 'Stale overwrite plan is stale.',
    }),
  ).toContainText('Stale overwrite plan is stale.')
  expect(
    (await client.inspect(matches(await client.listSessions())!)).snapshot.values?.specimenMetric,
  ).toBe(39)
  await page.getByRole('button', { name: 'Overwrite value…' }).press('Enter')
  await expect(overwriteDialog).toBeVisible()
  await overwriteDialog.getByRole('button', { name: 'Overwrite value' }).press('Enter')
  await expect(boundInput).toHaveValue('37')
  await expect(boundInput).toHaveAttribute('data-stale', 'false')
  await expect
    .poll(async () => {
      const session = matches(await client.listSessions())!
      return (await client.inspect(session)).snapshot.values?.specimenMetric
    })
    .toBe(37)
  const finalSession = matches(await client.listSessions())!
  const finalSnapshot = await client.inspect(finalSession)
  expect(finalSnapshot.snapshot.values?.specimenMetric).toBe(37)
  const finalWait = await client.wait(finalSession, {
    type: 'wait',
    requestId: 'lab-wait-overwrite-37',
    timeoutMs: 1000,
    condition: {
      type: 'value_equals',
      field: 'specimenMetric',
      value: 37,
      afterSequence: beforeOverwriteSession.sequence,
    },
  })
  expect(finalWait.type).toBe('wait_result')
  expect((finalWait as { outcome: string }).outcome).toBe('satisfied')
  await page.getByRole('button', { name: 'Close panel Primary Panel' }).click()
  await expect(page.getByRole('button', { name: 'Show primary panel' })).toBeFocused()

  await page.reload()
  await expect(page.locator('[data-contract-lab-status]')).toHaveAttribute('data-ready', 'true')
  await expect
    .poll(
      async () =>
        matches(await client.listSessions())?.sessionId === initial.sessionId &&
        matches(await client.listSessions())!.generation > initial.generation,
    )
    .toBeTruthy()
  const next = matches(await client.listSessions())!
  expect(next.sessionId).toBe(initial.sessionId)
  expect(next.generation).toBeGreaterThan(initial.generation)
  const old = await client.setValues(initial, {
    type: 'set_values',
    requestId: 'lab-old-generation',
    values: { specimenMetric: 43 },
  })
  expect(old.type).toBe('bridge_error')
  expect(['generation_mismatch', 'session_not_found']).toContain(
    (old as { error: { code: string } }).error.code,
  )
  await expect(page.locator('[data-contract-lab-bound-display]')).toHaveText('24')

  const primaryBeforeStyle = matches(await client.listSessions())!
  const primaryBeforeStyleSnapshot = await client.inspect(primaryBeforeStyle)
  await page.getByRole('button', { name: /^Style lab:/ }).click()
  await expect(page.locator('[data-contract-lab-specimen]')).toHaveAttribute(
    'data-preset',
    'composition',
  )
  const styleMatches = (items: Awaited<ReturnType<typeof client.listSessions>>) =>
    items.find(
      (item) => item.registrationId === 'dashlet-style-lab' && item.browserTabId === browserTabId,
    )
  await expect.poll(async () => styleMatches(await client.listSessions())).toBeTruthy()
  const styleInitial = styleMatches(await client.listSessions())!
  expect(styleInitial.label).toBe('Contract Lab Style Lab')
  expect(styleInitial.disclosedValueFields).toEqual(['switchValue', 'number'])
  expect(styleInitial.disclosedScopeIds).toEqual([])
  expect(styleInitial.diagnosticsDisclosed).toBe(false)
  expect(styleInitial.writableFields).toEqual(['number'])
  const styleInitialSnapshot = await client.inspect(styleInitial)
  expect(styleInitialSnapshot.snapshot.values?.switchValue).toBe(true)
  expect(styleInitialSnapshot.snapshot.values?.number).toBe(1.234567)

  const styleNumberDashlet = page.locator('[data-picodash-dashlet="style-lab-number"]')
  const styleNumber = styleNumberDashlet.getByRole('textbox', { name: 'NumberDashlet' })
  await expect(styleNumber).toHaveValue('1.235')
  await styleNumber.focus()
  await page.getByRole('switch', { name: 'SwitchDashlet' }).focus()
  const afterUntouchedBlur = styleMatches(await client.listSessions())!
  expect(afterUntouchedBlur.sequence).toBe(styleInitial.sequence)
  expect((await client.inspect(afterUntouchedBlur)).snapshot.values?.number).toBe(1.234567)

  await styleNumber.focus()
  const incompatibleWrite = await client.setValues(afterUntouchedBlur, {
    type: 'set_values',
    requestId: 'lab-style-number-incompatible',
    values: { number: 500 },
  })
  expect(incompatibleWrite.type).toBe('command_result')
  await expect(styleNumber).toHaveCount(0)
  const styleNumberShell = styleNumberDashlet.getByRole('group', {
    name: 'NumberDashlet',
    exact: true,
  })
  await expect(styleNumberShell).toBeFocused()
  const numberWarning = 'The current value (500) is outside the configured range.'
  await expect(styleNumberDashlet.getByRole('note')).toHaveText(numberWarning)
  const styleBasicsStatus = page
    .getByRole('complementary', { name: 'Basics & readout' })
    .locator('[data-picodash-dashlist] [role="status"]')
  await expect(styleBasicsStatus).toHaveCount(1)
  await expect(styleBasicsStatus).toHaveText(numberWarning)
  await expect(styleBasicsStatus).toHaveAttribute('aria-live', 'polite')
  await expect(styleBasicsStatus).toHaveAttribute('aria-atomic', 'true')

  const styleSwitch = page.getByRole('switch', { name: 'SwitchDashlet' })
  await expect(styleSwitch).toBeChecked()
  await styleSwitch.press('Space')
  await expect(styleSwitch).not.toBeChecked()
  const styleWait = await client.wait(styleInitial, {
    type: 'wait',
    requestId: 'lab-style-switch-false',
    timeoutMs: 1000,
    condition: {
      type: 'value_equals',
      field: 'switchValue',
      value: false,
      afterSequence: afterUntouchedBlur.sequence,
    },
  })
  expect(styleWait.type).toBe('wait_result')
  expect((styleWait as { outcome: string }).outcome).toBe('satisfied')
  const styleChanged = styleMatches(await client.listSessions())!
  expect(styleChanged.sequence).toBeGreaterThan(styleInitial.sequence)
  expect((await client.inspect(styleChanged)).snapshot.values?.switchValue).toBe(false)

  const primaryAfterStyle = matches(await client.listSessions())!
  expect(primaryAfterStyle.registrationId).toBe('contract-lab-specimen')
  expect(primaryAfterStyle.browserTabId).toBe(browserTabId)
  expect(primaryAfterStyle.sequence).toBe(primaryBeforeStyle.sequence)
  expect((await client.inspect(primaryAfterStyle)).snapshot).toEqual(
    primaryBeforeStyleSnapshot.snapshot,
  )

  const standaloneList = page.getByRole('region', { name: 'Standalone List evidence' })
  const collapseStandaloneGroup = standaloneList.getByRole('button', {
    name: 'Collapse group Standalone group',
  })
  await collapseStandaloneGroup.focus()
  await expect(collapseStandaloneGroup).toBeFocused()
  await collapseStandaloneGroup.press('Enter')
  const expandStandaloneGroup = standaloneList.getByRole('button', {
    name: 'Expand group Standalone group',
  })
  await expect(expandStandaloneGroup).toBeVisible()
  await expect(expandStandaloneGroup).toHaveAttribute('aria-expanded', 'false')

  const collapseWait = await client.wait(primaryAfterStyle, {
    type: 'wait',
    requestId: 'lab-primary-standalone-collapse',
    timeoutMs: 1000,
    condition: { type: 'sequence_after', sequence: primaryAfterStyle.sequence },
  })
  expect(collapseWait).toMatchObject({ type: 'wait_result', outcome: 'satisfied' })

  const primaryAfterStandaloneCollapse = matches(await client.listSessions())!
  expect(primaryAfterStandaloneCollapse).toMatchObject({
    registrationId: 'contract-lab-specimen',
    browserTabId,
    generation: primaryAfterStyle.generation,
  })
  expect(primaryAfterStandaloneCollapse.sequence).toBeGreaterThan(primaryAfterStyle.sequence)
  const collapsedSnapshot = await client.inspect(primaryAfterStandaloneCollapse)
  expect(collapsedSnapshot.session).toMatchObject({
    registrationId: 'contract-lab-specimen',
    browserTabId,
    generation: primaryAfterStyle.generation,
    sequence: primaryAfterStandaloneCollapse.sequence,
  })
  expect(
    collapsedSnapshot.snapshot.scopes?.find((scope) => scope.id === standaloneListScopeId),
  ).toMatchObject({
    id: standaloneListScopeId,
    metadata: {
      dashList: {
        collapseOverrides: [['standalone-group', true]],
      },
    },
  })
  await page.evaluate((key) => {
    localStorage.removeItem(key)
    localStorage.removeItem('contract-lab-unrelated-key')
  }, persistenceProbeStorageKey)
})
