// @vitest-environment jsdom
// Also used unchanged to grade a fresh consumer implementation of Shortcuts.tsx.
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it } from 'vite-plus/test'
import { Controls, createSettings } from './Shortcuts.js'

it('consumer completes bound controls and retained, persistent panel shortcuts', () => {
  localStorage.clear()
  let nexus = createSettings()
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const button = (name: string) => {
    const node = document.querySelector(`button[aria-label="${name}"]`)
    if (!(node instanceof HTMLButtonElement)) throw new Error(`Missing ${name}`)
    return node
  }
  const key = (key: string, code: string, modifiers = {}) => {
    act(() => {
      document.activeElement?.dispatchEvent(
        new KeyboardEvent('keydown', { key, code, bubbles: true, ...modifiers }),
      )
    })
    act(() => {
      document.activeElement?.dispatchEvent(
        new KeyboardEvent('keyup', { key, code, bubbles: true, ...modifiers }),
      )
    })
  }
  try {
    act(() => root.render(createElement(Controls, { nexus })))
    const value = () =>
      document.querySelector('output[aria-label="Application value"]')?.textContent
    expect(value()).toBe('On')
    const toggle = document.querySelector('input[type="checkbox"]')
    if (!(toggle instanceof HTMLInputElement)) throw new Error('Missing Enabled switch')
    act(() => toggle.click())
    expect(value()).toBe('Off')
    const draft = document.querySelector('input[aria-label="Draft name"]')
    if (!(draft instanceof HTMLInputElement)) throw new Error('Missing draft input')
    draft.value = 'Unsaved name'
    act(() => {
      const b = button('Record shortcut for Inspector')
      b.focus()
      b.click()
    })
    key('k', 'KeyK', { ctrlKey: true, shiftKey: true })
    key('k', 'KeyK', { ctrlKey: true, shiftKey: true })
    expect(button('Reveal panel Inspector').disabled).toBe(false)
    key('k', 'KeyK', { ctrlKey: true, shiftKey: true })
    expect(document.querySelector('input[aria-label="Draft name"]')).toBe(draft)
    expect(draft.value).toBe('Unsaved name')
    act(() => root.render(null))
    nexus.destroy()
    nexus = createSettings()
    act(() => root.render(createElement(Controls, { nexus })))
    expect(button('Record shortcut for Inspector').textContent).toContain('K')
    act(() => {
      const b = button('Record shortcut for Inspector')
      b.focus()
      b.click()
    })
    key('Backspace', 'Backspace')
    expect(button('Record shortcut for Inspector').textContent).not.toContain('K')
  } finally {
    act(() => root.unmount())
    host.remove()
    nexus.destroy()
    localStorage.clear()
  }
})
