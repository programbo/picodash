// @vitest-environment jsdom
import { act, createRef, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import {
  PicodashOverlayProvider,
  PicodashThemeProvider,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../src/index.tsx'

let host: HTMLDivElement
let root: Root

async function render(element: ReactNode) {
  await act(async () => root.render(element))
  await act(async () => {})
}

function tree(
  children: ReactNode,
  props: Omit<React.ComponentProps<typeof Tooltip>, 'children'> = {},
) {
  return (
    <PicodashThemeProvider theme="dark" density="compact">
      <PicodashOverlayProvider portalContainer={host} layerBase={100}>
        <Tooltip {...props}>{children}</Tooltip>
      </PicodashOverlayProvider>
    </PicodashThemeProvider>
  )
}

function composition(contentProps: Partial<React.ComponentProps<typeof TooltipContent>> = {}) {
  return (
    <>
      <TooltipTrigger>
        <button type="button" aria-label="Help">
          ?
        </button>
      </TooltipTrigger>
      <TooltipContent {...contentProps}>Helpful description</TooltipContent>
    </>
  )
}

describe('@picodash/ui Tooltip', () => {
  beforeEach(() => {
    host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
    vi.stubGlobal('CSS', { escape: (value: string) => value })
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    host.remove()
    vi.unstubAllGlobals()
  })

  it('inherits provider timing and allows an instance override', async () => {
    await render(
      <TooltipProvider delay={0} closeDelay={12}>
        <Tooltip defaultOpen delay={0}>
          {composition()}
        </Tooltip>
      </TooltipProvider>,
    )
    await act(async () => {})
    expect(document.querySelector('[data-slot="tooltip"]')).toBeTruthy()
  })

  it('supports controlled and uncontrolled open state while keeping trigger wrapperless', async () => {
    const onOpenChange = vi.fn()
    await render(tree(composition(), { isOpen: true, onOpenChange }))
    expect(host.querySelector('button')?.parentElement?.tagName).toBe('DIV')
    expect(document.querySelector('[data-slot="tooltip"]')).toBeTruthy()
    expect(host.querySelector('[data-slot="tooltip"]')).toBeTruthy()
    expect(document.querySelector('[data-slot="tooltip"]')?.textContent).toContain(
      'Helpful description',
    )
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('supports explicit body and HTMLElement portals, theme/density, layer, arrow, and composition', async () => {
    const external = document.createElement('section')
    document.body.append(external)
    const contentRef = createRef<HTMLDivElement>()
    const className = (values: { isEntering: boolean; defaultClassName: string | undefined }) =>
      values.isEntering ? 'entering' : 'idle'
    const style = (values: { isEntering: boolean; defaultStyle: React.CSSProperties }) => ({
      ...values.defaultStyle,
      color: 'red',
    })
    await render(
      <PicodashThemeProvider theme="dark" density="compact">
        <Tooltip isOpen>
          <TooltipTrigger>
            <button type="button">Help</button>
          </TooltipTrigger>
          <TooltipContent
            portalContainer={external}
            layerBase={120}
            ref={contentRef}
            className={className}
            style={style}
          >
            Text
          </TooltipContent>
        </Tooltip>
      </PicodashThemeProvider>,
    )
    const trigger = host.querySelector('button') as HTMLButtonElement
    trigger.focus()
    await act(async () => {})
    const tooltip = external.querySelector('[data-slot="tooltip"]') as HTMLElement
    expect(tooltip).toBeTruthy()
    expect(tooltip.dataset.picodashTheme).toBe('dark')
    expect(tooltip.dataset.picodashDensity).toBe('compact')
    expect(tooltip.className).toContain('picodash-tooltip')
    expect(tooltip.className).toContain('idle')
    expect(tooltip.style.color).toBe('red')
    expect(tooltip.style.zIndex).toContain('120')
    expect(external.querySelector('[data-slot="tooltip"]')).toBe(tooltip)
    expect(external.innerHTML).toContain('picodash-tooltip-arrow')
    expect(contentRef.current).toBe(tooltip)
    external.remove()

    await render(
      <PicodashThemeProvider theme="dark" density="compact">
        <Tooltip isOpen>
          <TooltipTrigger>
            <button type="button">Help</button>
          </TooltipTrigger>
          <TooltipContent portalContainer={null}>Body tooltip</TooltipContent>
        </Tooltip>
      </PicodashThemeProvider>,
    )
    expect(document.body.querySelector('[data-slot="tooltip"]')?.textContent).toContain(
      'Body tooltip',
    )
  })

  it('rejects invalid layer bases before rendering', async () => {
    await expect(render(tree(composition({ layerBase: 1.2 })))).rejects.toThrow(
      'layerBase must be a finite integer',
    )
  })

  it('rejects duplicate, reversed, and extra composition children', async () => {
    await expect(
      render(
        tree(
          <>
            <TooltipContent>Text</TooltipContent>
            <TooltipTrigger>
              <button type="button">Help</button>
            </TooltipTrigger>
          </>,
        ),
      ),
    ).rejects.toThrow('exactly TooltipTrigger followed by TooltipContent')
    await expect(
      render(
        tree(
          <>
            <TooltipTrigger>
              <button type="button">Help</button>
            </TooltipTrigger>
            <TooltipContent>Text</TooltipContent>
            <TooltipContent>Extra</TooltipContent>
          </>,
        ),
      ),
    ).rejects.toThrow('exactly TooltipTrigger followed by TooltipContent')
  })
})
