# ADR 0001: Agent-first store and Dashlet boundaries

## Status

Superseded by [ADR 0002](0002-provider-level-store-and-scoped-views.md). This ADR remains as a
record of the prototype-era per-Panel Store model.

## Decision

`@picodash/store` owns the complete per-Panel state engine:

- typed field definitions and stable field handles,
- JSON-compatible values and defaults,
- parse/validate contracts,
- draft and interaction state,
- ordered registration and reset/repair workflows,
- import/export and atomic multi-field mutation paths.

`@picodash/store/react` provides synchronous whole-record adapter wiring for host frameworks and
external stores. All state writes share one atomic, validated setter path.

`@picodash/picodash` owns rendering, registration side-effects, provider/layout orchestration, portals,
themes, geometry, and overlays.

## Domain model

Typed JSX remains the canonical authoring representation.

- Panels are represented by `PicodashPanel` and receive typed store instances.
- Dashlets bind to typed field handles rather than string identifiers.
- Field handles are owned by the store, so they are stable and type-safe across composition.

Provider-owned state remains separate from per-Panel state:

- Provider owns panel registration visibility, activation, z-order, and persisted layout records.
- Panel/Store state owns values, contracts, interaction state, drafts, ordering, and repair.

## Boundaries

- `@picodash/picodash/dashlet` is the semantic custom-Dashlet surface and anatomy.
- `@picodash/picodash/ui` remains the lower-level accessible foundation and React Aria contract layer.

## Rejected alternatives

- Keeping per-Panel engine inside `@picodash/picodash` would couple render and state migration work and
  weaken host portability.
- String field identifiers would weaken type-level guarantees and allow contract drift between authoring
  and rendered components.
- Per-field adapters would split mutation paths and break atomic resets, imports, and repairs.
- First-class Dashboard component abstractions would overstep composition responsibility and constrain host
  layout ownership.
- Moving semantic Dashlet anatomy into `/ui` would blur component-level intent with low-level primitives.
