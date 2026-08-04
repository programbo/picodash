# Product value propositions

This explanation distinguishes Store, DashPanel, DashList, and Picodash as products. It guides
roadmap priority, documentation depth, examples, and package boundaries before implementation.

## Status

> Contract: Draft
> Implementation: Prototype
> Evidence: Value propositions require final product review before they become accepted product
> contracts.

## Store

> Contract: Accepted
> Implementation: Prototype

### Proposition

Store is a typed state foundation for configurable React interfaces. It gives applications one
synchronous, validated value authority plus durable metadata for Panels and Lists, without forcing
the application to replace its preferred state library.

### User and problem

Store is for developers and coding agents building control, configuration, and monitoring
interfaces that need more than disconnected component state. Those interfaces commonly need typed
values, validation, drafts, atomic resets, persistence, import/export, and several organized UI
scopes. Rebuilding those contracts for every Panel or settings screen creates inconsistent behavior
and difficult migrations.

### Concrete value

- Define canonical typed fields once and bind them across several UI scopes.
- Keep multi-field writes synchronous, validated, and atomic.
- Persist application values when Store owns them, or adapt an existing application store without
  creating a second value authority.
- Organize Panel and List metadata with scoped views while keeping root values reusable.
- Give agents explicit contracts, structured diagnostics, and predictable documents instead of
  asking them to infer application state conventions.

### Independent use

Store can power a custom application UI without DashPanel or DashList. Its React selector API can
subscribe directly to an explicit root or scoped Store.

### Boundary

Store does not render controls, Panels, Lists, or dashboards. Scopes organize trusted application
state; they do not sandbox plugins or restrict field access.

## DashPanel

> Contract: Draft
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
- Persist settled placement as a Store scope override while keeping visibility and drag previews
  transient.
- Resolve viewport or element boundaries, insets, portals, themes, and action menus through one
  Provider contract.
- Preserve pointer, keyboard, focus, and overlay behavior across complex host applications.
- Use DashPanel without adopting DashList or Picodash's integrated Dashlet composition.

### Independent use

A DashPanel-only application creates a root Store, supplies it to `PicodashProvider`, and renders
one or more Panels containing arbitrary application UI.

### Boundary

DashPanel owns the panel host and placement behavior. It does not prescribe the content's form,
List, data-fetching, or application-value model. Permanent removal remains application-owned
unmounting rather than imperative deregistration.

## DashList

> Contract: Draft
> Implementation: Prototype

### Proposition

DashList is a standalone React composition system for building ordered, groupable collections of
controls, readouts, visualizations, previews, and actions backed by typed Store fields.

### User and problem

DashList is for applications that need a dense, adaptable settings or operations List but do not
want to rebuild field binding, draft handling, grouping, accessible reordering, collapse state, and
durable user ordering. Conventional form libraries focus on submission; generic sortable Lists do
not understand canonical values, validation, or compound Dashlets.

### Concrete value

- Compose typed Dashlets as explicit JSX rather than generating an opaque form from a schema.
- Bind several editors and displays to one canonical Store field while keeping interaction drafts
  local to each binding.
- Group and reorder stable items with pointer and keyboard parity.
- Persist user order and collapse overrides without persisting declarative containment.
- Reset, import, and export active List content through the same Store transaction contracts.
- Run standalone with an explicit Store or inherit a scope when composed under Picodash.

### Independent use

A DashList-only application supplies a root Store and List ID, or a scoped Store whose identity
agrees with the List. DashList establishes scoped context for its Dashlets without requiring a
PicodashProvider or DashPanel.

### Boundary

DashList does not provide a floating Panel, placement, portals, or Provider host. It organizes
trusted React content inside an application-owned layout. Cross-container moves do not rewrite
declarative group membership.

## Picodash

> Contract: Draft
> Implementation: Prototype

### Proposition

Picodash is an integrated React control and monitoring interface built from Store, DashPanel, and
DashList. It lets a developer or coding agent add configurable controls, live readouts,
visualizations, previews, and actions to an existing application without inventing the state,
panel, and List infrastructure separately.

### User and problem

Picodash is for teams that want the complete control-interface system rather than one foundation.
The application may need several Panels, grouped Dashlets, durable preferences, typed application
values, accessible interaction, theming, and documents that work together under one explicit
contract.

### Concrete value

- Compose DashPanels and DashLists over one root Store and field model.
- Use same-scope primary Lists or explicit child scopes without separate Panel/List identity systems.
- Apply Panel actions across active descendant Lists through registered relationships.
- Reuse integrated Dashlets and shared themes while retaining explicit typed JSX.
- Start with the integrated facade and drop to any foundational package when custom composition is
  required.

### Boundary

Picodash is an integration and facade, not a monolithic Dashboard component or an application
framework. Applications still own routing, data transport, authorization, exposure policy, and
which Panels and Dashlets are mounted.

## Product relationship

```text
@picodash/store   @picodash/theme
        |               |
        +-------+-------+
                |
       +--------+--------+
       |                 |
DashPanel            DashList
       |                 |
       +--------+--------+
                |
            Picodash
```

DashPanel and DashList depend on Store and shared theme contracts, not on one another. Picodash
integrates them after their independent contracts are stable.

## Contract-strength assessment

- **Store:** accepted API. Ownership, scope, persistence, adapter, transaction, and document
  boundaries are internally consistent. The exact DashPanel metadata payload remains deliberately
  dependent on the DashPanel placement review.
- **DashPanel:** moderately strong. Its primary outcome and placement/host boundary are clear, but
  the detailed aspirational API still needs reconciliation with the prototype.
- **DashList:** directionally strong but least differentiated in detail. Its Dashlet anatomy,
  authoring ergonomics, group behavior, and built-in catalog require a focused contract session
  before the product reference can become accepted.
- **Picodash:** clear as an integration proposition, but its final facade should follow rather than
  pre-empt foundational contracts.
