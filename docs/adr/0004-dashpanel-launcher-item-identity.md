# ADR 0004: DashPanel launcher item identity

## Status

Accepted target contract.

## Context

`DashPanelLauncher` renders application-declared controls that target mounted Panels by `panelId`.
One launcher may legitimately contain several controls for the same Panel, such as text and icon
representations or entries in different application-defined groups. Those controls share a Panel
target but retain independent React Aria press, focus, disabled, label, and accessibility state.

Using the array index as a React key transfers that state to whichever target moves into the same
position. Using `panelId` alone cannot distinguish repeated targets. Using a Panel ID plus its
occurrence keeps different Panel targets stable but still treats repeated controls as positional
when they reorder among themselves.

Requiring a separate identity for every launcher entry would solve the React problem but make the
common one-control-per-Panel case repeat the same identity twice. Rejecting repeated Panel targets
would instead turn an implementation limitation into a new public composition constraint.

## Decision

Launcher target identity and launcher entry identity are separate:

- `panelId` identifies the Panel controlled by an entry.
- Optional `itemId` identifies that launcher entry.
- An entry may omit `itemId` while its `panelId` is unique in the launcher.
- Every entry in a repeated-`panelId` group must provide a unique, stable, non-empty `itemId`.
- Every supplied `itemId` is unique within its launcher, including IDs on entries with different
  Panel targets.
- Explicit item keys and fallback Panel keys use separate internal namespaces.

`itemId` is launcher-local React identity only. It is not rendered as a DOM ID, registered with
Nexus, persisted, disclosed through Dev Bridge, or interpreted as Panel identity. Changing a
supplied `itemId` intentionally remounts that launcher control.

## Consequences

- Existing launchers with one entry per Panel require no migration.
- Repeated Panel targets remain supported but must declare the identity React needs to preserve
  each control through reordering.
- Focus, press, disabled, and accessible control state stay attached to the same launcher entry.
- Array-level repetition rules remain runtime-validated because TypeScript cannot express
  uniqueness or conditional requirements across an arbitrary readonly array.
- Package type and component evidence must cover optional IDs, repeated targets, stable reordering,
  missing IDs, duplicate IDs, and empty IDs.

## Rejected alternatives

- **Require `itemId` for every entry:** type-safe but adds redundant caller work for the common
  one-control-per-Panel case.
- **Reject repeated `panelId` values:** removes a valid application composition and creates an
  unnecessary breaking target-identity constraint.
- **Use absolute array indexes:** transfers React state between different targets after reorder.
- **Use `panelId` plus occurrence for every duplicate:** preserves Panel targeting but not the
  identity of distinct repeated controls when their order changes.
- **Derive identity from labels or accessibility names:** presentation is mutable, may be a React
  node, and is not a reliable identity contract.

## Detailed record

The exact validation and fallback rules are recorded in the
[DashPanel contract decisions](../reference/dashpanel-contract-decisions.md) and the public surface
is recorded in the [DashPanel target reference](../reference/dashpanel.md).
