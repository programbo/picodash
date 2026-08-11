// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { describe, expect, it, afterEach, beforeEach, vi } from 'vite-plus/test'
import { clickElement, dispatchElement, renderReactRoot } from '../../../test/react.ts'
import { ActionMenuItem } from '@picodash/ui'
import { createPicodashNexus } from '@picodash/nexus'
import { DashPanel, DashPanelProvider } from './index.tsx'
import { DashPanelIntegrationProvider } from './integration.tsx'
import { useDashPanelRuntime } from './runtime/panel-runtime-context.tsx'

let container: HTMLDivElement
let root: Root

const makeNexus = () =>
  createPicodashNexus({
    valueOwner: 'nexus',
    fields: { value: { defaultValue: 1 } },
  })

async function render(element: React.ReactNode) {
  await renderReactRoot(root, element)
}

async function openActions() {
  const trigger = document.querySelector(
    '[data-slot="button"][aria-label="Actions for Inspector"]',
  ) as HTMLButtonElement
  expect(trigger).toBeTruthy()
  await clickElement(trigger)
}

function panel(
  nexus: ReturnType<typeof makeNexus>,
  props: Partial<React.ComponentProps<typeof DashPanel>> = {},
) {
  return (
    <DashPanelProvider nexus={nexus}>
      <DashPanel id="inspector" title="Inspector" {...props} />
    </DashPanelProvider>
  )
}

describe('DashPanel action composition', () => {
  beforeEach(() => {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  it('exposes keyboard movement shortcuts and shared instructions on the move control', async () => {
    const nexus = makeNexus()
    await render(panel(nexus))
    const move = document.querySelector('[aria-label="Move panel Inspector"]') as HTMLElement
    const instructionsId = move.getAttribute('aria-describedby')
    expect(move.getAttribute('aria-keyshortcuts')).toBe(
      'Enter Space ArrowUp ArrowDown ArrowLeft ArrowRight Escape',
    )
    expect(instructionsId).toBeTruthy()
    expect(document.getElementById(instructionsId!)?.textContent).toContain(
      'Press Space or Enter to pick up.',
    )
    expect(document.getElementById(instructionsId!)?.textContent).toContain(
      'Press Enter to commit, or Escape to cancel.',
    )
    await act(async () => root.unmount())
    nexus.destroy()
  })

  it('renders contributor content before built-in actions only when omitted', async () => {
    const nexus = makeNexus()
    function Contributor({ scopeId }: { scopeId: string }) {
      return <ActionMenuItem label={`Contributed ${scopeId}`} onAction={vi.fn()} />
    }
    await render(
      <DashPanelIntegrationProvider defaultActionItems={Contributor}>
        {panel(nexus)}
      </DashPanelIntegrationProvider>,
    )
    await openActions()
    expect(
      [...document.querySelectorAll('[data-slot="action-menu-item"]')].map(
        (item) => item.textContent,
      ),
    ).toContain('Contributed inspector')
    expect(document.querySelector('[data-slot="action-submenu"]')).toBeTruthy()
    await act(async () => root.unmount())
    nexus.destroy()
  })

  it('implements false, replacement, and empty-array menu semantics', async () => {
    const nexus = makeNexus()
    await render(panel(nexus, { actionMenu: false }))
    expect(document.querySelector('[data-slot="action-menu"]')).toBeNull()

    await render(
      panel(nexus, {
        actionMenu: [<ActionMenuItem key="custom" label="Custom" onAction={vi.fn()} />],
      }),
    )
    await openActions()
    expect(document.body.textContent).toContain('Custom')
    expect(document.body.textContent).not.toContain('Placement')

    await render(panel(nexus, { actionMenu: [] }))
    expect(document.querySelector('[data-slot="action-menu"]')).toBeNull()
    await act(async () => root.unmount())
    nexus.destroy()
  })

  it('confirms request-remove and never invokes the callback on cancellation', async () => {
    const nexus = makeNexus()
    const onRequestRemove = vi.fn()
    await render(panel(nexus, { onRequestRemove }))
    await openActions()
    const remove = [...document.querySelectorAll('[data-slot="action-menu-item"]')].find(
      (item) => item.textContent === 'Remove panel…',
    ) as HTMLElement
    expect(remove).toBeTruthy()
    await clickElement(remove)
    expect(document.querySelector('[data-slot="alert-dialog-content"]')).toBeTruthy()
    await clickElement(
      [...document.querySelectorAll('[data-slot="button"]')].find(
        (button) => button.textContent === 'Cancel',
      ) as HTMLButtonElement,
    )
    expect(onRequestRemove).not.toHaveBeenCalled()

    await openActions()
    const secondRemove = [...document.querySelectorAll('[data-slot="action-menu-item"]')].find(
      (item) => item.textContent === 'Remove panel…',
    ) as HTMLElement
    await clickElement(secondRemove)
    await clickElement(
      [...document.querySelectorAll('[data-slot="button"]')].find(
        (button) => button.textContent === 'Remove panel',
      ) as HTMLButtonElement,
    )
    expect(onRequestRemove).toHaveBeenCalledTimes(1)
    expect(onRequestRemove).toHaveBeenCalledWith({ scopeId: 'inspector' })
    await act(async () => root.unmount())
    nexus.destroy()
  })

  it('disables dock targets occupied by another Panel in the same arena', async () => {
    const nexus = makeNexus()
    await render(
      <DashPanelProvider nexus={nexus}>
        <DashPanel
          id="occupied"
          title="Occupied"
          defaultLayout={{
            placement: { mode: 'fixed', disposition: { kind: 'docked', position: 'full-left' } },
            preferredPosition: { x: 0, y: 0 },
          }}
        />
        <DashPanel
          id="inspector"
          title="Inspector"
          defaultLayout={{
            placement: { mode: 'fixed', disposition: { kind: 'docked', position: 'full-right' } },
            preferredPosition: { x: 0, y: 0 },
          }}
        />
      </DashPanelProvider>,
    )
    await openActions()
    const submenu = document.querySelector('[data-slot="action-submenu"]') as HTMLElement
    await dispatchElement(
      submenu,
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    )
    const occupied = [...document.querySelectorAll('[data-slot="action-menu-item"]')].find(
      (item) => item.textContent === 'Dock full-left',
    ) as HTMLElement
    expect(occupied).toBeTruthy()
    expect(occupied.getAttribute('aria-disabled')).toBe('true')
    await act(async () => root.unmount())
    nexus.destroy()
  })

  it('keeps Fixed dock actions when the rendered placement is an occupied fallback', async () => {
    const nexus = makeNexus()
    nexus.scope('inspector').setDashPanelLayout({
      placement: { mode: 'fixed', disposition: { kind: 'docked', position: 'full-left' } },
      preferredPosition: { x: 0, y: 0 },
    })
    function Fixture() {
      const [occupied, setOccupied] = useState(true)
      return (
        <>
          <button type="button" data-release-dock onClick={() => setOccupied(false)}>
            Release dock
          </button>
          <DashPanelProvider nexus={nexus}>
            {occupied ? (
              <DashPanel
                key="occupied"
                id="occupied"
                title="Occupied"
                defaultLayout={{
                  placement: {
                    mode: 'fixed',
                    disposition: { kind: 'docked', position: 'full-left' },
                  },
                }}
              />
            ) : null}
            <DashPanel
              key="inspector"
              id="inspector"
              title="Inspector"
              defaultLayout={{
                placement: {
                  mode: 'fixed',
                  disposition: { kind: 'docked', position: 'full-right' },
                },
              }}
            />
          </DashPanelProvider>
        </>
      )
    }
    await render(<Fixture />)
    expect(
      document.querySelector('[aria-label="Move panel Inspector"]')?.getAttribute('disabled'),
    ).not.toBeNull()
    await openActions()
    const submenu = document.querySelector('[data-slot="action-submenu"]') as HTMLElement
    await dispatchElement(
      submenu,
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    )
    const labels = [...document.querySelectorAll('[data-slot="action-menu-item"]')].map(
      (item) => item.textContent,
    )
    expect(labels).toContain('Dock full-right')
    expect(labels).not.toContain('Free')
    expect(labels).not.toContain('Snap top')

    const fullRight = [...document.querySelectorAll('[data-slot="action-menu-item"]')].find(
      (item) => item.textContent === 'Dock full-right',
    ) as HTMLElement
    expect(fullRight.getAttribute('aria-disabled')).toBe('true')
    const fullLeft = [...document.querySelectorAll('[data-slot="action-menu-item"]')].find(
      (item) => item.textContent === 'Dock full-left',
    ) as HTMLElement
    expect(fullLeft.getAttribute('aria-disabled')).toBe('true')

    await clickElement(document.querySelector('[data-release-dock]') as HTMLButtonElement)
    expect(fullLeft.getAttribute('aria-disabled')).not.toBe('true')
    await clickElement(fullLeft)
    expect(nexus.getState().scopes.get('inspector')?.dashPanel?.placement).toEqual({
      mode: 'fixed',
      disposition: { kind: 'docked', position: 'full-left' },
    })
    await act(async () => root.unmount())
    nexus.destroy()
  })

  it('announces Nexus rejections from direct movement and action commands', async () => {
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      nexusId: 'dashpanel-actions-quarantine',
      schemaVersion: 1,
      fields: { value: { defaultValue: 1 } },
      initialEnvelope: {
        kind: 'picodash-nexus-envelope',
        formatVersion: 1,
        nexusId: 'dashpanel-actions-quarantine',
        schemaVersion: 1,
        revision: 1,
        writerId: 'fixture',
        valueOwner: 'nexus',
        values: { value: 1 },
        scopes: [['inspector', { dashPanel: { invalid: true } }]],
      },
    } as never)
    expect(nexus.metadataRecovery.getState().quarantinedScopes.has('inspector')).toBe(true)
    await render(
      <DashPanelProvider nexus={nexus}>
        <DashPanel id="inspector" title="Inspector" />
      </DashPanelProvider>,
    )
    const move = document.querySelector('[aria-label="Move panel Inspector"]') as HTMLElement
    await dispatchElement(move, new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await dispatchElement(move, new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    await dispatchElement(move, new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(document.querySelector('[data-picodash-panel-status]')?.textContent).toBe(
      'Panel movement failed: Scope metadata is quarantined.',
    )

    await openActions()
    const submenu = document.querySelector('[data-slot="action-submenu"]') as HTMLElement
    await dispatchElement(
      submenu,
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    )
    const snap = [...document.querySelectorAll('[data-slot="action-menu-item"]')].find(
      (item) => item.textContent === 'Snap top-left',
    ) as HTMLElement
    await clickElement(snap)
    expect(document.querySelector('[data-picodash-panel-status]')?.textContent).toBe(
      'Panel placement failed: Scope metadata is quarantined.',
    )

    await openActions()
    const reset = [...document.querySelectorAll('[data-slot="action-menu-item"]')].find(
      (item) => item.textContent === 'Reset layout',
    ) as HTMLElement
    await clickElement(reset)
    expect(document.querySelector('[data-picodash-panel-status]')?.textContent).toBe(
      'Panel layout reset failed: Scope metadata is quarantined.',
    )
    await act(async () => root.unmount())
    nexus.destroy()
  })

  it('announces a dock race rejected after the placement menu was rendered', async () => {
    const nexus = makeNexus()
    let runtime!: ReturnType<typeof useDashPanelRuntime>
    function RuntimeProbe() {
      runtime = useDashPanelRuntime()
      return null
    }
    await render(
      <DashPanelProvider nexus={nexus}>
        <RuntimeProbe />
        <DashPanel
          id="inspector"
          title="Inspector"
          defaultLayout={{
            placement: {
              mode: 'fixed',
              disposition: { kind: 'docked', position: 'full-right' },
            },
          }}
        />
      </DashPanelProvider>,
    )
    await openActions()
    const submenu = document.querySelector('[data-slot="action-submenu"]') as HTMLElement
    await dispatchElement(
      submenu,
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    )
    const fullLeft = [...document.querySelectorAll('[data-slot="action-menu-item"]')].find(
      (item) => item.textContent === 'Dock full-left',
    ) as HTMLElement
    expect(fullLeft.getAttribute('aria-disabled')).not.toBe('true')
    const originalSetPlacement = runtime.setPlacement.bind(runtime)
    let occupied: ReturnType<typeof runtime.acquire> | undefined
    vi.spyOn(runtime, 'setPlacement').mockImplementation((scopeId, placement) => {
      occupied ??= runtime.acquire({
        scopeId: 'occupied',
        defaultLayout: {
          placement: { mode: 'fixed', disposition: { kind: 'docked', position: 'full-left' } },
        },
        placement: { mode: 'fixed', disposition: { kind: 'docked', position: 'full-left' } },
        dockPositions: ['full-left'],
        presentation: { kind: 'panel' },
      })
      return originalSetPlacement(scopeId, placement)
    })
    await clickElement(fullLeft)
    expect(document.querySelector('[data-picodash-panel-status]')?.textContent).toBe(
      'Panel placement failed: The dock position is occupied.',
    )
    await act(async () => {
      occupied?.release()
    })
    await act(async () => root.unmount())
    nexus.destroy()
  })
})
