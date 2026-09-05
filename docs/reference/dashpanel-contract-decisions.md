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

A DashPanel `id` resolves its Nexus scope and its identity in the nearest Provider. A launcher
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
- `itemId` is not a DOM ID, Nexus scope, Panel ID, persisted value, or cross-launcher registry key.

The runtime namespaces explicit item identities separately from fallback Panel identities. An
explicit `itemId` may therefore equal another entry's `panelId` without producing a React key
collision.

### 1.3 Validation

Invalid launcher identity fails synchronously before the launcher renders its triggers. Empty
explicit item IDs, duplicate explicit item IDs, and repeated Panel targets with an omitted item ID
are contract errors. A target Panel that is not mounted remains a valid launcher declaration and
renders a disabled trigger.

## 2. Placement interaction feedback

### 2.1 Live magnetic snapping (PANEL-PLACEMENT-FEEDBACK-1)

Floating snaps and Hybrid top/bottom snaps resolve during pointer movement, not only after release.
Entering `snapProximity` moves the displayed Panel to the exact offset target. Once acquired, the
target remains active through a resistant interval and releases at
`max(snapProximity, detachDistance)`. The resistance is transient geometry; it does not create an
intermediate placement or Nexus write.

Snap acquisition and final detachment use Motion with short, theme-defined independent translation. The base
Panel position continues to follow live pointer geometry while the transient offset settles, so
motion never turns the entire drag into a lagging transition. DashPanel exposes separate duration,
easing, and bounce tokens for snap and detach. Reduced motion removes both animations without
changing attraction, resistance, release thresholds, or the committed result.

### 2.2 Hybrid dock target proxy (PANEL-PLACEMENT-FEEDBACK-2)

Hybrid side and corner intent uses an independent target-area proxy. Motion animates it from the
Panel to an available target, between targets as the pointer crosses zones, and back to the Panel
when the pointer leaves every valid zone. The shared theme duration and easing tokens govern this
interruptible transform-and-opacity sequence. Policy-disabled and occupied targets are not
offered. Reduced motion removes the transition without changing target selection.

The proxy never drives Panel containment, claims a dock slot, or commits placement. Pointer release
is the only dock commit. Top/bottom magnetic snaps remain distinct from side/corner dock intent;
less spatially obvious canonical docks remain available through the direct placement menu.

An available proxy target does contribute a transient allocation preview. Existing Panels on the
same side immediately animate toward the size and offset they would receive if the drag were
released. Moving to another target replaces that preview; leaving every dock zone or detaching a
docked Hybrid Panel animates affected peers back toward the allocation derived from settled
occupants. This preview remains runtime-only and does not claim occupancy or write Nexus state.

### 2.3 Hidden placement invariance (PANEL-PLACEMENT-VISIBILITY-1)

Visibility is orthogonal to placement. The native `hidden` state wins over Floating, Fixed, and
Hybrid layout styling, removes the Panel's layout box and visual presentation, and retains its
settled placement, child React state, and leases for reopening.

### 2.4 Docked minimize and reveal (PANEL-DOCKED-MINIMIZE-1)

A collapsible Fixed Panel, or a Hybrid Panel whose settled disposition is docked, uses minimize
rather than header-only collapse. Its in-header Minimize control points toward the occupied edge;
bottom-corner controls point diagonally toward that corner. Activating it keeps the Panel mounted,
retains its body dimensions and dock occupancy, and animates the complete Panel beyond the effective
boundary using transform and opacity.

The minimized Panel is inert and absent from the accessibility tree. A separate Reveal control
remains at the vacated boundary edge or bottom corner. Its arrow points back into the container,
opposite the minimize direction. Focus transfers from Minimize to Reveal and back when those
controls initiate the transition. Reduced motion makes the transition immediate without changing
placement, focus, or retained state.

Floating and snapped Panels continue to collapse to their header. Collapse/minimize state remains
transient and is never written to Nexus.

### 2.5 Boundary-constrained intrinsic height (PANEL-PLACEMENT-HEIGHT-1)

A free Panel keeps its preferred intrinsic height while it fits. When its header is dragged toward
the boundary bottom, the Panel's resolved height reduces to the remaining space instead of moving
the header back up. It never shrinks below the shell's measured minimum. For a root DashList, that
minimum includes the `start` and `end` pin bands; only the automatic band becomes a scrollport.

Settled intrinsic height changes, including Panel and DashGroup disclosure, use Motion with the
shared theme motion tokens. Active dragging and reduced-motion preference make the transition
immediate so animation cannot change pointer geometry. DashPanel captures the rendered shell height
before disclosure changes, resolves its new boundary-constrained height, and animates between
those two concrete sizes; it does not depend on the browser inferring an intrinsic-size transition.

### 2.6 Edge contact and activation (PANEL-PLACEMENT-PRESENTATION-1)

A docked Panel and its Hybrid target proxy remove radius from every corner that lies on a contacted
effective-boundary edge. A corner dock contacts two edges and therefore retains only its opposite
inner corner radius. Allocation can shorten or offset an edge Panel, so contact is derived from its
resolved rectangle rather than its named dock position. A detached Reveal control applies the same
rule from its own boundary contact rather than inheriting every contact of the hidden Panel, and its
carrier remains above every ordinary Panel layer so an overlapping Panel cannot block it. Pointer
interaction or focus within a Panel activates it, and the Provider renders the most recently
activated visible Panel above its peers without persisting z-order.

Theme-defined Panel entry and exit keyframes remain deferred. Exit motion needs one explicit
visibility lifecycle that preserves `hidden`, inertness, focus restoration, and reduced-motion
behavior; a theme cannot independently delay those semantics.

## Related decisions

- [ADR 0004: DashPanel launcher item identity](../adr/0004-dashpanel-launcher-item-identity.md)
- [DashPanel target reference](dashpanel.md)
- [Nexus contract decisions](nexus-contract-decisions.md)
