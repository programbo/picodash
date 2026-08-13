// @vitest-environment jsdom
import { createRef, type CSSProperties } from 'react'
import { describe, expectTypeOf, it } from 'vite-plus/test'
import { Popover, type PopoverProps } from '../src/index.tsx'

describe('@picodash/ui Popover types', () => {
  it('preserves the public React Aria contract with Picodash portal and layer overrides', () => {
    const portal = document.createElement('div')
    const ref = createRef<HTMLElement>()
    const props: PopoverProps = {
      children: ({ placement }) => placement ?? 'unplaced',
      className: ({ isEntering }) => (isEntering ? 'entering' : 'idle'),
      style: ({ defaultStyle }) => ({ ...defaultStyle, color: 'red' }),
      render: (domProps) => <div {...domProps} />,
      ref,
      portalContainer: portal,
      layerBase: 40,
      placement: 'bottom end',
      offset: 8,
      crossOffset: 2,
      shouldFlip: true,
      isOpen: true,
      onOpenChange: () => undefined,
      shouldCloseOnInteractOutside: () => true,
    }
    const plainStyle: NonNullable<PopoverProps['style']> = {} satisfies CSSProperties
    void plainStyle
    void props
    expectTypeOf(Popover).toBeCallableWith(props)

    const reservedPortal: PopoverProps = {
      children: null,
      // @ts-expect-error The unstable upstream portal prop is reserved by Picodash.
      UNSTABLE_portalContainer: portal,
    }
    void reservedPortal

    const svgPortal: PopoverProps = {
      children: null,
      // @ts-expect-error Picodash portal containers are HTML elements.
      portalContainer: document.createElementNS('http://www.w3.org/2000/svg', 'svg'),
    }
    void svgPortal
  })

  it('does not export private layer context, hooks, or arithmetic', async () => {
    const ui = await import('../src/index.tsx')
    expectTypeOf(ui).not.toHaveProperty('ActiveOverlayLayer')
    expectTypeOf(ui).not.toHaveProperty('useActiveOverlayLayer')
    expectTypeOf(ui).not.toHaveProperty('resolveOverlayLayer')
  })
})
