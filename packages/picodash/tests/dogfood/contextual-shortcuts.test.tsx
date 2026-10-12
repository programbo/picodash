// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vite-plus/test'
import { createSettings } from './Shortcuts.js'
import { ContextualControls } from './ContextualShortcuts.js'

it('consumer records reusable group shortcuts, retains drafts and restores both preferences after reload', async () => {
  localStorage.clear()
  vi.stubGlobal('matchMedia', (media: string) => ({
    matches: true,
    media,
    addEventListener() {},
    removeEventListener() {},
  }))
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => setTimeout(() => fn(0), 0))
  vi.stubGlobal('cancelAnimationFrame', clearTimeout)
  let nexus = createSettings()
  const settle = () =>
    act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30))
    })
  const button = (name: string) => screen.getByRole('button', { name })
  const key = (value: string, code: string) => {
    const target = document.activeElement ?? document.body
    const options = { key: value, code, ctrlKey: value.length === 1, shiftKey: value.length === 1 }
    fireEvent.keyDown(target, options)
    fireEvent.keyUp(target, options)
  }
  const record = (name: string, value: string, code: string) => {
    const b = button(`Record shortcut for ${name}`)
    act(() => b.focus())
    fireEvent.click(b)
    key(value, code)
  }
  try {
    render(<ContextualControls nexus={nexus} />)
    await settle()
    record('Geometry', 'k', 'KeyK')
    record('group Geometry tools', 'g', 'KeyG')
    record('group Output tools', 'g', 'KeyG')
    expect(button('Record shortcut for group Output tools').getAttribute('aria-pressed')).toBe(
      'false',
    )
    const draft = screen.getByRole('textbox', { name: 'Geometry draft' }) as HTMLInputElement
    fireEvent.change(draft, { target: { value: 'unfinished -' } })
    act(() => button('Record shortcut for group Geometry tools').focus())
    key('g', 'KeyG')
    await settle()
    expect(screen.getByRole('complementary', { name: 'Geometry tools' }).contains(draft)).toBe(true)
    expect(screen.queryByRole('complementary', { name: 'Output tools' })).toBeNull()
    fireEvent.click(button('Return Geometry tools to stack'))
    await settle()
    expect(screen.getByRole('textbox', { name: 'Geometry draft' })).toBe(draft)
    expect(draft.value).toBe('unfinished -')
    key('k', 'KeyK')
    expect(screen.queryByRole('complementary', { name: 'Geometry' })).toBeNull()
    key('k', 'KeyK')
    await settle()
    expect(screen.getByRole('complementary', { name: 'Geometry' })).toBeTruthy()
    cleanup()
    await settle()
    nexus.destroy()
    nexus = createSettings()
    render(<ContextualControls nexus={nexus} />)
    await settle()
    expect(button('Record shortcut for Geometry').textContent).toContain('K')
    expect(button('Record shortcut for group Geometry tools').textContent).toContain('G')
    expect(button('Record shortcut for group Output tools').textContent).toContain('G')
    record('group Geometry tools', 'Backspace', 'Backspace')
    expect(button('Record shortcut for group Geometry tools').textContent).not.toContain('G')
  } finally {
    cleanup()
    await settle()
    nexus.destroy()
    vi.unstubAllGlobals()
    localStorage.clear()
  }
})
