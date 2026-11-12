// @vitest-environment jsdom
import { act, createElement, StrictMode, type ReactElement } from 'react'
import { describe, expect, it } from 'vite-plus/test'
import { createDomTestRenderer as create } from '../../../test/dom-renderer.ts'
import { createPicodashNexus, type NexusInteractionEvent } from '@picodash/nexus'
import { DashList, Dashlet } from '../src/index.tsx'

function render(element: ReactElement) {
  let renderer!: ReturnType<typeof create>
  act(() => {
    renderer = create(element)
  })
  return renderer
}

describe('DashList public Nexus interaction reporting', () => {
  it('attributes standalone keyboard reorder to the List and flushes updates before one accepted end', () => {
    const nexus = createPicodashNexus({ valueOwner: 'nexus', fields: {} })
    const events: NexusInteractionEvent[] = []
    const unsubscribe = nexus.events.subscribe((event) => events.push(event))
    const renderer = render(
      createElement(
        StrictMode,
        null,
        createElement(
          DashList,
          { id: 'reorder', nexus },
          createElement(Dashlet, { id: 'one', label: 'One' }),
          createElement(Dashlet, { id: 'two', label: 'Two' }),
        ),
      ),
    )
    const handle = () => renderer.root.findByProps({ 'data-picodash-reorder-handle': 'one' })
    const key = (value: string) =>
      act(() => {
        handle().props.onKeyDown({ key: value, preventDefault() {} })
      })
    const initialSnapshot = nexus.getState()
    key('Enter')
    key('ArrowDown')
    expect(nexus.getState()).toBe(initialSnapshot)
    key('Enter')
    const lifecycle = events.filter((event) => event.event.type.startsWith('drag.'))
    expect(lifecycle.map((event) => event.event.type)).toEqual([
      'drag.start',
      'drag.update',
      'drag.end',
    ])
    expect(lifecycle.map((event) => event.source.kind)).toEqual([
      'dashList',
      'dashList',
      'dashList',
    ])
    expect(lifecycle.every((event) => event.source.scopeId === 'reorder')).toBe(true)
    expect(lifecycle.at(-1)?.event).toMatchObject({
      type: 'drag.end',
      operation: 'reorder',
      input: 'keyboard',
      outcome: 'accepted',
    })
    expect(nexus.scope('reorder').getState().scope?.dashList?.rootOrder).toEqual(['two', 'one'])
    act(() => renderer.unmount())
    expect(events.filter((event) => event.event.type === 'drag.cancel')).toHaveLength(0)
    unsubscribe()
    nexus.destroy()
  })

  it('reports hover/focus without creating metadata and cancels a started reorder without saving it', () => {
    const nexus = createPicodashNexus({ valueOwner: 'nexus', fields: {} })
    const events: NexusInteractionEvent[] = []
    const unsubscribe = nexus.scope('reorder').events.subscribe((event) => events.push(event))
    const renderer = render(
      createElement(
        DashList,
        { id: 'reorder', nexus },
        createElement(Dashlet, { id: 'one', label: 'One' }),
        createElement(Dashlet, { id: 'two', label: 'Two' }),
      ),
    )
    const handle = () => renderer.root.findByProps({ 'data-picodash-reorder-handle': 'one' })
    const before = nexus.getState()
    act(() => {
      handle().props.onPointerEnter({ pointerType: 'pen' })
      handle().props.onFocus()
      handle().props.onPointerLeave({ pointerType: 'pen' })
      handle().props.onKeyDown({ key: 'Enter', preventDefault() {} })
    })
    act(() => {
      handle().props.onKeyDown({ key: 'ArrowDown', preventDefault() {} })
    })
    act(() => {
      handle().props.onKeyDown({ key: 'Escape', preventDefault() {} })
    })
    expect(nexus.getState()).toBe(before)
    expect(events.slice(0, 3).map((event) => [event.event.type, event.event.input])).toEqual([
      ['hover', 'pen'],
      ['focus', 'keyboard'],
      ['hover', 'pen'],
    ])
    expect(events.filter((event) => event.event.type === 'drag.cancel')).toHaveLength(1)
    expect(events.filter((event) => event.event.type === 'drag.end')).toHaveLength(0)
    act(() => renderer.unmount())
    unsubscribe()
    nexus.destroy()
  })

  it('publishes one cancellation before unmount releases the active entity generation', () => {
    const nexus = createPicodashNexus({ valueOwner: 'nexus', fields: {} })
    const events: NexusInteractionEvent[] = []
    const unsubscribe = nexus.events.subscribe((event) => events.push(event))
    const renderer = render(
      createElement(
        DashList,
        { id: 'reorder', nexus },
        createElement(Dashlet, { id: 'one', label: 'One' }),
        createElement(Dashlet, { id: 'two', label: 'Two' }),
      ),
    )
    act(() => {
      renderer.root.findByProps({ 'data-picodash-reorder-handle': 'one' }).props.onKeyDown({
        key: 'Enter',
        preventDefault() {},
      })
    })
    act(() => renderer.unmount())
    expect(events.map((event) => event.event.type)).toEqual(['drag.start', 'drag.cancel'])
    expect(events.at(-1)?.event).toMatchObject({ type: 'drag.cancel', reason: 'unmounted' })
    expect(events[0]?.source.generation).toBe(events[1]?.source.generation)
    expect(nexus.getState().scopes.size).toBe(0)
    unsubscribe()
    nexus.destroy()
  })
})
