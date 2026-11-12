// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { dockDashPanelRect } from '../geometry/placement-geometry.ts'
import { measurePanelSizing } from './panel-size-measurement.ts'

afterEach(() => {
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

describe('Panel natural measurement', () => {
  it('keeps natural placement size independent of a temporary dock allocation cap', () => {
    const panel = document.createElement('aside')
    panel.innerHTML =
      '<div data-picodash-panel-surface><div data-slot="dash-header"></div><div data-picodash-panel-scroll-frame><div data-picodash-panel-body><div data-picodash-panel-content>Content</div></div></div></div>'
    const header = panel.querySelector('[data-slot="dash-header"]')
    const body = panel.querySelector('[data-picodash-panel-body]')
    document.body.append(panel)
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      if (this === panel) return new DOMRect(0, 0, 320, 450)
      if (this === header)
        return new DOMRect(0, 0, this.style.inlineSize === 'min-content' ? 100 : 320, 45)
      if (this === body) return new DOMRect(0, 45, 320, 405)
      return new DOMRect(0, 45, 320, 405)
    })
    const result = measurePanelSizing(panel, { width: 800, height: 600 }, {}, undefined, 45, {
      height: 200,
    })
    expect(result.sizing.resolved.height).toBe(200)
    expect(result.unallocatedSize.height).toBe(450)
    const boundary = { left: 0, top: 0, right: 800, bottom: 600 }
    const heights = [400, 200, 400].map(
      (allocation) =>
        dockDashPanelRect('bottom-left', boundary, result.unallocatedSize, { allocation }).height,
    )
    expect(heights).toEqual([400, 200, 400])
  })

  it('measures full horizontal docks at their allocated width without changing preferred width', () => {
    const panel = document.createElement('aside')
    panel.innerHTML =
      '<div data-picodash-panel-surface><div data-slot="dash-header"></div><div data-picodash-panel-scroll-frame><div data-picodash-panel-body><div data-picodash-panel-content>Content</div></div></div></div>'
    const header = panel.querySelector('[data-slot="dash-header"]')
    const body = panel.querySelector('[data-picodash-panel-body]')
    document.body.append(panel)
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      const width = panel.style.inlineSize === '400px' ? 400 : 320
      const contentHeight = width === 400 ? 100 : 200
      if (this === panel) return new DOMRect(0, 0, width, contentHeight + 45)
      if (this === header)
        return new DOMRect(0, 0, this.style.inlineSize === 'min-content' ? 100 : width, 45)
      if (this === body) return new DOMRect(0, 45, width, contentHeight)
      return new DOMRect(0, 45, width, contentHeight)
    })
    const result = measurePanelSizing(
      panel,
      { width: 800, height: 600 },
      {},
      undefined,
      45,
      { width: 400 },
      400,
    )
    expect(result.sizing.preferred).toEqual({ width: 320, height: 145 })
    expect(result.sizing.measurements?.content).toEqual({ width: 400, height: 100 })
  })

  it('resolves percentage preferred height against the effective boundary rather than a taller portal', () => {
    const portal = document.createElement('div')
    portal.style.height = '1000px'
    const panel = document.createElement('aside')
    panel.innerHTML =
      '<div data-picodash-panel-surface><div data-slot="dash-header"></div><div data-picodash-panel-scroll-frame><div data-picodash-panel-body><div data-picodash-panel-content>Content</div></div></div></div>'
    const header = panel.querySelector('[data-slot="dash-header"]')
    const body = panel.querySelector('[data-picodash-panel-body]')
    portal.append(panel)
    document.body.append(portal)
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      if (this === portal) return new DOMRect(0, 0, 800, 1000)
      if (this === panel) {
        const height = panel.style.blockSize.endsWith('%')
          ? Number.parseFloat(panel.style.blockSize) * 10
          : 217
        return new DOMRect(0, 0, 320, height)
      }
      if (this === header)
        return new DOMRect(0, 0, this.style.inlineSize === 'min-content' ? 100 : 320, 45)
      if (this === body) return new DOMRect(0, 45, 320, 172)
      return new DOMRect(0, 45, 320, 172)
    })
    const result = measurePanelSizing(
      panel,
      { width: 800, height: 200 },
      { height: '50%' },
      undefined,
      45,
    )
    expect(result.sizing.preferred.height).toBe(100)
    expect(result.sizing.desired.height).toBe(100)
    expect(result.sizing.resolved.height).toBe(100)
  })

  it('excludes owned dock FLIP scale from every shell/content metric and restores the transform', () => {
    const panel = document.createElement('aside')
    panel.setAttribute('data-picodash-panel', '')
    panel.setAttribute('data-picodash-dock-allocation-motion', 'true')
    panel.style.setProperty('transform', 'translate3d(0, 120px, 0) scale(1, 0.2)', 'important')
    panel.style.maxBlockSize = '45px'
    const header = document.createElement('div')
    header.dataset.slot = 'dash-header'
    const body = document.createElement('div')
    body.setAttribute('data-picodash-panel-body', '')
    const content = document.createElement('div')
    content.setAttribute('data-picodash-panel-content', '')
    content.textContent = 'Retained application content'
    body.append(content)
    const surface = document.createElement('div')
    surface.setAttribute('data-picodash-panel-surface', '')
    const frame = document.createElement('div')
    frame.setAttribute('data-picodash-panel-scroll-frame', '')
    frame.append(body)
    surface.append(header, frame)
    panel.append(surface)
    document.body.append(panel)
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      const scale = panel.style.transform.includes('scale(') ? 0.2 : 1
      if (this === panel) return new DOMRect(0, 0, 320, 217 * scale)
      if (this === header)
        return new DOMRect(0, 0, this.style.inlineSize === 'min-content' ? 100 : 320, 45 * scale)
      return new DOMRect(0, 45 * scale, 320, 172 * scale)
    })
    const result = measurePanelSizing(panel, { width: 800, height: 600 }, {}, undefined, 45)
    expect(result.sizing.preferred).toEqual({ width: 320, height: 217 })
    expect(result.sizing.resolved).toEqual({ width: 320, height: 217 })
    expect(result.sizing.measurements?.content.height).toBe(172)
    expect(panel.style.transform).toBe('translate3d(0, 120px, 0) scale(1, 0.2)')
    expect(panel.style.getPropertyPriority('transform')).toBe('important')
    expect(panel.style.maxBlockSize).toBe('45px')
    expect(panel.getAttribute('data-picodash-dock-allocation-motion')).toBe('true')
  })
})
