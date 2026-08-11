// @vitest-environment jsdom
import { act, createElement } from 'react'
import { describe, expect, it } from 'vite-plus/test'
import {
  createDomTestRenderer as create,
  type DomTestRenderer,
} from '../../../test/dom-renderer.ts'
import { createPicodashNexus } from '../src/index.ts'
import type { RootNexus, ScopedNexus } from '../src/index.ts'
import { shallowEqual, usePicodashNexusSelector } from '../src/react.ts'

type Values = { readonly count: number; readonly label: string }
type TestNexus = RootNexus<any, any> | ScopedNexus<any, any>

function makeNexus(initialValues?: Partial<Values>) {
  return createPicodashNexus({
    valueOwner: 'nexus',
    fields: {
      count: { defaultValue: 0 },
      label: { defaultValue: 'initial' },
    },
    initialValues,
  })
}

function mountSelector<T>(
  nexus: TestNexus,
  selector: (state: any) => T,
  equality?: (left: T, right: T) => boolean,
) {
  let renders = 0
  let latestSelection!: T
  function View({
    currentNexus,
    currentSelector,
    currentEquality,
  }: {
    currentNexus: TestNexus
    currentSelector: (state: any) => T
    currentEquality?: typeof equality
  }) {
    renders += 1
    const selected = usePicodashNexusSelector(currentNexus, currentSelector, currentEquality)
    latestSelection = selected
    return createElement('output', null, JSON.stringify(selected))
  }
  let renderer!: DomTestRenderer
  act(() => {
    renderer = create(
      createElement(View, {
        currentNexus: nexus,
        currentSelector: selector,
        currentEquality: equality,
      }),
    )
  })
  return {
    get renders() {
      return renders
    },
    get output() {
      return renderer.toJSON()
    },
    get selection() {
      return latestSelection
    },
    update(nextNexus: TestNexus, nextSelector: (state: any) => T, nextEquality?: typeof equality) {
      act(() => {
        renderer.update(
          createElement(View, {
            currentNexus: nextNexus,
            currentSelector: nextSelector,
            currentEquality: nextEquality,
          }),
        )
      })
    },
    unmount() {
      act(() => renderer.unmount())
    },
  }
}

describe('@picodash/nexus/react explicit selectors', () => {
  it('handles a source mutation during subscription setup', () => {
    const nexus = makeNexus({ count: 0 })
    let subscribeCalls = 0
    const racedNexus = {
      ...nexus,
      subscribe(listener: () => void) {
        subscribeCalls += 1
        nexus.setValues({ count: 1 })
        return nexus.subscribe(listener)
      },
    } as typeof nexus

    const view = mountSelector(racedNexus, (state) => state.values.count)
    expect(subscribeCalls).toBe(1)
    expect(view.output).toMatchObject({ type: 'output', children: ['1'] })
    view.unmount()
  })

  it('does not churn a subscription on an unrelated parent rerender', () => {
    const nexus = makeNexus()
    const selector = (state: ReturnType<typeof nexus.getState>) => state.values.count
    let subscribeCalls = 0
    let unsubscribeCalls = 0
    const countedNexus = {
      ...nexus,
      subscribe(listener: () => void) {
        subscribeCalls += 1
        const unsubscribe = nexus.subscribe(listener)
        return () => {
          unsubscribeCalls += 1
          unsubscribe()
        }
      },
    } as typeof nexus

    let renderer!: DomTestRenderer
    function View({ tick }: { readonly tick: number }) {
      const value = usePicodashNexusSelector(countedNexus, selector)
      return createElement('output', { 'data-tick': tick }, String(value))
    }
    act(() => {
      renderer = create(createElement(View, { tick: 0 }))
    })
    act(() => {
      renderer.update(createElement(View, { tick: 1 }))
    })
    expect(subscribeCalls).toBe(1)
    expect(unsubscribeCalls).toBe(0)
    act(() => renderer.unmount())
    expect(unsubscribeCalls).toBe(1)
  })

  it('selects initial values and follows root and scoped notifications', () => {
    const nexus = makeNexus({ count: 1 })
    const scoped = nexus.scope('settings')
    const root = mountSelector(nexus, (state) => state.values.count)
    const scopedView = mountSelector(scoped, (state) => state.values.count)
    expect(root.output).toMatchObject({ type: 'output', children: ['1'] })
    expect(scopedView.output).toMatchObject({ type: 'output', children: ['1'] })

    act(() => {
      nexus.setValues({ count: 2 })
    })
    expect(root.output).toMatchObject({ children: ['2'] })
    expect(scopedView.output).toMatchObject({ children: ['2'] })
    expect(root.renders).toBe(2)
    expect(scopedView.renders).toBe(2)
    root.unmount()
    scopedView.unmount()
  })

  it('suppresses a same-scope notification when the selection is unchanged', () => {
    const nexus = makeNexus()
    const scoped = nexus.scope('settings')
    const view = mountSelector(scoped, (state) => state.values)
    const initialRenders = view.renders
    act(() => {
      scoped.setDashListRootOrder(['a', 'b'])
    })
    expect(view.renders).toBe(initialRenders)
    expect(view.output).toMatchObject({ children: ['{"count":0,"label":"initial"}'] })
    view.unmount()
  })

  it('does not run a scoped selector for metadata changes in another scope', () => {
    const nexus = makeNexus()
    const scopeA = nexus.scope('a')
    const scopeB = nexus.scope('b')
    let selectorCalls = 0
    const view = mountSelector(scopeA, (state) => {
      selectorCalls += 1
      return state.values.count
    })
    const callsAfterMount = selectorCalls
    const rendersAfterMount = view.renders
    act(() => {
      scopeB.setDashListRootOrder(['b-item'])
    })
    expect(selectorCalls).toBe(callsAfterMount)
    expect(view.renders).toBe(rendersAfterMount)
    view.unmount()
  })

  it('retains the selected reference for custom equality and applies selector/equality replacements', () => {
    const nexus = makeNexus()
    const first = { kind: 'first' as const }
    const second = { kind: 'first' as const }
    const equal = (left: { kind: string }, right: { kind: string }) => left.kind === right.kind
    const view = mountSelector(nexus, () => first, equal)
    const initialSelection = view.selection
    expect(view.renders).toBe(1)
    act(() => {
      nexus.setValues({ count: 1 })
    })
    expect(view.renders).toBe(1)
    expect(view.selection).toBe(initialSelection)

    view.update(nexus, () => second, equal)
    expect(view.renders).toBe(2)
    expect(view.selection).toBe(initialSelection)
    expect(view.output).toMatchObject({ children: ['{"kind":"first"}'] })

    view.update(nexus, () => second, Object.is)
    expect(view.selection).toBe(second)
    expect(view.output).toMatchObject({ children: ['{"kind":"first"}'] })
    view.unmount()
  })

  it('resubscribes when the Nexus changes and tears down old subscriptions', () => {
    const first = makeNexus({ count: 1 })
    const second = makeNexus({ count: 10 })
    const view = mountSelector(first, (state) => state.values.count)
    view.update(second, (state) => state.values.count)
    expect(view.output).toMatchObject({ children: ['10'] })
    const rendersAfterReplacement = view.renders
    act(() => {
      first.setValues({ count: 2 })
    })
    expect(view.renders).toBe(rendersAfterReplacement)
    act(() => {
      second.setValues({ count: 11 })
    })
    expect(view.output).toMatchObject({ children: ['11'] })
    view.unmount()
    const rendersAfterUnmount = view.renders
    act(() => {
      second.setValues({ count: 12 })
    })
    expect(view.renders).toBe(rendersAfterUnmount)
  })
})

describe('shallowEqual', () => {
  it('handles Object.is edge cases and one-level records', () => {
    expect(shallowEqual(NaN, NaN)).toBe(true)
    expect(shallowEqual(-0, 0)).toBe(false)
    expect(shallowEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true)
    expect(shallowEqual({ nested: { value: 1 } }, { nested: { value: 1 } })).toBe(false)
    expect(shallowEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false)
  })

  it('handles arrays and rejects unsupported categories', () => {
    expect(shallowEqual([1, 'two'] as const, [1, 'two'] as const)).toBe(true)
    expect(shallowEqual([1, 2], [2, 1])).toBe(false)
    expect(shallowEqual({ 0: 1, 1: 2 }, [1, 2])).toBe(false)
    expect(shallowEqual(new Map([['a', 1]]), new Map([['a', 1]]))).toBe(false)
    expect(shallowEqual(new Set([1]), new Set([1]))).toBe(false)
    expect(shallowEqual(Object.create({ a: 1 }), Object.create({ a: 1 }))).toBe(false)
    const symbol = Symbol('private')
    expect(shallowEqual({ a: 1, [symbol]: 2 }, { a: 1, [symbol]: 2 })).toBe(false)
  })
})
