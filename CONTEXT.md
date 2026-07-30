# Picodash

Picodash is a system for composing unobtrusive control and monitoring surfaces within an
application.

## Language

**Dashboard**:
The application-level composition of one or more Panels and their Dashlets. A Dashboard is a
composition, not a single component.
_Avoid_: Workspace, control center, dashboard component

**Panel**:
An independently placeable container of Dashlets within a Dashboard.
_Avoid_: Dashlet, window, widget

**Dashlet**:
A control, readout, visualization, preview, action, or compound item inside a Panel.
_Avoid_: Panel, widget, tweak

**Compound Dashlet**:
One Dashlet that composes multiple elements and may bind several fields while retaining a single
ordering, visibility, status, and reset boundary.
_Avoid_: Dashlet group, mini-dashboard, nested Panel

**Picodash Store**:
The complete state engine for one Panel, encompassing values, contracts, drafts, validation,
repair, registration, ordering, collapse, focus, hover, and interaction state.
_Avoid_: Provider Store, global Store, field registry

## Placement

**Boundary**:
The rectangular area relative to which a Panel is placed and contained.
_Avoid_: Portal, parent, viewport

**Placement mode**:
A Panel's stable movement policy: Floating, Fixed, or Hybrid.
_Avoid_: Position, disposition, layout mode

**Floating**:
A placement mode that permits Free placement and offset Snapped attachment.
_Avoid_: Free, draggable

**Fixed**:
A placement mode that keeps a Panel Docked to its Boundary.
_Avoid_: Docked, pinned

**Hybrid**:
A placement mode that can move between Free, Snapped, and Docked dispositions.
_Avoid_: Magnetic, adaptive

**Disposition**:
A Panel's current relationship to its Boundary: Free, Snapped, or Docked.
_Avoid_: Placement mode, position, alignment

**Free**:
A disposition located by Preferred coordinates without attachment to a Boundary edge.
_Avoid_: Floating, detached

**Snapped**:
An offset disposition attached to a Boundary edge or corner while retaining floating character.
_Avoid_: Docked, fixed, magnetic

**Docked**:
A flush disposition attached to a Boundary edge or corner with fixed character.
_Avoid_: Snapped, fixed, pinned

**Preferred coordinates**:
The Boundary-relative Cartesian point chosen before containment is applied.
_Avoid_: Screen coordinates, rendered coordinates, absolute coordinates
