import { createElement } from 'react'
import { describe, it } from 'vite-plus/test'
import { PicodashOverlayProvider } from '../src/index.tsx'
import type { PicodashOverlayDefaults, PicodashOverlayProviderProps } from '../src/index.tsx'

describe('@picodash/ui overlay provider types', () => {
  it('accepts HTMLElement and null while keeping defaults readonly', () => {
    const host = {} as HTMLElement
    const props: PicodashOverlayProviderProps = {
      children: null,
      portalContainer: host,
      layerBase: -1,
    }
    const reset: PicodashOverlayProviderProps = { children: null, portalContainer: null }
    const defaults: PicodashOverlayDefaults = { portalContainer: host, layerBase: 0 }
    void props
    void reset
    void defaults

    // @ts-expect-error resolved defaults are readonly.
    defaults.layerBase = 2

    void createElement(PicodashOverlayProvider, props)
    const svg: PicodashOverlayProviderProps = {
      children: null,
      // @ts-expect-error SVGElement is not an accepted portal host.
      portalContainer: {} as SVGElement,
    }
    void svg
    const element: PicodashOverlayProviderProps = {
      children: null,
      // @ts-expect-error arbitrary Element is not an accepted portal host.
      portalContainer: {} as Element,
    }
    void element

    // @ts-expect-error overlay defaults do not expose setters.
    const setter: PicodashOverlayProviderProps = { children: null, setLayerBase: () => {} }
    void setter
    const theme: PicodashOverlayProviderProps = {
      children: null,
      // @ts-expect-error theme and density belong to the independent theme provider.
      theme: 'dark',
      density: 'compact',
    }
    void theme
    // @ts-expect-error overlay defaults do not expose layout or ref props.
    const layout: PicodashOverlayProviderProps = { children: null, className: 'overlay' }
    void layout
    // @ts-expect-error overlay defaults do not expose a ref.
    const ref: PicodashOverlayProviderProps = { children: null, ref: { current: null } }
    void ref
    // @ts-expect-error overlay provider does not accept Nexus or product props.
    const product: PicodashOverlayProviderProps = { children: null, nexus: {} }
    void product
  })
})
