# Product value propositions

This explanation distinguishes Nexus, DashPanel, DashList, and Picodash as products. It guides
roadmap priority, documentation depth, examples, and package boundaries before implementation.

## Status

> Contract: Accepted
> Implementation: Prototype
> Evidence: Product purposes, users, independent value, and package boundaries are accepted.

## Nexus

> Contract: Accepted
> Implementation: Prototype

### Proposition

Picodash Nexus connects settings panels, inspectors, and control dashboards to typed application
state, adding validation, drafts, saved preferences, and import/export without forcing a second
source of truth. It can own the values or adapt an existing synchronous state store; multi-field
changes are validated as a complete candidate and committed atomically.

### User and problem

Nexus is for developers and coding agents building settings panels, inspectors, and control or
monitoring dashboards that need more than disconnected component state. Rebuilding validation,
drafts, persistence, import/export, and saved UI preferences for every interface creates
inconsistent behavior and difficult migrations.

### Concrete value

- Define canonical typed fields once and bind them across several UI scopes.
- Keep multi-field writes synchronous, validated, and atomic.
- Persist application values when Nexus owns them, or adapt an existing application store without
  creating a second value authority.
- Organize Panel and List metadata with scoped views while keeping root values reusable.
- Give agents explicit contracts, structured diagnostics, and predictable documents instead of
  asking them to infer application state conventions.

### Independent use

Nexus can power a custom application UI without DashPanel or DashList. Its React selector API can
subscribe directly to an explicit root or scoped Nexus.

### Boundary

Nexus does not render controls, Panels, Lists, or dashboards. Scopes organize trusted application
state; they do not sandbox plugins or restrict field access.

## DashPanel

> Contract: Accepted
> Implementation: Prototype

### Proposition

DashPanel is a standalone React panel shell for adding movable, dockable, dismissible UI without
building window management, portal coordination, accessible actions, and layout persistence from
scratch.

### User and problem

DashPanel is for applications that need tools, inspectors, controls, previews, or operational
readouts without permanently consuming page layout. Building a reliable floating panel requires
more than dragging: it needs boundaries, snapping and docking, keyboard and focus behavior,
visibility controls, portal layering, themes, responsive containment, and restorable placement.

### Concrete value

- Render arbitrary React content in a Panel that can float, snap, dock, collapse, hide, and reopen.
- Choose the dock positions a host permits and distribute same-edge Panels through predictable
  occupancy and allocation rules.
- Persist settled placement as a Nexus scope override while keeping visibility and drag previews
  transient.
- Resolve viewport or element boundaries, insets, portals, themes, and action menus through one
  Provider contract.
- Preserve pointer, keyboard, focus, and overlay behavior across complex host applications.
- Let the host project a Panel as a modal drawer or sheet without overwriting its desktop layout.
- Use DashPanel without adopting DashList or Picodash's integrated Dashlet composition.

### Independent use

A DashPanel-only application creates a root Nexus, supplies it to `DashPanelProvider`, and renders
one or more Panels containing arbitrary application UI.

### Boundary

DashPanel owns the panel host and placement behavior. It does not prescribe the content's form,
List, data-fetching, or application-value model. Permanent removal remains application-owned
unmounting rather than imperative deregistration.

## DashList

> Contract: Accepted
> Implementation: Prototype

### Proposition

DashList is a standalone React composition system for building ordered, groupable collections of
controls, readouts, visualizations, previews, and actions backed by typed Nexus fields.

### User and problem

DashList is for applications that need a dense, adaptable settings or operations List but do not
want to rebuild field binding, draft handling, grouping, accessible reordering, collapse state, and
durable user ordering. Conventional form libraries focus on submission; generic sortable Lists do
not understand canonical values, validation, or compound Dashlets.

### Concrete value

- Compose typed Dashlets as explicit JSX rather than generating an opaque form from a schema.
- Bind several editors and displays to one canonical Nexus field while keeping interaction drafts
  local to each binding.
- Group and reorder stable items with pointer and keyboard parity.
- Persist user order and collapse overrides without persisting declarative containment.
- Reset active List content and import or export one reviewed JSON scope document through the same
  Nexus transaction and disclosure contracts.
- Run standalone with an explicit Nexus or inherit a scope when composed under Picodash.

### Independent use

A DashList-only application supplies a root Nexus and List ID, or a scoped Nexus whose identity
agrees with the List. DashList establishes scoped context for its Dashlets without requiring a
PicodashProvider or DashPanel.

### Boundary

DashList does not provide a floating Panel, placement, portals, or Provider host. It organizes
trusted React content inside an application-owned layout. Cross-container moves do not rewrite
declarative group membership.

## Picodash

> Contract: Accepted
> Implementation: Prototype

### Proposition

Picodash is an integrated React control and monitoring interface built from Nexus, DashPanel, and
DashList. It lets a developer or coding agent add configurable controls, live readouts,
visualizations, previews, and actions to an existing application without inventing the state,
panel, and List infrastructure separately.

### User and problem

Picodash is for teams that want the complete control-interface system rather than one foundation.
The application may need several Panels, grouped Dashlets, durable preferences, typed application
values, accessible interaction, theming, and documents that work together under one explicit
contract.

### Concrete value

- Compose DashPanels and DashLists over one root Nexus and field model.
- Use one same-scope primary List by default, with explicit child scopes for advanced composition.
- Contribute the primary DashList's actions to its Panel while keeping additional explicitly scoped
  Lists independent.
- Reuse integrated Dashlets and shared UI while retaining explicit typed JSX.
- Start with the integrated facade and drop to any foundational package when custom composition is
  required.

### Boundary

Picodash is an integration and facade, not a monolithic Dashboard component or an application
framework. Applications still own routing, data transport, authorization, exposure policy, and
which Panels and Dashlets are mounted.

## Product relationship

```text
@picodash/nexus       @picodash/ui
       |  \             /  |
       |   +-- DashPanel ---+
       |   +-- DashList ----+
       +----- Picodash -----+
```

DashPanel and DashList depend on Nexus and the shared UI foundation, not on one another. UI owns
theme, density, tokens, and generic accessible presentation primitives; it is supporting
infrastructure rather than a fourth product proposition. Picodash integrates the three products
after their independent contracts are stable.

## Contract-strength assessment

- **Nexus:** accepted API. Ownership, scope, persistence, adapter, transaction, and document
  boundaries are internally consistent, including the Nexus-owned DashPanel layout record.
- **DashPanel:** accepted initial API. Product ownership, lifecycle, placement, docking, adaptive
  presentation, sizing, accessibility, actions, and theme behavior are internally consistent.
- **DashList:** accepted initial API. Anatomy, authoring, group behavior, rail presentation,
  ready-made Dashlets, actions, documents, and catalog ownership are explicit.
- **Picodash:** accepted integration contract. Implementation remains deliberately sequenced after
  the three foundational products stabilize.
