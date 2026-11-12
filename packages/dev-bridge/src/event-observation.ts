import { normalizeNexusInteractionEvent, type NexusInteractionEvent } from '@picodash/nexus'
import type {
  PicodashDevBridgeEventCursor,
  PicodashDevBridgeEventEntry,
  PicodashDevBridgeEventsResult,
  PicodashDevBridgeReadEventsCommand,
  PicodashDevBridgeSessionDescriptor,
} from './types.js'

const MAX_EVENT_COUNT = 256
const MAX_EVENT_BYTES = 1024 * 1024

type RetainedEvent = PicodashDevBridgeEventEntry & { readonly bytes: number }

/** Read-only, generation-local history. Update replacement never removes a lifecycle event. */
export class EventObservationJournal {
  private retained: RetainedEvent[] = []
  private bytes = 0
  private droppedThrough = 0
  private nexusSequence = 0
  sequence = 0

  append(
    sequence: number,
    input: unknown,
    disclosure: PicodashDevBridgeSessionDescriptor,
  ): boolean {
    if (!Number.isSafeInteger(sequence) || sequence !== this.sequence + 1) return false
    let event: NexusInteractionEvent
    try {
      event = normalizeNexusInteractionEvent(input)
    } catch {
      return false
    }
    if (
      event.sequence <= this.nexusSequence ||
      !disclosure.disclosedEventScopeIds.includes(event.source.scopeId) ||
      !disclosure.disclosedEventTypes.includes(event.event.type)
    )
      return false
    this.sequence = sequence
    this.nexusSequence = event.sequence
    const bytes = new TextEncoder().encode(JSON.stringify({ sequence, event })).byteLength
    const previous = this.retained.at(-1)
    if (previous && coalescible(previous.event, event)) {
      this.retained.pop()
      this.bytes -= previous.bytes
    }
    this.retained.push({ sequence, event, bytes })
    this.bytes += bytes
    while (this.retained.length > MAX_EVENT_COUNT || this.bytes > MAX_EVENT_BYTES) {
      const discarded = this.retained.shift()
      if (!discarded) break
      this.bytes -= discarded.bytes
      this.droppedThrough = discarded.sequence
    }
    return true
  }

  gap(sequence: number): boolean {
    if (!Number.isSafeInteger(sequence) || sequence <= this.sequence) return false
    this.sequence = sequence
    this.droppedThrough = sequence
    this.retained = []
    this.bytes = 0
    return true
  }

  read(
    session: PicodashDevBridgeSessionDescriptor,
    command: PicodashDevBridgeReadEventsCommand,
    outcome: 'available' | 'timed_out' = 'available',
  ): PicodashDevBridgeEventsResult {
    const after = command.cursor?.sequence ?? this.sequence
    const gap = after < this.droppedThrough
    const events = gap
      ? []
      : this.retained
          .filter((entry) => entry.sequence > after)
          .slice(0, command.limit ?? MAX_EVENT_COUNT)
          .map(({ sequence, event }) => ({ sequence, event }))
    const cursor: PicodashDevBridgeEventCursor = {
      sessionId: session.sessionId,
      generation: session.generation,
      sequence: gap ? this.sequence : (events.at(-1)?.sequence ?? after),
    }
    return {
      type: 'events_result',
      requestId: command.requestId,
      outcome: gap ? 'history_gap' : outcome,
      session: {
        sessionId: session.sessionId,
        generation: session.generation,
        sequence: session.sequence,
      },
      cursor,
      earliestAvailableSequence: this.retained[0]?.sequence ?? this.sequence + 1,
      events,
    }
  }
}

function coalescible(previous: NexusInteractionEvent, next: NexusInteractionEvent): boolean {
  if (
    previous.source.scopeId !== next.source.scopeId ||
    previous.source.kind !== next.source.kind ||
    previous.source.generation !== next.source.generation
  )
    return false
  if (previous.event.type === 'drag.update' && next.event.type === 'drag.update')
    return previous.event.interactionId === next.event.interactionId
  if (previous.event.type === 'pointer' && next.event.type === 'pointer')
    return (
      previous.event.phase === 'move' &&
      next.event.phase === 'move' &&
      previous.event.target === next.event.target
    )
  return false
}
