import { createElement, type ReactElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it, vi } from 'vite-plus/test'
import { useUNSAFE_PortalContext } from 'react-aria'
import {
  PicodashOverlayProvider,
  usePicodashOverlayDefaults,
  type PicodashOverlayProviderProps,
} from '../src/index.tsx'

function render(element: ReactElement) {
  let renderer!: ReactTestRenderer
  act(() => {
    renderer = create(element)
  })
  return renderer
}

function provider(props: Omit<PicodashOverlayProviderProps, 'children'>, children: ReactElement) {
  return createElement(PicodashOverlayProvider, { ...props, children })
}

function DefaultsProbe({ id = 'probe' }: { id?: string }) {
  const defaults = usePicodashOverlayDefaults()
  const { getContainer } = useUNSAFE_PortalContext()
  return createElement('output', {
    id,
    portalContainer: defaults.portalContainer,
    layerBase: defaults.layerBase,
    ariaPortalContainer: getContainer?.(),
  })
}

describe('@picodash/ui overlay provider', () => {
  it('uses body and null standalone defaults depending on the document', () => {
    const body = {} as HTMLElement
    vi.stubGlobal('document', { body })
    let renderer = render(createElement(DefaultsProbe))
    expect(renderer.root.findByType('output').props).toMatchObject({ portalContainer: body })
    act(() => renderer.unmount())

    vi.stubGlobal('document', undefined)
    renderer = render(createElement(DefaultsProbe))
    expect(renderer.root.findByType('output').props.portalContainer).toBeNull()
    act(() => renderer.unmount())
    vi.unstubAllGlobals()
  })

  it('renders no DOM and inherits or replaces each default independently', () => {
    const body = {} as HTMLElement
    const replacement = {} as HTMLElement
    vi.stubGlobal('document', { body })
    const renderer = render(
      provider(
        { portalContainer: replacement, layerBase: -3 },
        provider(
          {},
          createElement(
            'section',
            null,
            createElement(DefaultsProbe, { id: 'inherited' }),
            provider(
              { portalContainer: null, layerBase: 0 },
              createElement(DefaultsProbe, { id: 'reset' }),
            ),
          ),
        ),
      ),
    )
    expect(renderer.root.findAllByType('output').map((output) => output.props)).toMatchObject([
      {
        id: 'inherited',
        portalContainer: replacement,
        layerBase: -3,
        ariaPortalContainer: replacement,
      },
      { id: 'reset', portalContainer: body, layerBase: 0, ariaPortalContainer: body },
    ])
    expect(renderer.toJSON()).toMatchObject({ type: 'section' })
    act(() => renderer.unmount())
    vi.unstubAllGlobals()
  })

  it('bridges the exact selected host and clears inherited React Aria context', () => {
    const host = {} as HTMLElement
    vi.stubGlobal('document', undefined)
    const renderer = render(
      provider(
        { portalContainer: host },
        provider({ portalContainer: null }, createElement(DefaultsProbe)),
      ),
    )
    expect(renderer.root.findByType('output').props).toMatchObject({
      portalContainer: null,
      ariaPortalContainer: undefined,
    })
    act(() => renderer.unmount())

    vi.stubGlobal('document', { body: host })
    const inherited = render(provider({}, createElement(DefaultsProbe)))
    expect(inherited.root.findByType('output').props.ariaPortalContainer).toBe(host)
    act(() => inherited.unmount())
    vi.unstubAllGlobals()
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 1.5])(
    'rejects invalid layerBase %s synchronously',
    (layerBase) => {
      expect(() => render(provider({ layerBase }, createElement(DefaultsProbe)))).toThrowError(
        TypeError,
      )
    },
  )
})
