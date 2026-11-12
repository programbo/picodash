// @vitest-environment jsdom
import { act, StrictMode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { createDomTestRenderer as create } from '../../../test/dom-renderer.ts'
import { useScrollFade } from '../src/index.tsx'

const observers: TestResizeObserver[] = []
class TestResizeObserver implements ResizeObserver {
  readonly targets = new Set<Element>()
  constructor(readonly callback: ResizeObserverCallback) {
    observers.push(this)
  }
  observe(element: Element) {
    this.targets.add(element)
  }
  unobserve(element: Element) {
    this.targets.delete(element)
  }
  disconnect() {
    this.targets.clear()
  }
  resize() {
    this.callback([], this)
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  observers.length = 0
})

function setup({ height = 200, content = 800, strict = false } = {}) {
  vi.stubGlobal('ResizeObserver', TestResizeObserver)
  const metrics = { height, content }
  function Probe() {
    const fade = useScrollFade()
    return (
      <div
        ref={(element) => {
          if (element)
            Object.defineProperties(element, {
              clientHeight: { configurable: true, get: () => metrics.height },
              scrollHeight: { configurable: true, get: () => metrics.content },
            })
          return fade(element)
        }}
      >
        <div>Content</div>
      </div>
    )
  }
  let renderer!: ReturnType<typeof create>
  act(() => {
    renderer = create(
      strict ? (
        <StrictMode>
          <Probe />
        </StrictMode>
      ) : (
        <Probe />
      ),
    )
  })
  const element = renderer.root.findByProps({ 'data-picodash-scroll-fade': '' }).element
  if (!(element instanceof HTMLElement)) throw new Error('Expected the scrollport.')
  const read = () => ({
    top: Number.parseFloat(element.style.getPropertyValue('--_picodash-scroll-fade-top')),
    bottom: Number.parseFloat(element.style.getPropertyValue('--_picodash-scroll-fade-bottom')),
    overflow: element.getAttribute('data-picodash-scroll-overflow'),
  })
  const scroll = (position: number) => {
    element.scrollTop = position
    element.dispatchEvent(new Event('scroll'))
  }
  return { renderer, element, metrics, read, scroll }
}

describe('useScrollFade', () => {
  it('derives both edge cues from current geometry, including short viewports and overscroll', () => {
    const { renderer, metrics, read, scroll } = setup()
    expect(read()).toEqual({ top: 0, bottom: 40, overflow: 'end' })
    scroll(48)
    expect(read()).toEqual({ top: 20, bottom: 40, overflow: 'start end' })
    scroll(600)
    expect(read()).toEqual({ top: 40, bottom: 0, overflow: 'start' })
    scroll(900)
    expect(read()).toEqual({ top: 40, bottom: 0, overflow: 'start' })
    scroll(-20)
    expect(read()).toEqual({ top: 0, bottom: 40, overflow: 'end' })
    metrics.height = 80
    observers[0].resize()
    expect(read()).toEqual({ top: 0, bottom: 20, overflow: 'end' })
    metrics.content = 80
    observers[0].resize()
    expect(read()).toEqual({ top: 0, bottom: 0, overflow: '' })
    act(() => renderer.unmount())
  })

  it('updates before the next frame after content mutations and observes replacement content', async () => {
    const { renderer, element, metrics, read } = setup({ content: 200 })
    expect(read().bottom).toBe(0)
    metrics.content = 800
    const replacement = document.createElement('div')
    const disclosure = document.createElement('section')
    replacement.append(disclosure)
    element.replaceChildren(replacement)
    await act(async () => {
      await Promise.resolve()
    })
    expect(observers[0].targets).toEqual(new Set([element, replacement, disclosure]))
    expect(read()).toEqual({ top: 0, bottom: 40, overflow: 'end' })
    // Images can change overflow without a DOM mutation or viewport resize.
    metrics.content = 200
    replacement.dispatchEvent(new Event('load'))
    expect(read().bottom).toBe(0)
    act(() => renderer.unmount())
  })

  it('releases observers, listeners, and owned DOM feedback during StrictMode cleanup', () => {
    const { renderer, element, metrics } = setup({ strict: true })
    expect(observers.filter((observer) => observer.targets.size > 0)).toHaveLength(1)
    act(() => renderer.unmount())
    expect(observers.every((observer) => observer.targets.size === 0)).toBe(true)
    expect(element.hasAttribute('data-picodash-scroll-fade')).toBe(false)
    expect(element.hasAttribute('data-picodash-scroll-overflow')).toBe(false)
    metrics.content = 2000
    element.dispatchEvent(new Event('scroll'))
    expect(element.style.getPropertyValue('--_picodash-scroll-fade-bottom')).toBe('')
  })
})
