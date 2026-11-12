import { afterEach, describe, expect, test } from 'vite-plus/test'
import type { NexusInteractionEvent, NexusInteractionInput } from '@picodash/nexus'
import type WebSocket from 'ws'
import { EventObservationJournal } from '../src/event-observation.js'
import { createPicodashDevBridgeClient } from '../src/client.js'
import { startPicodashDevBridgeRelay } from '../src/relay.js'
import type {
  PicodashDevBridgeEventCursor,
  PicodashDevBridgeSessionDescriptor,
} from '../src/types.js'
import {
  closeSocket,
  frame,
  openSocket,
  readFrame,
  registerFrame,
  snapshotFrame,
  waitOpen,
} from './support/raw.js'

const descriptor: PicodashDevBridgeSessionDescriptor = {
  sessionId: 'events',
  generation: 1,
  sequence: 0,
  registrationId: 'events',
  browserTabId: 'tab',
  origin: 'http://localhost',
  fieldKeys: [],
  disclosedValueFields: [],
  writableFields: [],
  disclosedScopeIds: [],
  diagnosticsDisclosed: false,
  disclosedEventScopeIds: ['panel'],
  disclosedEventTypes: ['hover', 'drag.start', 'drag.update', 'drag.end', 'drag.cancel', 'layout'],
  eventSequence: 0,
  capabilities: ['inspect', 'set_values', 'wait', 'read_events'],
}
const cursor = (sequence: number): PicodashDevBridgeEventCursor => ({
  sessionId: 'events',
  generation: 1,
  sequence,
})
function event(
  sequence: number,
  input: NexusInteractionInput = { type: 'hover', phase: 'enter', target: 'panel', input: 'mouse' },
): NexusInteractionEvent {
  return {
    sequence,
    timestamp: sequence,
    source: { scopeId: 'panel', kind: 'dashPanel', generation: 1 },
    event: input,
  }
}
const sessionRef = (session: PicodashDevBridgeSessionDescriptor) => ({
  sessionId: session.sessionId,
  generation: session.generation,
  sequence: session.sequence,
})
const drag = (type: 'drag.start' | 'drag.update'): NexusInteractionInput => ({
  type,
  target: 'se',
  input: 'mouse',
  interactionId: 'resize-1',
  operation: 'resize',
})

describe('bounded event observation journal', () => {
  test('coalesces consecutive updates while preserving lifecycle and published cursor order', () => {
    const journal = new EventObservationJournal()
    expect(journal.append(1, event(1, drag('drag.start')), descriptor)).toBe(true)
    expect(journal.append(2, event(2, drag('drag.update')), descriptor)).toBe(true)
    expect(journal.append(3, event(3, drag('drag.update')), descriptor)).toBe(true)
    expect(
      journal.append(
        4,
        event(4, {
          type: 'drag.end',
          target: 'se',
          input: 'mouse',
          interactionId: 'resize-1',
          operation: 'resize',
          outcome: 'accepted',
        }),
        descriptor,
      ),
    ).toBe(true)
    const result = journal.read(descriptor, {
      type: 'read_events',
      requestId: 'read',
      cursor: cursor(0),
    })
    expect(result.outcome).toBe('available')
    expect(result.events.map((entry) => [entry.sequence, entry.event.event.type])).toEqual([
      [1, 'drag.start'],
      [3, 'drag.update'],
      [4, 'drag.end'],
    ])
    expect(result.cursor.sequence).toBe(4)
    expect(
      journal
        .read(descriptor, { type: 'read_events', requestId: 'middle', cursor: cursor(2), limit: 1 })
        .events.map((entry) => entry.sequence),
    ).toEqual([3])
  })

  test('bounds retained history and reports loss instead of silently skipping old lifecycle events', () => {
    const journal = new EventObservationJournal()
    for (let sequence = 1; sequence <= 300; sequence++)
      expect(journal.append(sequence, event(sequence), descriptor)).toBe(true)
    const lost = journal.read(descriptor, {
      type: 'read_events',
      requestId: 'old',
      cursor: cursor(0),
    })
    expect(lost).toMatchObject({
      outcome: 'history_gap',
      events: [],
      earliestAvailableSequence: 45,
      cursor: { sequence: 300 },
    })
    const retained = journal.read(descriptor, {
      type: 'read_events',
      requestId: 'retained',
      cursor: cursor(44),
    })
    expect(retained.events).toHaveLength(256)
    expect(retained.events[0]?.sequence).toBe(45)
    expect(journal.read(descriptor, { type: 'read_events', requestId: 'baseline' })).toMatchObject({
      events: [],
      cursor: { sequence: 300 },
    })
  })

  test('rejects forged attribution, duplicate ordering, unknown event fields and oversized payloads', () => {
    const journal = new EventObservationJournal()
    expect(
      journal.append(
        1,
        { ...event(1), source: { scopeId: 'undisclosed', kind: 'dashPanel', generation: 1 } },
        descriptor,
      ),
    ).toBe(false)
    expect(journal.append(2, event(1), descriptor)).toBe(false)
    expect(journal.append(1, { ...event(1), secret: 'never retain this' }, descriptor)).toBe(false)
    const rect = { x: 0, y: 0, width: 10, height: 10 }
    expect(
      journal.append(
        1,
        event(1, {
          type: 'layout',
          input: 'automatic',
          target: 'panel',
          reason: 'content',
          geometry: {
            initial: rect,
            requested: rect,
            applied: rect,
            delta: rect,
            stepDelta: rect,
            constraints: Array.from({ length: 32 }, () => 'x'.repeat(200)),
          },
        }),
        descriptor,
      ),
    ).toBe(false)
    expect(journal.append(1, event(1), descriptor)).toBe(true)
    expect(journal.append(2, event(1), descriptor)).toBe(false)
    expect(journal.sequence).toBe(1)
  })
})

const relays: Array<Awaited<ReturnType<typeof startPicodashDevBridgeRelay>>> = []
const sockets: WebSocket[] = []
afterEach(async () => {
  await Promise.all(sockets.splice(0).map(closeSocket))
  await Promise.all(relays.splice(0).map((relay) => relay.close()))
})
async function connected(disclosed = true) {
  const relay = await startPicodashDevBridgeRelay({ allowedBrowserOrigins: ['http://localhost'] })
  relays.push(relay)
  const credential = relay.issueBrowserCredential('http://localhost')
  const socket = openSocket(credential.webSocketUrl, credential.origin)
  sockets.push(socket)
  await waitOpen(socket)
  frame(
    socket,
    registerFrame(credential.token, 'events', 'tab', {
      disclosure: {
        valueFields: ['count'],
        scopeIds: [],
        diagnostics: false,
        eventScopeIds: disclosed ? ['panel'] : [],
        eventTypes: disclosed ? ['hover', 'drag.start', 'drag.update', 'drag.end'] : [],
      },
    }),
  )
  const registered = await readFrame(socket)
  const session = registered.session as PicodashDevBridgeSessionDescriptor
  frame(socket, snapshotFrame(session, 0, { values: { count: 1 } }))
  const client = createPicodashDevBridgeClient(relay.agentCredential)
  await client.inspect(session)
  return { relay, socket, session, client }
}

describe('read-only event protocol', () => {
  test('reads and waits with independent cursors, keeps snapshot sequence unchanged, and fences cursor generations', async () => {
    const { socket, session, client } = await connected()
    const baseline = await client.readEvents(session, {
      type: 'read_events',
      requestId: 'baseline',
    })
    expect(baseline.type).toBe('events_result')
    if (baseline.type !== 'events_result') throw new Error('baseline failed')
    const pending = client.readEvents(session, {
      type: 'read_events',
      requestId: 'next',
      cursor: baseline.cursor,
      timeoutMs: 1000,
    })
    frame(socket, {
      type: 'interaction_event',
      session: sessionRef(session),
      eventSequence: 1,
      event: event(1, drag('drag.start')),
    })
    const result = await pending
    expect(result).toMatchObject({
      type: 'events_result',
      outcome: 'available',
      cursor: { sequence: 1 },
      events: [{ event: { event: { type: 'drag.start' } } }],
    })
    expect(await client.inspect(session)).toMatchObject({
      session: { sequence: 0, eventSequence: 1 },
      snapshot: { values: { count: 1 } },
    })
    await expect(
      client.readEvents(session, {
        type: 'read_events',
        requestId: 'stale',
        cursor: { ...baseline.cursor, generation: session.generation + 1 },
      }),
    ).resolves.toMatchObject({ type: 'bridge_error', error: { code: 'generation_mismatch' } })
    await expect(
      client.readEvents(session, {
        type: 'read_events',
        requestId: 'ahead',
        cursor: { ...baseline.cursor, sequence: 99 },
      }),
    ).resolves.toMatchObject({ type: 'bridge_error', error: { code: 'invalid_request' } })
    await expect(
      client.readEvents(session, {
        type: 'read_events',
        requestId: 'timeout',
        cursor: { ...baseline.cursor, sequence: 1 },
        timeoutMs: 10,
      }),
    ).resolves.toMatchObject({ type: 'events_result', outcome: 'timed_out', events: [] })
  })

  test('refuses undisclosed events and malformed read limits without sending browser commands', async () => {
    const { session, client, relay } = await connected(false)
    await expect(
      client.readEvents(session, { type: 'read_events', requestId: 'denied' }),
    ).resolves.toMatchObject({ type: 'bridge_error', error: { code: 'capability_denied' } })
    const response = await fetch(
      `${relay.baseUrl}/v1/sessions/${session.sessionId}/generations/${session.generation}/events`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${relay.agentCredential.token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ type: 'read_events', requestId: 'invalid', limit: 257 }),
      },
    )
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      type: 'bridge_error',
      error: { code: 'invalid_request' },
    })
  })

  test('reports declared transport gaps and terminates waits when the generation disconnects', async () => {
    const { socket, session, client } = await connected()
    const initial = await client.readEvents(session, { type: 'read_events', requestId: 'baseline' })
    if (initial.type !== 'events_result') throw new Error('baseline failed')
    const pending = client.readEvents(session, {
      type: 'read_events',
      requestId: 'gap',
      cursor: initial.cursor,
      timeoutMs: 1000,
    })
    frame(socket, { type: 'event_gap', session: sessionRef(session), eventSequence: 5 })
    await expect(pending).resolves.toMatchObject({
      type: 'events_result',
      outcome: 'history_gap',
      events: [],
      cursor: { sequence: 5 },
    })
    const waiting = client.readEvents(session, {
      type: 'read_events',
      requestId: 'disconnect',
      cursor: { ...initial.cursor, sequence: 5 },
      timeoutMs: 1000,
    })
    await new Promise((resolve) => setTimeout(resolve, 10))
    await closeSocket(socket)
    await expect(waiting).resolves.toMatchObject({
      type: 'bridge_error',
      error: { code: 'session_disconnected' },
    })
  })
})
