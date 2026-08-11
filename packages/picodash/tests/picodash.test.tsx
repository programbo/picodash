// @vitest-environment jsdom
import { act as domAct, createElement, type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { describe, expect, it } from 'vite-plus/test'
import { createPicodashStore } from '@picodash/store'
import { usePicodashScope } from '@picodash/store/react'
import { DashPanel, DashList, Dashlet, PicodashProvider } from '../src/index.ts'

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
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    function ScopeProbe() {
      return createElement('output', { 'data-scope': usePicodashScope().scopeId })
    }
    domAct(() => {
      root.render(
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
    })
    expect(document.body.querySelector('[data-picodash-panel]')).toBeTruthy()
    expect(document.body.querySelector('[data-picodash-dashlist]')).toBeTruthy()
    expect(document.body.querySelector('[data-picodash-dashlet="value"]')).toBeTruthy()
    expect(document.body.querySelector('output')?.getAttribute('data-scope')).toBe('settings')
    domAct(() => root.unmount())
    container.remove()
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
