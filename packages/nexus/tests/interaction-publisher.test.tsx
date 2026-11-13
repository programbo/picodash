// @vitest-environment jsdom
import { act, createElement, StrictMode } from 'react'
import { describe, expect, it } from 'vite-plus/test'
import { createDomTestRenderer as create } from '../../../test/dom-renderer.ts'
import {
  createPicodashNexus,
  type NexusInteractionEvent,
  type NexusInteractionPublisher,
} from '../src/index.ts'
import {
  PicodashNexusEntityBoundary,
  PicodashNexusProviderBoundary,
  useNexusInteractionPublisher,
} from '../src/integration.ts'

describe('declarative interaction publisher', () => {
  it('reports payload capacity without interrupting a product handler and recovers on a later valid event', () => {
    const nexus = createPicodashNexus({ valueOwner: 'nexus', fields: {} })
    let publish: NexusInteractionPublisher = () => undefined
    function Probe() {
      publish = useNexusInteractionPublisher()
      return null
    }
    let renderer!: ReturnType<typeof create>
    act(() => {
      renderer = create(
        createElement(PicodashNexusProviderBoundary, {
          nexus,
          children: createElement(PicodashNexusEntityBoundary, {
            nexus: nexus.scope('panel'),
            kind: 'dashPanel',
            children: createElement(Probe),
          }),
        }),
      )
    })
    expect(
      publish({ type: 'hover', phase: 'enter', input: 'mouse', target: 'p'.repeat(5000) }),
    ).toBeUndefined()
    expect(nexus.events.getSequence()).toBe(0)
    expect([...nexus.diagnostics.getState().current.values()]).toContainEqual(
      expect.objectContaining({
        code: 'interaction_delivery_limited',
        identity: { kind: 'scope-interaction', scopeId: 'panel' },
      }),
    )
    expect(
      publish({ type: 'hover', phase: 'enter', input: 'mouse', target: 'shell' })?.sequence,
    ).toBe(1)
    expect(
      [...nexus.diagnostics.getState().current.values()].some(
        (d) => d.code === 'interaction_delivery_limited',
      ),
    ).toBe(false)
    act(() => renderer.unmount())
    nexus.destroy()
  })
  it('uses the existing entity generation, survives StrictMode and becomes inert on teardown', () => {
    const nexus = createPicodashNexus({ valueOwner: 'nexus', fields: {} }),
      events: NexusInteractionEvent[] = []
    nexus.events.subscribe((event) => events.push(event))
    let publish: NexusInteractionPublisher = () => undefined
    function Probe() {
      publish = useNexusInteractionPublisher()
      return createElement(
        'button',
        {
          onClick: () =>
            publish({ type: 'hover', phase: 'enter', input: 'mouse', target: 'shell' }),
        },
        'Publish',
      )
    }
    let renderer!: ReturnType<typeof create>
    act(() => {
      renderer = create(
        createElement(
          StrictMode,
          null,
          createElement(PicodashNexusProviderBoundary, {
            nexus,
            children: createElement(PicodashNexusEntityBoundary, {
              nexus: nexus.scope('panel'),
              kind: 'dashPanel',
              children: createElement(Probe),
            }),
          }),
        ),
      )
    })
    const callback = publish
    act(() => {
      renderer.root.findByType('button').props.onClick()
    })
    expect(events).toHaveLength(1)
    expect(events[0]?.source).toMatchObject({ scopeId: 'panel', kind: 'dashPanel' })
    expect(publish).toBe(callback)
    act(() => renderer.unmount())
    expect(
      callback({ type: 'hover', phase: 'leave', input: 'mouse', target: 'shell' }),
    ).toBeUndefined()
    expect(events).toHaveLength(1)
    expect(() => nexus.destroy()).not.toThrow()
  })
})
