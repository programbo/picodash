# Picodash Context

## Product and package model

Picodash ships three foundational products and one integrated product:

- `@picodash/store`: the typed value, scope, metadata, persistence, and adapter foundation.
- `@picodash/dashpanel`: the standalone draggable, dockable panel shell.
- `@picodash/dashlist`: standalone list, group, and Dashlet composition primitives.
- `@picodash/picodash`: the integrated facade combining DashPanel and DashList.

`@picodash/ui` is the supporting theme, density, token, and generic accessible UI foundation. The
current `@picodash/theme` package is prototype evidence scheduled for replacement.

The production website has one public route, `/`. The Contract Lab runs in `apps/lab` under `/lab`
for local debugging and is not deployed with the website.

## Glossary

**Dashboard**
The application-level composition of one or more Panels and their Dashlets. A Dashboard is a composition
construct, not a component.
_Avoid_: Workspace, control center, dashboard component

**Panel**
An independently placeable container rendered by `DashPanel`.
_Avoid_: Dashlet, window, widget

**Adaptive Panel presentation**
A transient drawer or sheet projection of a Panel that preserves the Panel's ordinary placement
preference.
_Avoid_: Mobile mode, responsive placement, docked sheet

**DashList**
An ordered, groupable collection of registered Dashlets associated with one Store scope.
_Avoid_: Panel, field registry, schema-generated form

**Primary DashList**
The DashList that shares a Panel's Store scope. A Panel has at most one primary DashList, while
additional DashLists occupy explicitly identified child scopes.
_Avoid_: First List, default List, only List

**DashGroup**
A declarative DashList container with one stable node identity, optional collapse, and one
immediate-child ordering container. It is not a Store scope.
_Avoid_: Scope, nested List, Dashlet group

**Dashlet**
A registered leaf in a DashList that presents a control, readout, visualization, preview, action,
or compound composition.
_Avoid_: Panel, widget, tweak

**Compound Dashlet**
One Dashlet that composes multiple elements and may bind several fields while retaining one node
identity, ordering boundary, focus boundary, and standard issue region.
_Avoid_: Dashlet group, mini-dashboard, nested Panel

**List behavior action**
An operation whose target and effect belong to one active DashList scope, such as expanding groups
or resetting List-owned state. Its presentation may be shared without transferring behavior to
DashPanel or Picodash.
_Avoid_: Panel action, menu item

**Component catalog**
Static package-owned discovery metadata for accepted public components and their canonical imports.
It is not a runtime registry or prop schema.
_Avoid_: Component registry, plugin catalog, API schema

**Scope document**
A versioned projection targeting one Store scope's permitted canonical values and durable metadata,
optionally including active descendants. It is not a value dump, draft snapshot, or record of
historical relationships.
_Avoid_: Settings file, scope backup, exported values

**Picodash Store**
A root typed state kernel owning canonical values, field contracts, scopes, durable product metadata,
and registered binding interaction state. A scoped Store is an immutable view of that root, not a
separate value store.
_Avoid_: Provider Store, global Store, field registry

**DashPanel Provider**
The host-owned `DashPanelProvider` boundary for Panel visibility, activation, z-order, placement
policy, and layout coordination over one root Store.
_Avoid_: Picodash Provider, global panel manager, app-level panel service

**Picodash Provider**
The integrated `PicodashProvider` boundary that composes the Store, DashPanel Provider, shared UI,
and Picodash-only coordination without creating another state authority.
_Avoid_: Dashboard component, global registry, renamed DashPanel Provider

## Placement Terms

**Boundary**
The rectangular area relative to which a Panel is placed and contained.
_Avoid_: Portal, parent, viewport

**Boundary inset**
The reduction applied to a Boundary's usable placement rectangle before a Panel is placed or
contained.
_Avoid_: Container margin, snap offset, portal padding

**Placement mode**
The stable movement policy family: `floating`, `fixed`, or `hybrid`.
_Avoid_: Position, disposition, layout mode

**Floating**
A mode that permits free placement and offset snapped attachment.
_Avoid_: Free, draggable

**Fixed**
A mode that keeps a Panel docked to its Boundary.
_Avoid_: Docked, pinned

**Hybrid**
A mode that can move between free, snapped, and docked behavior.
_Avoid_: Magnetic, adaptive

**Disposition**
A Panel’s current relationship to its Boundary: `free`, `snapped`, or `docked`.
_Avoid_: Placement mode, position, alignment

**Free**
A disposition located by preferred coordinates without edge/corner attachment.
_Avoid_: Floating, detached

**Snapped**
A disposition attached to a boundary edge or corner while retaining floating behavior.
_Avoid_: Docked, fixed, magnetic

**Docked**
A flush disposition attached to a boundary edge or corner with fixed behavior.
_Avoid_: Snapped, fixed, pinned

**Preferred coordinates**
Boundary-relative coordinates used before containment and projection rules.
_Avoid_: Screen coordinates, rendered coordinates, absolute coordinates
