// @vitest-environment jsdom
import { act, type CSSProperties, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { describe, expect, it, afterEach, beforeEach, vi } from 'vite-plus/test'
import { clickElement, dispatchElement, renderReactRoot } from '../../../test/react.ts'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogTitle,
  AlertDialogTrigger,
  PicodashOverlayProvider,
  PicodashThemeProvider,
} from '../src/index.tsx'
import { resolveDialogLayer } from '../src/overlay-layer.tsx'

let container: HTMLDivElement
let root: Root

function tree({
  isOpen,
  onOpenChange,
  action,
  portalContainer,
  overlayStyle,
  overlayLayerBase,
}: {
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
  action?: ReactNode
  portalContainer?: HTMLElement | null
  overlayStyle?: CSSProperties
  overlayLayerBase?: number
} = {}) {
  return (
    <PicodashThemeProvider theme="light" density="compact">
      <PicodashOverlayProvider layerBase={100} portalContainer={container ?? undefined}>
        <AlertDialog isOpen={isOpen} onOpenChange={onOpenChange}>
          <AlertDialogTrigger>Open</AlertDialogTrigger>
          <AlertDialogOverlay
            portalContainer={portalContainer}
            style={overlayStyle}
            layerBase={overlayLayerBase}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset values?</AlertDialogTitle>
                <AlertDialogDescription id="current-values">
                  Current values will be replaced.
                </AlertDialogDescription>
                <AlertDialogDescription>Defaults come from the Nexus.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                {action ?? <AlertDialogAction>Reset</AlertDialogAction>}
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialogOverlay>
        </AlertDialog>
      </PicodashOverlayProvider>
    </PicodashThemeProvider>
  )
}

async function render(element: ReactNode) {
  await renderReactRoot(root, element)
}

describe('@picodash/ui AlertDialog composition', () => {
  beforeEach(() => {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  it('opens uncontrolled state and renders alertdialog semantics and descriptions', async () => {
    await render(tree())
    expect(document.querySelector('[data-slot="alert-dialog-overlay"]')).toBeNull()
    await clickElement(container.querySelector('[data-slot="button"]') as HTMLButtonElement)
    expect(
      (document.querySelector('[data-slot="alert-dialog-overlay"]') as HTMLElement).parentElement,
    ).toBe(container)
    const dialog = document.querySelector('[data-slot="alert-dialog-content"]') as HTMLElement
    expect(dialog.getAttribute('role')).toBe('alertdialog')
    expect(dialog.querySelector('[data-slot="alert-dialog-title"]')).toBeTruthy()
    const descriptions = [...dialog.querySelectorAll('[data-slot="alert-dialog-description"]')]
    expect(dialog.getAttribute('aria-describedby')).toBe(
      descriptions.map((description) => description.id).join(' '),
    )
    expect(descriptions[0]?.id).toBe('current-values')
    expect(document.querySelector('[data-slot="alert-dialog-modal"]')).toBeTruthy()
  })

  it('closes through Cancel and Action while preserving caller onPress and opt-out', async () => {
    const defaultOnPress = vi.fn()
    await render(
      tree({ action: <AlertDialogAction onPress={defaultOnPress}>Run</AlertDialogAction> }),
    )
    await clickElement(container.querySelector('[data-slot="button"]') as HTMLButtonElement)
    await clickElement(
      [...document.querySelectorAll('[data-slot="button"]')].find(
        (button) => button.textContent === 'Run',
      ) as HTMLButtonElement,
    )
    expect(defaultOnPress).toHaveBeenCalledTimes(1)
    expect(document.querySelector('[data-slot="alert-dialog-overlay"]')).toBeNull()

    await act(async () => root.unmount())
    root = createRoot(container)
    const onPress = vi.fn()
    await render(
      tree({
        action: (
          <AlertDialogAction closeOnPress={false} onPress={onPress}>
            Run
          </AlertDialogAction>
        ),
      }),
    )
    await clickElement(container.querySelector('[data-slot="button"]') as HTMLButtonElement)
    const action = [...document.querySelectorAll('[data-slot="button"]')].find(
      (button) => button.textContent === 'Run',
    ) as HTMLButtonElement
    await clickElement(action)
    expect(onPress).toHaveBeenCalledTimes(1)
    expect(document.querySelector('[data-slot="alert-dialog-overlay"]')).toBeTruthy()
    const cancel = document.querySelector('.picodash-alert-dialog-cancel') as HTMLButtonElement
    await clickElement(cancel)
    expect(document.querySelector('[data-slot="alert-dialog-overlay"]')).toBeNull()
  })

  it('honors controlled state, outside-dismissal policy, theme/density, and layer precedence', async () => {
    const onOpenChange = vi.fn()
    await render(tree({ isOpen: true, onOpenChange }))
    const overlay = document.querySelector('[data-slot="alert-dialog-overlay"]') as HTMLElement
    expect(overlay.dataset.picodashTheme).toBe('light')
    expect(overlay.dataset.picodashDensity).toBe('compact')
    expect(overlay.style.zIndex).toContain('var(--picodash-layer-dialog)')
    expect(overlay.style.zIndex).toContain('100')
    await dispatchElement(overlay, new MouseEvent('pointerdown', { bubbles: true }))
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
    await clickElement(document.querySelector('.picodash-alert-dialog-cancel') as HTMLButtonElement)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('uses explicit and null portal overrides and keeps component z-index above caller style', async () => {
    const explicitHost = document.createElement('div')
    document.body.append(explicitHost)
    await render(
      tree({
        isOpen: true,
        portalContainer: explicitHost,
        overlayLayerBase: 40,
        overlayStyle: { zIndex: 9999 },
      }),
    )
    const explicitOverlay = explicitHost.querySelector(
      '[data-slot="alert-dialog-overlay"]',
    ) as HTMLElement
    expect(explicitOverlay).toBeTruthy()
    expect(explicitOverlay.parentElement).toBe(explicitHost)
    expect(explicitOverlay.style.zIndex).toContain('var(--picodash-layer-dialog)')
    expect(explicitOverlay.style.zIndex).not.toContain('9999')
    await act(async () => root.unmount())

    root = createRoot(container)
    await render(tree({ isOpen: true, portalContainer: null }))
    const nullOverlay = document.body.querySelector(
      '[data-slot="alert-dialog-overlay"]',
    ) as HTMLElement
    expect(nullOverlay).toBeTruthy()
    expect(nullOverlay.parentElement).toBe(document.body)
  })

  it('resolves the dialog token floor and nested parent plus one expression', () => {
    expect(resolveDialogLayer(undefined, undefined)).toBe('var(--picodash-layer-dialog)')
    expect(resolveDialogLayer(40, undefined)).toBe('max(var(--picodash-layer-dialog), 40)')
    expect(resolveDialogLayer(undefined, 'max(var(--picodash-layer-dialog), 40)')).toBe(
      'max(var(--picodash-layer-dialog), calc(max(var(--picodash-layer-dialog), 40) + 1))',
    )
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 1.5])(
    'rejects invalid explicit layerBase %s',
    async (layerBase) => {
      await expect(render(tree({ isOpen: true, overlayLayerBase: layerBase }))).rejects.toThrow(
        TypeError,
      )
    },
  )
})
