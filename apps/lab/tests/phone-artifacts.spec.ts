import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
  type TestInfo,
} from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const phoneViewport = { width: 390, height: 844 } as const
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const artifactDirectory = path.join(repositoryRoot, 'output/playwright/phone')

interface PhoneRecording {
  readonly context: BrowserContext
  readonly errors: string[]
  readonly page: Page
}

test.beforeAll(async () => {
  await mkdir(artifactDirectory, { recursive: true })
})

test('captures phone-sized placement motion and reduced-motion evidence', async ({
  baseURL,
  browser,
}, testInfo) => {
  const recording = await openPhoneRecording(browser, baseURL, testInfo)
  const { errors, page } = recording
  try {
    await openLab(page)
    await page.getByRole('button', { name: /^Placement:/ }).click()

    const boundary = page.getByRole('region', { name: 'DashPanel placement boundary' })
    const panel = page.getByRole('complementary', { name: 'Placement Panel' })
    const dragSurface = panel.locator('[data-picodash-panel-drag-surface]')
    await boundary.evaluate((element) => element.scrollIntoView({ block: 'start' }))
    await expect(panel).toBeVisible()
    const expandedHeight = (await requiredBox(panel)).height
    const body = panel.locator('[data-picodash-panel-body]')
    expect(
      await body.evaluate((element) => ({
        overflow: element.scrollHeight > element.clientHeight,
        top: getComputedStyle(element).getPropertyValue('--_picodash-scroll-fade-top').trim(),
        bottom: getComputedStyle(element).getPropertyValue('--_picodash-scroll-fade-bottom').trim(),
      })),
    ).toEqual({ overflow: false, top: '0px', bottom: '0px' })
    await capture(page, testInfo, 'placement-expanded.png')

    const collapse = panel.getByRole('button', { name: 'Collapse panel Placement Panel' })
    const heightMotion = await triggeredMotion(panel, 'blockSize', () => collapse.click())
    expect(heightMotion).toMatchObject({ duration: 150, keyframeCount: 2 })
    await expect(panel).not.toHaveAttribute('data-picodash-height-motion')
    const collapsedHeight = (await requiredBox(panel)).height
    expect(collapsedHeight).toBeLessThan(expandedHeight)
    await capture(page, testInfo, 'placement-collapsed.png')
    const expandMotion = await triggeredMotion(panel, 'blockSize', () =>
      panel.getByRole('button', { name: 'Expand panel Placement Panel' }).click(),
    )
    expect(expandMotion).toMatchObject({ duration: 150, keyframeCount: 2 })
    await expect(panel).not.toHaveAttribute('data-picodash-height-motion')
    expect((await requiredBox(panel)).height).toBeGreaterThan(collapsedHeight)

    let boundaryBox = await requiredBox(boundary)
    let panelBox = await requiredBox(panel)
    let dragBox = await requiredBox(dragSurface)
    let pointer = center(dragBox)
    await page.mouse.move(pointer.x, pointer.y)
    await page.mouse.down()
    const snapMotion = await triggeredMotion(panel, 'translate', () =>
      page.mouse.move(
        pointer.x + boundaryBox.x + 8 - panelBox.x,
        pointer.y + boundaryBox.y + 8 - panelBox.y,
      ),
    )
    await expect(panel).toHaveAttribute('data-picodash-magnetic', 'snapped')
    expect(snapMotion).toMatchObject({ duration: 160, keyframeCount: 3 })
    await page.mouse.up()
    await expect(panel).toHaveAttribute('data-picodash-placement', 'floating-snapped')
    await expect(panel).not.toHaveAttribute('data-picodash-magnetic-motion')
    await capture(page, testInfo, 'placement-snapped.png')

    dragBox = await requiredBox(dragSurface)
    pointer = center(dragBox)
    await page.mouse.move(pointer.x, pointer.y)
    await page.mouse.down()
    await page.mouse.move(pointer.x, pointer.y + 24)
    await expect(panel).toHaveAttribute('data-picodash-magnetic', 'resisted')
    const detachMotion = await triggeredMotion(panel, 'translate', () =>
      page.mouse.move(pointer.x, pointer.y + 64),
    )
    await expect(panel).not.toHaveAttribute('data-picodash-magnetic')
    expect(detachMotion).toMatchObject({ duration: 140, keyframeCount: 3 })
    await page.mouse.up()

    await panel.evaluate((element) => {
      element.style.setProperty('--picodash-panel-width', '16rem')
    })
    await expect.poll(async () => (await requiredBox(panel)).width).toBeLessThanOrEqual(257)
    await page.getByRole('button', { name: 'Hybrid', exact: true }).click()
    await boundary.evaluate((element) => element.scrollIntoView({ block: 'start' }))
    await panel.getByRole('button', { name: 'Actions for Placement Panel' }).click()
    const placement = page.getByRole('menuitem', { name: 'Placement', exact: true })
    await placement.press('ArrowRight')
    await page.getByRole('menuitem', { name: 'Free', exact: true }).press('Enter')
    await expect(panel).toHaveAttribute('data-picodash-placement', 'hybrid-free')

    await dragSurface.scrollIntoViewIfNeeded()
    boundaryBox = await requiredBox(boundary)
    panelBox = await requiredBox(panel)
    dragBox = await requiredBox(dragSurface)
    pointer = center(dragBox)
    const rightEdgePointerX =
      pointer.x + boundaryBox.x + boundaryBox.width - panelBox.width - panelBox.x
    const dockPreview = page.locator('[data-picodash-panel-dock-preview]')
    await page.mouse.move(pointer.x, pointer.y)
    await page.mouse.down()
    const dockPreviewMotion = await triggeredMotion(dockPreview, 'transform', () =>
      page.mouse.move(rightEdgePointerX, boundaryBox.y + 20),
    )
    await expect(dockPreview).toHaveAttribute('data-picodash-dock-position', 'top-right')
    expect(dockPreviewMotion).toMatchObject({ duration: 150, keyframeCount: 2 })
    await capture(page, testInfo, 'placement-hybrid-target.png')
    const fullRightMotion = await triggeredMotion(dockPreview, 'transform', () =>
      page.mouse.move(rightEdgePointerX, boundaryBox.y + boundaryBox.height / 2),
    )
    await expect(dockPreview).toHaveAttribute('data-picodash-dock-position', 'full-right')
    expect(fullRightMotion).toMatchObject({
      duration: 150,
      keyframeCount: 2,
    })
    const dockReleaseMotion = await triggeredMotion(panel, 'transform', () => page.mouse.up())
    expect(dockReleaseMotion).toMatchObject({ duration: 150, keyframeCount: 2 })
    await expect(panel).not.toHaveAttribute('data-picodash-dock-allocation-motion')
    await expect(panel).toHaveAttribute('data-picodash-placement', 'hybrid-docked')

    // A body portal exposes overflow that the specimen's clipped local portal contains.
    await page.getByRole('button', { name: 'Document portal', exact: true }).click()
    await boundary.evaluate((element) => {
      // Match a workspace whose right dock is flush with the viewport edge.
      element.style.width = `${window.innerWidth - element.getBoundingClientRect().left}px`
      element.scrollIntoView({ block: 'start' })
    })
    const minimize = panel.getByRole('button', { name: 'Minimize panel Placement Panel' })
    await minimize.click()
    const reveal = page.getByRole('button', { name: 'Reveal panel Placement Panel' })
    await expect(reveal).toBeVisible()
    await reveal.scrollIntoViewIfNeeded()
    await capture(page, testInfo, 'placement-minimized.png')
    for (const activation of ['pointer', 'keyboard']) {
      if (activation === 'keyboard') {
        await minimize.press('Enter')
        await expect(reveal).toBeFocused()
      }
      await page
        .locator('[data-contract-lab-focused-placement-panel]')
        .evaluate(async (element) => {
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
          await Promise.all(element.getAnimations().map((animation) => animation.finished))
        })
      const scroll = await documentScrollDuring(page, panel, () =>
        activation === 'pointer' ? reveal.click() : reveal.press('Enter'),
      )
      await writeEvidence(testInfo, `placement-reveal-${activation}-scroll.json`, scroll)
      await expect(minimize).toBeFocused()
      expect(scroll.samples.length).toBeGreaterThan(1)
      expect(scroll.samples.filter((sample) => sample.x !== scroll.start.x)).toEqual([])
      expect(scroll.samples.filter((sample) => sample.y !== scroll.start.y)).toEqual([])
    }

    await boundary.evaluate((element) => element.style.removeProperty('width'))
    await page.getByRole('button', { name: 'Boundary portal', exact: true }).click()
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.getByRole('button', { name: 'Floating', exact: true }).click()
    await panel.getByRole('button', { name: 'Collapse panel Placement Panel' }).press('Enter')
    await expect(panel).not.toHaveAttribute('data-picodash-height-motion')
    expect(await motionCount(panel)).toBe(0)
    await panel.getByRole('button', { name: 'Expand panel Placement Panel' }).press('Enter')
    expect(await motionCount(panel)).toBe(0)

    // Ordinary arbitrary content must fade too, not only a DashStack's automatic band.
    await boundary.evaluate((element) => element.scrollIntoView({ block: 'end' }))
    boundaryBox = await requiredBox(boundary)
    panelBox = await requiredBox(panel)
    dragBox = await requiredBox(dragSurface)
    pointer = center(dragBox)
    await page.mouse.move(pointer.x, pointer.y)
    await page.mouse.down()
    await page.mouse.move(
      pointer.x,
      pointer.y + boundaryBox.y + boundaryBox.height - 160 - panelBox.y,
      { steps: 8 },
    )
    await page.mouse.up()
    await expect.poll(async () => (await requiredBox(panel)).height).toBeLessThan(161)
    const overflow = await body.evaluate((element) => ({
      client: element.clientHeight,
      scroll: element.scrollHeight,
      mask: getComputedStyle(element).maskImage,
    }))
    expect(overflow.client).toBeGreaterThan(40)
    expect(overflow.scroll).toBeGreaterThan(overflow.client)
    expect(overflow.mask).toContain('linear-gradient')
    await capture(page, testInfo, 'placement-overflow-start.png')
    await body.evaluate((element) => {
      element.scrollTop = (element.scrollHeight - element.clientHeight) / 2
    })
    await capture(page, testInfo, 'placement-overflow-middle.png')
    await capture(panel, testInfo, 'placement-overflow-detail.png')
    expect(await body.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
    await body.evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })
    await capture(page, testInfo, 'placement-overflow-end.png')
    expect(
      await body.evaluate(
        (element) => element.scrollHeight - element.clientHeight - element.scrollTop,
      ),
    ).toBeLessThanOrEqual(1)
    const lastButton = await requiredBox(panel.getByRole('button', { name: 'Reset panel layout' }))
    const scroller = await requiredBox(body)
    expect(lastButton.y + lastButton.height).toBeLessThanOrEqual(scroller.y + scroller.height)

    const evidence = {
      viewport: phoneViewport,
      implementation: 'motion/mini',
      expandedHeight,
      collapsedHeight,
      heightMotion,
      expandMotion,
      snapMotion,
      detachMotion,
      dockPreviewMotion,
      dockReleaseMotion,
      overflow,
      reducedMotionAnimationCount: await motionCount(panel),
    }
    await writeEvidence(testInfo, 'placement-motion.json', evidence)
    expect(errors, 'unexpected browser errors').toEqual([])
  } finally {
    await finishPhoneRecording(recording, testInfo, 'placement-motion.webm')
  }
})

test('captures phone-sized boundary contraction with start and end lanes', async ({
  baseURL,
  browser,
}, testInfo) => {
  const recording = await openPhoneRecording(browser, baseURL, testInfo)
  const { errors, page } = recording
  try {
    await openLab(page)
    await page.getByRole('button', { name: /^Style lab:/ }).click()

    const primaryPanel = page.getByRole('complementary', { name: 'Primary Panel' })
    await primaryPanel.getByRole('button', { name: 'Close panel Primary Panel' }).click()
    await expect(primaryPanel).toBeHidden()

    const boundary = page.getByRole('region', { name: 'Dashlet style lab' })
    const panel = page.getByRole('complementary', { name: 'Basics & readout' })
    const list = panel.getByRole('list', { name: 'Basics and readout Dashlets' })
    await panel.evaluate((element) => {
      element.style.setProperty('--picodash-panel-width', '16rem')
    })
    await expect.poll(async () => (await requiredBox(panel)).width).toBeLessThanOrEqual(257)
    await boundary.evaluate((element) => {
      element.scrollIntoView({ block: 'end' })
    })

    await panel.getByRole('button', { name: 'Actions for Basics & readout' }).click()
    const placement = page.getByRole('menuitem', { name: 'Placement', exact: true })
    await placement.press('ArrowRight')
    await page.getByRole('menuitem', { name: 'Free', exact: true }).click()
    await expect(panel).toHaveAttribute('data-picodash-placement', 'hybrid-free')

    const dragSurface = panel.locator('[data-picodash-panel-drag-surface]')
    await dragSurface.scrollIntoViewIfNeeded()
    let boundaryBox = await requiredBox(boundary)
    let panelBox = await requiredBox(panel)
    let dragBox = await requiredBox(dragSurface)
    const pointer = center(dragBox)
    // Leave room for the entire pinned Readout group as well as a usable auto scrollport.
    const contractedHeight = 600
    const contractedTop = boundaryBox.y + boundaryBox.height - contractedHeight
    await page.mouse.move(pointer.x, pointer.y)
    await page.mouse.down()
    await page.mouse.move(pointer.x - 48, pointer.y + contractedTop - panelBox.y, { steps: 8 })
    await expect
      .poll(async () => (await requiredBox(panel)).height)
      .toBeLessThanOrEqual(contractedHeight + 1)
    await page.mouse.up()

    boundaryBox = await requiredBox(boundary)
    panelBox = await requiredBox(panel)
    const lanes = await list.evaluate((element) => {
      const start = element.querySelector<HTMLElement>('[data-picodash-dashstack-band="start"]')
      const automatic = element.querySelector<HTMLElement>(
        '[data-picodash-dashstack-band="automatic"]',
      )
      const end = element.querySelector<HTMLElement>('[data-picodash-dashstack-band="end"]')
      if (!start || !automatic || !end) throw new TypeError('Expected all three DashStack lanes.')
      return {
        automaticClientHeight: automatic.clientHeight,
        automaticScrollHeight: automatic.scrollHeight,
        automaticScrollable: automatic.scrollHeight > automatic.clientHeight,
        endVisible: end.getBoundingClientRect().height > 0,
        startVisible: start.getBoundingClientRect().height > 0,
      }
    })
    expect(lanes).toMatchObject({
      automaticScrollable: true,
      endVisible: true,
      startVisible: true,
    })
    expect(lanes.automaticClientHeight).toBeGreaterThan(0)
    expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(boundaryBox.y + boundaryBox.height + 1)
    const automatic = list.locator('[data-picodash-dashstack-band="automatic"]')
    const fade = () =>
      automatic.evaluate((element) => {
        const style = getComputedStyle(element)
        const progress = (name: string) =>
          element
            .getAnimations()
            .find(
              (animation) => animation instanceof CSSAnimation && animation.animationName === name,
            )
            ?.effect?.getComputedTiming().progress
        return {
          start: progress('picodash-scroll-fade-start'),
          end: progress('picodash-scroll-fade-end'),
          mask: style.maskImage,
        }
      })
    const cues = () =>
      list.evaluate((element) => ({
        top: getComputedStyle(element, '::before').opacity,
        bottom: getComputedStyle(element, '::after').opacity,
        pointerEvents: getComputedStyle(element, '::after').pointerEvents,
      }))
    await expect.poll(cues).toEqual({ top: '0', bottom: '1', pointerEvents: 'none' })
    await expect.poll(async () => (await fade()).start).toBe(0)
    // A short overflow can already be inside the final 96px fade range.
    await expect.poll(async () => (await fade()).end).toBeLessThan(1)
    expect((await fade()).mask).toContain('linear-gradient')
    for (const band of ['start', 'end']) {
      expect(
        await list
          .locator(`[data-picodash-dashstack-band="${band}"]`)
          .evaluate((element) => getComputedStyle(element).maskImage),
      ).toBe('none')
    }
    await capture(page, testInfo, 'boundary-contraction.png')
    await automatic.evaluate((element) => {
      element.scrollTop = (element.scrollHeight - element.clientHeight) / 2
    })
    await expect.poll(async () => (await fade()).start).toBeGreaterThan(0)
    await expect.poll(async () => (await fade()).end).toBeLessThan(1)
    await expect.poll(cues).toMatchObject({ top: '1', bottom: '1' })
    await capture(page, testInfo, 'boundary-scroll-middle.png')
    expect(await automatic.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
    await automatic.evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })
    await expect.poll(async () => (await fade()).end).toBe(1)
    await expect.poll(cues).toMatchObject({ top: '1', bottom: '0' })
    await capture(page, testInfo, 'boundary-scroll-end.png')
    expect(
      await automatic.evaluate(
        (element) => element.scrollHeight - element.clientHeight - element.scrollTop,
      ),
    ).toBeLessThanOrEqual(1)
    await page.emulateMedia({ forcedColors: 'active' })
    await expect.poll(async () => (await fade()).mask).toBe('none')
    await expect.poll(cues).toMatchObject({ top: '1', bottom: '0' })
    await page.emulateMedia({ forcedColors: 'none' })
    // Content shrinking below the viewport must clear both cues, including after an end scroll.
    await automatic.evaluate((element) => {
      for (const child of element.children) if (child instanceof HTMLElement) child.hidden = true
    })
    await expect.poll(cues).toMatchObject({ top: '0', bottom: '0' })
    await writeEvidence(testInfo, 'boundary-contraction.json', {
      viewport: phoneViewport,
      panel: panelBox,
      boundaryBottom: boundaryBox.y + boundaryBox.height,
      lanes,
    })
    expect(errors, 'unexpected browser errors').toEqual([])
  } finally {
    await finishPhoneRecording(recording, testInfo, 'boundary-contraction.webm')
  }
})

test('captures every retained theme preference and the public custom-theme fixture', async ({
  page,
}, testInfo) => {
  await page.setViewportSize(phoneViewport)
  await page.emulateMedia({ colorScheme: 'dark' })
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))

  await openLab(page)
  await page.getByRole('button', { name: /^Placement:/ }).click()
  const boundary = page.getByRole('region', { name: 'DashPanel placement boundary' })
  const panel = page.getByRole('complementary', { name: 'Placement Panel' })
  await boundary.evaluate((element) => element.scrollIntoView({ block: 'start' }))

  await selectTheme(page, panel, 'light')
  await capture(page, testInfo, 'theme-light.png')
  await selectTheme(page, panel, 'dark')
  await capture(page, testInfo, 'theme-dark.png')

  await page.emulateMedia({ colorScheme: 'light' })
  await selectTheme(page, panel, 'system')
  await capture(page, testInfo, 'theme-system-light.png')
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect.poll(() => resolvedTheme(panel)).toBe('dark')
  await capture(page, testInfo, 'theme-system-dark.png')

  await selectTheme(page, panel, 'ocean')
  const customPresentation = await panel.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      backgroundColor: style.backgroundColor,
      borderRadius: style.borderTopLeftRadius,
      elevatedShadow: style.getPropertyValue('--picodash-shadow-elevated').trim(),
      focus: style.getPropertyValue('--picodash-color-focus').trim(),
      surface: style.getPropertyValue('--picodash-color-surface').trim(),
      theme: element.closest('[data-picodash-theme]')?.getAttribute('data-picodash-theme'),
    }
  })
  expect(customPresentation).toMatchObject({
    borderRadius: '8px',
    elevatedShadow: '0 25px 50px -12px #00000073',
    theme: 'ocean',
  })
  expect(customPresentation.backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
  expect(customPresentation.focus).not.toBe('')
  expect(customPresentation.surface).not.toBe('')
  expect(customPresentation.surface).not.toBe('initial')
  await capture(page, testInfo, 'theme-custom-ocean.png')
  await writeEvidence(testInfo, 'themes.json', {
    viewport: phoneViewport,
    retainedPreferences: ['light', 'dark', 'system'],
    systemResolutions: ['light', 'dark'],
    customFixture: customPresentation,
  })
  expect(errors, 'unexpected browser errors').toEqual([])
})

async function openPhoneRecording(
  browser: Browser,
  baseURL: string | undefined,
  testInfo: TestInfo,
): Promise<PhoneRecording> {
  if (!baseURL) throw new TypeError('The Contract Lab base URL is required.')
  const context = await browser.newContext({
    baseURL,
    colorScheme: 'dark',
    deviceScaleFactor: 1,
    recordVideo: {
      dir: testInfo.outputPath('video-source'),
      size: phoneViewport,
    },
    reducedMotion: 'no-preference',
    viewport: phoneViewport,
  })
  const page = await context.newPage()
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  return { context, errors, page }
}

async function finishPhoneRecording(
  recording: PhoneRecording,
  testInfo: TestInfo,
  name: string,
): Promise<void> {
  const video = recording.page.video()
  await recording.context.close()
  if (!video) throw new TypeError('Phone artifact context did not create a video.')
  const videoPath = path.join(artifactDirectory, name)
  await video.saveAs(videoPath)
  await testInfo.attach(name, { path: videoPath, contentType: 'video/webm' })
}

async function openLab(page: Page): Promise<void> {
  await page.goto('/lab')
  await page.getByRole('button', { name: 'Contract tools', exact: true }).click()
  await expect(page.locator('[data-contract-lab-status]')).toHaveAttribute('data-ready', 'true')
}

async function capture(subject: Page | Locator, testInfo: TestInfo, name: string): Promise<void> {
  const screenshotPath = path.join(artifactDirectory, name)
  await subject.screenshot({ path: screenshotPath, animations: 'allow' })
  await testInfo.attach(name, { path: screenshotPath, contentType: 'image/png' })
}

async function writeEvidence(testInfo: TestInfo, name: string, value: unknown): Promise<void> {
  const evidencePath = path.join(artifactDirectory, name)
  await writeFile(evidencePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await testInfo.attach(name, { path: evidencePath, contentType: 'application/json' })
}

async function documentScrollDuring(page: Page, panel: Locator, trigger: () => Promise<unknown>) {
  const observation = await page.evaluateHandle(() => {
    const start = { x: window.scrollX, y: window.scrollY }
    const samples = [start]
    const sample = () => samples.push({ x: window.scrollX, y: window.scrollY })
    let frame = 0
    const tick = () => {
      sample()
      frame = requestAnimationFrame(tick)
    }
    window.addEventListener('scroll', sample)
    window.addEventListener('focusin', sample)
    frame = requestAnimationFrame(tick)
    return {
      stop() {
        cancelAnimationFrame(frame)
        window.removeEventListener('scroll', sample)
        window.removeEventListener('focusin', sample)
        sample()
        return { start, samples }
      },
    }
  })
  try {
    await trigger()
    await panel.evaluate(async (element) => {
      // Flush transition creation, then observe through its final rendered frame.
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      await Promise.all(element.getAnimations().map((animation) => animation.finished))
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    })
    return await observation.evaluate((tracker) => tracker.stop())
  } finally {
    await observation.evaluate((tracker) => tracker.stop())
    await observation.dispose()
  }
}

async function triggeredMotion(
  locator: Locator,
  property: string,
  trigger: () => Promise<unknown>,
) {
  await expect(locator).toBeVisible()
  const observation = locator.evaluate(
    (element, expectedProperty) =>
      new Promise<{ readonly duration: number; readonly keyframeCount: number } | null>(
        (resolve) => {
          const deadline = performance.now() + 500
          const inspect = () => {
            for (const animation of element.getAnimations()) {
              const effect = animation.effect
              if (!(effect instanceof KeyframeEffect)) continue
              const keyframes = effect.getKeyframes()
              if (!keyframes.some((keyframe) => expectedProperty in keyframe)) continue
              const duration = effect.getTiming().duration
              if (typeof duration !== 'number') continue
              resolve({ duration, keyframeCount: keyframes.length })
              return
            }
            if (performance.now() >= deadline) {
              resolve(null)
              return
            }
            requestAnimationFrame(inspect)
          }
          inspect()
        },
      ),
    property,
  )
  await trigger()
  const result = await observation
  if (!result) throw new TypeError(`Expected active ${property} motion.`)
  return result
}

async function motionCount(locator: Locator): Promise<number> {
  // Scroll-driven masks respond directly to scrolling, including with reduced motion.
  // This assertion prohibits timed motion, not the reviewed scroll-fade exception.
  return locator.evaluate(
    (element) =>
      element
        .getAnimations({ subtree: true })
        .filter((animation) => animation.timeline instanceof DocumentTimeline).length,
  )
}

async function selectTheme(page: Page, panel: Locator, theme: string): Promise<void> {
  await page.getByRole('button', { name: `Use ${theme} theme` }).click()
  await expect
    .poll(() => resolvedTheme(panel))
    .toMatch(theme === 'system' ? /^(?:light|dark)$/ : theme)
}

async function resolvedTheme(panel: Locator): Promise<string | null> {
  return panel.evaluate(
    (element) =>
      element.closest('[data-picodash-theme]')?.getAttribute('data-picodash-theme') ?? null,
  )
}

async function requiredBox(locator: Locator) {
  const box = await locator.boundingBox()
  if (!box) throw new TypeError('Expected a rendered browser box.')
  return box
}

function center(box: {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}) {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}
