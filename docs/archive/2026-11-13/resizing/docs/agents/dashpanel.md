# DashPanel agent instructions

Read this file before changing DashPanel behavior, examples, or docs. Then read
[`../reference/dashpanel-contract-decisions.md`](../reference/dashpanel-contract-decisions.md),
[`../reference/dashpanel.md`](../reference/dashpanel.md),
[`../adr/0004-dashpanel-launcher-item-identity.md`](../adr/0004-dashpanel-launcher-item-identity.md),
the Nexus agent instructions for Nexus interactions, and the UI agent instructions for shared
presentation.
Manual sizing and event ownership also require
[`../adr/0007-panel-manual-sizing-and-interaction-events.md`](../adr/0007-panel-manual-sizing-and-interaction-events.md).

## Decision lens

DashPanel determines where arbitrary application UI lives. Optimize for reliable hosting,
placement, dismissal, recovery, and accessible operation without assuming the content is a
DashList. A Panel may contain tools, previews, controls, readouts, or any other React content.

Use Dev Bridge while developing Nexus-backed layout behavior whenever disclosed state,
transactions, diagnostics, or browser effects can verify the outcome. If the Bridge cannot express
the needed safe observation, improve it before building a DashPanel-specific inspection path.

## Ownership constraints

- Own Provider hosting, boundaries, portals, visibility, activation, z-order, placement, docking,
  occupancy, allocation, adaptive modal presentation, and Panel actions.
- Persist settled layout overrides through Nexus. Do not persist visibility, activation, z-order,
  drag previews, resolved content width, or host-selected adaptive presentation.
- Keep declared preferred size, per-axis manual overrides, and resolved geometry separate. Full
  docks may own one span; that axis's preferred/manual size remains dormant. Boundary contraction
  never replaces retained size or position. Restore-size preserves placement; full reset clears all
  Panel overrides.
- Implement drawer and sheet as transient modal projections with a visible Close action, backdrop,
  focus containment and restoration, scroll locking, and Escape/outside dismissal. Do not disguise
  them as ordinary docks or add an automatic product breakpoint.
- Preserve pointer and keyboard outcome parity for movement and actions.
- Resize gestures use one explicit operation owner with movement, commit once, and write nothing
  on no-op/cancel. Keep pointer frames local, report typed Nexus events, and preserve non-drag
  numeric controls. Natural content measurement must not read a constrained shell as user intent.
- Close hides. Permanent removal remains an application-owned unmount request after confirmation.
- Keep the public high-level runtime API narrow. Do not add a launcher registry, mutable Provider
  Nexus, generic selector, private controller channel, or Motion-specific public API.
- DashPanel owns no Dashlets, List ordering, field binding, or application-value model.

Pure product tests own geometry and allocation. Component tests own React wiring, DOM, ARIA, and
deterministic events. Contract Lab owns real pointer capture, layout, focus, portals, viewport,
zoom, and cohesive browser seams.

## Installed styles and local packages

The required stylesheet is `@picodash/dashpanel/style.css`; optional handle recipes are published
through `@picodash/dashpanel/resize-handles.css`. Keep their build/export artifact checks together.
For local distribution, follow [the local package guide](../development/local-packages.md).
