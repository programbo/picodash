// @vitest-environment jsdom
import { createRef, useState, StrictMode, type RefObject } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vite-plus/test'
import { createPicodashNexus } from '@picodash/nexus'
import { getDashStackStructure, revealDashlet } from '@picodash/dashstack'
import { PicodashProvider, DashStack, DashGroup, Dashlet } from '../src/index.js'
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
