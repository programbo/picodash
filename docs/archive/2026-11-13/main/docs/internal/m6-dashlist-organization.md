# M6: useful DashList organization

Owner hands-on approval: **Approved** on 2026-09-10. This extends the approved Value binding example without adding
a new preset or public package API. D2 retains the underlying data slice.

Workspace settings groups the three editable fields. Collapsing it leaves the interval readout
available; moving the group below the readout prioritizes monitoring. Children can be reordered
within the group to put frequently used controls first. List actions remain pinned at the end.
The ready-made and composed Lists share values but retain independent arrangements.

The existing public `DashGroup`, reorder policy, and `DashListResetListItem` supply the behavior.
Nexus persists settled group/root order and collapse overrides under each List identity, using
the M5 storage key. Dev Bridge discloses those two scopes for read-only inspection; its write
allowlist remains limited to the three application fields. No documents, pruning, migration,
cross-group transfer, or Bridge metadata mutation is introduced.

The existing standalone binding browser journey exercises keyboard reorder cancellation without
a saved write, a committed keyboard child move, the equivalent pointer move in the other List,
no write during pointer preview, whole-group movement, independent collapse, and reload.
Bridge inspection and storage both verify the settled child order. Confirmed Reset list restores
one List's declared organization through another reload while preserving the peer arrangement.
The M4/M5 value, reset, refresh, theme, and phone checks remain in the same journey.

The owning 254 DashList tests pass. Review images are under `output/playwright/m4/`, including
`m6-organization.png`. The owner subsequently approved the drag feel and reported successful Safari use.

## Owner review

Open Value binding. Drag a child row or use its handle with Enter, arrows, and Enter to commit;
Escape cancels. Collapse Workspace settings, move the group below Current interval, and refresh.
Check that the other List has its own arrangement. Use List actions → Reset list to restore the
declared organization while keeping values.

## Expanded drag review

The owner requested a longer specimen and restoration of the prototype drag presentation before
accepting M6. Value binding now includes a Reordering playground with three automatic groups,
standalone readouts, and two root nodes in each pinned lane. Its fixed-height host makes automatic
lane scrolling visible while start/end remain available.

DashList now uses Motion for sibling displacement and a transient pointer-following drag surface
with translucent paint, shared surface blur, elevated shadow, and drag-layer tokens. The visual
session owns its transforms and animation-frame scrolling and cleans them up on termination;
Nexus still receives only settled orders. Reduced motion removes sibling transitions.

Browser testing exposed position-based keys on inner declaration boundaries. Stable declaration
keys now preserve row/group DOM and child state while moving. Pointer capture is renewed after
DOM movement so dragging continues into automatic-lane edge scrolling.

`apps/lab/tests/reordering.spec.ts` owns long-list drag presentation evidence: group glass/shadow,
animated sibling displacement, retained DOM, fixed pinned lanes, edge scrolling without saved
preview writes, persisted group order, pinned-band boundaries, and child drag cancellation with
an invalid draft retained. Screenshots are saved in `output/playwright/m6/`. Existing M4/M5/M6
value and organization closure remains in the standalone binding journey. The owner approved this expanded slice on 2026-09-10.

## Drag review corrections

Owner review found instant sibling movement, a late coverage trigger, and weak backdrop blur.
The duration reader now respects both CSS seconds and milliseconds: the built token is `.15s`,
which the earlier reader incorrectly divided by 1000. Motion displacement is sampled across real
rendered frames. Layout slots include scroll offset so edge scrolling is not mistaken for reorder
movement. The dragged leading edge triggers a swap at the sibling midpoint, including equality;
travel direction prevents an immediate reverse swap after layout changes.

Translucency now belongs to the surface background rather than whole-subtree opacity. A browser
comparison with backdrop filtering disabled proves that the overlapping sibling actually blurs.
The long-list journey checks just below and exactly at the halfway threshold, multiple intermediate
sibling positions, and the existing persistence, cancellation, draft, and pinned-lane behaviors.
Both focused Lab journeys, all 254 DashList tests, Motion policy, and Vite+ checks pass locally.
Owner acceptance was received on 2026-09-10: dragging feels natural, including in Safari.
Safari coverage is owner-reported; the automated browser journeys use Chromium.
