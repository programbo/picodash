import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  createPicodashDevBridgeClient,
  type PicodashDevBridgeClient,
  type PicodashDevBridgeSessionDescriptor,
} from '@picodash/dev-bridge'

const scopeId = 'contract-lab-resize-panel'
const errors = new WeakMap<Page, string[]>()

test.beforeEach(async ({ page }) => {
  const messages: string[] = []
  errors.set(page, messages)
  page.on('pageerror', (error) => messages.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') messages.push(message.text())
  })
  await page.setViewportSize({ width: 1600, height: 1100 })
})

test.afterEach(async ({ page }) => {
  expect(errors.get(page) ?? [], 'unexpected browser errors').toEqual([])
})

async function openResizeLab(page: Page) {
  await page.goto('/lab')
  await page.getByRole('button', { name: 'Contract tools', exact: true }).click()
  await expect(page.locator('[data-contract-lab-status]')).toHaveAttribute('data-ready', 'true')
  await page.getByRole('button', { name: 'Reset lab', exact: true }).click()
  await page.getByRole('button', { name: 'Resize lab', exact: true }).click()
  await expect(page.getByLabel('Resize measurement readiness')).toHaveText('Ready')
  return page.getByRole('complementary', { name: 'Resize Panel', exact: true })
}

async function bridgeFor(page: Page) {
  const raw: unknown = JSON.parse(
    await readFile(resolve(process.cwd(), '../../.picodash/dev-bridge.json'), 'utf8'),
  )
  if (
    !raw ||
    typeof raw !== 'object' ||
    !('url' in raw) ||
    typeof raw.url !== 'string' ||
    !('token' in raw) ||
    typeof raw.token !== 'string'
  )
    throw new Error('Expected private Lab Bridge credentials.')
  const client = createPicodashDevBridgeClient({ baseUrl: raw.url, token: raw.token })
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem('picodash-dev-bridge-tab')))
    .toEqual(expect.any(String))
  const tabId = await page.evaluate(() => sessionStorage.getItem('picodash-dev-bridge-tab'))
  const session = async () =>
    (await client.listSessions()).find(
      (candidate) =>
        candidate.registrationId === 'contract-lab-resize' && candidate.browserTabId === tabId,
    )
  await expect.poll(session).toBeTruthy()
  return {
    client,
    session: async () => {
      const found = await session()
      if (!found) throw new Error('Resize Lab Bridge session is unavailable.')
      return found
    },
  }
}

async function metadata(
  client: PicodashDevBridgeClient,
  session: PicodashDevBridgeSessionDescriptor,
) {
  return (await client.inspect(session)).snapshot.scopes?.find((scope) => scope.id === scopeId)
    ?.metadata
}

async function box(panel: Locator) {
  const result = await panel.boundingBox()
  if (!result) throw new Error('Expected visible Panel geometry.')
  return result
}

async function dragTarget(
  page: Page,
  panel: Locator,
  target: string,
  x: number,
  y: number,
  release = true,
  steps = 8,
) {
  const handle = panel.getByRole('button', {
    name: `Resize panel Resize Panel from ${target}`,
    exact: true,
  })
  // A real hover checks hit testing and scrolls past the sticky Lab status strip.
  // Measuring immediately after minimal scrolling can capture a still-moving portal rectangle.
  await handle.hover()
  const start = await box(handle)
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2)
  await page.mouse.down()
  await page.mouse.move(start.x + start.width / 2 + x, start.y + start.height / 2 + y, { steps })
  if (release) await page.mouse.up()
}

type CuePose = Record<'opacity' | 'scale' | 'translate', number[]>

async function assertReversibleCueMotion(
  page: Page,
  indicator: Locator,
  show: () => Promise<unknown>,
  hide: () => Promise<unknown>,
  settledTranslate: readonly [number, number] = [0, 0],
) {
  const readPose = () =>
    indicator.evaluate((element): CuePose => {
      const style = getComputedStyle(element)
      const scale = style.scale.split(/\s+/).map(Number.parseFloat)
      const translate = style.translate.split(/\s+/).map(Number.parseFloat)
      return {
        opacity: [Number(style.opacity)],
        scale: [scale[0], scale[1] ?? scale[0]],
        translate: [translate[0], translate[1] ?? 0],
      }
    })
  await hide()
  await expect(indicator).toHaveCSS('opacity', '0')
  const hidden = await readPose()
  const shown: CuePose = { opacity: [1], scale: [1, 1], translate: [...settledTranslate] }
  expect(Math.min(...hidden.scale)).toBeLessThan(1)
  expect(
    Math.hypot(...hidden.translate.map((value, index) => value - shown.translate[index])),
  ).toBeGreaterThan(0)
  let previous = hidden
  for (const target of [1, 0, 1]) {
    const observation = indicator.evaluate(
      (element) =>
        new Promise<Record<keyof CuePose, { from: number[]; to: number[]; current: number[] }>>(
          (resolve, reject) => {
            const cleanup = () => {
              clearTimeout(timeout)
              element.removeEventListener('transitionrun', inspect)
            }
            const inspect = (event: Event) => {
              if (
                !(event instanceof TransitionEvent) ||
                event.target !== element ||
                event.propertyName !== 'opacity'
              )
                return
              const sample = (property: keyof CuePose) => {
                const animation = element
                  .getAnimations()
                  .find(
                    (animation) =>
                      animation instanceof CSSTransition &&
                      animation.transitionProperty === property,
                  )
                const effect = animation?.effect
                const duration = effect?.getTiming().duration
                if (
                  !animation ||
                  !(effect instanceof KeyframeEffect) ||
                  typeof duration !== 'number'
                )
                  throw new Error(`Expected a ${property} transition.`)
                const components = (value: string) => {
                  const parts = value.split(/\s+/).map(Number.parseFloat)
                  return property === 'opacity'
                    ? [parts[0]]
                    : [parts[0], parts[1] ?? (property === 'scale' ? parts[0] : 0)]
                }
                const frames = effect.getKeyframes()
                animation.pause()
                animation.currentTime = duration / 2
                return {
                  from: components(String(frames[0]?.[property])),
                  to: components(String(frames[frames.length - 1]?.[property])),
                  current: components(getComputedStyle(element).getPropertyValue(property)),
                }
              }
              try {
                resolve({
                  opacity: sample('opacity'),
                  scale: sample('scale'),
                  translate: sample('translate'),
                })
              } catch (error) {
                reject(error)
              } finally {
                cleanup()
              }
            }
            const timeout = setTimeout(() => {
              cleanup()
              reject(new Error('Expected reversible cue motion.'))
            }, 3000)
            element.addEventListener('transitionrun', inspect)
          },
        ),
    )
    await (target === 1 ? show() : hide())
    const sample = await observation
    const expected = target === 1 ? shown : hidden
    for (const property of ['opacity', 'scale', 'translate'] as const) {
      expect(sample[property].to).toEqual(expected[property])
      sample[property].from.forEach((value, index) =>
        expect(value).toBeCloseTo(previous[property][index], 3),
      )
    }
    expect(sample.opacity.current[0]).toBeGreaterThan(0)
    expect(sample.opacity.current[0]).toBeLessThan(1)
    expect(Math.min(...sample.scale.current)).toBeGreaterThan(Math.min(...hidden.scale))
    expect(Math.min(...sample.scale.current)).toBeLessThan(1)
    previous = {
      opacity: sample.opacity.current,
      scale: sample.scale.current,
      translate: sample.translate.current,
    }
  }
  await indicator.evaluate((element) => {
    for (const animation of element.getAnimations()) animation.finish()
  })
  await expect.poll(readPose).toEqual(shown)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  try {
    await hide()
    await expect.poll(readPose).toEqual(hidden)
    await show()
    await expect.poll(readPose).toEqual(shown)
    expect(await indicator.evaluate((element) => element.getAnimations().length)).toBe(0)
  } finally {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
  }
}

async function sampleHandleReveal(panel: Locator, show: () => Promise<unknown>) {
  const observation = panel.locator('[data-picodash-panel-resize-layer]').evaluate((layer) => {
    const sample = () =>
      Array.from(layer.querySelectorAll('[data-picodash-panel-resize-target]')).map((button) => ({
        target: button.getAttribute('data-picodash-panel-resize-target') ?? '',
        kind: button.getAttribute('data-picodash-panel-resize-kind'),
        hit: [button.getBoundingClientRect().width, button.getBoundingClientRect().height],
        strokes: Array.from(button.querySelectorAll('[data-picodash-panel-resize-segment]'))
          .filter((segment) => getComputedStyle(segment).display !== 'none')
          .map((segment) => {
            const style = getComputedStyle(segment)
            const rect = segment.getBoundingClientRect()
            const scale = style.scale.split(/\s+/).map(Number.parseFloat)
            const sx = scale[0],
              sy = scale[1] ?? scale[0]
            const translation = style.translate.split(/\s+/).map(Number.parseFloat)
            const origin = style.transformOrigin.split(/\s+/).map(Number.parseFloat)
            return {
              width: rect.width,
              height: rect.height,
              scale: [sx, sy],
              translation: [translation[0], translation[1] ?? 0],
              anchor: [rect.left + origin[0] * sx, rect.top + origin[1] * sy],
            }
          }),
      }))
    return new Promise<ReturnType<typeof sample>[]>((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timeout)
        layer.removeEventListener('transitionrun', inspect)
      }
      const inspect = (event: Event) => {
        if (!(event instanceof TransitionEvent) || event.propertyName !== 'opacity') return
        const animations = layer.getAnimations({ subtree: true }).flatMap((animation) => {
          const duration = animation.effect?.getTiming().duration
          return typeof duration === 'number' ? [{ animation, duration }] : []
        })
        for (const { animation } of animations) animation.pause()
        const frames = [0, 0.5, 1].map((progress) => {
          for (const { animation, duration } of animations)
            animation.currentTime = duration * progress
          return sample()
        })
        for (const { animation } of animations) animation.finish()
        cleanup()
        resolve(frames)
      }
      const timeout = setTimeout(() => {
        cleanup()
        reject(new Error('Expected resize cue reveal motion.'))
      }, 3000)
      layer.addEventListener('transitionrun', inspect)
    })
  })
  await show()
  return observation
}

async function assertResizeHandleThemes(page: Page, panel: Locator, testInfo: TestInfo) {
  await panel.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  const originalBox = await box(panel)
  const edges = page.getByRole('combobox', { name: 'Edge handle style', exact: true })
  const corners = page.getByRole('combobox', { name: 'Corner handle style', exact: true })
  const edge = panel.getByRole('button', { name: 'Resize panel Resize Panel from e', exact: true })
  await assertReversibleCueMotion(
    page,
    edge.locator('[data-picodash-panel-resize-segment="primary"]'),
    () => edge.hover(),
    async () => {
      await edges.focus()
      await page.mouse.move(0, 0)
    },
  )
  for (const { recipe, edgeStyle, cornerStyle } of [
    { recipe: 'single', edgeStyle: 'single', cornerStyle: 'single' },
    { recipe: 'parallel', edgeStyle: 'parallel', cornerStyle: 'single' },
    { recipe: 'external', edgeStyle: 'parallel', cornerStyle: 'external' },
    { recipe: 'internal', edgeStyle: 'parallel', cornerStyle: 'internal' },
    { recipe: 'external-single', edgeStyle: 'external-single', cornerStyle: 'single' },
    { recipe: 'external-parallel', edgeStyle: 'external-parallel', cornerStyle: 'external' },
  ]) {
    await edges.selectOption(edgeStyle)
    await corners.selectOption(cornerStyle)
    await edges.focus()
    await page.mouse.move(0, 0)
    await expect(edge.locator('[data-picodash-panel-resize-segment="primary"]')).toHaveCSS(
      'opacity',
      '0',
    )
    const frames = await sampleHandleReveal(panel, () => edge.hover())
    const settled = frames[frames.length - 1]
    for (const frame of frames)
      for (const handle of frame) {
        const rest = settled.find((candidate) => candidate.target === handle.target)
        if (!rest) throw new Error('Expected the same resize target throughout motion.')
        const external =
          handle.kind === 'edge' ? edgeStyle.startsWith('external') : cornerStyle === 'external'
        expect(handle.hit).toEqual(rest.hit)
        for (const [index, stroke] of handle.strokes.entries()) {
          const final = rest.strokes[index]
          if (handle.kind === 'edge' || cornerStyle === 'external') {
            for (const axis of [0, 1])
              expect(stroke.anchor[axis] - stroke.translation[axis]).toBeCloseTo(
                final.anchor[axis],
                2,
              )
            if (final.width > final.height) expect(stroke.height).toBeCloseTo(final.height, 2)
            else expect(stroke.width).toBeCloseTo(final.width, 2)
          }
        }
        if (handle.kind === 'corner' && cornerStyle === 'external') {
          const [horizontal, vertical] = handle.strokes
          expect(horizontal.anchor[0]).toBeCloseTo(vertical.anchor[0], 2)
          expect(horizontal.anchor[1]).toBeCloseTo(vertical.anchor[1], 2)
        }
        if (frame !== frames[0]) continue
        const [x, y] = handle.strokes[0].translation
        const direction = external ? -1 : 1
        if (handle.target.includes('e')) expect(x * direction).toBeGreaterThan(0)
        if (handle.target.includes('w')) expect(x * direction).toBeLessThan(0)
        if (handle.target.includes('s')) expect(y * direction).toBeGreaterThan(0)
        if (handle.target.includes('n')) expect(y * direction).toBeLessThan(0)
      }
    const handles = await panel
      .locator('[data-picodash-panel-resize-target]')
      .evaluateAll((buttons) =>
        buttons.map((button) => {
          const panel = button.closest('[data-picodash-panel]')
          if (!panel) throw new Error('Expected a resize target inside a Panel.')
          const bounds = panel.getBoundingClientRect()
          return {
            kind: button.getAttribute('data-picodash-panel-resize-kind'),
            strokes: Array.from(button.querySelectorAll('[data-picodash-panel-resize-segment]'))
              .filter((segment) => getComputedStyle(segment).display !== 'none')
              .map((segment) => {
                const style = getComputedStyle(segment)
                const rect = segment.getBoundingClientRect()
                const x = rect.x + rect.width / 2
                const y = rect.y + rect.height / 2
                const matrix = new DOMMatrixReadOnly(
                  style.transform === 'none' ? undefined : style.transform,
                )
                return {
                  width: Number.parseFloat(style.width),
                  height: Number.parseFloat(style.height),
                  rotation: [matrix.a, matrix.b, matrix.c, matrix.d],
                  x,
                  y,
                  opacity: style.opacity,
                  scale: style.scale,
                  translate: style.translate,
                  pointerEvents: style.pointerEvents,
                  reachable: document.elementFromPoint(x, y) === button,
                  outside:
                    x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom,
                }
              }),
          }
        }),
      )
    for (const handle of handles) {
      const dual =
        handle.kind === 'edge' ? edgeStyle.includes('parallel') : cornerStyle !== 'single'
      expect(handle.strokes).toHaveLength(dual ? 2 : 1)
      for (const stroke of handle.strokes) {
        expect(stroke.opacity).toBe('1')
        expect(stroke.scale).toBe('1')
        expect(stroke.translate).toBe('0px')
        expect(stroke.pointerEvents).toBe('none')
        expect(stroke.reachable).toBe(true)
        expect(stroke.outside).toBe(
          handle.kind === 'edge' ? edgeStyle.startsWith('external') : cornerStyle === 'external',
        )
      }
      if (!dual) continue
      const [primary, secondary] = handle.strokes
      if (!primary || !secondary) throw new Error('Expected two rendered resize segments.')
      if (cornerStyle === 'external' && handle.kind === 'corner') {
        expect([primary.width, primary.height, secondary.width, secondary.height]).toEqual([
          14, 2, 2, 14,
        ])
      } else {
        expect(primary.rotation).toEqual(secondary.rotation)
        expect(
          Math.hypot(primary.x - secondary.x, primary.y - secondary.y),
          JSON.stringify({ recipe, kind: handle.kind, primary, secondary }),
        ).toBeGreaterThan(3)
        if (handle.kind === 'corner') expect(primary.width).toBe(secondary.width * 2)
      }
    }
    expect(await box(panel)).toEqual(originalBox)
    if (recipe === 'external') {
      await page.screenshot({
        path: resolve(
          process.cwd(),
          '../../output/resize-evidence/resize-handle-controls-desktop.png',
        ),
      })
    }
    await testInfo.attach(`resize-handles-${recipe}`, {
      body: await page.screenshot({
        path: resolve(process.cwd(), `../../output/resize-evidence/resize-handles-${recipe}.png`),
        clip: {
          x: originalBox.x - 24,
          y: originalBox.y - 24,
          width: originalBox.width + 48,
          height: originalBox.height + 48,
        },
      }),
      contentType: 'image/png',
    })
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await edges.selectOption('external-parallel')
  await corners.selectOption('external')
  await corners.scrollIntoViewIfNeeded()
  for (const control of [edges, corners]) {
    const bounds = await box(control)
    expect(bounds.x).toBeGreaterThanOrEqual(0)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(390)
    expect(bounds.height).toBeGreaterThanOrEqual(44)
  }
  await page.screenshot({
    path: resolve(process.cwd(), '../../output/resize-evidence/resize-handle-controls-mobile.png'),
  })
  await panel.getByRole('button', { name: 'Resize panel Resize Panel from e', exact: true }).hover()
  await expect(panel.getByRole('heading', { name: 'Resize Panel', exact: true })).toBeInViewport()
  await page.screenshot({
    path: resolve(process.cwd(), '../../output/resize-evidence/resize-handle-panel-mobile.png'),
  })
  await page.setViewportSize({ width: 1600, height: 1100 })
  await expect.poll(async () => (await box(panel)).width).toBe(originalBox.width)
  await edges.selectOption('single')
  await corners.selectOption('single')
}

test('retains manual intent through resize, contracted reload, expansion and header restoration', async ({
  page,
}, testInfo) => {
  const panel = await openResizeLab(page)
  const bridge = await bridgeFor(page)
  const session = await bridge.session()
  const titleSurface = panel.locator('[data-picodash-panel-title-drag-surface]')
  await titleSurface.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await titleSurface.hover()
  const titleBox = await box(titleSurface)
  const input = await page.context().newCDPSession(page)
  const start = { x: titleBox.x + titleBox.width / 2, y: titleBox.y + titleBox.height / 2 }
  try {
    await input.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...start, buttons: 0 })
    await input.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      ...start,
      button: 'left',
      buttons: 1,
      clickCount: 1,
    })
    await input.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: start.x + 40,
      y: start.y + 16,
      button: 'left',
      buttons: 1,
    })
    // A release-bearing movement can revoke capture before the later pointerup arrives.
    await input.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: start.x + 60,
      y: start.y + 24,
      buttons: 0,
    })
    await input.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: start.x + 60,
      y: start.y + 24,
      button: 'left',
      buttons: 0,
      clickCount: 1,
    })
  } finally {
    await input.detach()
  }
  await expect(page.getByLabel('Preferred panel position')).toHaveText('84, 48')
  expect(await metadata(bridge.client, session)).toMatchObject({
    dashPanel: { preferredPosition: { x: 84, y: 48 } },
  })
  await page.getByRole('button', { name: 'Reset resize example', exact: true }).click()
  await page.getByLabel('Requested manual width').fill('480')
  await page.getByLabel('Requested manual height').fill('320')
  await page.getByRole('button', { name: 'Set manual size', exact: true }).click()
  await expect(page.getByLabel('Manual panel size')).toHaveText('480 × 320')
  const beforeHandleThemes = await metadata(bridge.client, session)
  await assertResizeHandleThemes(page, panel, testInfo)
  expect(await metadata(bridge.client, session)).toEqual(beforeHandleThemes)
  const restore = panel.getByRole('button', { name: 'Restore preferred size', exact: true })
  const actions = panel.getByRole('button', { name: 'Actions for Resize Panel', exact: true })
  expect((await box(restore)).x).toBeLessThan((await box(actions)).x)
  await panel.evaluate((element) => {
    element.style.setProperty('--picodash-panel-resize-grip-size', '40%')
  })
  for (const target of ['e', 's'] as const) {
    const grip = panel.getByRole('button', {
      name: `Resize panel Resize Panel from ${target}`,
      exact: true,
    })
    const dimensions = await grip.evaluate((element) => {
      const indicator = element.firstElementChild
      if (!(indicator instanceof HTMLElement)) throw new Error('Expected a resize indicator.')
      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(indicator)
      return {
        width: rect.width,
        height: rect.height,
        indicatorWidth: Number.parseFloat(style.width),
        indicatorHeight: Number.parseFloat(style.height),
      }
    })
    if (target === 'e') expect(dimensions.indicatorHeight).toBeCloseTo(dimensions.height * 0.4, 1)
    else expect(dimensions.indicatorWidth).toBeCloseTo(dimensions.width * 0.4, 1)
  }
  await panel.evaluate((element) => {
    element.style.removeProperty('--picodash-panel-resize-grip-size')
  })
  // Exercise the actual hit layer on both sides of the clipped surface, including corners.
  await panel.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  const beforeOffset = await box(panel)
  for (const offset of [-4, 24]) {
    await panel.evaluate((element, value) => {
      element.style.setProperty('--picodash-panel-resize-offset', `${value}px`)
    }, offset)
    for (const target of ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']) {
      const handle = panel.getByRole('button', {
        name: `Resize panel Resize Panel from ${target}`,
        exact: true,
      })
      const hit = await handle.evaluate((element) => {
        const rect = element.getBoundingClientRect()
        const x = rect.x + rect.width / 2
        const y = rect.y + rect.height / 2
        const panel = element.closest('[data-picodash-panel]')!
        const bounds = panel.getBoundingClientRect()
        return {
          reachable: document.elementFromPoint(x, y) === element,
          outside: x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom,
        }
      })
      expect(hit, `${target} at offset ${offset}`).toEqual({ reachable: true, outside: offset > 0 })
    }
    expect(await box(panel)).toEqual(beforeOffset)
  }
  await panel.getByRole('button', { name: 'Resize panel Resize Panel from e', exact: true }).hover()
  const outsideBox = await box(panel)
  await testInfo.attach('outside-resize-indicators', {
    body: await page.screenshot({
      path: resolve(process.cwd(), '../../output/resize-evidence/outside-resize-indicators.png'),
      clip: {
        x: outsideBox.x - 32,
        y: outsideBox.y - 32,
        width: outsideBox.width + 64,
        height: outsideBox.height + 64,
      },
    }),
    contentType: 'image/png',
  })
  const beforeOutsideDrag = await metadata(bridge.client, session)
  for (const target of ['e', 'se']) {
    await dragTarget(page, panel, target, 24, 24, false)
    await expect(panel).toHaveAttribute('data-picodash-resizing', target)
    await page.keyboard.press('Escape')
    await page.mouse.up()
    await expect(panel).not.toHaveAttribute('data-picodash-resizing')
    expect(await metadata(bridge.client, session)).toEqual(beforeOutsideDrag)
  }
  await panel.evaluate((element) => {
    element.style.removeProperty('--picodash-panel-resize-offset')
  })

  const move = panel.getByRole('button', { name: 'Move panel Resize Panel', exact: true })
  await move.press('Enter')
  await move.press('Shift+ArrowRight')
  await move.press('Shift+ArrowDown')
  await move.press('Enter')
  const baseline = await bridge.client.readEvents(session, {
    type: 'read_events',
    requestId: 'resize-baseline',
  })
  if (baseline.type !== 'events_result') throw new Error('Expected an event cursor baseline.')
  const beforeResize = await metadata(bridge.client, session)
  await dragTarget(page, panel, 'e', 48, 0, false)
  await expect(panel).toHaveAttribute('data-picodash-resizing', 'e')
  expect(await metadata(bridge.client, session)).toEqual(beforeResize)
  await page.mouse.up()
  await expect(page.getByLabel('Manual panel size')).toHaveText('528 × 320')
  const saved = await metadata(bridge.client, session)
  expect(saved).toMatchObject({
    dashPanel: {
      version: 2,
      manualSize: { width: 528, height: 320 },
      preferredPosition: { x: 34, y: 34 },
    },
  })
  const observed = await bridge.client.readEvents(session, {
    type: 'read_events',
    requestId: 'resize-observed',
    cursor: baseline.cursor,
    timeoutMs: 1000,
  })
  if (observed.type !== 'events_result') throw new Error('Expected disclosed resize events.')
  expect(observed.outcome).toBe('available')
  expect(observed.events.map((entry) => entry.event.event)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ type: 'hover', phase: 'enter' }),
      expect.objectContaining({ type: 'pointer', phase: 'down' }),
      expect.objectContaining({ type: 'pointer', phase: 'up' }),
    ]),
  )
  const resizeEvents = observed.events
    .map((entry) => entry.event)
    .filter(({ event }) => 'operation' in event && event.operation === 'resize')
  expect(resizeEvents.map(({ event }) => event.type)).toEqual(
    expect.arrayContaining(['drag.start', 'drag.update', 'drag.end']),
  )
  const ended = resizeEvents.find(({ event }) => event.type === 'drag.end')
  expect(ended?.event).toMatchObject({
    outcome: 'accepted',
    geometry: { delta: { width: 48, height: 0 } },
  })
  expect(resizeEvents.every(({ source }) => source.scopeId === scopeId)).toBe(true)
  const full = await box(panel)
  await page
    .getByRole('combobox', { name: 'Edge handle style', exact: true })
    .selectOption('parallel')
  await page
    .getByRole('combobox', { name: 'Corner handle style', exact: true })
    .selectOption('internal')
  await page.getByRole('button', { name: 'Shrink container', exact: true }).click()
  await expect.poll(async () => (await box(panel)).width).toBeLessThan(full.width)
  expect(await metadata(bridge.client, session)).toEqual(saved)
  await page.reload()
  await expect(page.getByLabel('Resize measurement readiness')).toHaveText('Ready')
  await expect(page.getByRole('button', { name: 'Restore container', exact: true })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Edge handle style', exact: true })).toHaveValue(
    'parallel',
  )
  await expect(
    page.getByRole('combobox', { name: 'Corner handle style', exact: true }),
  ).toHaveValue('internal')
  await expect(page.getByLabel('Manual panel size')).toHaveText('528 × 320')
  const restoredSession = await bridge.session()
  expect(restoredSession.generation).toBeGreaterThan(session.generation)
  const stale = await bridge.client.readEvents(restoredSession, {
    type: 'read_events',
    requestId: 'stale-resize-cursor',
    cursor: baseline.cursor,
  })
  expect(stale.type).toBe('bridge_error')
  await page.getByRole('button', { name: 'Restore container', exact: true }).click()
  await expect.poll(async () => Math.round((await box(panel)).width)).toBe(528)
  await expect.poll(async () => Math.round((await box(panel)).height)).toBe(320)
  expect(await metadata(bridge.client, restoredSession)).toEqual(saved)
  await testInfo.attach('manual-size-restored', {
    body: await panel.screenshot(),
    contentType: 'image/png',
  })
  await panel.getByRole('button', { name: 'Restore preferred size', exact: true }).click()
  await expect(page.getByLabel('Manual panel size')).toHaveText('Automatic on both axes')
  expect(await metadata(bridge.client, restoredSession)).toMatchObject({
    dashPanel: { preferredPosition: { x: 34, y: 34 } },
  })
  await page.reload()
  await expect(page.getByLabel('Manual panel size')).toHaveText('Automatic on both axes')
})

test('measures animated natural content while manual height scrolls and cancelled resize writes nothing', async ({
  page,
}, testInfo) => {
  const panel = await openResizeLab(page)
  const bridge = await bridgeFor(page)
  const session = await bridge.session()
  await page.getByText('Content constraints and explicit metrics', { exact: true }).click()
  await page.getByLabel('Content maximum height', { exact: true }).check()
  await page.getByRole('button', { name: 'Apply configuration', exact: true }).click()
  const firstItem = panel.getByRole('button', { name: 'Accordion item 1', exact: true })
  const thirdItem = panel.getByRole('button', { name: 'Accordion item 3', exact: true })
  const settleDisclosure = async () => {
    await expect(panel.locator('[data-resize-accordion-transition]')).toHaveCount(0)
    await expect(panel).not.toHaveAttribute('data-picodash-height-motion')
  }
  await firstItem.click()
  await thirdItem.click()
  await settleDisclosure()
  const south = panel.getByRole('button', { name: 'Resize panel Resize Panel from s', exact: true })
  await south.hover()
  const expandedHeight = (await box(panel)).height
  expect(expandedHeight).toBeGreaterThan(300)
  await dragTarget(page, panel, 's', 0, 260 - expandedHeight, true, 1)
  await expect(page.getByLabel('Manual panel size')).toHaveText('automatic × 260')
  const retainedSize = await metadata(bridge.client, session)
  await thirdItem.click()
  await settleDisclosure()
  await expect.poll(async () => (await box(panel)).height).toBeLessThan(260)
  await firstItem.click()
  await settleDisclosure()
  await expect.poll(async () => Math.round((await box(panel)).height)).toBe(260)
  expect(await metadata(bridge.client, session)).toEqual(retainedSize)
  const contentMaximum = Number(
    (await page.getByLabel('Effective panel maximum').textContent())?.split(' × ')[1],
  )
  expect(contentMaximum).toBeGreaterThan(260)
  await dragTarget(page, panel, 's', 0, 200, true, 1)
  await expect.poll(async () => (await box(panel)).height).toBeCloseTo(contentMaximum, 0)
  await expect
    .poll(() =>
      panel
        .locator('[data-picodash-panel-body]')
        .evaluate((element) => element.scrollHeight <= element.clientHeight + 1),
    )
    .toBe(true)
  await page.getByRole('button', { name: 'Reset resize example', exact: true }).click()
  await page.getByLabel('Resize recipe').selectOption('accordion')
  const initialPanelHeight = (await box(panel)).height
  const item = panel.getByRole('button', { name: 'Accordion item 2', exact: true })
  const transitionSamples = await item.evaluate(
    (button) =>
      new Promise<{ content: number; panel: number; remaining: number; bottomFade: number }[]>(
        (resolveSamples) => {
          if (!(button instanceof HTMLButtonElement))
            throw new Error('Expected the accordion disclosure button.')
          const regionId = button.getAttribute('aria-controls')
          const region = regionId ? button.ownerDocument.getElementById(regionId) : null
          const shell = button.closest('aside')
          const body = shell?.querySelector('[data-picodash-panel-body]')
          const samples: {
            content: number
            panel: number
            remaining: number
            bottomFade: number
          }[] = []
          if (!region || !shell || !body)
            throw new Error('Accordion region or Panel shell is unavailable.')
          const observer = new ResizeObserver(() => {
            samples.push({
              content: region.getBoundingClientRect().height,
              panel: shell.getBoundingClientRect().height,
              remaining: body.scrollHeight - body.clientHeight - body.scrollTop,
              bottomFade: Number.parseFloat(
                getComputedStyle(body).getPropertyValue('--_picodash-scroll-fade-bottom'),
              ),
            })
          })
          observer.observe(region)
          observer.observe(body)
          let frames = 0
          const sample = () => {
            if (++frames < 30) requestAnimationFrame(sample)
            else {
              observer.disconnect()
              resolveSamples(samples)
            }
          }
          button.click()
          requestAnimationFrame(sample)
        },
      ),
  )
  expect(new Set(transitionSamples.map(({ content }) => Math.round(content))).size).toBeGreaterThan(
    3,
  )
  expect(
    new Set(transitionSamples.map(({ panel: height }) => Math.round(height))).size,
  ).toBeGreaterThan(3)
  expect(transitionSamples.filter(({ remaining }) => remaining > 5).length).toBeGreaterThan(0)
  expect(
    transitionSamples
      .filter(({ remaining }) => remaining > 5)
      .every(({ bottomFade }) => bottomFade > 0),
  ).toBe(true)
  await expect(item).toHaveAttribute('aria-expanded', 'true')
  const grownPanel = await box(panel)
  const contentBoundary = await box(
    page.getByRole('region', { name: 'Resize Panel boundary', exact: true }),
  )
  expect(grownPanel.height).toBeGreaterThan(initialPanelHeight + 20)
  expect(grownPanel.y + grownPanel.height).toBeLessThanOrEqual(
    contentBoundary.y + contentBoundary.height - 16 + 1,
  )
  await expect(page.getByLabel('Manual panel size')).toHaveText('Automatic on both axes')
  await page.getByText('Content and accordion', { exact: true }).click()
  const beforeAdd = (await box(panel)).height
  await page.getByRole('button', { name: 'Add tall item', exact: true }).click()
  await expect.poll(async () => (await box(panel)).height).toBeGreaterThanOrEqual(beforeAdd)
  await page.getByLabel('Requested manual width').fill('360')
  await page.getByLabel('Requested manual height').fill('240')
  await page.getByRole('button', { name: 'Set manual size', exact: true }).click()
  await expect(page.getByLabel('Manual panel size')).toHaveText('360 × 240')
  await page.getByRole('button', { name: 'Add tall item', exact: true }).click()
  await expect.poll(async () => Math.round((await box(panel)).height)).toBe(240)
  const body = panel.locator('[data-picodash-panel-body]')
  await expect
    .poll(() => body.evaluate((element) => element.scrollHeight > element.clientHeight))
    .toBe(true)
  const startIndicator = panel.locator('[data-picodash-panel-scroll-indicator="start"]')
  const endIndicator = panel.locator('[data-picodash-panel-scroll-indicator="end"]')
  await expect(startIndicator).toHaveCSS('opacity', '0')
  await expect(endIndicator).toHaveCSS('opacity', '1')
  expect(
    await endIndicator.evaluate((element) => {
      const bounds = element.getBoundingClientRect()
      return {
        mask: getComputedStyle(element).maskImage,
        pointerEvents: getComputedStyle(element).pointerEvents,
        receivesPointer:
          document
            .elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
            ?.closest('[data-picodash-panel-scroll-indicator]') !== null,
      }
    }),
  ).toEqual({ mask: 'none', pointerEvents: 'none', receivesPointer: false })
  await body.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
  await expect(startIndicator).toHaveCSS('opacity', '1')
  await expect(endIndicator).toHaveCSS('opacity', '0')
  await body.evaluate((element) => {
    element.scrollTop = 100
  })
  await expect(startIndicator).toHaveCSS('opacity', '1')
  await expect(endIndicator).toHaveCSS('opacity', '1')
  await assertReversibleCueMotion(
    page,
    endIndicator,
    () =>
      body.evaluate((element) => {
        element.scrollTop = 100
      }),
    () =>
      body.evaluate((element) => {
        element.scrollTop = element.scrollHeight
      }),
    [-50, 0],
  )
  await testInfo.attach('floating-scroll-indicators', {
    body: await panel.screenshot(),
    contentType: 'image/png',
  })
  const fastBaseline = await bridge.client.readEvents(session, {
    type: 'read_events',
    requestId: 'fast-resize-baseline',
  })
  if (fastBaseline.type !== 'events_result') throw new Error('Expected a fast-resize baseline.')
  await body.evaluate((element) => {
    element.scrollTop = 100
  })
  await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBe(100)
  // Match a moving release: primary-button-up motion revokes capture before pointerup.
  const fastGrip = panel.getByRole('button', {
    name: 'Resize panel Resize Panel from se',
    exact: true,
  })
  await fastGrip.hover()
  const fastBox = await box(fastGrip)
  const fastStart = { x: fastBox.x + fastBox.width / 2, y: fastBox.y + fastBox.height / 2 }
  const fastInput = await page.context().newCDPSession(page)
  try {
    await fastInput.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      ...fastStart,
      buttons: 0,
    })
    await fastInput.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      ...fastStart,
      button: 'left',
      buttons: 1,
      clickCount: 1,
    })
    await fastInput.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: fastStart.x + 24,
      y: fastStart.y + 16,
      button: 'left',
      buttons: 1,
    })
    await fastInput.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: fastStart.x + 32,
      y: fastStart.y + 24,
      buttons: 0,
    })
    await fastInput.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: fastStart.x + 32,
      y: fastStart.y + 24,
      button: 'left',
      buttons: 0,
      clickCount: 1,
    })
  } finally {
    await fastInput.detach()
  }
  await expect(page.getByLabel('Manual panel size')).toHaveText('392 × 264')
  await expect.poll(async () => Math.round((await box(panel)).width)).toBe(392)
  await expect.poll(async () => Math.round((await box(panel)).height)).toBe(264)
  await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBe(100)
  expect(await metadata(bridge.client, session)).toMatchObject({
    dashPanel: { manualSize: { width: 392, height: 264 } },
  })
  const fastResult = await bridge.client.readEvents(session, {
    type: 'read_events',
    requestId: 'fast-resize-observed',
    cursor: fastBaseline.cursor,
    timeoutMs: 1000,
  })
  if (fastResult.type !== 'events_result') throw new Error('Expected fast resize events.')
  const fastTerminal = fastResult.events
    .map(({ event }) => event.event)
    .filter((event) => event.type === 'drag.end' || event.type === 'drag.cancel')
  expect(fastTerminal).toEqual([
    expect.objectContaining({
      type: 'drag.end',
      operation: 'resize',
      outcome: 'accepted',
      geometry: expect.objectContaining({
        delta: { x: 0, y: 0, width: 32, height: 24 },
      }),
    }),
  ])
  const saved = await metadata(bridge.client, session)
  const baseline = await bridge.client.readEvents(session, {
    type: 'read_events',
    requestId: 'cancel-baseline',
  })
  if (baseline.type !== 'events_result') throw new Error('Expected an event cursor baseline.')
  await dragTarget(page, panel, 'se', 32, 24, false)
  await expect(panel).toHaveAttribute('data-picodash-resizing', 'se')
  await page.keyboard.press('Escape')
  await page.mouse.up()
  await expect(panel).not.toHaveAttribute('data-picodash-resizing')
  expect(await metadata(bridge.client, session)).toEqual(saved)
  const cancellation = await bridge.client.readEvents(session, {
    type: 'read_events',
    requestId: 'cancel-observed',
    cursor: baseline.cursor,
    timeoutMs: 1000,
  })
  if (cancellation.type !== 'events_result')
    throw new Error('Expected disclosed resize cancellation.')
  expect(cancellation.events.map((entry) => entry.event.event)).toContainEqual(
    expect.objectContaining({ type: 'drag.cancel', operation: 'resize' }),
  )
  await page.getByRole('button', { name: 'Remove last item', exact: true }).click()
  await page.getByRole('button', { name: 'Close all items', exact: true }).click()
  await page
    .getByRole('button', { name: 'Restore preferred size from custom control', exact: true })
    .click()
  await expect(page.getByLabel('Panel size source')).toHaveText(
    'Width: preferred; height: preferred',
  )
  await testInfo.attach('accordion-manual-scroll-and-restore', {
    body: await panel.screenshot(),
    contentType: 'image/png',
  })
  const contentSettings = page.getByText('Content and accordion', { exact: true })
  if (!(await contentSettings.evaluate((element) => element.closest('details')?.open)))
    await contentSettings.click()
  await page.getByRole('combobox', { name: 'Panel content', exact: true }).selectOption('list')
  await page.getByRole('button', { name: 'Apply configuration', exact: true }).click()
  await page.getByLabel('Requested manual width').fill('480')
  await page.getByLabel('Requested manual height').fill('320')
  await page.getByRole('button', { name: 'Set manual size', exact: true }).click()
  await expect.poll(async () => Math.round((await box(panel)).height)).toBe(320)
  const list = panel.getByRole('list', { name: 'Resize Lab pinned bands', exact: true })
  const startBand = list.locator(':scope > [data-picodash-dashstack-band="start"]')
  const automaticBand = list.locator(':scope > [data-picodash-dashstack-band="automatic"]')
  const endBand = list.locator(':scope > [data-picodash-dashstack-band="end"]')
  await expect
    .poll(() => body.evaluate((element) => element.scrollHeight <= element.clientHeight + 1))
    .toBe(true)
  await expect
    .poll(() => automaticBand.evaluate((element) => element.scrollHeight > element.clientHeight))
    .toBe(true)
  const startBefore = await box(startBand)
  const endBefore = await box(endBand)
  const panelBefore = await box(panel)
  await automaticBand.evaluate((element) => {
    element.scrollTop = 120
  })
  await expect.poll(() => automaticBand.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
  await dragTarget(page, panel, 'e', 32, 0, true, 1)
  await expect(page.getByLabel('Manual panel size')).toHaveText('512 × 320')
  await expect.poll(() => automaticBand.evaluate((element) => element.scrollTop)).toBe(120)
  const panelAfter = await box(panel)
  expect((await box(startBand)).y - panelAfter.y).toBeCloseTo(startBefore.y - panelBefore.y, 1)
  expect((await box(endBand)).y - panelAfter.y).toBeCloseTo(endBefore.y - panelBefore.y, 1)
  await testInfo.attach('pinned-band-scroll-owner', {
    body: await panel.screenshot(),
    contentType: 'image/png',
  })
  await automaticBand.evaluate((element) => {
    element.scrollTop = 0
  })
  const reorderSession = await bridge.session()
  const reorderBaseline = await bridge.client.readEvents(reorderSession, {
    type: 'read_events',
    requestId: 'list-reorder-baseline',
  })
  if (reorderBaseline.type !== 'events_result')
    throw new Error('Expected a List reorder event baseline.')
  const detailOrder = () =>
    list
      .locator('[data-picodash-dashlet]')
      .evaluateAll((elements) =>
        elements.map((element) => element.getAttribute('data-picodash-dashlet')),
      )
  const beforeOrder = await detailOrder()
  const reorder = list.getByRole('button', { name: 'Reorder Detail 1', exact: true })
  await reorder.press('Enter')
  await reorder.press('ArrowDown')
  await reorder.press('Enter')
  await expect.poll(detailOrder).not.toEqual(beforeOrder)
  const reordered = await bridge.client.readEvents(reorderSession, {
    type: 'read_events',
    requestId: 'list-reorder-observed',
    cursor: reorderBaseline.cursor,
    timeoutMs: 1000,
  })
  if (reordered.type !== 'events_result') throw new Error('Expected disclosed List reorder events.')
  const listEvents = reordered.events
    .map((entry) => entry.event)
    .filter(
      ({ source, event }) =>
        source.kind === 'dashStack' && 'operation' in event && event.operation === 'reorder',
    )
  expect(listEvents.map(({ event }) => event.type)).toEqual(
    expect.arrayContaining(['drag.start', 'drag.update', 'drag.end']),
  )
  expect(
    listEvents.some(({ event }) => event.type === 'drag.end' && event.outcome === 'accepted'),
  ).toBe(true)
})

test('supports numeric and keyboard sizing, placement-aware grips, and retained close/reopen', async ({
  page,
}) => {
  const panel = await openResizeLab(page)
  await panel.getByRole('button', { name: 'Actions for Resize Panel', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Resize panel…', exact: true }).click()
  const editor = page.getByRole('form', { name: 'Resize panel Resize Panel', exact: true })
  await expect(editor.getByLabel('Width (px)')).toBeFocused()
  await editor.getByLabel('Width (px)').fill('420')
  await editor.getByLabel('Height (px)').fill('280')
  await editor.getByRole('button', { name: 'Apply size', exact: true }).click()
  await expect(page.getByLabel('Manual panel size')).toHaveText('420 × 280')
  const grip = panel.getByRole('button', { name: 'Resize panel Resize Panel from se', exact: true })
  await grip.press('Enter')
  await grip.press('Shift+ArrowRight')
  await grip.press('Shift+ArrowDown')
  await grip.press('Enter')
  await expect(page.getByLabel('Manual panel size')).toHaveText('430 × 290')
  await panel.getByRole('button', { name: 'Close panel Resize Panel', exact: true }).click()
  await expect(panel).toBeHidden()
  await page.getByRole('button', { name: 'Reopen Resize Panel', exact: true }).click()
  await expect(panel).toBeVisible()
  await expect(page.getByLabel('Manual panel size')).toHaveText('430 × 290')
  await page.getByText('Panel dimensions and input', { exact: true }).click()
  await page.getByLabel('Declared placement').selectOption('dock-right')
  await page.getByLabel('Resize grips').selectOption('always')
  await page.getByRole('button', { name: 'Apply configuration', exact: true }).click()
  await expect(panel).toHaveAttribute('data-picodash-placement', 'fixed-docked')
  await expect(panel.locator('[data-picodash-panel-resize-target]')).toHaveCount(1)
  await expect(
    panel.getByRole('button', { name: 'Resize panel Resize Panel from w', exact: true }),
  ).toBeVisible()
  await panel.getByRole('button', { name: 'Restore preferred size', exact: true }).click()
  await expect(page.getByLabel('Manual panel size')).toHaveText('Automatic on both axes')
  const dimensions = page.getByText('Panel dimensions and input', { exact: true })
  if (!(await dimensions.evaluate((element) => element.closest('details')?.open)))
    await dimensions.click()
  await page.getByRole('combobox', { name: 'Declared placement', exact: true }).selectOption('free')
  await page.getByLabel('Preferred height', { exact: true }).fill('50%')
  await page.getByRole('combobox', { name: 'Resize grips', exact: true }).selectOption('hidden')
  await page
    .getByRole('combobox', { name: 'Corner handle style', exact: true })
    .selectOption('external')
  await page.getByRole('button', { name: 'Apply configuration', exact: true }).click()
  await expect(panel).toHaveAttribute('data-picodash-placement', 'floating-free')
  await expect(page.getByLabel('Manual panel size')).toHaveText('Automatic on both axes')
  const percentageBoundary = await box(
    page.getByRole('region', { name: 'Resize Panel boundary', exact: true }),
  )
  await expect
    .poll(async () => (await box(panel)).height)
    .toBeCloseTo((percentageBoundary.height - 2 * 16) / 2, 1)
  const hiddenCorner = panel.getByRole('button', {
    name: 'Resize panel Resize Panel from ne',
    exact: true,
  })
  await expect(hiddenCorner.locator('[data-picodash-panel-resize-segment="primary"]')).toHaveCSS(
    'opacity',
    '0',
  )
  await hiddenCorner.press('Enter')
  for (const segment of ['primary', 'secondary']) {
    await expect(
      hiddenCorner.locator(`[data-picodash-panel-resize-segment="${segment}"]`),
    ).toHaveCSS('scale', '1')
  }
  await hiddenCorner.press('Escape')
  await expect(page.getByRole('region', { name: 'Contract Lab status', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Take specimen offline', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Reopen primary specimen', exact: true }),
  ).toBeVisible()
})
