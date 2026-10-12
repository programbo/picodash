// @vitest-environment jsdom
import { createRef, useState, StrictMode, type RefObject } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vite-plus/test'
import { createPicodashNexus } from '@picodash/nexus'
import { getDashStackStructure, revealDashlet } from '@picodash/dashstack'
import { PicodashProvider, DashPanel, DashStack, DashGroup, Dashlet } from '../src/index.js'
import { transitionGroup } from '../src/detachable-state.js'

let mediaChange: (() => void) | undefined
let desktop = true
beforeEach(() => {
  desktop = true
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return query.includes('min-width') ? desktop : true
    },
    media: query,
    addEventListener: (_: string, fn: () => void) => {
      if (query.includes('min-width')) mediaChange = fn
    },
    removeEventListener: () => {},
  }))
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => setTimeout(() => fn(0), 0))
  vi.stubGlobal('cancelAnimationFrame', clearTimeout)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
const flush = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20))
  })
}
function Draft({ inputRef }: { inputRef: RefObject<HTMLInputElement | null> }) {
  const [value, setValue] = useState('draft')
  return (
    <input
      ref={inputRef}
      aria-label="Unfinished value"
      value={value}
      onChange={(e) => setValue(e.target.value)}
    />
  )
}
function fixture(collapsed = false) {
  const inputRef = createRef<HTMLInputElement>()
  const nexus = createPicodashNexus({ valueOwner: 'nexus', fields: { value: { defaultValue: 4 } } })
  const view = (show = true) => (
    <PicodashProvider nexus={nexus}>
      <DashStack id="tools">
        {show ? (
          <DashGroup id="geometry" label="Geometry" detachable defaultCollapsed={collapsed}>
            <Dashlet id="value" label="Value" primaryFocusRef={inputRef}>
              <Draft inputRef={inputRef} />
            </Dashlet>
          </DashGroup>
        ) : null}
        <Dashlet id="next" label="Next">
          <input aria-label="Next field" />
        </Dashlet>
      </DashStack>
    </PicodashProvider>
  )
  return { nexus, view }
}
it('retains one editor, its draft, logical membership and values over repeated round trips', async () => {
  const { nexus, view } = fixture()
  const mounted = render(view())
  const editor = screen.getByRole('textbox', { name: 'Unfinished value' })
  fireEvent.change(editor, { target: { value: 'unfinished -' } })
  const before = nexus.getState().values
  fireEvent.click(screen.getByRole('button', { name: 'Detach group Geometry' }))
  await flush()
  const detached = screen.getByRole('complementary', { name: 'Geometry' })
  expect(detached.contains(editor)).toBe(true)
  expect(screen.getAllByRole('textbox', { name: 'Unfinished value' })).toHaveLength(1)
  expect(editor.getAttribute('value')).toBe('unfinished -')
  expect(
    getDashStackStructure(nexus.scope('tools')).nodes.find((n) => n.id === 'value'),
  ).toMatchObject({ parentId: 'geometry', visible: true })
  expect(nexus.getState().values).toEqual(before)
  expect(nexus.scope('tools').getState().scope?.dashStack?.rootOrder).toBeUndefined()
  fireEvent.click(screen.getByRole('button', { name: 'Return Geometry to stack' }))
  await flush()
  expect(screen.queryByRole('complementary', { name: 'Geometry' })).toBeNull()
  expect(screen.getByRole('textbox', { name: 'Unfinished value' })).toBe(editor)
  expect(editor.getAttribute('value')).toBe('unfinished -')
  expect(document.activeElement).toBe(
    screen.getByRole('button', { name: 'Collapse group Geometry' }),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Detach group Geometry' }))
  await flush()
  expect(screen.getByRole('complementary', { name: 'Geometry' }).contains(editor)).toBe(true)
  mounted.unmount()
  await flush()
  nexus.destroy()
})
it('keeps inline collapse preference, reveals detached controls and returns on unsupported viewport', async () => {
  const { nexus, view } = fixture(true)
  render(view())
  fireEvent.click(screen.getByRole('button', { name: 'Detach group Geometry' }))
  await flush()
  expect(screen.getByRole('textbox', { name: 'Unfinished value' })).toBeTruthy()
  expect(
    getDashStackStructure(nexus.scope('tools')).nodes.find((n) => n.id === 'geometry')?.collapsed,
  ).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Collapse panel Geometry' }))
  await flush()
  expect(
    getDashStackStructure(nexus.scope('tools')).nodes.find((n) => n.id === 'value')?.visible,
  ).toBe(false)
  let revealed: unknown
  await act(async () => {
    revealed = await revealDashlet(nexus.scope('tools'), 'value')
  })
  expect(revealed).toEqual({ ok: true })
  expect(
    nexus.scope('tools').getState().scope?.dashStack?.collapseOverrides.get('geometry'),
  ).toBeUndefined()
  act(() => {
    desktop = false
    mediaChange?.()
  })
  await flush()
  expect(screen.queryByRole('complementary', { name: 'Geometry' })).toBeNull()
  expect(screen.queryByRole('textbox', { name: 'Unfinished value' })).toBeNull()
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Expand group Geometry' }))
  act(() => {
    desktop = true
    mediaChange?.()
  })
  expect(screen.queryByRole('complementary', { name: 'Geometry' })).toBeNull()
  cleanup()
  await flush()
  nexus.destroy()
})
it('removes the detached host when its source group disappears', async () => {
  const { nexus, view } = fixture()
  const mounted = render(view())
  fireEvent.click(screen.getByRole('button', { name: 'Detach group Geometry' }))
  await flush()
  mounted.rerender(view(false))
  await flush()
  expect(screen.queryByRole('complementary', { name: 'Geometry' })).toBeNull()
  expect(getDashStackStructure(nexus.scope('tools')).nodes.map((n) => n.id)).toEqual(['next'])
  mounted.unmount()
  await flush()
  nexus.destroy()
})
it('explicit transitions cancel only provisional detachment and keep settled panels detached', () => {
  expect(transitionGroup('inline', 'pull')).toBe('detaching')
  expect(transitionGroup('detaching', 'cancel')).toBe('inline')
  expect(transitionGroup('detaching', 'settle')).toBe('detached')
  expect(transitionGroup('detached', 'enter-home')).toBe('return-preview')
  expect(transitionGroup('return-preview', 'cancel')).toBe('detached')
  expect(transitionGroup('return-preview', 'return')).toBe('inline')
  const returning = transitionGroup('detached', 'begin-return')
  expect(returning).toBe('returning')
  expect(transitionGroup(returning, 'enter-home')).toBe('returning')
  expect(transitionGroup(returning, 'return')).toBe('inline')
})

it('retains a pinned non-reorderable group through Strict Mode and isolates two detached hosts', async () => {
  const nexus = createPicodashNexus({ valueOwner: 'nexus', fields: {} })
  const mounted = render(
    <StrictMode>
      <PicodashProvider nexus={nexus}>
        <DashStack id="pinned" reorderable={false}>
          <DashGroup id="first" label="First" pin="start" detachable="floating" collapsible={false}>
            <Dashlet id="one" label="One">
              <input aria-label="First draft" defaultValue="pending" />
            </Dashlet>
          </DashGroup>
          <DashGroup id="last" label="Last" pin="end" detachable>
            <Dashlet id="two" label="Two">
              <input aria-label="Second draft" defaultValue="other" />
            </Dashlet>
          </DashGroup>
        </DashStack>
      </PicodashProvider>
    </StrictMode>,
  )
  const first = screen.getByRole('textbox', { name: 'First draft' })
  fireEvent.click(screen.getByRole('button', { name: 'Detach group First' }))
  await flush()
  fireEvent.click(screen.getByRole('button', { name: 'Detach group Last' }))
  await flush()
  expect(screen.getAllByRole('complementary')).toHaveLength(2)
  expect(screen.getByRole('complementary', { name: 'First' }).contains(first)).toBe(true)
  expect(getDashStackStructure(nexus.scope('pinned')).rootIds).toEqual(['first', 'last'])
  fireEvent.click(screen.getByRole('button', { name: 'Return First to stack' }))
  await flush()
  expect(screen.getAllByRole('complementary')).toHaveLength(1)
  expect(screen.getByRole('complementary', { name: 'Last' })).toBeTruthy()
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Detach group First' }))
  expect(screen.getByRole('textbox', { name: 'First draft' })).toBe(first)
  mounted.unmount()
  await flush()
  nexus.destroy()
})

it('activates the physical detached host for retained controls rather than their React ancestor', async () => {
  const nexus = createPicodashNexus({ valueOwner: 'nexus', fields: {} })
  const mounted = render(
    <PicodashProvider nexus={nexus}>
      <DashPanel id="source" title="Source">
        <button>Source action</button>
        <DashStack id="tools">
          <DashGroup id="geometry" label="Geometry" detachable reorderable>
            <Dashlet id="value" label="Value">
              <input aria-label="Detached editor" />
            </Dashlet>
            <Dashlet id="other" label="Other">
              <input aria-label="Other editor" />
            </Dashlet>
          </DashGroup>
        </DashStack>
      </DashPanel>
    </PicodashProvider>,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Detach group Geometry' }))
  await flush()
  const source = screen.getByRole('complementary', { name: 'Source' })
  const detached = screen.getByRole('complementary', { name: 'Geometry' })
  const sourceAction = screen.getByRole('button', { name: 'Source action' })
  fireEvent.pointerDown(sourceAction)
  expect(source.getAttribute('data-active')).toBe('true')
  fireEvent.pointerDown(screen.getByRole('textbox', { name: 'Detached editor' }))
  expect(detached.getAttribute('data-active')).toBe('true')
  expect(source.hasAttribute('data-active')).toBe(false)
  act(() => sourceAction.focus())
  act(() => screen.getByRole('textbox', { name: 'Detached editor' }).focus())
  expect(detached.getAttribute('data-active')).toBe('true')
  expect(source.hasAttribute('data-active')).toBe(false)
  mounted.unmount()
  await flush()
  nexus.destroy()
})

it('can return during the initial pull after leaving home, with cancellation still restoring inline', () => {
  let state = transitionGroup('inline', 'pull')
  expect(transitionGroup(state, 'enter-home')).toBe('detaching')
  state = transitionGroup(state, 'leave-home')
  state = transitionGroup(state, 'enter-home')
  expect(state).toBe('detaching-return-preview')
  expect(transitionGroup(state, 'return')).toBe('inline')
  expect(transitionGroup(state, 'cancel')).toBe('inline')
  const away = transitionGroup(state, 'leave-home')
  expect(transitionGroup(away, 'cancel')).toBe('inline')
  expect(transitionGroup(away, 'settle')).toBe('detached')
})

it('records scoped group hotkeys, arbitrates visible parents, retains editors and disables hidden contexts', async () => {
  const nexus = createPicodashNexus({ valueOwner: 'nexus', fields: {} })
  const view = () => (
    <PicodashProvider nexus={nexus}>
      {['A', 'B'].map((name) => (
        <DashPanel
          key={name}
          id={name}
          title={name}
          recordableHotkey
          defaultLayout={{
            placement: {
              mode: 'fixed',
              disposition: { kind: 'docked', position: name === 'A' ? 'full-left' : 'full-right' },
            },
          }}
        >
          <DashStack id={`stack-${name}`}>
            <DashGroup id="geometry" label={`Geometry ${name}`} detachable recordableHotkey>
              <Dashlet id="draft" label="Draft">
                <input aria-label={`Draft ${name}`} defaultValue="draft" />
              </Dashlet>
            </DashGroup>
            <DashGroup id="other" label={`Other ${name}`} detachable recordableHotkey>
              <Dashlet id="other-content" label="Other">
                Other
              </Dashlet>
            </DashGroup>
          </DashStack>
        </DashPanel>
      ))}
    </PicodashProvider>
  )
  const mounted = render(view())
  await flush()
  const button = (name: string) => screen.getByRole('button', { name })
  const key = (value = 'g', code = 'KeyG', repeat = false) => {
    const target = document.activeElement ?? document.body
    fireEvent.keyDown(target, {
      key: value,
      code,
      ctrlKey: value.length === 1,
      shiftKey: value.length === 1,
      repeat,
    })
    fireEvent.keyUp(target, {
      key: value,
      code,
      ctrlKey: value.length === 1,
      shiftKey: value.length === 1,
    })
  }
  const record = (name: string) => {
    const b = button(`Record shortcut for ${name}`)
    act(() => b.focus())
    fireEvent.click(b)
    key()
  }
  record('group Geometry A')
  const binding = nexus.scope('stack-A').getState().scope?.dashGroupHotkeys?.get('geometry')
  expect(binding).toContain('[KeyG]')
  record('group Geometry B')
  expect(nexus.scope('stack-B').getState().scope?.dashGroupHotkeys?.get('geometry')).toBe(binding)
  record('group Other A')
  expect(nexus.scope('stack-A').getState().scope?.dashGroupHotkeys?.has('other')).toBe(false)
  expect(document.body.textContent).toContain('already in use in this context')
  key('Escape', 'Escape')
  record('A')
  expect(nexus.scope('A').getState().scope?.dashPanelHotkey).toBeUndefined()
  key('Escape', 'Escape')
  const draft = screen.getByRole('textbox', { name: 'Draft A' })
  fireEvent.change(draft, { target: { value: 'unfinished -' } })
  act(() => button('Record shortcut for group Geometry A').focus())
  key()
  await flush()
  expect(screen.getByRole('complementary', { name: 'Geometry A' }).contains(draft)).toBe(true)
  expect(screen.queryByRole('complementary', { name: 'Geometry B' })).toBeNull()
  expect(document.activeElement).toBe(draft)
  // Typing and held chords do not activate a different group.
  key()
  expect(screen.queryByRole('complementary', { name: 'Geometry B' })).toBeNull()
  fireEvent.click(button('Return Geometry A to stack'))
  await flush()
  expect(screen.getByRole('textbox', { name: 'Draft A' })).toBe(draft)
  expect((draft as HTMLInputElement).value).toBe('unfinished -')
  fireEvent.click(button('Minimize panel A'))
  act(() => button('Record shortcut for group Geometry B').focus())
  key('g', 'KeyG', true)
  expect(screen.queryByRole('complementary', { name: 'Geometry B' })).toBeNull()
  key()
  await flush()
  expect(screen.getByRole('complementary', { name: 'Geometry B' })).toBeTruthy()
  fireEvent.click(button('Return Geometry B to stack'))
  await flush()
  fireEvent.click(button('Close panel B'))
  key()
  await flush()
  expect(screen.queryByRole('complementary', { name: 'Geometry A' })).toBeNull()
  expect(screen.queryByRole('complementary', { name: 'Geometry B' })).toBeNull()
  fireEvent.click(button('Reveal panel A'))
  key()
  await flush()
  expect(screen.getByRole('complementary', { name: 'Geometry A' })).toBeTruthy()
  // A detached group's shortcut raises its existing panel, never creates a copy.
  act(() => button('Record shortcut for group Geometry A').focus())
  key()
  await flush()
  expect(screen.getAllByRole('complementary', { name: 'Geometry A' })).toHaveLength(1)
  act(() => button('Record shortcut for group Geometry A').focus())
  fireEvent.click(button('Record shortcut for group Geometry A'))
  key('Backspace', 'Backspace')
  expect(nexus.scope('stack-A').getState().scope?.dashGroupHotkeys).toBeUndefined()
  mounted.unmount()
  await flush()
  nexus.destroy()
})
