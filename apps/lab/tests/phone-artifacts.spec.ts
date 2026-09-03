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
    await page.mouse.up()
    await expect(panel).toHaveAttribute('data-picodash-placement', 'hybrid-docked')

    const minimize = panel.getByRole('button', { name: 'Minimize panel Placement Panel' })
    await minimize.click()
    const reveal = page.getByRole('button', { name: 'Reveal panel Placement Panel' })
    await expect(reveal).toBeVisible()
    await reveal.scrollIntoViewIfNeeded()
    await capture(page, testInfo, 'placement-minimized.png')
    await reveal.click()
    await expect(minimize).toBeFocused()

    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.getByRole('button', { name: 'Floating', exact: true }).click()
    await panel.getByRole('button', { name: 'Collapse panel Placement Panel' }).press('Enter')
    await expect(panel).not.toHaveAttribute('data-picodash-height-motion')
    expect(await motionCount(panel)).toBe(0)
    await panel.getByRole('button', { name: 'Expand panel Placement Panel' }).press('Enter')
    expect(await motionCount(panel)).toBe(0)

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
    const contractedHeight = 300
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
      const start = element.querySelector<HTMLElement>('[data-picodash-dashlist-band="start"]')
      const automatic = element.querySelector<HTMLElement>(
        '[data-picodash-dashlist-band="automatic"]',
      )
      const end = element.querySelector<HTMLElement>('[data-picodash-dashlist-band="end"]')
      if (!start || !automatic || !end) throw new TypeError('Expected all three DashList lanes.')
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
    expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(boundaryBox.y + boundaryBox.height + 1)
    await capture(page, testInfo, 'boundary-contraction.png')
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
  await expect(page.locator('[data-contract-lab-status]')).toHaveAttribute('data-ready', 'true')
}

async function capture(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  const screenshotPath = path.join(artifactDirectory, name)
  await page.screenshot({ path: screenshotPath, animations: 'allow' })
  await testInfo.attach(name, { path: screenshotPath, contentType: 'image/png' })
}

async function writeEvidence(testInfo: TestInfo, name: string, value: unknown): Promise<void> {
  const evidencePath = path.join(artifactDirectory, name)
  await writeFile(evidencePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await testInfo.attach(name, { path: evidencePath, contentType: 'application/json' })
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
  return locator.evaluate((element) => element.getAnimations({ subtree: true }).length)
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
