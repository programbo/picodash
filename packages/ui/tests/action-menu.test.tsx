// @vitest-environment jsdom
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import {
  ActionMenu,
  ActionMenuItem,
  ActionMenuSeparator,
  ActionSubmenu,
  PicodashOverlayProvider,
  PicodashThemeProvider,
} from '../src/index.tsx'
import { resolveOverlayLayer } from '../src/overlay-layer.tsx'

let container: HTMLDivElement
let root: Root

async function render(element: ReactNode) {
  await act(async () => root.render(element))
  await act(async () => {})
}

function tree(children: ReactNode, props: Partial<React.ComponentProps<typeof ActionMenu>> = {}) {
  return (
    <PicodashThemeProvider theme="dark" density="compact">
      <PicodashOverlayProvider portalContainer={container} layerBase={100}>
        <ActionMenu label="Settings actions" {...props}>
          {children}
        </ActionMenu>
      </PicodashOverlayProvider>
    </PicodashThemeProvider>
  )
}

async function openMenu() {
  ;(container.querySelector('[data-slot="button"]') as HTMLButtonElement).click()
  await act(async () => {})
}

describe('@picodash/ui ActionMenu composition', () => {
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

  it('normalizes uncontrolled and controlled open state and calls onOpenChange', async () => {
    const onOpenChange = vi.fn()
    await render(tree(<ActionMenuItem label="Run" onAction={vi.fn()} />, { onOpenChange }))
    expect(document.querySelector('[data-slot="action-menu"]')).toBeNull()
    await openMenu()
    expect(onOpenChange).toHaveBeenCalledWith(true)
    expect(document.querySelector('[data-slot="action-menu"]')).toBeTruthy()
    ;(document.querySelector('[data-slot="action-menu-item"]') as HTMLElement).click()
    await act(async () => {})
    expect(onOpenChange).toHaveBeenCalledWith(false)

    await act(async () => root.unmount())
    root = createRoot(container)
    const refused = vi.fn()
    await render(
      tree(<ActionMenuItem label="Run" onAction={vi.fn()} />, {
        isOpen: true,
        onOpenChange: refused,
      }),
    )
    ;(document.querySelector('[data-slot="action-menu"]') as HTMLElement).dispatchEvent(
      new MouseEvent('pointerdown', { bubbles: true }),
    )
    await act(async () => {})
    expect(refused).not.toHaveBeenCalledWith(false)
  })

  it('uses the standard trigger, preserves custom triggers, and closes after one action', async () => {
    const onAction = vi.fn()
    await render(tree(<ActionMenuItem label="Run" onAction={onAction} />))
    const defaultTrigger = container.querySelector('[data-slot="button"]') as HTMLButtonElement
    expect(defaultTrigger.getAttribute('aria-label')).toBe('Settings actions')
    await openMenu()
    const item = document.querySelector('[data-slot="action-menu-item"]') as HTMLElement
    expect(item.getAttribute('textvalue')).toBeNull()
    item.click()
    await act(async () => {})
    expect(onAction).toHaveBeenCalledTimes(1)
    expect(document.querySelector('[data-slot="action-menu"]')).toBeNull()

    await act(async () => root.unmount())
    root = createRoot(container)
    await render(
      tree(<ActionMenuItem label="Run" onAction={vi.fn()} />, {
        trigger: (
          <button data-custom-trigger type="button">
            Open
          </button>
        ),
      }),
    )
    expect(container.querySelector('[data-custom-trigger]')).toBeTruthy()
    expect(container.querySelector('[data-slot="button"]')).toBeNull()
  })

  it('keeps disabled actions inert and preserves typeahead text values', async () => {
    const disabled = vi.fn()
    await render(
      tree(
        <>
          <ActionMenuItem label="Disabled command" onAction={disabled} isDisabled />
          <ActionMenuItem label="Deploy" onAction={vi.fn()} />
          <ActionMenuSeparator />
        </>,
      ),
    )
    await openMenu()
    const disabledItem = document.querySelector('[data-slot="action-menu-item"]') as HTMLElement
    expect(disabledItem.getAttribute('aria-disabled')).toBe('true')
    disabledItem.click()
    await act(async () => {})
    expect(disabled).not.toHaveBeenCalled()
    expect(document.querySelector('[data-slot="action-menu-separator"]')).toBeTruthy()
  })

  it('composes the exact submenu pair and closes the root after a submenu action', async () => {
    const subAction = vi.fn()
    await render(
      tree(
        <ActionSubmenu label="Export">
          <ActionMenuItem label="JSON" onAction={subAction} />
        </ActionSubmenu>,
      ),
    )
    await openMenu()
    const submenuTrigger = document.querySelector('[data-slot="action-submenu"]') as HTMLElement
    expect(submenuTrigger.getAttribute('aria-haspopup')).toBe('menu')
    submenuTrigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    await act(async () => {})
    const nested = [...document.querySelectorAll('[data-slot="action-menu-item"]')].find(
      (element) => element.textContent === 'JSON',
    ) as HTMLElement
    expect(nested).toBeTruthy()
    nested.click()
    await act(async () => {})
    expect(subAction).toHaveBeenCalledTimes(1)
    expect(document.querySelector('[data-slot="action-menu"]')).toBeNull()
  })

  it('opens confirmation only after the menu closes and confirms once', async () => {
    const onAction = vi.fn()
    await render(
      tree(
        <ActionMenuItem
          label="Reset"
          onAction={onAction}
          confirmation={{
            title: 'Reset?',
            description: 'Defaults are restored.',
            actionLabel: 'Reset values',
          }}
        />,
      ),
    )
    await openMenu()
    ;(document.querySelector('[data-slot="action-menu-item"]') as HTMLElement).click()
    await act(async () => {})
    expect(document.querySelector('[data-slot="action-menu"]')).toBeNull()
    expect(document.querySelector('[data-slot="alert-dialog-content"]')).toBeTruthy()
    ;(
      [...document.querySelectorAll('[data-slot="button"]')].find(
        (button) => button.textContent === 'Reset values',
      ) as HTMLButtonElement
    ).click()
    await act(async () => {})
    expect(onAction).toHaveBeenCalledTimes(1)
    expect(document.querySelector('[data-slot="alert-dialog-content"]')).toBeNull()
  })

  it('closes a confirmation when its reviewed operation fingerprint changes', async () => {
    const onAction = vi.fn()
    const listeners = new Set<() => void>()
    let fingerprint = 'first'
    await render(
      tree(
        <ActionMenuItem
          label="Reset"
          onAction={onAction}
          confirmation={{
            title: 'Reset?',
            description: 'Defaults are restored.',
            actionLabel: 'Reset values',
            guard: {
              fingerprint,
              getFingerprint: () => fingerprint,
              subscribe(listener) {
                listeners.add(listener)
                return () => listeners.delete(listener)
              },
            },
          }}
        />,
      ),
    )
    await openMenu()
    ;(document.querySelector('[data-slot="action-menu-item"]') as HTMLElement).click()
    await act(async () => {})
    expect(document.querySelector('[data-slot="alert-dialog-content"]')).toBeTruthy()
    const confirm = [...document.querySelectorAll('[data-slot="button"]')].find(
      (button) => button.textContent === 'Reset values',
    ) as HTMLButtonElement
    await act(async () => {
      fingerprint = 'second'
      for (const listener of listeners) listener()
      confirm.click()
    })
    expect(document.querySelector('[data-slot="alert-dialog-content"]')).toBeNull()
    expect(onAction).not.toHaveBeenCalled()
  })

  it('cancels confirmation without action and refuses to open when a controlled menu stays open', async () => {
    const onAction = vi.fn()
    const onOpenChange = vi.fn()
    await render(
      tree(
        <ActionMenuItem
          label="Reset"
          onAction={onAction}
          confirmation={{
            title: 'Reset?',
            description: 'Defaults are restored.',
            actionLabel: 'Reset values',
          }}
        />,
        { isOpen: true, onOpenChange },
      ),
    )
    const item = document.querySelector('[data-slot="action-menu-item"]') as HTMLElement
    item.click()
    await act(async () => {})
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(document.querySelector('[data-slot="alert-dialog-content"]')).toBeNull()
    expect(onAction).not.toHaveBeenCalled()
  })

  it('clears a queued confirmation when the controlled dialog closes', async () => {
    const onAction = vi.fn()
    await render(
      tree(
        <ActionMenuItem
          label="Reset"
          onAction={onAction}
          confirmation={{
            title: 'Reset?',
            description: 'Defaults are restored.',
            actionLabel: 'Reset values',
          }}
        />,
      ),
    )
    await openMenu()
    ;(document.querySelector('[data-slot="action-menu-item"]') as HTMLElement).click()
    await act(async () => {})
    expect(document.querySelector('[data-slot="alert-dialog-content"]')).toBeTruthy()
    ;(
      [...document.querySelectorAll('[data-slot="button"]')].find(
        (button) => button.textContent === 'Cancel',
      ) as HTMLButtonElement
    ).click()
    await act(async () => {})
    await act(async () => {})
    expect(document.querySelector('[data-slot="alert-dialog-content"]')).toBeNull()
    expect(onAction).not.toHaveBeenCalled()
  })

  it('uses explicit, null, and inherited portal hosts and private layer expressions', async () => {
    await render(tree(<ActionMenuItem label="Run" onAction={vi.fn()} />))
    await openMenu()
    const inheritedPopover = container.querySelector('.picodash-action-menu-popover') as HTMLElement
    expect(inheritedPopover).toBeTruthy()
    expect(inheritedPopover.parentElement?.parentElement).toBe(container)
    await act(async () => root.unmount())
    root = createRoot(container)
    const explicit = document.createElement('div')
    document.body.append(explicit)
    await render(
      tree(<ActionMenuItem label="Run" onAction={vi.fn()} />, {
        portalContainer: explicit,
        layerBase: 40,
      }),
    )
    await openMenu()
    const explicitMenu = explicit.querySelector('[data-slot="action-menu"]') as HTMLElement
    expect(explicitMenu).toBeTruthy()
    const explicitPopover = explicit.querySelector('.picodash-action-menu-popover') as HTMLElement
    expect(explicitPopover).toBeTruthy()
    expect(explicitPopover.parentElement?.parentElement).toBe(explicit)
    expect(resolveOverlayLayer('menu', 40, undefined)).toBe('max(var(--picodash-layer-menu), 40)')
    expect(resolveOverlayLayer('menu', undefined, 'max(var(--picodash-layer-menu), 40)')).toBe(
      'max(var(--picodash-layer-menu), calc(max(var(--picodash-layer-menu), 40) + 1))',
    )
    await act(async () => root.unmount())
    root = createRoot(container)
    await render(tree(<ActionMenuItem label="Run" onAction={vi.fn()} />, { portalContainer: null }))
    await openMenu()
    const bodyMenu = document.body.querySelector('[data-slot="action-menu"]') as HTMLElement
    expect(bodyMenu).toBeTruthy()
    expect(document.body.querySelector('.picodash-action-menu-popover')).toBeTruthy()
    explicit.remove()
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 1.5])(
    'rejects invalid explicit layerBase %s',
    async (invalidLayerBase) => {
      await expect(
        render(
          tree(<ActionMenuItem label="Run" onAction={vi.fn()} />, { layerBase: invalidLayerBase }),
        ),
      ).rejects.toThrow(TypeError)
    },
  )
})
