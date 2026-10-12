# Move readouts with Panel docking

Use `useDashPanel` from `@picodash/dashpanel`, including inside a `PicodashProvider`. Keep the canvas
and its camera transform unchanged; reserve space on the absolutely positioned readout overlay.
Dogfood .52 and later provide the transient `dragPreview` required to distinguish idle from undocking.
Copy bundled `example/DockReactive.tsx` ([source example](../../packages/picodash/tests/dogfood/DockReactive.tsx)) and its `Controls.tsx` Nexus factory companion for runnable standalone
`DashPanelProvider` and integrated `PicodashProvider` compositions.

The core selection is the same in both:

```tsx
import { useDashPanel } from '@picodash/dashpanel'

const panel = useDashPanel('tools')
if (panel.availability === 'available') {
  const drag = panel.dragPreview
  const placement = drag?.placement ?? panel.placement
  const available = drag?.dockTarget?.kind === 'available' ? drag.dockTarget.preview : null
  const position =
    available?.position ??
    (placement.disposition.kind === 'docked' ? placement.disposition.position : null)
  // Your overlay reserves available.bounds.width, or its known Panel width when idle/docked.
  // Apply that clearance to overlay left/right; do not alter the canvas or camera.
}
```

| Observation                | Overlay decision                                                          |
| -------------------------- | ------------------------------------------------------------------------- |
| Idle (`dragPreview: null`) | Use committed placement; reserve a visible, expanded docked Panel's side. |
| Active free with no target | Remove the previous dock reservation; the moving Panel renders free.      |
| Active blocked target      | Keep free posture; do not reserve the blocked destination.                |
| Active available target    | Reserve the prospective destination from `dockTarget.preview`.            |

Free posture starts at pickup, even while committed placement still names the old dock. Cancellation
clears movement and restores the committed reservation. Drop clears movement atomically with successful
committed placement; disposal makes the controller unavailable. Never interpret `dockPreview: null`
alone as idle or undocked. The observation is not persisted and does not move the camera.

Preview bounds describe the logical target proxy in **viewport CSS pixels**, including shared dock
allocation and boundary inset. They are not the animated proxy's intermediate rectangle, the moving
Panel's rectangle, or guaranteed final intrinsic shell bounds. Width can directly supply clearance;
translate left/top into your overlay's containing block if using absolute target coordinates.
The example uses a fixed authored width of 320 CSS pixels, not a generic responsive/resize observer.
Keep `panelWidth` equal to that known width; preview bounds supply shared-allocation width while
a target is active. The example restricts destinations to full-left/full-right; corner overlays can map top/bottom
positions according to their own layout. Multiple Panels combine reservations by taking the maximum
clearance on each affected side. Notifications follow meaningful posture/target/bounds changes,
not every pointer coordinate.

The actual Gearmo readout/camera composition was separately verified by its consumer owner at
commit `8fc7b41`; this recipe uses public packages and introduces no solver or application policy.
