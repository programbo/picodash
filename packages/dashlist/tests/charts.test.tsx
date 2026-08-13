// @vitest-environment jsdom
import { act, createElement, type ReactElement } from 'react'
import { describe, expect, it, vi } from 'vite-plus/test'
import { renderToString } from 'react-dom/server'
import { createDomTestRenderer, type DomTestRenderer } from '../../../test/dom-renderer.ts'
import { createPicodashNexus } from '@picodash/nexus'

vi.mock('@tanstack/charts/react', () => ({
  Chart: (props: { ariaLabel: string; definition: unknown }) =>
    createElement('svg', {
      role: 'img',
      'aria-label': props.ariaLabel,
      'data-chart-definition': props.definition ? 'present' : 'empty',
    }),
}))

const { ChartDashlet, SparklineDashlet } = await import('../src/charts.tsx')
const { DashList } = await import('../src/index.tsx')

function withList(child: ReactElement) {
  const nexus = createPicodashNexus({ valueOwner: 'nexus', fields: {} })
  return { nexus, element: createElement(DashList, { id: 'charts', nexus }, child) }
}

function render(element: ReactElement): DomTestRenderer {
  let renderer!: DomTestRenderer
  act(() => {
    renderer = createDomTestRenderer(element)
  })
  return renderer
}

function definition() {
  return { marks: [] } as never
}

describe('experimental chart dashlets', () => {
  it('renders ChartDashlet with label naming and accepts definition updates', () => {
    const setup = withList(
      createElement(ChartDashlet, {
        id: 'chart',
        label: 'Revenue',
        definition: definition(),
      }),
    )
    const view = render(setup.element)
    expect(view.root.element.querySelector('[role="img"][aria-label="Revenue"]')).not.toBeNull()
    act(() =>
      view.update(
        createElement(
          DashList,
          { id: 'charts', nexus: setup.nexus },
          createElement(ChartDashlet, {
            id: 'chart',
            label: 'Revenue',
            definition: definition(),
          }),
        ),
      ),
    )
    expect(view.root.findByProps({ 'data-picodash-dashlet': 'chart' })).toBeDefined()
    act(() => view.unmount())
    setup.nexus.destroy()
  })

  it('starts Sparkline empty, bounds samples, and disposes on unmount', () => {
    let emit!: (value: number) => void
    const disposer = vi.fn()
    const setup = withList(
      createElement(SparklineDashlet, {
        id: 'spark',
        label: 'CPU',
        maxSamples: 3,
        source: (next) => {
          emit = next
          return disposer
        },
      }),
    )
    const view = render(setup.element)
    expect(view.root.element.querySelector('[data-picodash-sparkline-samples="0"]')).not.toBeNull()
    act(() => {
      emit(1)
      emit(2)
      emit(3)
      emit(4)
    })
    expect(view.root.element.querySelector('[data-picodash-sparkline-samples="3"]')).not.toBeNull()
    act(() => view.unmount())
    expect(disposer).toHaveBeenCalledTimes(1)
    act(() => emit(5))
    setup.nexus.destroy()
  })

  it('suspends while hidden or offscreen and resubscribes when visible', () => {
    const observers: Array<{ callback: (entries: Array<{ isIntersecting: boolean }>) => void }> = []
    class MockIntersectionObserver {
      readonly callback: (entries: Array<{ isIntersecting: boolean }>) => void
      constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void) {
        this.callback = callback
        observers.push(this)
      }
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
    let subscriptions = 0
    const disposers: Array<ReturnType<typeof vi.fn>> = []
    const setup = withList(
      createElement(SparklineDashlet, {
        id: 'spark-visibility',
        label: 'Latency',
        source: () => {
          subscriptions += 1
          const disposer = vi.fn()
          disposers.push(disposer)
          return disposer
        },
      }),
    )
    const view = render(setup.element)
    expect(subscriptions).toBe(1)
    act(() => observers[0]!.callback([{ isIntersecting: false }]))
    expect(disposers[0]).toHaveBeenCalledTimes(1)
    act(() => observers[0]!.callback([{ isIntersecting: true }]))
    expect(subscriptions).toBe(2)
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    void act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(disposers[1]).toHaveBeenCalledTimes(1)
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    void act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(subscriptions).toBe(3)
    act(() => view.unmount())
    setup.nexus.destroy()
    vi.unstubAllGlobals()
  })

  it('renders deterministically on the server with no initial samples', () => {
    const html = renderToString(
      createElement(
        DashList,
        { id: 'charts', nexus: createPicodashNexus({ valueOwner: 'nexus', fields: {} }) },
        createElement(SparklineDashlet, {
          id: 'ssr-spark',
          label: 'Throughput',
          source: (emit) => {
            emit(42)
          },
        }),
      ),
    )
    expect(html).toContain('data-picodash-sparkline-samples="0"')
    expect(html).toContain('aria-label="Throughput"')
  })
})
