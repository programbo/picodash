# DashStack agent instructions

Read this file before changing DashStack, Dashlets, actions, examples, or docs. Then read
[`../reference/dashstack.md`](../reference/dashstack.md), the Nexus agent instructions for field and
metadata behavior, the UI agent instructions for shared presentation, and
[`../adr/0006-dashstack-responsive-measurement.md`](../adr/0006-dashstack-responsive-measurement.md)
for the responsive layout constraint.

## Decision lens

DashStack determines how controls, readouts, visualizations, previews, and actions are organized and
operated. Optimize for explicit JSX composition, typed Nexus bindings, local drafts, accessible
ordering, useful grouping, and durable user preferences without assuming the Stack is hosted in a
Panel.

Use Dev Bridge while developing canonical value, binding, metadata, action, and document flows.
When a safe missing observation or command slows the work, prioritize the Bridge improvement and
prove it against the real DashStack consumer before continuing with a workaround.

## Public package paths

| Path                               | Use                                                                   |
| ---------------------------------- | --------------------------------------------------------------------- |
| `@picodash/dashstack`              | DashStack composition, stable ready-made Dashlets, and Stack actions. |
| `@picodash/dashstack/ui`           | Controlled, unbound controls for composing custom Dashlets.           |
| `@picodash/dashstack/catalog`      | Static metadata for accepted public DashStack components.             |
| `@picodash/dashstack/charts`       | Experimental `ChartDashlet` and `SparklineDashlet` prototypes.        |
| `@picodash/dashstack/style.css`    | Required DashStack and Dashlet structural styles.                     |
| `@picodash/dashstack/package.json` | Package metadata for tooling.                                         |

The `/charts` entrypoint is pre-alpha. It requires the exact optional `@tanstack/charts` `0.12.0`
peer and is excluded from the stable root inventory and component catalog.

## Ownership constraints

- Own Stack, group, Dashlet anatomy, binding composition, ready-made Dashlets, ordering, collapse,
  rail presentation, Stack actions, document UX, unbound controls, and package catalog metadata.
- Keep declarations explicit: DashStack contains Dashlets or root DashGroups with one organizational subgroup level; arbitrary wrappers
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
- DashStack owns no floating placement, Panel Provider, portals, routing, transport, authentication,
  or authorization.

Pure product tests own ordering and reconciliation. Component tests own binding wiring, semantic
DOM, ARIA, and deterministic events. Contract Lab owns real pointer, focus, layout, storage, and
cohesive browser seams.

The canonical product name and pre-release cutover are defined by
[ADR 0007](../adr/0007-dashstack-name-and-public-identity.md).

`/integration` exposes the group-host protocol accepted in
[ADR 0009](../adr/0009-detachable-groups.md). DashStack owns logical membership, visibility metadata,
reveal and reorder cancellation; Picodash owns relocation and Panel coordination.
