# Picodash Context

## Product and package model

Picodash ships three public products:

- `@picodash/dashpanel`: the standalone draggable, dockable panel shell.
- `@picodash/dashlist`: standalone list, group, and Dashlet composition primitives.
- `@picodash/picodash`: the integrated facade combining DashPanel and Dashlist.

`@picodash/store` is the application-wide typed state kernel. `@picodash/theme` supplies shared
semantic theme context and tokens. `@picodash/picodash` is the integrated public facade for
consumers migrate to the three products.

The production website has one public route, `/`. The Contract Lab runs in `apps/lab` under `/lab`
for local debugging and is not deployed with the website.

## Glossary

**Dashboard**
The application-level composition of one or more Panels and their Dashlets. A Dashboard is a composition
construct, not a component.
_Avoid_: Workspace, control center, dashboard component

**Panel**
An independently placeable container represented by `PicodashPanel`.
_Avoid_: Dashlet, window, widget

**Dashlet**
A control, readout, visualization, preview, action, or compound item inside a Panel.
_Avoid_: Panel, widget, tweak

**Compound Dashlet**
One Dashlet that composes multiple elements and may bind several fields while retaining one registration
boundary, ordering, visibility, status, and reset boundary.
_Avoid_: Dashlet group, mini-dashboard, nested Panel

**Picodash Store**
The complete per-Panel state engine covering values, contracts, drafts, validation, repair, registration,
ordering, collapse, focus, hover, and interaction state.
_Avoid_: Provider Store, global Store, field registry

**Picodash Provider**
The host-owned boundary that registers Panels and owns provider-scoped state for panel visibility, activation,
z-order, cross-panel placement policy, and persisted layout.
_Avoid_: global panel manager, global registry, app-level panel service

## Placement Terms

**Boundary**
The rectangular area relative to which a Panel is placed and contained.
_Avoid_: Portal, parent, viewport

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
