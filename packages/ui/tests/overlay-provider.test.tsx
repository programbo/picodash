// @vitest-environment jsdom
import { act, createElement, type ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import {
  createDomTestRenderer as create,
  type DomTestRenderer,
} from '../../../test/dom-renderer.ts'
import { useUNSAFE_PortalContext } from 'react-aria'
import {
  PicodashOverlayProvider,
  usePicodashOverlayDefaults,
  type PicodashOverlayProviderProps,
} from '../src/index.tsx'

function render(element: ReactElement) {
  let renderer!: DomTestRenderer
  act(() => {
    renderer = create(element)
  })
  return renderer
}

function provider(props: Omit<PicodashOverlayProviderProps, 'children'>, children: ReactElement) {
  return createElement(PicodashOverlayProvider, { ...props, children })
}

interface DefaultsObservation {
  readonly portalContainer: HTMLElement | null
  readonly layerBase: number | undefined
  readonly ariaPortalContainer: Element | null | undefined
}

const observations = new Map<string, DefaultsObservation>()

function DefaultsProbe({ id = 'probe' }: { id?: string }) {
  const defaults = usePicodashOverlayDefaults()
  const { getContainer } = useUNSAFE_PortalContext()
  observations.set(id, {
    portalContainer: defaults.portalContainer,
    layerBase: defaults.layerBase,
    ariaPortalContainer: getContainer?.(),
  })
  return createElement('output', { id })
}

describe('@picodash/ui overlay provider', () => {
  beforeEach(() => observations.clear())

  it('uses body and null standalone defaults depending on the document', () => {
    const body = {} as HTMLElement
    vi.stubGlobal('document', { body })
    let renderer = render(createElement(DefaultsProbe))
    expect(observations.get('probe')).toMatchObject({ portalContainer: body })
    act(() => renderer.unmount())

    vi.stubGlobal('document', undefined)
    renderer = render(createElement(DefaultsProbe))
    expect(observations.get('probe')?.portalContainer).toBeNull()
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
    expect(observations.get('inherited')).toMatchObject({
      portalContainer: replacement,
      layerBase: -3,
      ariaPortalContainer: replacement,
    })
    expect(observations.get('reset')).toMatchObject({
      portalContainer: body,
      layerBase: 0,
      ariaPortalContainer: body,
    })
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
    expect(observations.get('probe')).toMatchObject({
      portalContainer: null,
      ariaPortalContainer: undefined,
    })
    act(() => renderer.unmount())

    vi.stubGlobal('document', { body: host })
    const inherited = render(provider({}, createElement(DefaultsProbe)))
    expect(observations.get('probe')?.ariaPortalContainer).toBe(host)
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
