# DashList agent instructions

Read this file before changing DashList, Dashlets, actions, examples, or docs. Then read
[`../reference/dashlist.md`](../reference/dashlist.md), the Nexus agent instructions for field and
metadata behavior, the UI agent instructions for shared presentation, and
[`../adr/0006-dashlist-responsive-measurement.md`](../adr/0006-dashlist-responsive-measurement.md)
for the responsive layout constraint.

## Decision lens

DashList determines how controls, readouts, visualizations, previews, and actions are organized and
operated. Optimize for explicit JSX composition, typed Nexus bindings, local drafts, accessible
ordering, useful grouping, and durable user preferences without assuming the List is hosted in a
Panel.

Use Dev Bridge while developing canonical value, binding, metadata, action, and document flows.
When a safe missing observation or command slows the work, prioritize the Bridge improvement and
prove it against the real DashList consumer before continuing with a workaround.

## Ownership constraints

- Own List, group, Dashlet anatomy, binding composition, ready-made Dashlets, ordering, collapse,
  rail presentation, List actions, document UX, unbound controls, and package catalog metadata.
- Keep declarations explicit: DashList contains Dashlets or one-level DashGroups; arbitrary wrappers
  do not become hidden declarations.
- Keep reorderability container-owned and pin bands declarative. Commit one changed order at the
  end of an interaction; write nothing for cancellation or no-op sessions.
- Keep collapsed descendants mounted and registered. Repair focus before making content inert.
- Keep disabled and read-only policies separate from authorization and from reorder/disclosure
  behavior.
- Attach labels, descriptions, and Nexus issues to the controls that consume them. Attribute
  compound issues structurally; never parse issue messages or mark every child invalid.
- Treat invalid configuration as a developer contract error. Treat a valid but unrepresentable
  canonical value as an ephemeral presentation warning; show the real value and never clamp,
  fabricate, persist, or silently replace it.
- Field defaults and validation belong to Nexus. Ready-made Dashlets do not add alternate value
  authorities, parser overrides, or implicit first-choice selection.
- DashList owns no floating placement, Panel Provider, portals, routing, transport, authentication,
  or authorization.

Pure product tests own ordering and reconciliation. Component tests own binding wiring, semantic
DOM, ARIA, and deterministic events. Contract Lab owns real pointer, focus, layout, storage, and
cohesive browser seams.
