// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it } from 'vite-plus/test'
import { createGroupedSettings, GroupedControls } from './GroupedControls.js'

it('registers a custom root group and keeps its pinned control bound', () => {
  const nexus = createGroupedSettings()
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    act(() => root.render(createElement(GroupedControls, { nexus })))
    const group = container.querySelector('[data-picodash-dashgroup="drive"]')
    const toggle = group?.querySelector('input[type="checkbox"]')
    if (!(toggle instanceof HTMLInputElement)) throw new Error('Missing grouped switch')
    expect(container.querySelectorAll('[data-picodash-dashgroup="drive"]')).toHaveLength(1)
    expect(container.querySelector('[data-picodash-dashgroup="mechanical-roles"]')).not.toBeNull()
    act(() => toggle.click())
    expect(nexus.getState().values.enabled).toBe(false)
  } finally {
    act(() => root.unmount())
    container.remove()
    nexus.destroy()
  }
})
