// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vite-plus/test'
import { Detachable } from './Detachable.js'
import { createSettings } from './Controls.js'

it('packed integration preserves one bound control between hosts', async () => {
  vi.stubGlobal('matchMedia', (media: string) => ({
    media,
    matches: true,
    addEventListener() {},
    removeEventListener() {},
  }))
  const nexus = createSettings()
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const click = (name: string) => {
    const button = document.querySelector(`[aria-label="${name}"]`)
    if (!(button instanceof HTMLButtonElement)) throw new Error(`Missing ${name}`)
    act(() => button.click())
  }
  try {
    act(() => root.render(createElement(Detachable, { nexus })))
    const toggle = container.querySelector('input[type="checkbox"]')
    if (!(toggle instanceof HTMLInputElement)) throw new Error('Missing switch')
    click('Detach group Behavior')
    expect(document.querySelector('aside[aria-label="Behavior"]')?.contains(toggle)).toBe(true)
    act(() => toggle.click())
    expect(nexus.getState().values.enabled).toBe(false)
    click('Return Behavior to stack')
    expect(container.contains(toggle)).toBe(true)
    expect(document.querySelectorAll('input[type="checkbox"]')).toHaveLength(1)
  } finally {
    act(() => root.unmount())
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    container.remove()
    nexus.destroy()
    vi.unstubAllGlobals()
  }
})
