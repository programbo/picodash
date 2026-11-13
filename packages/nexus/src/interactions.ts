import { PicodashContractError } from './kernel/index.js'
import { classifyIdentity } from './runtime-controller.js'
import { clonePicodashValue } from './json.js'
import type { PicodashJsonValue } from './kernel/index.js'

export type NexusInteractionSource =
  | 'mouse'
  | 'touch'
  | 'pen'
  | 'keyboard'
  | 'programmatic'
  | 'automatic'
export type NexusInteractionRect = Readonly<{ x: number; y: number; width: number; height: number }>
export type NexusInteractionGeometry = Readonly<{
  initial: NexusInteractionRect
  requested: NexusInteractionRect
  applied: NexusInteractionRect
  delta: NexusInteractionRect
  stepDelta: NexusInteractionRect
  pointerDelta?: Readonly<{ x: number; y: number }>
  constraints?: readonly string[]
}>
type InteractionTarget = Readonly<{ target: string; input: NexusInteractionSource }>
type DragInput = InteractionTarget &
  Readonly<{
    interactionId: string
    operation: 'move' | 'resize' | 'reorder'
    geometry?: NexusInteractionGeometry
  }>
export type NexusInteractionInput =
  | (InteractionTarget & Readonly<{ type: 'hover' | 'focus'; phase: 'enter' | 'leave' }>)
  | (InteractionTarget &
      Readonly<{
        type: 'pointer'
        phase: 'down' | 'up' | 'cancel' | 'move' | 'click'
        position?: Readonly<{ x: number; y: number }>
        button?: number
        buttons?: number
        modifiers?: Readonly<{ alt: boolean; control: boolean; meta: boolean; shift: boolean }>
      }>)
  | (DragInput & Readonly<{ type: 'drag.start' | 'drag.update' }>)
  | (DragInput &
      Readonly<{
        type: 'drag.end'
        outcome: 'accepted' | 'unchanged' | 'rejected'
        reason?: string
      }>)
  | (DragInput & Readonly<{ type: 'drag.cancel'; reason: string }>)
  | (InteractionTarget &
      Readonly<{
        type: 'command'
        command: string
        outcome: 'accepted' | 'unchanged' | 'rejected'
        reason?: string
      }>)
  | (InteractionTarget &
      Readonly<{
        type: 'layout'
        reason: 'content' | 'boundary' | 'policy'
        geometry: NexusInteractionGeometry
      }>)

export type NexusInteractionEvent = Readonly<{
  sequence: number
  timestamp: number
  source: Readonly<{ scopeId: string; kind: 'dashPanel' | 'dashStack'; generation: number }>
  event: NexusInteractionInput
}>
export type NexusInteractionFilter = Readonly<{
  scopeIds?: readonly string[]
  kinds?: readonly ('dashPanel' | 'dashStack')[]
  types?: readonly NexusInteractionInput['type'][]
}>
export interface NexusInteractionEvents {
  subscribe(
    listener: (event: NexusInteractionEvent) => void,
    filter?: NexusInteractionFilter,
  ): () => void
  getSequence(): number
}
export type NexusInteractionPublisher = (
  input: NexusInteractionInput,
) => NexusInteractionEvent | undefined

const SOURCES = ['mouse', 'touch', 'pen', 'keyboard', 'programmatic', 'automatic'] as const
export const NEXUS_INTERACTION_TYPES = [
  'hover',
  'focus',
  'pointer',
  'drag.start',
  'drag.update',
  'drag.end',
  'drag.cancel',
  'command',
  'layout',
] as const
const MAX_EVENT_BYTES = 4096
const MAX_DISPATCH_EVENTS = 256

function invalid(reason: string): never {
  throw new PicodashContractError('invalid-interaction-event', { reason })
}
function object(
  value: unknown,
  keys: readonly string[],
  required: readonly string[],
): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return invalid('shape')
  const proto = Object.getPrototypeOf(value)
  if (proto !== Object.prototype && proto !== null) return invalid('shape')
  const descriptors = Object.getOwnPropertyDescriptors(value)
  for (const key of Reflect.ownKeys(descriptors)) {
    if (typeof key !== 'string' || !keys.includes(key)) return invalid('shape')
    const descriptor = descriptors[key]!
    if (!descriptor.enumerable || !('value' in descriptor)) return invalid('shape')
  }
  for (const key of required) if (!Object.hasOwn(descriptors, key)) return invalid('shape')
  return value as Record<string, unknown>
}
function identity(value: unknown): void {
  if (classifyIdentity(value)) invalid('identity')
}
function text(value: unknown): void {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 256) invalid('text')
  for (const character of value) {
    const code = character.codePointAt(0)!
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) invalid('text')
  }
}
function choice(value: unknown, choices: readonly string[]): void {
  if (typeof value !== 'string' || !choices.includes(value)) invalid('variant')
}
function finite(value: unknown, nonnegative = false): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || (nonnegative && value < 0))
    invalid('number')
}
function point(value: unknown): void {
  const p = object(value, ['x', 'y'], ['x', 'y'])
  finite(p.x)
  finite(p.y)
}
function rect(value: unknown, delta = false): void {
  const r = object(value, ['x', 'y', 'width', 'height'], ['x', 'y', 'width', 'height'])
  finite(r.x)
  finite(r.y)
  finite(r.width, !delta)
  finite(r.height, !delta)
}
function array(value: unknown): readonly unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) invalid('shape')
  const descriptors = Object.getOwnPropertyDescriptors(value)
  for (const key of Reflect.ownKeys(descriptors)) {
    if (
      typeof key !== 'string' ||
      (key !== 'length' && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length))
    )
      invalid('shape')
    const descriptor = descriptors[key]!
    if (key !== 'length' && (!descriptor.enumerable || !('value' in descriptor))) invalid('shape')
  }
  for (let index = 0; index < value.length; index += 1)
    if (!Object.hasOwn(descriptors, String(index))) invalid('shape')
  return value
}
function geometry(value: unknown): void {
  const g = object(
    value,
    ['initial', 'requested', 'applied', 'delta', 'stepDelta', 'pointerDelta', 'constraints'],
    ['initial', 'requested', 'applied', 'delta', 'stepDelta'],
  )
  rect(g.initial)
  rect(g.requested)
  rect(g.applied)
  rect(g.delta, true)
  rect(g.stepDelta, true)
  if (Object.hasOwn(g, 'pointerDelta')) point(g.pointerDelta)
  if (Object.hasOwn(g, 'constraints')) {
    const constraints = array(g.constraints)
    if (constraints.length > 32) invalid('constraints')
    for (const constraint of constraints) text(constraint)
  }
}
function checkInput(value: unknown): void {
  const base = object(
    value,
    [
      'type',
      'target',
      'input',
      'phase',
      'position',
      'button',
      'buttons',
      'modifiers',
      'interactionId',
      'operation',
      'geometry',
      'outcome',
      'reason',
      'command',
    ],
    ['type', 'target', 'input'],
  )
  choice(base.type, NEXUS_INTERACTION_TYPES)
  identity(base.target)
  choice(base.input, SOURCES)
  const common = ['type', 'target', 'input']
  switch (base.type) {
    case 'hover':
    case 'focus':
      object(value, [...common, 'phase'], [...common, 'phase'])
      choice(base.phase, ['enter', 'leave'])
      break
    case 'pointer': {
      object(
        value,
        [...common, 'phase', 'position', 'button', 'buttons', 'modifiers'],
        [...common, 'phase'],
      )
      choice(base.phase, ['down', 'up', 'cancel', 'move', 'click'])
      if (Object.hasOwn(base, 'position')) point(base.position)
      for (const key of ['button', 'buttons'])
        if (Object.hasOwn(base, key)) {
          finite(base[key])
          if (!Number.isSafeInteger(base[key]) || Number(base[key]) < (key === 'button' ? -1 : 0))
            invalid('number')
        }
      if (Object.hasOwn(base, 'modifiers')) {
        const m = object(
          base.modifiers,
          ['alt', 'control', 'meta', 'shift'],
          ['alt', 'control', 'meta', 'shift'],
        )
        for (const flag of Object.values(m)) if (typeof flag !== 'boolean') invalid('modifier')
      }
      break
    }
    case 'drag.start':
    case 'drag.update':
    case 'drag.end':
    case 'drag.cancel': {
      const extras =
        base.type === 'drag.end'
          ? ['outcome', 'reason']
          : base.type === 'drag.cancel'
            ? ['reason']
            : []
      object(
        value,
        [...common, 'interactionId', 'operation', 'geometry', ...extras],
        [
          ...common,
          'interactionId',
          'operation',
          ...(base.type === 'drag.end'
            ? ['outcome']
            : base.type === 'drag.cancel'
              ? ['reason']
              : []),
        ],
      )
      identity(base.interactionId)
      choice(base.operation, ['move', 'resize', 'reorder'])
      if (Object.hasOwn(base, 'geometry')) geometry(base.geometry)
      if (base.type === 'drag.end') choice(base.outcome, ['accepted', 'unchanged', 'rejected'])
      if (Object.hasOwn(base, 'reason')) text(base.reason)
      break
    }
    case 'command':
      object(value, [...common, 'command', 'outcome', 'reason'], [...common, 'command', 'outcome'])
      text(base.command)
      choice(base.outcome, ['accepted', 'unchanged', 'rejected'])
      if (Object.hasOwn(base, 'reason')) text(base.reason)
      break
    case 'layout':
      object(value, [...common, 'reason', 'geometry'], [...common, 'reason', 'geometry'])
      choice(base.reason, ['content', 'boundary', 'policy'])
      geometry(base.geometry)
      break
  }
}

/** Validate and detach a public wire event without granting publication authority. */
export function normalizeNexusInteractionEvent(input: unknown): NexusInteractionEvent {
  try {
    const e = object(
      input,
      ['sequence', 'timestamp', 'source', 'event'],
      ['sequence', 'timestamp', 'source', 'event'],
    )
    if (!Number.isSafeInteger(e.sequence) || Number(e.sequence) < 1) invalid('sequence')
    finite(e.timestamp, true)
    const source = object(
      e.source,
      ['scopeId', 'kind', 'generation'],
      ['scopeId', 'kind', 'generation'],
    )
    identity(source.scopeId)
    choice(source.kind, ['dashPanel', 'dashStack'])
    if (typeof source.scopeId !== 'string' || source.scopeId !== source.scopeId.trim())
      invalid('scope')
    if (!Number.isSafeInteger(source.generation) || Number(source.generation) < 1)
      invalid('generation')
    checkInput(e.event)
    const cloned = clonePicodashValue(input as PicodashJsonValue)
    if (new TextEncoder().encode(JSON.stringify(cloned)).byteLength > MAX_EVENT_BYTES)
      invalid('payload-size')
    return cloned as NexusInteractionEvent
  } catch (error) {
    if (error instanceof PicodashContractError) throw error
    return invalid('shape')
  }
}

type Listener = {
  readonly callback: (event: NexusInteractionEvent) => void
  readonly filter: NexusInteractionFilter
}
export class NexusInteractionHub {
  private sequence = 0
  private timestamp = 0
  private readonly listeners = new Set<Listener>()
  private readonly queue: NexusInteractionEvent[] = []
  private dispatching = false
  private dispatched = 0
  constructor(
    private readonly assertActive: () => void,
    private readonly dispatch: (listeners: Iterable<() => void>) => void,
    private readonly isMutationActive: () => boolean = () => false,
  ) {}

  facade(scopeId?: string): NexusInteractionEvents {
    return Object.freeze({
      subscribe: (
        callback: (event: NexusInteractionEvent) => void,
        filter: NexusInteractionFilter = {},
      ) => {
        this.assertActive()
        if (typeof callback !== 'function') throw new PicodashContractError('invalid-configuration')
        const checked = object(filter, ['scopeIds', 'kinds', 'types'], [])
        for (const key of ['scopeIds', 'kinds', 'types'] as const)
          if (Object.hasOwn(checked, key)) {
            const values = array(checked[key])
            if (values.length > 256) invalid('filter')
            for (const value of values) {
              if (key === 'scopeIds') identity(value)
              else
                choice(
                  value,
                  key === 'kinds' ? ['dashPanel', 'dashStack'] : NEXUS_INTERACTION_TYPES,
                )
            }
          }
        const listener: Listener = {
          callback,
          filter: Object.freeze({
            ...(filter.scopeIds ? { scopeIds: Object.freeze([...filter.scopeIds]) } : {}),
            ...(filter.kinds ? { kinds: Object.freeze([...filter.kinds]) } : {}),
            ...(filter.types ? { types: Object.freeze([...filter.types]) } : {}),
          }),
        }
        const scopedListener: Listener =
          scopeId === undefined
            ? listener
            : {
                callback: (event) => {
                  if (event.source.scopeId === scopeId) callback(event)
                },
                filter: listener.filter,
              }
        this.listeners.add(scopedListener)
        return () => {
          this.listeners.delete(scopedListener)
        }
      },
      getSequence: () => {
        this.assertActive()
        return this.sequence
      },
    })
  }

  publish(
    source: NexusInteractionEvent['source'],
    input: NexusInteractionInput,
  ): NexusInteractionEvent {
    this.assertActive()
    if (
      this.sequence >= Number.MAX_SAFE_INTEGER ||
      this.dispatched + this.queue.length >= MAX_DISPATCH_EVENTS
    )
      invalid('dispatch-capacity')
    const timestamp = Math.max(this.timestamp, globalThis.performance?.now() ?? Date.now())
    const event = normalizeNexusInteractionEvent({
      sequence: this.sequence + 1,
      timestamp,
      source,
      event: input,
    })
    this.sequence = event.sequence
    this.timestamp = timestamp
    this.queue.push(event)
    this.flush()
    return event
  }

  flush(): void {
    if (this.dispatching || this.isMutationActive() || !this.queue.length) return
    this.dispatching = true
    this.dispatched = 0
    try {
      while (this.queue.length) {
        const next = this.queue.shift()!
        this.dispatched += 1
        const callbacks = [...this.listeners]
          .filter(
            ({ filter }) =>
              (!filter.scopeIds || filter.scopeIds.includes(next.source.scopeId)) &&
              (!filter.kinds || filter.kinds.includes(next.source.kind)) &&
              (!filter.types || filter.types.includes(next.event.type)),
          )
          .map(
            ({ callback }) =>
              () =>
                callback(next),
          )
        this.dispatch(callbacks)
      }
    } finally {
      this.dispatching = false
      this.dispatched = 0
      this.queue.length = 0
    }
  }

  teardown(): void {
    this.listeners.clear()
    this.queue.length = 0
  }
}
