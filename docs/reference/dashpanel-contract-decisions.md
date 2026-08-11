# DashPanel contract decisions

This reference records accepted target decisions for `@picodash/dashpanel`. ADRs explain why the
identity and ownership model exists; this page states the exact public behavior it requires.

## Status

> Contract: Accepted
> Implementation: Partial
> Evidence: `packages/dashpanel/tests/dashpanel.test.tsx` and the DashPanel rows in the conformance
> matrix cover the implemented launcher identity subset.

## 1. Panel and launcher identity

### 1.1 Panel targets

A DashPanel `id` resolves its Store scope and its identity in the nearest Provider. A launcher
entry's `panelId` is a target reference to that Panel. It is not the identity of the launcher entry
when several controls target the same Panel.

One active DashPanel is permitted per scope. Repeating a `panelId` in a launcher creates additional
controls for the same Panel; it never creates or selects between duplicate mounted Panels.

### 1.2 Launcher entry identity (PANEL-LAUNCHER-IDENTITY-1)

`DashPanelLauncherItem.itemId` is an optional launcher-local identity:

- an entry whose `panelId` occurs once may omit `itemId`; its Panel target supplies the stable
  fallback identity;
- when a `panelId` occurs more than once, every occurrence requires an explicit `itemId`;
- every supplied `itemId` is a non-empty, case-sensitive string unique within that launcher;
- a supplied `itemId` remains stable across reorders and ordinary rerenders; changing it is an
  intentional React remount of that launcher entry; and
- `itemId` is not a DOM ID, Store scope, Panel ID, persisted value, or cross-launcher registry key.

The runtime namespaces explicit item identities separately from fallback Panel identities. An
explicit `itemId` may therefore equal another entry's `panelId` without producing a React key
collision.

### 1.3 Validation

Invalid launcher identity fails synchronously before the launcher renders its triggers. Empty
explicit item IDs, duplicate explicit item IDs, and repeated Panel targets with an omitted item ID
are contract errors. A target Panel that is not mounted remains a valid launcher declaration and
renders a disabled trigger.

## Related decisions

- [ADR 0004: DashPanel launcher item identity](../adr/0004-dashpanel-launcher-item-identity.md)
- [DashPanel target reference](dashpanel.md)
- [Store contract decisions](store-contract-decisions.md)
