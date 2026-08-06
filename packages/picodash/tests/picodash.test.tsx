// @vitest-environment jsdom
import { createElement, type ReactElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it } from 'vite-plus/test'
import { createPicodashStore } from '@picodash/store'
import { usePicodashScope } from '@picodash/store/react'
import { DashPanel, DashList, Dashlet, PicodashProvider } from '../src/index.ts'

;(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

function render(element: ReactElement): ReactTestRenderer {
  let renderer!: ReactTestRenderer
  act(() => {
    renderer = create(element)
  })
  return renderer
}

const makeStore = () =>
  createPicodashStore({ valueOwner: 'store', fields: { value: { defaultValue: 0 } } })

describe('@picodash/picodash facade alpha', () => {
  it('composes Provider, Panel, id-less primary List, and Dashlet in one Panel scope', () => {
    const store = makeStore()
    function ScopeProbe() {
      return createElement('output', { 'data-scope': usePicodashScope().scopeId })
    }
    const renderer = render(
      createElement(
        PicodashProvider,
        { store, children: null },
        createElement(
          DashPanel,
          { id: 'settings', title: 'Settings' },
          createElement(
            DashList,
            null,
            createElement(Dashlet, {
              id: 'value',
              label: 'Value',
              children: createElement(ScopeProbe),
            }),
          ),
        ),
      ),
    )
    expect(renderer.root.findByProps({ 'data-picodash-panel': true })).toBeDefined()
    expect(renderer.root.findByProps({ 'data-picodash-dashlist': true })).toBeDefined()
    expect(renderer.root.findByProps({ 'data-picodash-dashlet': 'value' })).toBeDefined()
    expect(renderer.root.findByType('output').props['data-scope']).toBe('settings')
    act(() => renderer.unmount())
    expect(() => store.destroy()).not.toThrow()
  })

  it('accepts every alpha dock position and rejects malformed or forbidden values', () => {
    const accepted = [
      'top-left',
      'top-right',
      'bottom-right',
      'bottom-left',
      'full-left',
      'center-left',
      'full-right',
      'center-right',
    ] as const
    for (const position of accepted) {
      const store = makeStore()
      const renderer = render(
        createElement(PicodashProvider, { store, children: null, dockPositions: [position] }),
      )
      act(() => renderer.unmount())
      expect(() => store.destroy()).not.toThrow()
    }

    for (const position of ['full-top', 'center-top', 'full-bottom', 'center-bottom', 'invalid']) {
      const store = makeStore()
      expect(() =>
        render(
          createElement(PicodashProvider, {
            store,
            children: null,
            dockPositions: [position] as never,
          }),
        ),
      ).toThrow(/invalid dock position/)
      expect(() => store.destroy()).not.toThrow()
    }
    const malformed = makeStore()
    expect(() =>
      render(
        createElement(PicodashProvider, {
          store: malformed,
          children: null,
          dockPositions: 'top-left' as never,
        }),
      ),
    ).toThrow(/must be an array/)
    expect(() => malformed.destroy()).not.toThrow()
  })
})
