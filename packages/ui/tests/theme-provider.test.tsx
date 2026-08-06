import { createElement, type ComponentType, type ReactElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vite-plus/test'
import {
  PicodashThemeProvider,
  usePicodashDensity,
  usePicodashTheme,
  type PicodashThemeProviderProps,
} from '../src/index.tsx'

const ThemeProvider = PicodashThemeProvider as ComponentType<PicodashThemeProviderProps<string>>

function Probe() {
  return createElement(
    'output',
    { 'data-density': usePicodashDensity(), 'data-theme': usePicodashTheme() },
    `${usePicodashTheme()}/${usePicodashDensity()}`,
  )
}

function carrier(renderer: ReactTestRenderer, theme: string) {
  return renderer.root.findByProps({ 'data-picodash-theme': theme })
}

function render(element: ReactElement) {
  let renderer!: ReactTestRenderer
  act(() => {
    renderer = create(element)
  })
  return renderer
}

function provider(
  props: Omit<PicodashThemeProviderProps<string>, 'children'>,
  children: ReactElement,
) {
  return createElement(ThemeProvider, { ...props, children })
}

describe('@picodash/ui theme and density provider', () => {
  it('uses standalone system and regular defaults without a Provider', () => {
    const matchMedia = vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
    vi.stubGlobal('window', { matchMedia })

    const renderer = render(createElement(Probe))
    expect(renderer.root.findByType('output').props).toMatchObject({
      'data-density': 'regular',
      'data-theme': 'light',
    })
    expect(matchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)')
    act(() => renderer.unmount())
    vi.unstubAllGlobals()
  })

  it('renders one display-contents carrier with both resolved attributes', () => {
    const renderer = render(provider({ theme: 'dark', density: 'compact' }, createElement(Probe)))
    const root = carrier(renderer, 'dark')
    expect(root.props['data-picodash-density']).toBe('compact')
    expect(root.props.style).toEqual({ display: 'contents' })
    expect(root.findByType('output').props).toMatchObject({
      'data-density': 'compact',
      'data-theme': 'dark',
    })
    act(() => renderer.unmount())
  })

  it('inherits each axis independently through nested Providers', () => {
    const renderer = render(
      provider(
        { theme: 'light', density: 'compact' },
        provider({ theme: 'dark' }, provider({ density: 'regular' }, createElement(Probe))),
      ),
    )
    const carriers = renderer.root.findAll(
      (node) => node.props['data-picodash-theme'] !== undefined,
    )
    expect(
      carriers.map((node) => [
        node.props['data-picodash-theme'],
        node.props['data-picodash-density'],
      ]),
    ).toEqual([
      ['light', 'compact'],
      ['dark', 'compact'],
      ['dark', 'regular'],
    ])
    act(() => renderer.unmount())
  })

  it('subscribes to system changes and cleans up the matchMedia listener', () => {
    let matches = false
    const listeners = new Set<(event: MediaQueryListEvent) => void>()
    const query = {
      get matches() {
        return matches
      },
      addEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.add(listener)
      }),
      removeEventListener: vi.fn(
        (_type: string, listener: (event: MediaQueryListEvent) => void) => {
          listeners.delete(listener)
        },
      ),
    }
    const matchMedia = vi.fn(() => query)
    vi.stubGlobal('window', { matchMedia })

    const renderer = render(provider({ theme: 'system' }, createElement(Probe)))
    expect(carrier(renderer, 'light')).toBeDefined()
    expect(query.addEventListener).toHaveBeenCalledTimes(1)

    act(() => {
      matches = true
      for (const listener of listeners) listener(new Event('change') as MediaQueryListEvent)
    })
    expect(carrier(renderer, 'dark')).toBeDefined()

    act(() => renderer.unmount())
    expect(query.removeEventListener).toHaveBeenCalledTimes(1)
    expect(listeners.size).toBe(0)
    vi.unstubAllGlobals()
  })

  it('does not subscribe to matchMedia for an explicit theme', () => {
    const matchMedia = vi.fn()
    vi.stubGlobal('window', { matchMedia })
    const renderer = render(provider({ theme: 'light' }, createElement(Probe)))
    expect(matchMedia).not.toHaveBeenCalled()
    act(() => renderer.unmount())
    vi.unstubAllGlobals()
  })
})
