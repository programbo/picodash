import { describe, expect, it, vi } from 'vite-plus/test'
import {
  createPicodashNexus,
  normalizeNexusInteractionEvent,
  type NexusInteractionEvent,
  type NexusInteractionInput,
} from '../src/index.ts'
import {
  acquireEntityLease,
  acquireProviderLease,
  publishNexusInteraction,
} from '../src/integration.ts'
import { createMemoryPersistence } from './support/memory-persistence.ts'

const hover = { type: 'hover', phase: 'enter', target: 'shell', input: 'mouse' } as const
const makeNexus = () =>
  createPicodashNexus({ valueOwner: 'nexus', fields: { count: { defaultValue: 0 } } })
const setup = (nexus: ReturnType<typeof makeNexus>) => {
  const host = acquireProviderLease(nexus)
  const panel = acquireEntityLease(nexus.scope('panel'), { kind: 'dashPanel', host })
  return {
    panel,
    release: () => {
      panel.release()
      host.release()
      nexus.destroy()
    },
  }
}

describe('Nexus ephemeral interaction events', () => {
  it('retains lexical identity rules for long scopes and targets within the payload budget', () => {
    const nexus = makeNexus(),
      host = acquireProviderLease(nexus)
    const scopeId = 'p'.repeat(257),
      target = 'n'.repeat(257)
    const panel = acquireEntityLease(nexus.scope(scopeId), { kind: 'dashPanel', host })
    const listener = vi.fn()
    nexus.events.subscribe(listener, { scopeIds: [scopeId] })
    const event = publishNexusInteraction(panel, { ...hover, target })
    expect(event.source.scopeId).toBe(scopeId)
    expect(event.event.target).toBe(target)
    expect(listener).toHaveBeenCalledWith(event)
    panel.release()
    host.release()
    nexus.destroy()
  })
  it('attributes detached immutable events without changing snapshots or persistence', () => {
    const driver = createMemoryPersistence()
    const nexus = createPicodashNexus({
      valueOwner: 'nexus',
      nexusId: 'events',
      schemaVersion: 1,
      fields: { count: { defaultValue: 0 } },
      persistence: { driver, storageKey: 'events', values: { defaultFieldPolicy: 'include' } },
    })
    const { panel, release } = setup(nexus)
    const before = nexus.getState(),
      scopedBefore = nexus.scope('panel').getState(),
      persistenceBefore = nexus.persistence.getState()
    const writes = driver.calls.length
    const rootListener = vi.fn(),
      scopeListener = vi.fn(),
      events: NexusInteractionEvent[] = []
    nexus.subscribe(rootListener)
    nexus.scope('panel').subscribe(scopeListener)
    nexus.events.subscribe((event) => events.push(event))
    const event = publishNexusInteraction(panel, hover)
    expect(event).toMatchObject({
      sequence: 1,
      source: { scopeId: 'panel', kind: 'dashPanel', generation: 1 },
      event: hover,
    })
    expect(Object.isFrozen(event)).toBe(true)
    expect(Object.isFrozen(event.event)).toBe(true)
    expect(events).toEqual([event])
    expect(nexus.getState()).toBe(before)
    expect(nexus.scope('panel').getState()).toBe(scopedBefore)
    expect(rootListener).not.toHaveBeenCalled()
    expect(scopeListener).not.toHaveBeenCalled()
    expect(nexus.persistence.getState()).toBe(persistenceBefore)
    expect(driver.calls).toHaveLength(writes)
    release()
    expect(() => nexus.events.getSequence()).toThrowError(
      expect.objectContaining({ code: 'use-after-destroy' }),
    )
  })

  it('filters root and scoped streams, detaches filters and unsubscribes idempotently', () => {
    const nexus = makeNexus(),
      host = acquireProviderLease(nexus)
    const first = acquireEntityLease(nexus.scope('first'), { kind: 'dashPanel', host }),
      second = acquireEntityLease(nexus.scope('second'), { kind: 'dashStack', host })
    const types: NexusInteractionInput['type'][] = ['hover']
    const listener = vi.fn(),
      scoped = vi.fn()
    const stop = nexus.events.subscribe(listener, {
      scopeIds: ['first'],
      kinds: ['dashPanel'],
      types,
    })
    nexus.scope('second').events.subscribe(scoped)
    types.push('command')
    publishNexusInteraction(first, hover)
    publishNexusInteraction(second, hover)
    publishNexusInteraction(first, {
      type: 'command',
      target: 'panel',
      input: 'programmatic',
      command: 'restoreSize',
      outcome: 'accepted',
    })
    expect(listener).toHaveBeenCalledTimes(1)
    expect(scoped).toHaveBeenCalledTimes(1)
    expect(nexus.scope('first').events.getSequence()).toBe(3)
    stop()
    stop()
    publishNexusInteraction(first, hover)
    expect(listener).toHaveBeenCalledTimes(1)
    first.release()
    second.release()
    host.release()
    nexus.destroy()
  })

  it('fences released/forged publishers and gives remounted entities a new generation', () => {
    const nexus = makeNexus(),
      host = acquireProviderLease(nexus)
    const first = acquireEntityLease(nexus.scope('panel'), { kind: 'dashPanel', host })
    const old = publishNexusInteraction(first, hover)
    first.release()
    expect(() => publishNexusInteraction(first, hover)).toThrowError(
      expect.objectContaining({
        code: 'invalid-interaction-publisher',
        context: { reason: 'released' },
      }),
    )
    const next = acquireEntityLease(nexus.scope('panel'), { kind: 'dashPanel', host })
    expect(publishNexusInteraction(next, hover).source.generation).toBeGreaterThan(
      old.source.generation,
    )
    expect(() => publishNexusInteraction({ release() {} } as typeof next, hover)).toThrowError(
      expect.objectContaining({
        code: 'invalid-interaction-publisher',
        context: { reason: 'wrong-kind' },
      }),
    )
    next.release()
    host.release()
    nexus.destroy()
  })

  it('defers publication from a value subscriber until the owning mutation finishes', () => {
    const nexus = makeNexus(),
      { panel, release } = setup(nexus)
    const seen: number[] = []
    nexus.subscribe(() => {
      if (nexus.getState().values.count === 1) publishNexusInteraction(panel, hover)
    })
    nexus.events.subscribe(() => {
      seen.push(nexus.getState().values.count)
      nexus.setValues({ count: 2 })
    })
    expect(nexus.setValues({ count: 1 }).ok).toBe(true)
    expect(seen).toEqual([1])
    expect(nexus.getState().values.count).toBe(2)
    release()
  })

  it('also flushes events after metadata mutations release their write lock', () => {
    const nexus = makeNexus(),
      { panel, release } = setup(nexus)
    nexus.subscribe(() => {
      if (nexus.scope('panel').getState().scope?.dashPanel?.manualSize?.height === 10)
        publishNexusInteraction(panel, hover)
    })
    nexus.events.subscribe(() => {
      nexus.setDashPanelLayout('panel', { version: 2, manualSize: { height: 20 } })
    })
    expect(nexus.setDashPanelLayout('panel', { version: 2, manualSize: { height: 10 } }).ok).toBe(
      true,
    )
    expect(nexus.scope('panel').getState().scope?.dashPanel?.manualSize?.height).toBe(20)
    release()
  })

  it('isolates exceptions and bounds recursive publication without losing already accepted order', () => {
    const nexus = makeNexus(),
      { panel, release } = setup(nexus),
      sequences: number[] = []
    nexus.events.subscribe(() => {
      publishNexusInteraction(panel, hover)
    })
    nexus.events.subscribe((event) => {
      sequences.push(event.sequence)
    })
    publishNexusInteraction(panel, hover)
    expect(sequences).toHaveLength(256)
    expect(sequences).toEqual(Array.from({ length: 256 }, (_, i) => i + 1))
    expect([...nexus.diagnostics.getState().current.values()]).toContainEqual(
      expect.objectContaining({
        code: 'subscriber_exception',
        identity: { kind: 'subscriber', surface: 'capability', capability: 'events' },
      }),
    )
    release()
  })

  it('validates every public wire union without executing accessors or accepting raw runtime objects', () => {
    const envelope = (event: unknown) => ({
      sequence: 1,
      timestamp: 0,
      source: { scopeId: 'panel', kind: 'dashPanel', generation: 1 },
      event,
    })
    const rect = { x: 0, y: 0, width: 10, height: 10 },
      delta = { x: -1, y: 0, width: 1, height: 0 }
    const geometry = { initial: rect, requested: rect, applied: rect, delta, stepDelta: delta }
    const events: NexusInteractionInput[] = [
      hover,
      { type: 'focus', phase: 'leave', target: 'shell', input: 'keyboard' },
      {
        type: 'pointer',
        phase: 'down',
        target: 'e',
        input: 'touch',
        position: { x: 2, y: 3 },
        button: 0,
        buttons: 1,
        modifiers: { alt: false, control: false, meta: false, shift: false },
      },
      {
        type: 'pointer',
        phase: 'move',
        target: 'shell',
        input: 'mouse',
        button: -1,
        buttons: 0,
        position: { x: 1, y: 2 },
      },
      {
        type: 'drag.start',
        interactionId: 'resize-1',
        operation: 'resize',
        target: 'e',
        input: 'mouse',
        geometry,
      },
      {
        type: 'drag.update',
        interactionId: 'resize-1',
        operation: 'resize',
        target: 'e',
        input: 'mouse',
        geometry,
      },
      {
        type: 'drag.end',
        interactionId: 'resize-1',
        operation: 'resize',
        target: 'e',
        input: 'mouse',
        geometry,
        outcome: 'accepted',
      },
      {
        type: 'drag.cancel',
        interactionId: 'move-1',
        operation: 'move',
        target: 'header',
        input: 'keyboard',
        reason: 'escape',
      },
      {
        type: 'command',
        target: 'shell',
        input: 'programmatic',
        command: 'restoreSize',
        outcome: 'unchanged',
      },
      { type: 'layout', target: 'shell', input: 'automatic', reason: 'boundary', geometry },
    ]
    for (const input of events)
      expect(normalizeNexusInteractionEvent(envelope(input)).event).toEqual(input)
    const getter = vi.fn(() => hover)
    expect(() =>
      normalizeNexusInteractionEvent(
        Object.defineProperty(envelope(hover), 'event', { get: getter, enumerable: true }),
      ),
    ).toThrow()
    expect(getter).not.toHaveBeenCalled()
    for (const invalid of [
      envelope({ ...hover, node: new Date() }),
      envelope({ ...hover, input: 'remote' }),
      envelope({ ...hover, target: '' }),
      { ...envelope(hover), sequence: Infinity },
      envelope({ ...events[4], geometry: { ...geometry, applied: { ...rect, width: -1 } } }),
      envelope({
        ...events[4],
        geometry: { ...geometry, constraints: Array.from({ length: 32 }, () => '🙂'.repeat(64)) },
      }),
    ])
      expect(() => normalizeNexusInteractionEvent(invalid)).toThrowError(
        expect.objectContaining({ code: 'invalid-interaction-event' }),
      )
  })
})
