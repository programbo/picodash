// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { createPicodashNexus, type NexusInteractionEvent } from '@picodash/nexus'
import {
  DashPanel,
  DashPanelProvider,
  useDashPanel,
  type DashPanelController,
  type DashPanelProps,
} from './index.tsx'

const rectangle = (left: number, top: number, width: number, height: number): DOMRect =>
  new DOMRect(left, top, width, height)
let root: Root
let host: HTMLDivElement
let boundary: HTMLDivElement
let width: number
let height: number
let contentHeight: number
let resizeObservers: ResizeObserverCallback[]
let frames: Map<number, FrameRequestCallback>
let frameId: number
let fontDescriptor: PropertyDescriptor | undefined
const captures = new Set<number>()
const captureMethods = ['setPointerCapture', 'hasPointerCapture', 'releasePointerCapture'] as const
const originalCaptureDescriptors = new Map(
  captureMethods.map((name) => [
    name,
    Object.getOwnPropertyDescriptor(HTMLElement.prototype, name),
  ]),
)

const pointer = (type: string, x: number, y: number) => {
  const event = new MouseEvent(type, {
    bubbles: true,
    clientX: x,
    clientY: y,
    button: 0,
    buttons: type === 'pointerup' ? 0 : 1,
  })
  Object.defineProperties(event, {
    pointerId: { value: 7 },
    pointerType: { value: 'mouse' },
    isPrimary: { value: true },
  })
  return event
}
const key = (value: string, shiftKey = false) =>
  new KeyboardEvent('keydown', { bubbles: true, key: value, shiftKey })
async function notify(target: Element) {
  await act(async () => {
    for (const callback of resizeObservers)
      callback([{ target } as ResizeObserverEntry], {} as ResizeObserver)
  })
}

describe('DashPanel manual sizing integration', () => {
  beforeEach(() => {
    host = document.createElement('div')
    boundary = document.createElement('div')
    document.body.append(host, boundary)
    root = createRoot(host)
    fontDescriptor = Object.getOwnPropertyDescriptor(document, 'fonts')
    width = 500
    height = 500
    contentHeight = 160
    captures.clear()
    resizeObservers = []
    frames = new Map()
    frameId = 0
    vi.stubGlobal(
      'ResizeObserver',
      class {
        readonly callback: ResizeObserverCallback
        constructor(callback: ResizeObserverCallback) {
          this.callback = callback
          resizeObservers.push(callback)
        }
        observe() {}
        unobserve() {}
        disconnect() {
          resizeObservers = resizeObservers.filter((callback) => callback !== this.callback)
        }
      },
    )
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      const id = ++frameId
      frames.set(id, callback)
      return id
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
      frames.delete(id)
    })
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      if (this === boundary) return rectangle(0, 0, width, height)
      const panel = this.closest<HTMLElement>('[data-picodash-panel]')
      const panelWidth =
        Number.parseFloat(
          panel?.style.inlineSize ||
            panel?.style.getPropertyValue('--picodash-panel-width') ||
            '200',
        ) || 200
      const declaredHeight = Number.parseFloat(panel?.style.blockSize ?? '')
      const cap = Number.parseFloat(panel?.style.maxBlockSize ?? '')
      const naturalHeight = contentHeight + 40
      const panelHeight =
        panel?.getAttribute('data-collapsed') === 'true' &&
        panel?.getAttribute('data-picodash-docked-minimized') !== 'true'
          ? 40
          : panel?.style.blockSize === 'min-content'
            ? 40
            : Math.min(
                Number.isFinite(declaredHeight) ? declaredHeight : naturalHeight,
                Number.isFinite(cap) ? cap : Infinity,
              )
      if (this.hasAttribute('data-picodash-panel'))
        return rectangle(
          Number.parseFloat(this.style.left) || 20,
          Number.parseFloat(this.style.top) || 30,
          panelWidth,
          panelHeight,
        )
      if (this.dataset.slot === 'dash-header')
        return rectangle(0, 0, this.style.inlineSize === 'min-content' ? 60 : panelWidth, 40)
      if (this.hasAttribute('data-picodash-panel-content'))
        return rectangle(
          0,
          0,
          panelWidth,
          panel?.getAttribute('data-collapsed') === 'true' ? 0 : contentHeight,
        )
      if (this.hasAttribute('data-picodash-panel-body'))
        return rectangle(0, 0, panelWidth, Math.max(0, panelHeight - 40))
      return rectangle(0, 0, 0, 0)
    })
    Object.defineProperties(HTMLElement.prototype, {
      setPointerCapture: {
        configurable: true,
        value: (id: number) => {
          captures.add(id)
        },
      },
      hasPointerCapture: { configurable: true, value: (id: number) => captures.has(id) },
      releasePointerCapture: {
        configurable: true,
        value: (id: number) => {
          captures.delete(id)
        },
      },
    })
  })
  afterEach(async () => {
    await act(async () => root.unmount())
    host.remove()
    boundary.remove()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    if (fontDescriptor) Object.defineProperty(document, 'fonts', fontDescriptor)
    else Reflect.deleteProperty(document, 'fonts')
    for (const [name, descriptor] of originalCaptureDescriptors) {
      if (descriptor) Object.defineProperty(HTMLElement.prototype, name, descriptor)
      else Reflect.deleteProperty(HTMLElement.prototype, name)
    }
  })

  async function setup(props: Partial<DashPanelProps> = {}) {
    const nexus = createPicodashNexus({ valueOwner: 'nexus', fields: {} })
    let controller!: DashPanelController
    function Probe() {
      controller = useDashPanel('test')
      return null
    }
    const view = (nextProps: Partial<DashPanelProps>) => (
      <DashPanelProvider nexus={nexus} boundary={boundary}>
        <DashPanel
          id="test"
          title="Resize test"
          width={200}
          minWidth={80}
          maxWidth={800}
          minHeight={40}
          maxHeight={800}
          defaultLayout={{
            placement: { mode: 'floating', disposition: { kind: 'free' } },
            preferredPosition: { x: 20, y: 30 },
          }}
          {...nextProps}
        >
          <div>Content</div>
        </DashPanel>
        <Probe />
      </DashPanelProvider>
    )
    await act(async () => root.render(view(props)))
    await act(async () => {})
    return {
      nexus,
      rerender: (nextProps: Partial<DashPanelProps>) =>
        act(async () => root.render(view(nextProps))),
      getController: () => {
        if (controller.availability !== 'available') throw new Error('Panel not mounted')
        return controller
      },
      panel: document.querySelector<HTMLElement>('[data-picodash-panel]')!,
    }
  }

  it('retains manual axes through boundary projection and restores only the requested axis', async () => {
    const { nexus, getController } = await setup()
    await act(async () => {
      getController().setSize({ width: 600, height: 400 })
    })
    expect(nexus.scope('test').getState().scope?.dashPanel).toEqual({
      version: 2,
      manualSize: { width: 600, height: 400 },
    })
    expect(getController().sizing?.resolved).toEqual({ width: 500, height: 400 })
    width = 250
    height = 240
    await notify(boundary)
    expect(getController().sizing?.desired).toEqual({ width: 600, height: 400 })
    expect(getController().sizing?.resolved).toEqual({ width: 250, height: 210 })
    width = 800
    height = 800
    await notify(boundary)
    expect(getController().sizing?.resolved).toEqual({ width: 600, height: 400 })
    await act(async () => {
      getController().restorePreferredSize({ axes: 'width' })
    })
    expect(nexus.scope('test').getState().scope?.dashPanel).toEqual({
      version: 2,
      manualSize: { height: 400 },
    })
    expect(getController().sizing?.source).toEqual({ width: 'preferred', height: 'manual' })
    await act(async () => {
      getController().restorePreferredSize()
    })
    expect(nexus.scope('test').getState().scope).toBeUndefined()
  })

  it('commits one resized axis from keyboard geometry and keeps cancellation non-durable', async () => {
    const { nexus, panel, getController } = await setup()
    const layer = panel.querySelector('[data-picodash-panel-resize-layer]')!
    expect(layer.parentElement).toBe(panel)
    expect(layer.querySelectorAll('button')).toHaveLength(8)
    for (const button of layer.querySelectorAll('button')) {
      expect(
        Array.from(button.children, (segment) => [
          segment.getAttribute('data-picodash-panel-resize-segment'),
          segment.getAttribute('aria-hidden'),
        ]),
      ).toEqual([
        ['primary', 'true'],
        ['secondary', 'true'],
      ])
    }
    expect(panel.querySelector('[data-picodash-panel-surface]')?.contains(layer)).toBe(false)
    const events: NexusInteractionEvent[] = []
    const unsubscribe = nexus.events.subscribe((event) => events.push(event))
    const east = panel.querySelector<HTMLButtonElement>('[data-picodash-panel-resize-target="e"]')!
    await act(async () => east.dispatchEvent(key('Enter')))
    await act(async () => east.dispatchEvent(key('ArrowRight', true)))
    await act(async () => east.dispatchEvent(key('Enter')))
    expect(nexus.scope('test').getState().scope?.dashPanel).toEqual({
      version: 2,
      manualSize: { width: 210 },
    })
    expect(getController().sizing?.source.height).toBe('preferred')
    const saved = nexus.scope('test').getState().scope
    await act(async () => east.dispatchEvent(key('Enter')))
    await act(async () => east.dispatchEvent(key('ArrowRight', true)))
    await act(async () => east.dispatchEvent(key('Escape')))
    expect(nexus.scope('test').getState().scope).toBe(saved)
    expect(events.filter((event) => event.event.type === 'drag.end')).toHaveLength(1)
    expect(events.filter((event) => event.event.type === 'drag.cancel')).toHaveLength(1)
    expect(events.find((event) => event.event.type === 'drag.end')?.event).toMatchObject({
      operation: 'resize',
      outcome: 'accepted',
      geometry: { delta: { x: 0, y: 0, width: 10, height: 0 } },
    })
    unsubscribe()
  })

  it('uses one pointer commit, flushes final delta and releases capture; grip clicks do not size', async () => {
    const { nexus, panel } = await setup()
    const east = panel.querySelector<HTMLButtonElement>('[data-picodash-panel-resize-target="e"]')!
    const writes = vi.fn()
    nexus.subscribe(writes)
    await act(async () => east.dispatchEvent(pointer('pointerdown', 220, 130)))
    await act(async () => window.dispatchEvent(pointer('pointerup', 220, 130)))
    expect(nexus.scope('test').getState().scope).toBeUndefined()
    writes.mockClear()
    await act(async () => east.dispatchEvent(pointer('pointerdown', 220, 130)))
    await act(async () => window.dispatchEvent(pointer('pointermove', 260, 130)))
    await act(async () => window.dispatchEvent(pointer('pointerup', 270, 130)))
    expect(nexus.scope('test').getState().scope?.dashPanel).toEqual({
      version: 2,
      manualSize: { width: 250 },
    })
    expect(writes).toHaveBeenCalledTimes(1)
    expect(captures.size).toBe(0)
  })

  it('fences a canonical metadata write before React can refresh the resize registration', async () => {
    const { panel, nexus } = await setup()
    const events: NexusInteractionEvent[] = []
    const unsubscribe = nexus.events.subscribe((event) => events.push(event))
    const east = panel.querySelector<HTMLButtonElement>('[data-picodash-panel-resize-target="e"]')!
    await act(async () => east.dispatchEvent(key('Enter')))
    await act(async () => east.dispatchEvent(key('ArrowRight', true)))
    await act(async () => {
      nexus.scope('test').setDashPanelLayout({ version: 2, manualSize: { height: 400 } })
      // Both calls intentionally share one stack, before any registration effect can run.
      east.dispatchEvent(key('Enter'))
    })
    expect(nexus.scope('test').getState().scope?.dashPanel).toEqual({
      version: 2,
      manualSize: { height: 400 },
    })
    expect(events.filter((event) => event.event.type === 'drag.cancel')).toHaveLength(1)
    expect(events.find((event) => event.event.type === 'drag.cancel')?.event).toMatchObject({
      reason: 'metadata_changed',
    })
    expect(events.filter((event) => event.event.type === 'drag.end')).toHaveLength(0)
    unsubscribe()
  })

  it('commits the release position when the last movement sample has not been delivered', async () => {
    const { nexus, panel } = await setup()
    const handle = panel.querySelector<HTMLButtonElement>('[data-picodash-panel-move-handle]')!
    const events: NexusInteractionEvent[] = []
    const unsubscribe = nexus.events.subscribe((event) => events.push(event))
    const writes = vi.fn()
    nexus.subscribe(writes)
    await act(async () => {
      handle.dispatchEvent(pointer('pointerdown', 20, 30))
      handle.dispatchEvent(pointer('pointerup', 80, 54))
    })
    expect(nexus.scope('test').getState().scope?.dashPanel?.preferredPosition).toEqual({
      x: 80,
      y: 54,
    })
    expect(writes).toHaveBeenCalledTimes(1)
    expect(events.filter(({ event }) => event.type === 'drag.end')).toHaveLength(1)
    expect(events.find(({ event }) => event.type === 'drag.end')?.event).toMatchObject({
      operation: 'move',
      outcome: 'accepted',
      geometry: { delta: { x: 60, y: 24, width: 0, height: 0 } },
    })
    expect(captures.size).toBe(0)
    unsubscribe()
  })

  it('coalesces move telemetry at 60Hz and flushes before the one terminal event', async () => {
    const { nexus, panel } = await setup()
    const handle = panel.querySelector<HTMLButtonElement>('[data-picodash-panel-move-handle]')!
    const events: NexusInteractionEvent[] = []
    const unsubscribe = nexus.events.subscribe((event) => events.push(event))
    const writes = vi.fn()
    nexus.subscribe(writes)
    await act(async () => handle.dispatchEvent(pointer('pointerdown', 20, 30)))
    let samples = 0
    let lastX = 20
    for (let tick = 0; tick < 600; tick += 1) {
      await act(async () => {
        const end = Math.floor(((tick + 1) * 1000) / 60)
        while (samples < end) {
          samples += 1
          lastX = 120 + 50 * Math.sin(samples / 100)
          handle.dispatchEvent(pointer('pointermove', lastX, 30))
        }
      })
      await act(async () => {
        const pending = Array.from(frames.entries())
        frames.clear()
        for (const [, callback] of pending) callback((tick + 1) * (1000 / 60))
      })
    }
    expect(samples).toBe(10000)
    expect(writes).not.toHaveBeenCalled()
    await act(async () => handle.dispatchEvent(pointer('pointerup', lastX, 30)))
    const moves = events.filter(
      (event) => 'operation' in event.event && event.event.operation === 'move',
    )
    const updates = moves.filter((event) => event.event.type === 'drag.update')
    expect(updates).toHaveLength(600)
    expect(moves.filter((event) => event.event.type === 'drag.start')).toHaveLength(1)
    expect(moves.filter((event) => event.event.type === 'drag.end')).toHaveLength(1)
    expect(moves.at(-1)?.event.type).toBe('drag.end')
    expect(nexus.scope('test').getState().scope?.dashPanel?.preferredPosition?.x).toBeCloseTo(lastX)
    expect(writes).toHaveBeenCalledTimes(1)
    expect(captures.size).toBe(0)
    unsubscribe()
  })

  it('cancels a started gesture when declared bounds change without committing stale geometry', async () => {
    const { panel, nexus, rerender } = await setup()
    const events: NexusInteractionEvent[] = []
    const unsubscribe = nexus.events.subscribe((event) => events.push(event))
    const east = panel.querySelector<HTMLButtonElement>('[data-picodash-panel-resize-target="e"]')!
    await act(async () => east.dispatchEvent(key('Enter')))
    await act(async () => east.dispatchEvent(key('ArrowRight', true)))
    await rerender({ minWidth: 250 })
    expect(nexus.scope('test').getState().scope).toBeUndefined()
    expect(events.filter((event) => event.event.type === 'drag.cancel')).toHaveLength(1)
    expect(events.find((event) => event.event.type === 'drag.cancel')?.event).toMatchObject({
      reason: 'layout_changed',
    })
    expect(panel.hasAttribute('data-picodash-resizing')).toBe(false)
    unsubscribe()
  })

  it('cancels independent semantic content changes only when content bounds participate', async () => {
    const { panel, nexus } = await setup({ contentConstraints: { maxHeight: true } })
    const events: NexusInteractionEvent[] = []
    const unsubscribe = nexus.events.subscribe((event) => events.push(event))
    const east = panel.querySelector<HTMLButtonElement>('[data-picodash-panel-resize-target="e"]')!
    await act(async () => east.dispatchEvent(key('Enter')))
    await act(async () => east.dispatchEvent(key('ArrowRight', true)))
    await act(async () => {
      panel
        .querySelector('[data-picodash-panel-content]')!
        .append(document.createTextNode('Changed content'))
    })
    expect(nexus.scope('test').getState().scope).toBeUndefined()
    expect(events.filter((event) => event.event.type === 'drag.cancel')).toHaveLength(1)
    expect(events.find((event) => event.event.type === 'drag.cancel')?.event).toMatchObject({
      reason: 'content_constraints_changed',
    })
    expect(panel.hasAttribute('data-picodash-resizing')).toBe(false)
    unsubscribe()
  })

  it('opens the tap-size editor from the dedicated coarse-pointer shortcut', async () => {
    const { panel } = await setup({ showCloseButton: false })
    const shortcut = panel.querySelector<HTMLButtonElement>('[data-picodash-panel-resize-button]')!
    expect(shortcut.getAttribute('aria-label')).toBe('Resize panel Resize test')
    await act(async () => shortcut.click())
    const editor = panel.querySelector<HTMLFormElement>('[data-picodash-panel-size-editor]')
    expect(editor?.getAttribute('aria-label')).toBe('Resize panel Resize test')
    expect(document.activeElement?.getAttribute('type')).toBe('number')
  })

  it('keeps restore-size feedback available when the Close button is omitted', async () => {
    const { getController, panel, nexus } = await setup({ showCloseButton: false })
    await act(async () => getController().setSize({ width: 240 }))
    expect(panel.querySelector('[aria-label="Close panel Resize test"]')).toBeNull()
    const restore = panel.querySelector<HTMLButtonElement>('[aria-label="Restore preferred size"]')
    expect(restore).not.toBeNull()
    const actions = panel.querySelector('[aria-label="Actions for Resize test"]')!
    expect(
      restore!.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    await act(async () => restore!.focus())
    expect(document.activeElement).toBe(restore)
    await act(async () => restore!.click())
    expect(nexus.scope('test').getState().scope).toBeUndefined()
    expect(restore?.isConnected).toBe(false)
    expect(panel.contains(document.activeElement)).toBe(true)
    expect(document.activeElement).not.toBe(document.body)
  })

  it('remeasures image and font load events without overwriting a manual size, then removes listeners', async () => {
    const fonts = Object.assign(new EventTarget(), { status: 'loaded' })
    Object.defineProperty(document, 'fonts', { configurable: true, value: fonts })
    const add = vi.spyOn(fonts, 'addEventListener')
    const remove = vi.spyOn(fonts, 'removeEventListener')
    const { getController, panel, nexus } = await setup()
    await act(async () => getController().setSize({ height: 120 }))
    const content = panel.querySelector<HTMLElement>('[data-picodash-panel-content]')!
    const image = document.createElement('img')
    await act(async () => content.append(image))
    const saved = nexus.getState()
    contentHeight = 420
    await act(async () => image.dispatchEvent(new Event('load')))
    expect(getController().sizing?.preferred.height).toBe(460)
    expect(getController().sizing?.resolved.height).toBe(120)
    fonts.status = 'loading'
    contentHeight = 520
    await act(async () => image.dispatchEvent(new Event('load')))
    expect(getController().sizing?.measurements?.status).toBe('pending')
    fonts.status = 'loaded'
    await act(async () => fonts.dispatchEvent(new Event('loadingdone')))
    expect(getController().sizing?.preferred.height).toBe(560)
    expect(getController().sizing?.measurements?.status).toBe('ready')
    expect(nexus.getState()).toBe(saved)
    await act(async () => root.unmount())
    const added = add.mock.calls.filter(
      ([name]) => name === 'loadingdone' || name === 'loadingerror',
    )
    const removed = remove.mock.calls.filter(
      ([name]) => name === 'loadingdone' || name === 'loadingerror',
    )
    expect(added.length).toBeGreaterThanOrEqual(2)
    expect(removed).toEqual(added)
  })

  it('applies an explicit minimum height to an otherwise shorter automatic Panel', async () => {
    const { getController, panel } = await setup({ minHeight: 300 })
    expect(getController().sizing?.preferred.height).toBe(200)
    expect(getController().sizing?.resolved.height).toBe(300)
    expect(panel.getBoundingClientRect().height).toBe(300)
  })

  it('reports the final full-dock rectangle while retaining a dormant manual height', async () => {
    const { getController, panel, nexus } = await setup({
      defaultLayout: {
        placement: { mode: 'fixed', disposition: { kind: 'docked', position: 'full-right' } },
      },
    })
    await act(async () => getController().setSize({ height: 120 }))
    expect(getController().sizing?.desired.height).toBe(120)
    expect(getController().sizing?.resolved.height).toBe(500)
    expect(panel.style.blockSize).toBe('500px')
    expect(nexus.scope('test').getState().scope?.dashPanel?.manualSize?.height).toBe(120)
    expect(getController().sizing?.constraints).toContainEqual({
      axis: 'height',
      code: 'allocation',
      limit: 500,
    })
  })

  it('projects collapsed manual height to the bottom snap anchor and restores it on expansion', async () => {
    const { getController, panel, nexus } = await setup()
    await act(async () => getController().setSize({ height: 300 }))
    await act(async () =>
      getController().setPlacement({
        mode: 'floating',
        disposition: { kind: 'snapped', position: 'bottom' },
      }),
    )
    await act(async () => getController().collapse())
    expect(getController().sizing?.desired.height).toBe(300)
    expect(getController().sizing?.resolved.height).toBe(40)
    expect(Number.parseFloat(panel.style.top)).toBe(452)
    expect(nexus.scope('test').getState().scope?.dashPanel?.manualSize?.height).toBe(300)
    await act(async () => getController().expand())
    expect(getController().sizing?.resolved.height).toBe(300)
  })

  it('keeps collapse motion alive when its own content box reports the hidden height', async () => {
    const { getController, panel } = await setup()
    panel.style.setProperty('--picodash-duration-fast', '200ms')
    const cancel = vi.fn()
    const animate = vi.fn(() => ({
      cancel,
      play() {},
      pause() {},
      onfinish: null,
      currentTime: 0,
      playbackRate: 1,
      playState: 'running',
    }))
    Object.defineProperty(panel, 'animate', { configurable: true, value: animate })
    const content = panel.querySelector<HTMLElement>('[data-picodash-panel-content]')!
    await notify(panel)
    await act(async () => getController().collapse())
    expect(panel.hasAttribute('data-picodash-height-motion')).toBe(true)
    await notify(content)
    expect(cancel).not.toHaveBeenCalled()
    expect(panel.hasAttribute('data-picodash-height-motion')).toBe(true)
    expect(getController().sizing?.resolved.height).toBe(40)
    await notify(boundary)
    expect(cancel).toHaveBeenCalledTimes(2)
    expect(panel.hasAttribute('data-picodash-height-motion')).toBe(false)
  })

  it.each([false, true])(
    'restores height styles after both properties complete (cap first: %s)',
    async (capFirst) => {
      const { getController, panel } = await setup()
      panel.style.setProperty('--picodash-duration-fast', '200ms')
      const animations: {
        cancel: () => void
        play: () => void
        pause: () => void
        onfinish: (() => void) | null
        currentTime: number
        playbackRate: number
        playState: string
      }[] = []
      Object.defineProperty(panel, 'animate', {
        configurable: true,
        value: () => {
          const animation: (typeof animations)[number] = {
            cancel: vi.fn(),
            play() {},
            pause() {},
            onfinish: null,
            currentTime: 0,
            playbackRate: 1,
            playState: 'running',
          }
          animations.push(animation)
          return animation
        },
      })
      await notify(panel)
      await act(async () => getController().collapse())
      expect(animations).toHaveLength(2)
      const first = animations[capFirst ? 1 : 0]
      const second = animations[capFirst ? 0 : 1]
      if (!first || !second) throw new Error('Expected both owned height animations.')
      await act(async () => first.onfinish?.())
      expect(panel.hasAttribute('data-picodash-height-motion')).toBe(true)
      await act(async () => second.onfinish?.())
      expect(panel.hasAttribute('data-picodash-height-motion')).toBe(false)
      expect(panel.style.maxBlockSize).toBe('40px')
      expect(panel.style.blockSize).toBe('')
    },
  )

  it('coalesces a 1000Hz ten-second pointer source to frame previews and one settled write', async () => {
    const { nexus, panel } = await setup()
    const east = panel.querySelector<HTMLButtonElement>('[data-picodash-panel-resize-target="e"]')!
    const events: NexusInteractionEvent[] = []
    const unsubscribe = nexus.events.subscribe((event) => events.push(event))
    const writes = vi.fn()
    const scopedWrites = vi.fn()
    nexus.subscribe(writes)
    nexus.scope('test').subscribe(scopedWrites)
    await act(async () => east.dispatchEvent(pointer('pointerdown', 220, 130)))
    let samples = 0
    let changedPreviews = 0
    for (let tick = 0; tick < 600; tick += 1) {
      const previousWidth = panel.style.inlineSize
      await act(async () => {
        const end = Math.floor(((tick + 1) * 1000) / 60)
        while (samples < end) {
          samples += 1
          east.dispatchEvent(pointer('pointermove', 290 + 50 * Math.sin(samples / 100), 130))
        }
      })
      expect(panel.style.inlineSize).toBe(previousWidth)
      await act(async () => {
        const pending = Array.from(frames.entries())
        frames.clear()
        for (const [, callback] of pending) callback((tick + 1) * (1000 / 60))
      })
      if (panel.style.inlineSize !== previousWidth) changedPreviews += 1
    }
    expect(samples).toBe(10000)
    expect(changedPreviews).toBe(600)
    expect(writes).not.toHaveBeenCalled()
    expect(scopedWrites).not.toHaveBeenCalled()
    expect(nexus.scope('test').getState().scope).toBeUndefined()
    await act(async () => east.dispatchEvent(pointer('pointerup', 300, 130)))
    const updates = events.filter(
      (event) => event.event.type === 'drag.update' && event.event.operation === 'resize',
    )
    expect(updates).toHaveLength(601)
    expect(events.filter((event) => event.event.type === 'drag.start')).toHaveLength(1)
    expect(events.filter((event) => event.event.type === 'drag.end')).toHaveLength(1)
    expect(writes).toHaveBeenCalledTimes(1)
    expect(scopedWrites).toHaveBeenCalledTimes(1)
    expect(nexus.scope('test').getState().scope?.dashPanel?.manualSize).toEqual({ width: 280 })
    expect(captures.size).toBe(0)
    unsubscribe()
  })

  it('publishes one cancellation before entity release and leaves repeated sessions clean', async () => {
    const { nexus, panel } = await setup()
    const events: NexusInteractionEvent[] = []
    const unsubscribe = nexus.events.subscribe((event) => events.push(event))
    const east = panel.querySelector<HTMLButtonElement>('[data-picodash-panel-resize-target="e"]')!
    const initialObserverCount = resizeObservers.length
    for (let cycle = 0; cycle < 100; cycle += 1) {
      await act(async () => east.dispatchEvent(key('Enter')))
      await act(async () => east.dispatchEvent(key('ArrowRight')))
      await act(async () => east.dispatchEvent(key('Escape')))
    }
    expect(resizeObservers).toHaveLength(initialObserverCount)
    expect(events.filter((event) => event.event.type === 'drag.cancel')).toHaveLength(100)
    await act(async () => east.dispatchEvent(key('Enter')))
    await act(async () => east.dispatchEvent(key('ArrowRight')))
    await act(async () => root.unmount())
    const cancellations = events.filter((event) => event.event.type === 'drag.cancel')
    expect(cancellations).toHaveLength(101)
    expect(cancellations.at(-1)?.event).toMatchObject({ reason: 'unmounted', operation: 'resize' })
    expect(nexus.scope('test').getState().scope).toBeUndefined()
    expect(captures.size).toBe(0)
    expect(resizeObservers).toHaveLength(0)
    expect(frames.size).toBe(0)
    unsubscribe()
    expect(() => nexus.destroy()).not.toThrow()
  })

  it('observes content growth without changing manual height and leaves hover out of canonical snapshots', async () => {
    const { nexus, panel, getController } = await setup()
    await act(async () => getController().setSize({ height: 120 }))
    const saved = nexus.getState()
    const writes = vi.fn()
    nexus.subscribe(writes)
    const events: NexusInteractionEvent[] = []
    const unsubscribe = nexus.events.subscribe((event) => events.push(event))
    await act(async () => panel.dispatchEvent(pointer('pointerover', 40, 80)))
    await act(async () => panel.dispatchEvent(pointer('pointerout', 40, 80)))
    await act(async () => panel.dispatchEvent(pointer('pointerdown', 40, 80)))
    await act(async () => panel.dispatchEvent(pointer('pointerup', 40, 80)))
    await act(async () => panel.click())
    await act(async () =>
      panel.querySelector<HTMLButtonElement>('[data-picodash-panel-resize-target="e"]')!.focus(),
    )
    expect(events.some((event) => event.event.type === 'hover')).toBe(true)
    expect(events.some((event) => event.event.type === 'focus')).toBe(true)
    for (const phase of ['down', 'up', 'click'])
      expect(
        events.some((event) => event.event.type === 'pointer' && event.event.phase === phase),
      ).toBe(true)
    contentHeight = 400
    await notify(panel.querySelector('[data-picodash-panel-content]')!)
    expect(getController().sizing?.resolved.height).toBe(120)
    expect(getController().sizing?.preferred.height).toBe(440)
    expect(nexus.getState()).toBe(saved)
    expect(writes).not.toHaveBeenCalled()
    unsubscribe()
    await act(async () => root.unmount())
    expect(captures.size).toBe(0)
    expect(resizeObservers).toHaveLength(0)
    expect(frames.size).toBe(0)
    expect(() => nexus.destroy()).not.toThrow()
  })
})
