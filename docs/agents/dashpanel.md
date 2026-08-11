# DashPanel agent instructions

Read this file before changing DashPanel behavior, examples, or docs. Then read
[`../reference/dashpanel-contract-decisions.md`](../reference/dashpanel-contract-decisions.md),
[`../reference/dashpanel.md`](../reference/dashpanel.md),
[`../adr/0004-dashpanel-launcher-item-identity.md`](../adr/0004-dashpanel-launcher-item-identity.md),
the Nexus agent instructions for Nexus interactions, and the UI agent instructions for shared
presentation.

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
- Keep one preferred-width input. Full top/bottom docks and sheets may own inline span; other
  placements restore the same preferred width.
- Implement drawer and sheet as transient modal projections with a visible Close action, backdrop,
  focus containment and restoration, scroll locking, and Escape/outside dismissal. Do not disguise
  them as ordinary docks or add an automatic product breakpoint.
- Preserve pointer and keyboard outcome parity for movement and actions.
- Close hides. Permanent removal remains an application-owned unmount request after confirmation.
- Keep the public high-level runtime API narrow. Do not add a launcher registry, mutable Provider
  Nexus, generic selector, private controller channel, or Motion-specific public API.
- DashPanel owns no Dashlets, List ordering, field binding, or application-value model.

Pure product tests own geometry and allocation. Component tests own React wiring, DOM, ARIA, and
deterministic events. Contract Lab owns real pointer capture, layout, focus, portals, viewport,
zoom, and cohesive browser seams.
