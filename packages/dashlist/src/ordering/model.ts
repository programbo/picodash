/**
 * Pure ordering model for one DashList ordering container.
 *
 * The model deliberately has no React, Nexus, or DOM dependencies. A caller
 * supplies the current declaration and durable metadata snapshot, then feeds
 * the returned state to the same transition function for pointer and keyboard
 * interactions.
 */

export type DashListPin = 'start' | 'end'
export type OrderingBand = 'start' | 'automatic' | 'end'
export type ReorderDirection = 'up' | 'down' | 'home' | 'end'

export type OrderingNode = {
  readonly id: string
  /** Accessible name used by the interaction layer; it does not affect durable identity. */
  readonly name?: string
  readonly pin?: DashListPin
  /** Hidden nodes remain declared and ordered, but are not movement targets. */
  readonly visible?: boolean
}

export type OrderingInput = {
  readonly declarations: readonly OrderingNode[]
  /** Undefined means that this container has no durable override. */
  readonly durableOrder?: readonly string[]
  readonly reorderable?: boolean
  /** External layout state that must invalidate an active interaction when it changes. */
  readonly sessionFence?: string
}

export type ReconciledOrdering = {
  readonly declarations: readonly OrderingNode[]
  /** Effective order includes hidden declared nodes and excludes dormant IDs. */
  readonly order: readonly string[]
  readonly bands: Readonly<Record<OrderingBand, readonly string[]>>
  readonly visibleBands: Readonly<Record<OrderingBand, readonly string[]>>
  /** Sanitized durable history, including dormant/unknown valid IDs. */
  readonly durableOrder: readonly string[] | undefined
  /** Last Nexus-owned durable history used to derive the effective history. */
  readonly sourceDurableOrder: readonly string[] | undefined
  readonly customized: boolean
  readonly reorderable: boolean
  readonly sessionFence: string | undefined
  readonly fingerprint: string
}

export type ReorderSession = {
  readonly nodeId: string
  readonly band: OrderingBand
  readonly originOrder: readonly string[]
  readonly candidateOrder: readonly string[]
  readonly originFingerprint: string
}

export type OrderingState = {
  readonly ordering: ReconciledOrdering
  readonly session: ReorderSession | null
}

export type OrderingEvent =
  | { readonly type: 'start'; readonly nodeId: string }
  | { readonly type: 'move'; readonly direction: ReorderDirection }
  | { readonly type: 'commit' }
  | { readonly type: 'cancel' }
  | { readonly type: 'reconcile'; readonly input: OrderingInput }
  | { readonly type: 'reset' }

export type OrderingEffect =
  | { readonly kind: 'none' }
  | { readonly kind: 'write-order'; readonly order: readonly string[] }
  | { readonly kind: 'remove-order' }
  | { readonly kind: 'stale-cancel'; readonly reason: 'external-change' }

export type OrderingTransition = {
  readonly state: OrderingState
  readonly effect: OrderingEffect
}

const NO_EFFECT: OrderingEffect = Object.freeze({ kind: 'none' })

function isValidId(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) return false
  for (const character of value) {
    const code = character.codePointAt(0)!
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) return false
  }
  return true
}

function assertNode(node: OrderingNode): void {
  if (!isValidId(node.id))
    throw new TypeError(`Invalid DashList ordering node id: ${String(node.id)}`)
  if (node.pin !== undefined && node.pin !== 'start' && node.pin !== 'end') {
    throw new TypeError(`Invalid DashList ordering pin for ${node.id}.`)
  }
}

function bandFor(node: OrderingNode): OrderingBand {
  return node.pin === 'start' ? 'start' : node.pin === 'end' ? 'end' : 'automatic'
}

function sanitizeDurableOrder(order: readonly string[] | undefined): readonly string[] | undefined {
  if (order === undefined) return undefined
  const seen = new Set<string>()
  const result: string[] = []
  for (const id of order) {
    // Invalid entries are obsolete metadata, not current declarations. Ignore
    // them while retaining valid unknown IDs as dormant history.
    if (!isValidId(id) || seen.has(id)) continue
    seen.add(id)
    result.push(id)
  }
  return result.length === 0 ? undefined : Object.freeze(result)
}

function stableFingerprint(input: {
  readonly declarations: readonly OrderingNode[]
  readonly durableOrder: readonly string[] | undefined
  readonly sourceDurableOrder: readonly string[] | undefined
  readonly reorderable: boolean
  readonly sessionFence: string | undefined
}): string {
  return JSON.stringify({
    declarations: input.declarations.map((node) => ({
      id: node.id,
      pin: bandFor(node),
      visible: node.visible !== false,
    })),
    durableOrder: input.durableOrder ?? null,
    sourceDurableOrder: input.sourceDurableOrder ?? null,
    reorderable: input.reorderable,
    sessionFence: input.sessionFence ?? null,
  })
}

function freezeBands(
  bands: Record<OrderingBand, string[]>,
): Readonly<Record<OrderingBand, readonly string[]>> {
  return Object.freeze({
    start: Object.freeze(bands.start),
    automatic: Object.freeze(bands.automatic),
    end: Object.freeze(bands.end),
  })
}

/** Reconcile declarations with durable history without mutating either input. */
export function reconcileOrdering(input: OrderingInput): ReconciledOrdering {
  const declarations = input.declarations.map((node) => {
    assertNode(node)
    return Object.freeze({ ...node, visible: node.visible !== false })
  })
  const ids = new Set<string>()
  for (const node of declarations) {
    if (ids.has(node.id)) throw new TypeError(`Duplicate DashList ordering node id: ${node.id}`)
    ids.add(node.id)
  }

  const durableOrder = sanitizeDurableOrder(input.durableOrder)
  const reorderable = input.reorderable !== false
  const declarationById = new Map(declarations.map((node) => [node.id, node]))
  const bands: Record<OrderingBand, string[]> = { start: [], automatic: [], end: [] }

  // A customized container keeps known node order from durable history. New
  // declarations append in declaration order, independently within each pin band.
  for (const id of durableOrder ?? []) {
    const node = declarationById.get(id)
    if (node) bands[bandFor(node)].push(id)
  }
  for (const node of declarations) {
    const band = bandFor(node)
    if (!bands[band].includes(node.id)) bands[band].push(node.id)
  }

  const order = [...bands.start, ...bands.automatic, ...bands.end]
  const visibleBands: Record<OrderingBand, string[]> = {
    start: bands.start.filter((id) => declarationById.get(id)!.visible !== false),
    automatic: bands.automatic.filter((id) => declarationById.get(id)!.visible !== false),
    end: bands.end.filter((id) => declarationById.get(id)!.visible !== false),
  }
  const result: ReconciledOrdering = {
    declarations: Object.freeze(declarations),
    order: Object.freeze(order),
    bands: freezeBands(bands),
    visibleBands: freezeBands(visibleBands),
    durableOrder,
    sourceDurableOrder: durableOrder,
    customized: durableOrder !== undefined,
    reorderable,
    sessionFence: input.sessionFence,
    fingerprint: '',
  }
  return Object.freeze({
    ...result,
    fingerprint: stableFingerprint({
      declarations,
      durableOrder,
      sourceDurableOrder: durableOrder,
      reorderable,
      sessionFence: input.sessionFence,
    }),
  })
}

export function createOrderingState(input: OrderingInput): OrderingState {
  return Object.freeze({ ordering: reconcileOrdering(input), session: null })
}

function withSession(state: OrderingState, session: ReorderSession | null): OrderingState {
  return Object.freeze({ ordering: state.ordering, session })
}

function visiblePositions(
  order: readonly string[],
  ordering: ReconciledOrdering,
  band: OrderingBand,
): number[] {
  const visible = new Set(ordering.visibleBands[band])
  const bandIds = new Set(ordering.bands[band])
  const positions: number[] = []
  order.forEach((id, index) => {
    if (bandIds.has(id) && visible.has(id)) positions.push(index)
  })
  return positions
}

function moveCandidate(
  session: ReorderSession,
  ordering: ReconciledOrdering,
  direction: ReorderDirection,
): ReorderSession {
  const positions = visiblePositions(session.candidateOrder, ordering, session.band)
  const currentPosition = positions.indexOf(session.candidateOrder.indexOf(session.nodeId))
  if (currentPosition < 0) return session
  const targetPosition =
    direction === 'up'
      ? Math.max(0, currentPosition - 1)
      : direction === 'down'
        ? Math.min(positions.length - 1, currentPosition + 1)
        : direction === 'home'
          ? 0
          : positions.length - 1
  if (targetPosition === currentPosition) return session

  const next = [...session.candidateOrder]
  const visibleIds = positions.map((position) => next[position])
  const [moved] = visibleIds.splice(currentPosition, 1)
  visibleIds.splice(targetPosition, 0, moved)
  positions.forEach((position, index) => {
    next[position] = visibleIds[index]
  })
  return Object.freeze({ ...session, candidateOrder: Object.freeze(next) })
}

function mergeCommittedHistory(
  ordering: ReconciledOrdering,
  candidateOrder: readonly string[],
): readonly string[] {
  const current = new Set(ordering.order)
  const history = [...(ordering.durableOrder ?? [])]
  const currentSlots = history
    .map((id, index) => (current.has(id) ? index : -1))
    .filter((index) => index >= 0)
  const next = [...history]
  if (currentSlots.length === 0) return Object.freeze([...history, ...candidateOrder])
  candidateOrder.forEach((id, index) => {
    if (index < currentSlots.length) next[currentSlots[index]] = id
    else next.push(id)
  })
  return Object.freeze(next)
}

function sameOrder(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index])
}

function sameOptionalOrder(
  a: readonly string[] | undefined,
  b: readonly string[] | undefined,
): boolean {
  return a === undefined ? b === undefined : b !== undefined && sameOrder(a, b)
}

function withDurableSource(
  ordering: ReconciledOrdering,
  sourceDurableOrder: readonly string[] | undefined,
): ReconciledOrdering {
  if (sameOptionalOrder(ordering.sourceDurableOrder, sourceDurableOrder)) return ordering
  return Object.freeze({
    ...ordering,
    sourceDurableOrder,
    fingerprint: stableFingerprint({
      declarations: ordering.declarations,
      durableOrder: ordering.durableOrder,
      sourceDurableOrder,
      reorderable: ordering.reorderable,
      sessionFence: ordering.sessionFence,
    }),
  })
}

function reconcileAgainstPrevious(
  previous: ReconciledOrdering,
  input: OrderingInput,
): ReconciledOrdering {
  const sourceOrdering = reconcileOrdering(input)
  if (!sourceOrdering.customized) return sourceOrdering

  // Pin changes are declarative, so they do not rewrite Nexus metadata. Keep
  // the already-derived effective history while the Nexus-owned source is
  // unchanged, and let a genuinely new source override become authoritative.
  const sourceUnchanged = sameOptionalOrder(
    sourceOrdering.durableOrder,
    previous.sourceDurableOrder,
  )
  const baseline = sourceUnchanged
    ? reconcileOrdering({ ...input, durableOrder: previous.durableOrder })
    : sourceOrdering
  const previousBands = new Map(previous.declarations.map((node) => [node.id, bandFor(node)]))
  const migrated = new Set(
    sourceOrdering.declarations
      .filter((node) => {
        const previousBand = previousBands.get(node.id)
        return previousBand !== undefined && previousBand !== bandFor(node)
      })
      .map((node) => node.id),
  )
  if (migrated.size === 0) return withDurableSource(baseline, sourceOrdering.durableOrder)

  // Existing destination peers keep their customized relative order. Nodes
  // entering that band follow them in current declaration order.
  const candidate: string[] = []
  for (const band of ['start', 'automatic', 'end'] as const) {
    candidate.push(...baseline.bands[band].filter((id) => !migrated.has(id)))
    candidate.push(
      ...sourceOrdering.declarations
        .filter((node) => migrated.has(node.id) && bandFor(node) === band)
        .map((node) => node.id),
    )
  }
  const effectiveHistory = mergeCommittedHistory(baseline, candidate)
  return withDurableSource(
    reconcileOrdering({ ...input, durableOrder: effectiveHistory }),
    sourceOrdering.durableOrder,
  )
}

/**
 * Apply one pure interaction transition. `reconcile` is also the external-drift
 * fence: any membership, visibility, pin, policy, or durable-order change
 * cancels an active session before the new snapshot is exposed.
 */
export function transitionOrdering(state: OrderingState, event: OrderingEvent): OrderingTransition {
  if (event.type === 'reconcile') {
    const nextOrdering = reconcileAgainstPrevious(state.ordering, event.input)
    if (state.session && nextOrdering.fingerprint !== state.session.originFingerprint) {
      return {
        state: Object.freeze({ ordering: nextOrdering, session: null }),
        effect: Object.freeze({ kind: 'stale-cancel', reason: 'external-change' }),
      }
    }
    return {
      state: Object.freeze({ ordering: nextOrdering, session: state.session }),
      effect: NO_EFFECT,
    }
  }

  if (event.type === 'reset') {
    const hadOverride = state.ordering.customized
    const nextOrdering = reconcileOrdering({
      declarations: state.ordering.declarations,
      reorderable: state.ordering.reorderable,
      sessionFence: state.ordering.sessionFence,
    })
    return {
      state: Object.freeze({ ordering: nextOrdering, session: null }),
      effect: hadOverride ? Object.freeze({ kind: 'remove-order' }) : NO_EFFECT,
    }
  }

  if (event.type === 'start') {
    if (state.session || !state.ordering.reorderable) return { state, effect: NO_EFFECT }
    const node = state.ordering.declarations.find((candidate) => candidate.id === event.nodeId)
    if (!node || node.visible === false) return { state, effect: NO_EFFECT }
    const band = bandFor(node)
    if (state.ordering.visibleBands[band].length < 2) return { state, effect: NO_EFFECT }
    const session: ReorderSession = Object.freeze({
      nodeId: node.id,
      band,
      originOrder: state.ordering.order,
      candidateOrder: state.ordering.order,
      originFingerprint: state.ordering.fingerprint,
    })
    return { state: withSession(state, session), effect: NO_EFFECT }
  }

  if (!state.session) return { state, effect: NO_EFFECT }

  if (event.type === 'move') {
    const session = moveCandidate(state.session, state.ordering, event.direction)
    return { state: withSession(state, session), effect: NO_EFFECT }
  }

  if (event.type === 'cancel') {
    return { state: withSession(state, null), effect: NO_EFFECT }
  }

  // commit
  const session = state.session
  if (sameOrder(session.originOrder, session.candidateOrder)) {
    return { state: withSession(state, null), effect: NO_EFFECT }
  }
  const order = mergeCommittedHistory(state.ordering, session.candidateOrder)
  const nextOrdering = reconcileOrdering({
    declarations: state.ordering.declarations,
    durableOrder: order,
    reorderable: state.ordering.reorderable,
    sessionFence: state.ordering.sessionFence,
  })
  return {
    state: Object.freeze({ ordering: nextOrdering, session: null }),
    effect: Object.freeze({ kind: 'write-order', order }),
  }
}

export function candidateOrder(state: OrderingState): readonly string[] {
  return state.session?.candidateOrder ?? state.ordering.order
}
