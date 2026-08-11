// @vitest-environment jsdom
import { act, createElement, type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vite-plus/test'
import {
  createDomTestRenderer as create,
  type DomTestRenderer,
} from '../../../test/dom-renderer.ts'
import { createPicodashNexus } from '@picodash/nexus'
import { usePicodashScope } from '@picodash/nexus/react'
import { DashPanel, DashList, Dashlet, PicodashProvider } from '../src/index.ts'

function render(element: ReactElement): DomTestRenderer {
  let renderer!: DomTestRenderer
  act(() => {
    renderer = create(element)
  })
  return renderer
}

const makeNexus = () =>
  createPicodashNexus({ valueOwner: 'nexus', fields: { value: { defaultValue: 0 } } })

describe('@picodash/picodash facade alpha', () => {
  it('composes Provider, Panel, id-less primary List, and Dashlet in one Panel scope', () => {
    const nexus = makeNexus()
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    function ScopeProbe() {
      return createElement('output', { 'data-scope': usePicodashScope().scopeId })
    }
    act(() => {
      root.render(
        createElement(
          PicodashProvider,
          { nexus, children: null },
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
    act(() => root.unmount())
    container.remove()
    expect(() => nexus.destroy()).not.toThrow()
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
      const nexus = makeNexus()
      const renderer = render(
        createElement(PicodashProvider, { nexus, children: null, dockPositions: [position] }),
      )
      act(() => renderer.unmount())
      expect(() => nexus.destroy()).not.toThrow()
    }

    for (const position of ['full-top', 'center-top', 'full-bottom', 'center-bottom', 'invalid']) {
      const nexus = makeNexus()
      expect(() =>
        render(
          createElement(PicodashProvider, {
            nexus,
            children: null,
            dockPositions: [position] as never,
          }),
        ),
      ).toThrow(/invalid dock position/)
      expect(() => nexus.destroy()).not.toThrow()
    }
    const malformed = makeNexus()
    expect(() =>
      render(
        createElement(PicodashProvider, {
          nexus: malformed,
          children: null,
          dockPositions: 'top-left' as never,
        }),
      ),
    ).toThrow(/must be an array/)
    expect(() => malformed.destroy()).not.toThrow()
  })
})
