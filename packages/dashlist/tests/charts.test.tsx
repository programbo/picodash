// @vitest-environment jsdom
import { act, createElement, createRef, type ReactElement, type Ref } from 'react'
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

  it('forwards explicit aria-labels for non-text ChartDashlet labels', () => {
    const setup = withList(
      createElement(ChartDashlet, {
        id: 'icon-chart',
        label: createElement('span', null, 'Revenue'),
        'aria-label': 'Revenue chart',
        definition: definition(),
      }),
    )
    const view = render(setup.element)
    expect(
      view.root.element.querySelector('[role="img"][aria-label="Revenue chart"]'),
    ).not.toBeNull()
    expect(
      view.root.element.querySelector('[data-picodash-dashlet-shell][aria-label="Revenue chart"]'),
    ).not.toBeNull()
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

  it('trims retained history immediately when maxSamples decreases without a source emission', () => {
    let emit!: (value: number) => void
    const source = vi.fn((next: (value: number) => void) => {
      emit = next
      return () => undefined
    })
    const setup = withList(
      createElement(SparklineDashlet, {
        id: 'spark-resize',
        label: 'CPU',
        maxSamples: 4,
        source,
      }),
    )
    const view = render(setup.element)
    act(() => {
      emit(1)
      emit(2)
      emit(3)
      emit(4)
    })
    expect(view.root.element.querySelector('[data-picodash-sparkline-samples="4"]')).not.toBeNull()

    act(() =>
      view.update(
        createElement(
          DashList,
          { id: 'charts', nexus: setup.nexus },
          createElement(SparklineDashlet, {
            id: 'spark-resize',
            label: 'CPU',
            maxSamples: 2,
            source,
          }),
        ),
      ),
    )
    expect(view.root.element.querySelector('[data-picodash-sparkline-samples="2"]')).not.toBeNull()

    act(() =>
      view.update(
        createElement(
          DashList,
          { id: 'charts', nexus: setup.nexus },
          createElement(SparklineDashlet, {
            id: 'spark-resize',
            label: 'CPU',
            maxSamples: 5,
            source,
          }),
        ),
      ),
    )
    expect(view.root.element.querySelector('[data-picodash-sparkline-samples="2"]')).not.toBeNull()
    expect(source).toHaveBeenCalledTimes(3)
    act(() => view.unmount())
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
    expect(subscriptions).toBe(0)
    act(() => observers[0]!.callback([{ isIntersecting: false }]))
    expect(subscriptions).toBe(0)
    act(() => observers[0]!.callback([{ isIntersecting: true }]))
    expect(subscriptions).toBe(1)
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    void act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(disposers[0]).toHaveBeenCalledTimes(1)
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    void act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(subscriptions).toBe(2)
    act(() => view.unmount())
    setup.nexus.destroy()
    vi.unstubAllGlobals()
  })

  it('shares the outer registered shell between the caller ref and visibility observer', () => {
    let observed: Element | undefined
    const disconnect = vi.fn()
    class MockIntersectionObserver {
      observe(target: Element) {
        observed = target
      }
      disconnect = disconnect
    }
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
    const callerRef = createRef<HTMLDivElement>()
    const setup = withList(
      createElement(SparklineDashlet, {
        ref: callerRef,
        id: 'spark-object-ref',
        label: 'Requests',
        source: () => undefined,
      }),
    )
    const view = render(setup.element)
    const shell = view.root.findByProps({ 'data-picodash-dashlet': 'spark-object-ref' }).element

    expect(shell.getAttribute('role')).toBe('listitem')
    expect(callerRef.current).toBe(shell)
    expect(observed).toBe(shell)
    expect(
      view.root.element.querySelectorAll('[data-picodash-dashlet="spark-object-ref"]'),
    ).toHaveLength(1)

    act(() => view.unmount())
    expect(callerRef.current).toBeNull()
    expect(disconnect).toHaveBeenCalledOnce()
    setup.nexus.destroy()
    vi.unstubAllGlobals()
  })

  it('cleans up replaced callback refs without duplicating observers or source subscriptions', () => {
    const observerCallbacks: Array<(entries: Array<{ isIntersecting: boolean }>) => void> = []
    const disconnect = vi.fn()
    class MockIntersectionObserver {
      constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void) {
        observerCallbacks.push(callback)
      }
      observe() {}
      disconnect = disconnect
    }
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
    const firstCleanup = vi.fn()
    const secondCleanup = vi.fn()
    const firstRef = vi.fn((element: HTMLDivElement | null) =>
      element === null ? undefined : firstCleanup,
    )
    const secondRef = vi.fn((element: HTMLDivElement | null) =>
      element === null ? undefined : secondCleanup,
    )
    const disposer = vi.fn()
    const source = vi.fn(() => disposer)
    const setup = withList(
      createElement(SparklineDashlet, {
        ref: firstRef,
        id: 'spark-callback-ref',
        label: 'Latency',
        source,
      }),
    )
    const renderSparkline = (ref: Ref<HTMLDivElement>) =>
      createElement(
        DashList,
        { id: 'charts', nexus: setup.nexus },
        createElement(SparklineDashlet, {
          ref,
          id: 'spark-callback-ref',
          label: 'Latency',
          source,
        }),
      )
    const view = render(setup.element)
    const shell = view.root.findByProps({ 'data-picodash-dashlet': 'spark-callback-ref' }).element
    expect(firstRef).toHaveBeenCalledOnce()
    expect(firstRef).toHaveBeenCalledWith(shell)
    expect(observerCallbacks).toHaveLength(1)

    act(() => observerCallbacks[0]!([{ isIntersecting: true }]))
    expect(source).toHaveBeenCalledOnce()

    act(() => view.update(renderSparkline(secondRef)))
    expect(firstCleanup).toHaveBeenCalledOnce()
    expect(firstRef).toHaveBeenCalledOnce()
    expect(secondRef).toHaveBeenCalledOnce()
    expect(secondRef).toHaveBeenCalledWith(shell)
    expect(observerCallbacks).toHaveLength(1)
    expect(source).toHaveBeenCalledOnce()
    expect(disconnect).not.toHaveBeenCalled()

    act(() => view.unmount())
    expect(secondCleanup).toHaveBeenCalledOnce()
    expect(secondRef).toHaveBeenCalledOnce()
    expect(disposer).toHaveBeenCalledOnce()
    expect(disconnect).toHaveBeenCalledOnce()
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
