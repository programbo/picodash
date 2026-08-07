import type { RefObject } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { resolveDashPanelBoundary, type DashPanelBoundaryInset } from './boundary.ts'

class MockHtmlElement {
  getBoundingClientRect(): never {
    throw new Error('boundary resolver must not measure')
  }
}

class MockSvgElement {
  getBoundingClientRect(): never {
    throw new Error('boundary resolver must not measure')
  }
}

beforeEach(() => {
  vi.stubGlobal('Element', MockHtmlElement)
  vi.stubGlobal('SVGElement', MockSvgElement)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const htmlElement = () => new MockHtmlElement() as unknown as Element
const svgElement = () => new MockSvgElement() as unknown as Element
const ref = (current: Element | null): RefObject<Element | null> => ({ current })

describe('DashPanel boundary references', () => {
  it('resolves direct HTML and SVG Elements by identity without measuring', () => {
    const html = htmlElement()
    const svg = svgElement()
    expect(resolveDashPanelBoundary(html)).toBe(html)
    expect(resolveDashPanelBoundary(svg)).toBe(svg)
  })

  it('gives a direct panel Element precedence over an invalid provider', () => {
    const panel = htmlElement()
    expect(resolveDashPanelBoundary(panel, 'nearest-panel' as never)).toBe(panel)
  })

  it('uses explicit panel null as viewport and bypasses an invalid provider', () => {
    expect(resolveDashPanelBoundary(null, [] as never)).toBeNull()
  })

  it('falls through omitted or unresolved panel refs to the provider', () => {
    const provider = svgElement()
    const panelRef = ref(null)
    expect(resolveDashPanelBoundary(undefined, provider)).toBe(provider)
    expect(resolveDashPanelBoundary(panelRef, provider)).toBe(provider)
    panelRef.current = htmlElement()
    expect(resolveDashPanelBoundary(panelRef, provider)).toBe(panelRef.current)
    panelRef.current = null
    expect(resolveDashPanelBoundary(panelRef, provider)).toBe(provider)
  })

  it('resolves live provider refs and returns null for omitted, null, or unresolved providers', () => {
    const providerRef = ref(htmlElement())
    expect(resolveDashPanelBoundary(undefined, providerRef)).toBe(providerRef.current)
    providerRef.current = svgElement()
    expect(resolveDashPanelBoundary(undefined, providerRef)).toBe(providerRef.current)
    providerRef.current = null
    expect(resolveDashPanelBoundary(undefined, providerRef)).toBeNull()
    expect(resolveDashPanelBoundary(undefined, null)).toBeNull()
    expect(resolveDashPanelBoundary(undefined)).toBeNull()
  })

  it('rejects invalid boundaries and invalid current values synchronously', () => {
    const invalid: unknown[] = ['#panel', [], {}, 1, Symbol('boundary')]
    for (const value of invalid) {
      expect(() => resolveDashPanelBoundary(value as never)).toThrow(TypeError)
      expect(() => resolveDashPanelBoundary(undefined, value as never)).toThrow(TypeError)
    }
    expect(() => resolveDashPanelBoundary({ current: 'selector' } as never)).toThrow(TypeError)
    expect(() => resolveDashPanelBoundary(undefined, { current: {} } as never)).toThrow(TypeError)
    expect(() => resolveDashPanelBoundary({} as never)).toThrow(TypeError)
    expect(() => resolveDashPanelBoundary(undefined, { current: undefined } as never)).toThrow(
      TypeError,
    )
  })

  it('does not measure or mutate boundary refs', () => {
    const panel = htmlElement()
    const provider = svgElement()
    const panelRef = ref(panel)
    const providerRef = ref(provider)
    const result = resolveDashPanelBoundary(panelRef, providerRef)
    expect(result).toBe(panel)
    expect(panelRef.current).toBe(panel)
    expect(providerRef.current).toBe(provider)
  })

  it('keeps the public inset tuple vocabulary distinct from boundary resolution', () => {
    const scalar: DashPanelBoundaryInset = 8
    const pair: DashPanelBoundaryInset = [8, 16]
    const triple: DashPanelBoundaryInset = [1, 2, 3]
    const quad: DashPanelBoundaryInset = [1, 2, 3, 4]
    void scalar
    void pair
    void triple
    void quad
  })
})
