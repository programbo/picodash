// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it } from 'vite-plus/test'
import { Controls, createSettings } from './Controls.js'

it('packed controls update the application selector using the same Nexus and React', () => {
  const nexus = createSettings()
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    act(() => root.render(createElement(Controls, { nexus })))
    expect(container.querySelector('output')?.textContent).toBe('On')
    const toggle = container.querySelector('input[type="checkbox"]')
    if (!(toggle instanceof HTMLInputElement)) throw new Error('Missing switch input')
    act(() => toggle.click())
    expect(container.querySelector('output')?.textContent).toBe('Off')
  } finally {
    act(() => root.unmount())
    container.remove()
    nexus.destroy()
  }
})
