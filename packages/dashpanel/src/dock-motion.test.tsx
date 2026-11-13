// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vite-plus/test'
import { animate } from 'motion/mini'
import { createPicodashNexus } from '@picodash/nexus'
import { DashPanel, DashPanelProvider } from './index.tsx'

// jsdom has no WAAPI timeline. Capture only the decision to start a dock animation.
vi.mock('motion/mini', () => ({ animate: vi.fn(() => ({ cancel: vi.fn() })) }))

it('starts dock motion only after a positioned baseline exists', async () => {
  const nexus = createPicodashNexus({ valueOwner: 'nexus', fields: {} })
  nexus.scope('inspector').setDashPanelLayout({
    version: 2,
    placement: { mode: 'hybrid', disposition: { kind: 'docked', position: 'top-right' } },
    preferredPosition: { x: 0, y: 0 },
  })
  const container = document.createElement('div')
  const boundary = document.createElement('main')
  const boundaryRef: { current: Element | null } = { current: null }
  const style = document.createElement('style')
  style.textContent = '[data-picodash-panel] { --picodash-duration-fast: 150ms; }'
  document.head.append(style)
  document.body.append(container, boundary)
  const root = createRoot(container)
  let boundaryHeight = 600
  const rect = vi
    .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockImplementation(function (this: HTMLElement) {
      if (this === boundary) return new DOMRect(0, 0, 1000, boundaryHeight)
      if (this.hasAttribute('data-picodash-panel')) {
        const left = Number.parseFloat(this.style.left) || 0
        const top = this.style.top ? Number.parseFloat(this.style.top) : 700
        const cap = Number.parseFloat(this.style.maxBlockSize)
        return new DOMRect(left, top, 80, Number.isFinite(cap) ? Math.min(300, cap) : 300)
      }
      return new DOMRect()
    })
  try {
    await act(async () =>
      root.render(
        <DashPanelProvider nexus={nexus} boundary={boundaryRef}>
          <DashPanel id="inspector" title="Inspector" />
        </DashPanelProvider>,
      ),
    )
    expect(animate).not.toHaveBeenCalled()
    boundaryRef.current = boundary
    await act(async () => window.dispatchEvent(new Event('resize')))
    expect(animate).not.toHaveBeenCalled()
    boundaryHeight = 300
    await act(async () => boundary.dispatchEvent(new Event('transitionend')))
    expect(animate).toHaveBeenCalledTimes(1)
  } finally {
    await act(async () => root.unmount())
    rect.mockRestore()
    vi.clearAllMocks()
    container.remove()
    boundary.remove()
    style.remove()
    nexus.destroy()
  }
})
