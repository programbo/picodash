# ADR 0007: Panel manual sizing and interaction events

## Status

Accepted on 2026-11-12 after owner approval of the
[resizing plan](../internal/dashpanel-resizing-plan.md). Implementation and browser evidence retain
their individual statuses in the [conformance matrix](../reference/contract-conformance.md).

This decision revises ADR 0002's durable Panel model and the initial DashPanel no-user-resize
contract. It does not move Panel behavior into Nexus or shared UI.

## Context

Real use requires users to choose Panel dimensions. A single preferred CSS width and intrinsic
height cannot express manual height, per-axis restoration, or retained dimensions while a viewport
temporarily contracts. Saving the rendered rectangle would replace user intent with a constrained
projection. Saving a complete placement record on the first size change would also freeze declared
placement defaults that the user never changed.

Applications and agents need to observe interaction lifecycles and applied differences. Binding
interaction snapshots and diagnostics are not a general interaction event stream. Writing pointer
frames into either canonical values or durable metadata would produce unnecessary notifications,
persistence writes, and authority confusion.

## Decision

### Preferred, manual, and resolved geometry

DashPanel owns sizing behavior. Its declared preferred width/height and constraints are application
policy. A settled manual override is independent for each axis. Resolved dimensions and position
are a transient projection into the current boundary, insets, placement, and dock allocation.

Boundary contraction never overwrites manual dimensions or preferred position. Re-expansion
resolves from the retained inputs. A width-only override leaves automatic height automatic.
Content growth after manual height selection scrolls until the override is restored; explicitly
enabled content minimums may temporarily constrain the rendered size.

Free Panels support four edge and four corner resize targets. Anchored placements expose only
compatible targets; allocation-owned dimensions remain dormant. Resizing does not detach or change
placement. Pointer, keyboard, numeric controls, and public commands share sizing validation and
projection. A changed gesture commits once; no-op and cancellation commit nothing. Native listener ownership
starts with the gesture rather than a later React effect. A matching native capture-loss event
whose primary button is already released completes the gesture using its final coordinates,
independently of whether `pointerup` has arrived. Capture loss with the button still held remains
cancellation. This event-order clarification follows the observed moving-release failure in the
in-app browser on 2026-11-12.

Eight supplementary border targets cannot all be 44px squares on a minimum-sized Panel without
covering one another, header actions, or content. The accepted coarse-pointer revision therefore
keeps precise compact border grips and provides an always-visible 44×44px “Resize panel” header
action that opens the numeric/tap editor, with 44px inputs/actions. Standard header chrome retains
its coarse-pointer target contract. Border grips are an additional precision path; the equivalent
large control supplies the complete resizing functionality without dragging or target overlap.
This replaces the plan's original claim that every resize grip itself would be 44px.

### Versioned sparse Panel metadata

Nexus owns a strict JSON version-2 Panel payload with independent optional `placement`,
`preferredPosition`, and `manualSize` overrides. At least one override must exist. `manualSize`
contains at least one positive finite CSS-pixel `width` or `height`. Missing properties follow
current declarations. Removing the final override removes the Panel metadata record.

Only settled intent is durable. Measurement, resolved geometry, limits, hover, focus, visibility,
collapse, activation, z-order, animation, and allocation remain ephemeral. West/north resizing
commits changed position and dimensions atomically. Size restoration removes only the requested
manual axes; full layout reset removes all Panel overrides.

Hydration recognizes the exact valid obsolete prototype shape `{ placement, preferredPosition }`,
discards only that Panel preference, retains independently valid same-scope List metadata, and emits
the scoped `panel_layout_obsolete` warning. This is current-default recovery, not a migration or
compatibility alias. Arbitrary malformed or unknown Panel payloads retain the existing whole-scope
quarantine policy. Setters and document import accept only the strict version-2 shape.

Panel payload versioning changes neither the application's `schemaVersion` nor the existing
envelope/document `formatVersion: 1`. The explicit Panel `version: 2` is the domain cutover signal;
older strict readers fail validation rather than silently applying the new shape. Canonical values
remain unaffected by metadata recovery.

### Ephemeral Nexus observation

Every root and scoped Nexus exposes a typed `events` subscription namespace separate from
snapshots and persistence. Product events contain detached data, root-local sequence, monotonic
time, and Nexus-derived scope/entity generation. Live integration leases publish through the
public integration entry; declarations reuse their existing entity lease. Applications receive no
arbitrary emitter or new mutation authority from a subscription.

The contract covers hover/focus/pointer interactions, move/resize/reorder lifecycles, requested and
applied geometry differences, command outcomes, and automatic layout projection. Motion updates
may coalesce to one sample per frame; start/end/cancel transitions do not silently disappear. A
final update precedes the terminal event. Product-local geometry continues to drive rendering.
Events never contain native event objects, DOM nodes, arbitrary content, or raw exception causes.

The default Nexus channel retains no history. Subscriber exceptions cannot roll back state or
interrupt later listeners. Reentrant delivery is bounded. Dev Bridge may observe explicitly
disclosed scopes and event types through a bounded, generation-fenced cursor protocol, with visible
history gaps rather than an unbounded queue. It gains no resize, reset, or publish command.

## Consequences

- DashPanel remains useful with arbitrary React content and without DashList. Content whose
  semantic dimensions cannot be inferred from DOM layout supplies explicit finite metrics.
- Shared UI supplies unchanged primitives, theme tokens, and accessibility foundations. Resize
  targets, commands, measurements, state transitions, and feedback remain DashPanel-owned.
- Persisted manual intent survives viewport, placement, content, and visibility projections.
  Restoring preferred size is distinct from resetting placement.
- Nexus tests own payload, event-generation, dispatch, persistence, and document invariants.
  DashPanel tests own sizing and interactions. Contract Lab owns real layout, capture, focus,
  transitions, and browser storage; Bridge observations provide independent Nexus evidence.
- The Resize Lab is a visible scenario inside the existing Placement preset at `/lab`. The six
  presets, setup-only driver, stable Console/status, and 40-test ceiling remain unchanged.

## Rejected alternatives

- **Persist every resolved rectangle:** turns temporary constraints into lost user preferences.
- **One manual-sizing boolean plus a full size:** cannot retain automatic behavior independently
  per axis and duplicates information already carried by override presence.
- **Copy defaults into every layout write:** makes an unrelated size change override later
  application placement defaults.
- **Eight active targets on every dock:** promises movement that contradicts anchor/allocation
  ownership. Free placement remains available for unconstrained eight-direction resizing.
- **Record interactions as values, binding drafts, or diagnostics:** confuses state authority,
  rendering, durable preferences, current conditions, and event history.
- **Bridge-only inspection or private product imports:** creates a second authority unavailable to
  other public Nexus consumers.

## Detailed contracts

- [DashPanel decisions](../reference/dashpanel-contract-decisions.md)
- [DashPanel reference](../reference/dashpanel.md#resize-and-responsive-behavior)
- [Nexus decisions](../reference/nexus-contract-decisions.md#10-panel-metadata-and-provider-runtime)
- [Nexus events](../reference/nexus.md#interaction-events)
- [Dev Bridge observation](../development/agent-dev-bridge.md#read-disclosed-interaction-events)
