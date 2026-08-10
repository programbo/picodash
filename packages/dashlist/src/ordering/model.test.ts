import { describe, expect, it } from 'vite-plus/test'
import {
  candidateOrder,
  createOrderingState,
  reconcileOrdering,
  transitionOrdering,
  type OrderingInput,
  type OrderingState,
} from './model.ts'

const nodes = (...ids: string[]) => ids.map((id) => ({ id }))

function apply(
  state: OrderingState,
  ...events: Parameters<typeof transitionOrdering>[1][]
): OrderingState {
  return events.reduce((current, event) => transitionOrdering(current, event).state, state)
}

describe('DashList ordering model', () => {
  it('uses declaration order before customization and appends new declarations after known nodes', () => {
    const initial = reconcileOrdering({ declarations: nodes('a', 'b', 'c') })
    expect(initial.order).toEqual(['a', 'b', 'c'])
    expect(
      reconcileOrdering({
        declarations: nodes('c', 'a', 'b', 'new'),
        durableOrder: ['b', 'a', 'dormant'],
      }).order,
    ).toEqual(['b', 'a', 'c', 'new'])
  })

  it('retains dormant durable history so a returning node recovers its position', () => {
    const input: OrderingInput = { declarations: nodes('a', 'c'), durableOrder: ['a', 'b', 'c'] }
    const absent = reconcileOrdering(input)
    expect(absent.order).toEqual(['a', 'c'])
    expect(absent.durableOrder).toEqual(['a', 'b', 'c'])
    expect(reconcileOrdering({ ...input, declarations: nodes('a', 'b', 'c') }).order).toEqual([
      'a',
      'b',
      'c',
    ])
  })

  it('partitions start, automatic, and end bands and changes pin immediately', () => {
    expect(
      reconcileOrdering({
        declarations: [
          { id: 'auto-1' },
          { id: 'start', pin: 'start' },
          { id: 'end', pin: 'end' },
          { id: 'auto-2' },
        ],
        durableOrder: ['auto-2', 'start', 'auto-1', 'end'],
      }).order,
    ).toEqual(['start', 'auto-2', 'auto-1', 'end'])

    expect(
      reconcileOrdering({
        declarations: [{ id: 'a' }, { id: 'b', pin: 'start' }, { id: 'c' }],
        durableOrder: ['a', 'b', 'c'],
      }).order,
    ).toEqual(['b', 'a', 'c'])
  })

  it('rejects invalid and duplicate declaration identities, while sanitizing durable history', () => {
    expect(() => reconcileOrdering({ declarations: [{ id: ' a' }] })).toThrow(TypeError)
    expect(() => reconcileOrdering({ declarations: nodes('a', 'a') })).toThrow(/Duplicate/)
    expect(
      reconcileOrdering({ declarations: nodes('a'), durableOrder: ['', 'a', 'a', 'dormant', ' x'] })
        .durableOrder,
    ).toEqual(['a', 'dormant'])
  })

  it('moves by one and Home/End only among visible nodes in the active band', () => {
    let state = createOrderingState({
      declarations: [
        { id: 'a' },
        { id: 'hidden', visible: false },
        { id: 'b' },
        { id: 'start', pin: 'start' },
      ],
    })
    state = apply(state, { type: 'start', nodeId: 'b' })
    expect(candidateOrder(state)).toEqual(['start', 'a', 'hidden', 'b'])
    state = apply(state, { type: 'move', direction: 'up' })
    expect(candidateOrder(state)).toEqual(['start', 'b', 'hidden', 'a'])
    state = apply(state, { type: 'move', direction: 'home' })
    expect(candidateOrder(state)).toEqual(['start', 'b', 'hidden', 'a'])
    state = apply(state, { type: 'move', direction: 'end' })
    expect(candidateOrder(state)).toEqual(['start', 'a', 'hidden', 'b'])
  })

  it('shares the same candidate operations for keyboard and pointer callers', () => {
    const start = createOrderingState({ declarations: nodes('a', 'b', 'c') })
    const keyboard = apply(start, { type: 'start', nodeId: 'b' }, { type: 'move', direction: 'up' })
    const pointer = apply(start, { type: 'start', nodeId: 'b' }, { type: 'move', direction: 'up' })
    expect(candidateOrder(keyboard)).toEqual(candidateOrder(pointer))
  })

  it('emits one atomic write intent only for changed commits and no write for no-op/cancel', () => {
    let state = createOrderingState({ declarations: nodes('a', 'b', 'c') })
    state = apply(state, { type: 'start', nodeId: 'b' })
    const noOp = transitionOrdering(state, { type: 'commit' })
    expect(noOp.effect).toEqual({ kind: 'none' })
    expect(noOp.state.session).toBeNull()

    state = apply(state, { type: 'start', nodeId: 'b' }, { type: 'move', direction: 'up' })
    const committed = transitionOrdering(state, { type: 'commit' })
    expect(committed.effect).toEqual({ kind: 'write-order', order: ['b', 'a', 'c'] })
    expect(transitionOrdering(committed.state, { type: 'commit' }).effect).toEqual({ kind: 'none' })

    state = apply(
      committed.state,
      { type: 'start', nodeId: 'a' },
      { type: 'move', direction: 'down' },
    )
    expect(transitionOrdering(state, { type: 'cancel' }).effect).toEqual({ kind: 'none' })
    expect(candidateOrder(transitionOrdering(state, { type: 'cancel' }).state)).toEqual([
      'b',
      'a',
      'c',
    ])
  })

  it('preserves all-dormant durable history when newly declared nodes are reordered', () => {
    let state = createOrderingState({
      declarations: nodes('a', 'b'),
      durableOrder: ['dormant'],
    })
    state = apply(state, { type: 'start', nodeId: 'b' }, { type: 'move', direction: 'up' })
    const committed = transitionOrdering(state, { type: 'commit' })
    expect(committed.effect).toEqual({
      kind: 'write-order',
      order: ['dormant', 'b', 'a'],
    })
    expect(
      reconcileOrdering({
        declarations: nodes('dormant', 'a', 'b'),
        durableOrder: committed.effect.kind === 'write-order' ? committed.effect.order : undefined,
      }).order,
    ).toEqual(['dormant', 'b', 'a'])
  })

  it('enforces one active session and cancels a stale session on external drift', () => {
    let state = createOrderingState({ declarations: nodes('a', 'b', 'c') })
    state = apply(state, { type: 'start', nodeId: 'b' })
    const ignoredSecondStart = transitionOrdering(state, { type: 'start', nodeId: 'a' })
    expect(ignoredSecondStart.state.session?.nodeId).toBe('b')

    const stale = transitionOrdering(state, {
      type: 'reconcile',
      input: { declarations: [{ id: 'a' }, { id: 'b', pin: 'start' }, { id: 'c' }] },
    })
    expect(stale.effect).toEqual({ kind: 'stale-cancel', reason: 'external-change' })
    expect(stale.state.session).toBeNull()
    expect(candidateOrder(stale.state)).toEqual(['b', 'a', 'c'])

    let fenced = createOrderingState({
      declarations: nodes('a', 'b'),
      sessionFence: 'expanded',
    })
    fenced = apply(fenced, { type: 'start', nodeId: 'a' })
    expect(
      transitionOrdering(fenced, {
        type: 'reconcile',
        input: { declarations: nodes('a', 'b'), sessionFence: 'collapsed' },
      }).effect,
    ).toEqual({ kind: 'stale-cancel', reason: 'external-change' })
  })

  it('resets to current declaration order and emits a removal only for a durable override', () => {
    let state = createOrderingState({ declarations: nodes('a', 'b'), durableOrder: ['b', 'a'] })
    expect(state.ordering.order).toEqual(['b', 'a'])
    const reset = transitionOrdering(state, { type: 'reset' })
    expect(reset.effect).toEqual({ kind: 'remove-order' })
    expect(reset.state.ordering.order).toEqual(['a', 'b'])
    expect(transitionOrdering(reset.state, { type: 'reset' }).effect).toEqual({ kind: 'none' })
  })
})
