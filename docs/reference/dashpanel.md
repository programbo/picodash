# DashPanel: implemented behavior

`@picodash/dashpanel` renders arbitrary application content inside a Panel. Import its `/style.css` once and compose
`DashPanelProvider nexus={root}` with `DashPanel id="tools" title="Tools"`.
The [complete exports and prop declarations](api/dashpanel.md) cover the root and `/integration` entrypoints.

Panels support floating, fixed and hybrid placement; snapping; dock allocation; portal containers and boundaries;
visibility, activation, collapse and reopen actions; responsive modal presentation; keyboard and pointer movement;
manual resizing; and recorded keyboard shortcuts. Panels do not require a Stack as their content.

`width`, `height`, minimum/maximum dimensions and content constraints determine preferred and allowed sizing.
`resize` selects available handles. `useDashPanel(id)` exposes visibility, collapse, placement, sizing and reset commands.
Manual size persists through sparse layout v2 metadata. The live constrained rectangle and pointer preview stay ephemeral.
`restorePreferredSize` removes manual overrides; it is distinct from restoring all layout.
`showSizeConstraintIndicator` enables the size-limit indicator. `moveHandle` selects header, grip or both.

The optional `/resize-handles.css` stylesheet supplies `resize-edges-external`, `resize-edges-parallel`,
`resize-corners-external` and `resize-corners-internal` recipes. These are application classes over semantic resize targets.
The root style owns the baseline grips; import the recipe stylesheet after it.

`recordableHotkey` enables recording. Nexus retains only the committed shortcut text; Panel code parses, arbitrates and invokes it.
Theme, focus restoration, overlays and accessible actions are provided through shared UI and Panel runtime code.

A detached group uses the public integration transfer boundary; its Panel layout is session-owned. The original Stack owns its logical
membership and field bindings. See [Picodash](picodash.md). The [Nexus audit](../design/nexus-api-audit.md) identifies which persisted
Panel schemas should move into a consumer-owned metadata extension.

Source: [`src/index.tsx`](../../packages/dashpanel/src/index.tsx), [`runtime`](../../packages/dashpanel/src/runtime),
[`sizing`](../../packages/dashpanel/src/sizing). Tests: [`src`](../../packages/dashpanel/src) and [`tests`](../../packages/dashpanel/tests).
