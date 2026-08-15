// @vitest-environment jsdom
import { act, createRef, useRef, type CSSProperties, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { DialogTrigger } from 'react-aria-components'
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test'
import { clickElement, dispatchElement, renderReactRoot } from '../../../test/react.ts'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogOverlay,
  Button,
  PicodashOverlayProvider,
  PicodashThemeProvider,
  Popover,
} from '../src/index.tsx'

let container: HTMLDivElement
let root: Root

async function render(element: ReactNode) {
  await renderReactRoot(root, element)
}

function popoverTrigger(children: ReactNode, popoverProps = {}) {
  return (
    <DialogTrigger defaultOpen>
      <Button>Open popover</Button>
      <Popover {...popoverProps}>{children}</Popover>
    </DialogTrigger>
  )
}

function NestedPopoverTree() {
  const parentTriggerRef = useRef<HTMLButtonElement>(null)
  const childTriggerRef = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button ref={parentTriggerRef} type="button">
        Parent anchor
      </button>
      <Popover isOpen triggerRef={parentTriggerRef} data-testid="parent-popover">
        <button ref={childTriggerRef} type="button">
          Child anchor
        </button>
        <Popover isOpen triggerRef={childTriggerRef} data-testid="child-popover">
          Child popover
        </Popover>
      </Popover>
    </>
  )
}

describe('@picodash/ui Popover', () => {
  beforeEach(() => {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  it('uses the standalone body portal and preserves theme, density, caller render props, style, and ref', async () => {
    const ref = createRef<HTMLElement>()
    const className = (values: { isEntering: boolean }) =>
      values.isEntering ? 'caller-entering' : 'caller-idle'
    const style = (values: { defaultStyle: CSSProperties }) => ({
      ...values.defaultStyle,
      color: 'red',
    })

    await render(
      <PicodashThemeProvider theme="light" density="compact">
        {popoverTrigger('Standalone popover', {
          ref,
          className,
          style,
          render: (domProps: React.HTMLAttributes<HTMLDivElement>) => (
            <div {...domProps} data-custom-popover-root />
          ),
        })}
      </PicodashThemeProvider>,
    )

    const popover = document.body.querySelector('[data-slot="popover"]') as HTMLElement
    expect(popover).toBeTruthy()
    expect(document.body.contains(popover)).toBe(true)
    expect(container.contains(popover)).toBe(false)
    expect(popover.dataset.picodashTheme).toBe('light')
    expect(popover.dataset.picodashDensity).toBe('compact')
    expect(popover.dataset.customPopoverRoot).toBe('true')
    expect(popover.className).toContain('caller-idle')
    expect(popover.style.color).toBe('red')
    expect(popover.style.zIndex).toBe('var(--picodash-layer-popover)')
    expect(ref.current).toBe(popover)

    await render(
      <PicodashThemeProvider theme="dark" density="regular">
        {popoverTrigger('Standalone popover', { ref, className, style })}
      </PicodashThemeProvider>,
    )
    expect(document.body.querySelector('[data-slot="popover"]')).toHaveProperty(
      'dataset.picodashTheme',
      'dark',
    )
    expect(document.body.querySelector('[data-slot="popover"]')).toHaveProperty(
      'dataset.picodashDensity',
      'regular',
    )
  })

  it('inherits the Provider portal and base without mutating the shared host', async () => {
    const portal = document.createElement('section')
    document.body.append(portal)
    await render(
      <PicodashThemeProvider theme="dark" density="regular">
        <PicodashOverlayProvider portalContainer={portal} layerBase={120}>
          {popoverTrigger('Provider popover')}
        </PicodashOverlayProvider>
      </PicodashThemeProvider>,
    )

    const popover = portal.querySelector('[data-slot="popover"]') as HTMLElement
    expect(popover).toBeTruthy()
    expect(popover.style.zIndex).toBe('max(var(--picodash-layer-popover), 120)')
    expect(popover.dataset.picodashTheme).toBe('dark')
    expect(popover.dataset.picodashDensity).toBe('regular')
    expect(portal.hasAttribute('data-picodash-theme')).toBe(false)
    expect(portal.hasAttribute('data-picodash-density')).toBe(false)
    portal.remove()
  })

  it('supports explicit HTMLElement and body portal overrides', async () => {
    const inherited = document.createElement('section')
    const explicit = document.createElement('aside')
    document.body.append(inherited, explicit)
    await render(
      <PicodashOverlayProvider portalContainer={inherited}>
        {popoverTrigger('Explicit popover', { portalContainer: explicit })}
      </PicodashOverlayProvider>,
    )
    expect(explicit.querySelector('[data-slot="popover"]')?.textContent).toContain(
      'Explicit popover',
    )
    expect(inherited.querySelector('[data-slot="popover"]')).toBeNull()
    expect(explicit.hasAttribute('data-picodash-theme')).toBe(false)
    expect(explicit.hasAttribute('data-picodash-density')).toBe(false)

    await act(async () => root.unmount())
    root = createRoot(container)
    await render(
      <PicodashOverlayProvider portalContainer={inherited}>
        {popoverTrigger('Body popover', { portalContainer: null })}
      </PicodashOverlayProvider>,
    )
    expect(document.body.querySelector('[data-slot="popover"]')?.textContent).toContain(
      'Body popover',
    )
    expect(inherited.querySelector('[data-slot="popover"]')).toBeNull()
    inherited.remove()
    explicit.remove()
  })

  it('resolves above an AlertDialog and propagates its resolved layer to descendants', async () => {
    const portal = document.createElement('section')
    document.body.append(portal)
    await render(
      <PicodashOverlayProvider portalContainer={portal} layerBase={80}>
        <AlertDialog isOpen>
          <AlertDialogOverlay>
            <AlertDialogContent>
              <NestedPopoverTree />
            </AlertDialogContent>
          </AlertDialogOverlay>
        </AlertDialog>
      </PicodashOverlayProvider>,
    )

    const dialog = portal.querySelector('[data-slot="alert-dialog-overlay"]') as HTMLElement
    const parent = portal.querySelector('[data-testid="parent-popover"]') as HTMLElement
    const child = portal.querySelector('[data-testid="child-popover"]') as HTMLElement
    const dialogLayer = 'max(var(--picodash-layer-dialog), 80)'
    const parentLayer = `max(var(--picodash-layer-popover), 80, calc(${dialogLayer} + 1))`
    expect(dialog.style.zIndex).toBe(dialogLayer)
    expect(parent.style.zIndex).toBe(parentLayer)
    expect(child.style.zIndex).toBe(
      `max(var(--picodash-layer-popover), 80, calc(${parentLayer} + 1))`,
    )
    portal.remove()
  })

  it.each([-20, 0, 400])('uses explicit layerBase %s as a minimum', async (layerBase) => {
    await render(popoverTrigger('Layered popover', { layerBase }))
    expect((document.querySelector('[data-slot="popover"]') as HTMLElement).style.zIndex).toBe(
      `max(var(--picodash-layer-popover), ${layerBase})`,
    )
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 1.5])(
    'rejects invalid explicit layerBase %s',
    async (layerBase) => {
      await expect(render(popoverTrigger('Invalid popover', { layerBase }))).rejects.toThrow(
        TypeError,
      )
    },
  )

  it('retains React Aria keyboard dismissal', async () => {
    await render(
      <DialogTrigger>
        <Button>Open dismissable popover</Button>
        <Popover>Dismissable popover</Popover>
      </DialogTrigger>,
    )
    const trigger = container.querySelector('[data-slot="button"]') as HTMLButtonElement
    await clickElement(trigger)
    const popover = document.querySelector('[data-slot="popover"]') as HTMLElement
    await dispatchElement(popover, new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await act(async () => {})
    expect(document.querySelector('[data-slot="popover"]')).toBeNull()
  })
})
