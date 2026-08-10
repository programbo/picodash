// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { describe, expect, it, afterEach, beforeEach, vi } from 'vite-plus/test'
import { ActionMenuItem } from '@picodash/ui'
import { createPicodashStore } from '@picodash/store'
import { DashPanel, DashPanelProvider } from './index.tsx'
import { DashPanelIntegrationProvider } from './integration.tsx'

let container: HTMLDivElement
let root: Root

const makeStore = () =>
  createPicodashStore({
    valueOwner: 'store',
    fields: { value: { defaultValue: 1 } },
  })

async function render(element: React.ReactNode) {
  await act(async () => root.render(element))
  await act(async () => {})
}

async function openActions() {
  const trigger = container.querySelector(
    '[data-slot="button"][aria-label="Actions for Inspector"]',
  ) as HTMLButtonElement
  expect(trigger).toBeTruthy()
  await act(async () => trigger.click())
  await act(async () => {})
}

function panel(
  store: ReturnType<typeof makeStore>,
  props: Partial<React.ComponentProps<typeof DashPanel>> = {},
) {
  return (
    <DashPanelProvider store={store}>
      <DashPanel id="inspector" title="Inspector" {...props} />
    </DashPanelProvider>
  )
}

describe('DashPanel action composition', () => {
  beforeEach(() => {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
    vi.stubGlobal('CSS', { escape: (value: string) => value })
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })

  it('renders contributor content before built-in actions only when omitted', async () => {
    const store = makeStore()
    function Contributor({ scopeId }: { scopeId: string }) {
      return <ActionMenuItem label={`Contributed ${scopeId}`} onAction={vi.fn()} />
    }
    await render(
      <DashPanelIntegrationProvider defaultActionItems={Contributor}>
        {panel(store)}
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
    store.destroy()
  })

  it('implements false, replacement, and empty-array menu semantics', async () => {
    const store = makeStore()
    await render(panel(store, { actionMenu: false }))
    expect(container.querySelector('[data-slot="action-menu"]')).toBeNull()

    await render(
      panel(store, {
        actionMenu: [<ActionMenuItem key="custom" label="Custom" onAction={vi.fn()} />],
      }),
    )
    await openActions()
    expect(document.body.textContent).toContain('Custom')
    expect(document.body.textContent).not.toContain('Placement')

    await render(panel(store, { actionMenu: [] }))
    expect(container.querySelector('[data-slot="action-menu"]')).toBeNull()
    await act(async () => root.unmount())
    store.destroy()
  })

  it('confirms request-remove and never invokes the callback on cancellation', async () => {
    const store = makeStore()
    const onRequestRemove = vi.fn()
    await render(panel(store, { onRequestRemove }))
    await openActions()
    const remove = [...document.querySelectorAll('[data-slot="action-menu-item"]')].find(
      (item) => item.textContent === 'Remove panel…',
    ) as HTMLElement
    expect(remove).toBeTruthy()
    await act(async () => remove.click())
    await act(async () => {})
    expect(document.querySelector('[data-slot="alert-dialog-content"]')).toBeTruthy()
    ;(
      [...document.querySelectorAll('[data-slot="button"]')].find(
        (button) => button.textContent === 'Cancel',
      ) as HTMLButtonElement
    ).click()
    await act(async () => {})
    expect(onRequestRemove).not.toHaveBeenCalled()

    await openActions()
    const secondRemove = [...document.querySelectorAll('[data-slot="action-menu-item"]')].find(
      (item) => item.textContent === 'Remove panel…',
    ) as HTMLElement
    await act(async () => secondRemove.click())
    await act(async () => {})
    ;(
      [...document.querySelectorAll('[data-slot="button"]')].find(
        (button) => button.textContent === 'Remove panel',
      ) as HTMLButtonElement
    ).click()
    await act(async () => {})
    expect(onRequestRemove).toHaveBeenCalledTimes(1)
    expect(onRequestRemove).toHaveBeenCalledWith({ scopeId: 'inspector' })
    await act(async () => root.unmount())
    store.destroy()
  })
})
