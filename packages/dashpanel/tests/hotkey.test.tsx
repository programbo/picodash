// @vitest-environment jsdom
import { act, createElement } from 'react'
import { describe, expect, it } from 'vite-plus/test'
import { createDomTestRenderer } from '../../../test/dom-renderer.ts'
import { createPicodashNexus } from '@picodash/nexus'
import { DashPanel, DashPanelProvider } from '../src/index.tsx'
import { panelHotkeyError } from '../src/panel-hotkey.tsx'

function key(key: string, code: string, options: KeyboardEventInit = {}) {
  const target = document.activeElement ?? document.body
  act(() => {
    target.dispatchEvent(
      new KeyboardEvent('keydown', { key, code, bubbles: true, cancelable: true, ...options }),
    )
  })
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keyup', { key, code, bubbles: true, ...options }))
  })
}

describe('recordable docked panel shortcuts', () => {
  it('records, rejects conflicts, cancels, toggles once, ignores editors and clears without resetting layout', () => {
    const nexus = createPicodashNexus({ valueOwner: 'nexus', fields: { n: { defaultValue: 0 } } })
    let renderer: ReturnType<typeof createDomTestRenderer> | undefined
    act(() => {
      renderer = createDomTestRenderer(
        createElement(
          DashPanelProvider,
          { nexus, children: null },
          ...['one', 'two'].map((id) =>
            createElement(
              DashPanel,
              {
                id,
                key: id,
                title: id,
                recordableHotkey: true,
                collapsible: true,
                defaultLayout: {
                  placement: {
                    mode: 'fixed',
                    disposition: {
                      kind: 'docked',
                      position: id === 'one' ? 'full-left' : 'full-right',
                    },
                  },
                },
              },
              createElement('input', { 'aria-label': `Edit ${id}` }),
            ),
          ),
        ),
      )
    })
    const button = (name: string) =>
      document.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`)!
    const record = (id: string) =>
      act(() => {
        const b = button(`Record shortcut for ${id}`)
        b.focus()
        b.click()
      })
    try {
      record('one')
      const live = document.getElementById(
        button('Record shortcut for one').getAttribute('aria-describedby')!.split(' ')[0]!,
      )
      expect(live?.getAttribute('role')).toBe('status')
      expect(live?.textContent).toContain('Escape cancels')
      key('k', 'KeyK', { ctrlKey: true, shiftKey: true })
      const binding = nexus.scope('one').getState().scope?.dashPanelHotkey
      expect(binding).toMatch(/\[KeyK\]/)
      expect(live?.textContent).toContain('Shortcut set')
      expect(button('Record shortcut for one').getAttribute('aria-pressed')).toBe('false')
      record('two')
      key('k', 'KeyK', { ctrlKey: true, shiftKey: true })
      expect(nexus.scope('two').getState().scope?.dashPanelHotkey).toBeUndefined()
      expect(document.body.textContent).toContain('already in use')
      key('Escape', 'Escape')
      record('one')
      key('r', 'KeyR', { ctrlKey: true })
      expect(nexus.scope('one').getState().scope?.dashPanelHotkey).toBe(binding)
      key('Escape', 'Escape')
      act(() => button('Record shortcut for one').blur())
      key('k', 'KeyK', { ctrlKey: true, shiftKey: true })
      expect(button('Reveal panel one').disabled).toBe(false)
      key('k', 'KeyK', { ctrlKey: true, shiftKey: true, repeat: true })
      expect(button('Reveal panel one').disabled).toBe(false)
      key('k', 'KeyK', { ctrlKey: true, shiftKey: true })
      expect(button('Reveal panel one').disabled).toBe(true)
      const input = document.querySelector<HTMLInputElement>('input[aria-label="Edit one"]')!
      act(() => input.focus())
      key('k', 'KeyK', { ctrlKey: true, shiftKey: true })
      expect(button('Reveal panel one').disabled).toBe(true)
      act(() => input.blur())
      const modal = document.createElement('div')
      modal.setAttribute('aria-modal', 'true')
      document.body.append(modal)
      key('k', 'KeyK', { ctrlKey: true, shiftKey: true })
      expect(button('Reveal panel one').disabled).toBe(true)
      modal.remove()
      // A duplicate arriving from persistence must not toggle either panel.
      act(() => {
        nexus.scope('two').setDashPanelHotkey(binding ?? null)
      })
      key('k', 'KeyK', { ctrlKey: true, shiftKey: true })
      expect(button('Reveal panel one').disabled).toBe(true)
      expect(button('Reveal panel two').disabled).toBe(true)
      act(() => {
        nexus.scope('two').setDashPanelHotkey(null)
      })
      act(() => button('Close panel one').click())
      key('k', 'KeyK', { ctrlKey: true, shiftKey: true })
      expect(button('Minimize panel one').closest('aside')?.hidden).toBe(false)
      record('one')
      key('Backspace', 'Backspace')
      expect(nexus.scope('one').getState().scope?.dashPanelHotkey).toBeUndefined()
    } finally {
      act(() => renderer?.unmount())
    }
  })
  it.each(['K', 'Shift+K', 'Mod+R', 'Alt+F4', 'Control+Tab', 'nonsense'])(
    'rejects unsafe binding %s',
    (binding) => {
      expect(panelHotkeyError(binding)).toBeDefined()
    },
  )
  it('accepts an intentional modifier chord', () => {
    expect(panelHotkeyError('Mod+Shift+[KeyK]')).toBeUndefined()
  })
})

it.each(['floating', 'fixed'] as const)(
  'toggles a close-only %s panel, restores focus, and keeps its draft',
  async (mode) => {
    const nexus = createPicodashNexus({ valueOwner: 'nexus', fields: {} })
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()
    let renderer: ReturnType<typeof createDomTestRenderer> | undefined
    act(() => {
      renderer = createDomTestRenderer(
        <DashPanelProvider nexus={nexus}>
          <DashPanel
            id="closer"
            title="Closer"
            collapsible={false}
            showCloseButton
            recordableHotkey
            defaultLayout={{
              placement:
                mode === 'floating'
                  ? { mode: 'floating', disposition: { kind: 'free' } }
                  : { mode: 'fixed', disposition: { kind: 'docked', position: 'full-right' } },
            }}
          >
            <input aria-label="Close-only draft" defaultValue="unfinished" />
          </DashPanel>
        </DashPanelProvider>,
      )
    })
    const recorder = document.querySelector<HTMLButtonElement>(
      '[aria-label="Record shortcut for Closer"]',
    )!
    const input = document.querySelector<HTMLInputElement>('[aria-label="Close-only draft"]')!
    const panel = input.closest('aside')!
    try {
      expect(recorder.closest('[hidden]')).toBeNull()
      act(() => {
        recorder.focus()
        recorder.click()
      })
      key('k', 'KeyK', { ctrlKey: true, shiftKey: true })
      input.value = 'unfinished -'
      act(() => opener.focus())
      key('k', 'KeyK', { ctrlKey: true, shiftKey: true })
      expect(panel.hidden).toBe(true)
      expect(document.activeElement).toBe(opener)
      key('k', 'KeyK', { ctrlKey: true, shiftKey: true })
      await act(async () => {
        await Promise.resolve()
      })
      expect(panel.hidden).toBe(false)
      expect(panel.contains(document.activeElement)).toBe(true)
      expect(document.querySelector('[aria-label="Close-only draft"]')).toBe(input)
      expect(input.value).toBe('unfinished -')
      act(() =>
        document.querySelector<HTMLButtonElement>('[aria-label="Close panel Closer"]')!.click(),
      )
      expect(panel.hidden).toBe(true)
      key('k', 'KeyK', { ctrlKey: true, shiftKey: true })
      await act(async () => {
        await Promise.resolve()
      })
      expect(panel.hidden).toBe(false)
    } finally {
      act(() => renderer?.unmount())
      opener.remove()
      nexus.destroy()
    }
  },
)
