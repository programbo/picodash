import { createElement } from 'react'
import { describe, it } from 'vite-plus/test'
import { PicodashThemeProvider } from '../src/index.tsx'
import type {
  PicodashDensity,
  PicodashResolvedTheme,
  PicodashTheme,
  PicodashThemeOption,
  PicodashThemeProviderProps,
} from '../src/index.tsx'

describe('@picodash/ui theme provider types', () => {
  it('accepts custom theme names and rejects product-owned surfaces', () => {
    const builtIn: PicodashTheme = 'system'
    const density: PicodashDensity = 'compact'
    const customOption: PicodashThemeOption<'brand'> = 'brand'
    const customResolved: PicodashResolvedTheme<'brand'> = 'brand'

    void builtIn
    void density
    void customOption
    void customResolved

    const customProviderProps: PicodashThemeProviderProps<'brand'> = {
      children: null,
      theme: 'brand',
      density: 'regular',
    }
    void customProviderProps

    const customElement = createElement(PicodashThemeProvider<'brand'>, {
      children: null,
      theme: 'brand',
    })
    void customElement

    const defaultProviderProps: PicodashThemeProviderProps = { children: null }
    void defaultProviderProps

    // @ts-expect-error compact is a density, not a built-in theme preference.
    const compactTheme: PicodashThemeProviderProps = { children: null, theme: 'compact' }
    void compactTheme

    // @ts-expect-error component inference must not treat a density as a custom theme.
    const compactElement = createElement(PicodashThemeProvider, {
      children: null,
      theme: 'compact',
    })
    void compactElement

    // @ts-expect-error the Provider is controlled and has no setter.
    const setter: PicodashThemeProviderProps = { children: null, setTheme: () => {} }
    void setter

    // @ts-expect-error the Provider has no change callback.
    const callback: PicodashThemeProviderProps = { children: null, onThemeChange: () => {} }
    void callback

    // @ts-expect-error portal placement belongs to the overlay provider, not the theme provider.
    const portal: PicodashThemeProviderProps = { children: null, portalContainer: null }
    void portal

    // @ts-expect-error the carrier has no layout props.
    const layout: PicodashThemeProviderProps = { children: null, className: 'carrier' }
    void layout

    // @ts-expect-error the carrier does not expose a ref.
    const ref: PicodashThemeProviderProps = { children: null, ref: { current: null } }
    void ref
  })
})
