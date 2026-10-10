# ADR 0008: Organizational subgroups and linked controls

## Status

Accepted, 2026-10-09. John authorized implementation through the joint Mira/Maz handoff.

## Decision

DashStack permits one organizational subgroup level inside a root DashGroup. Subgroups cannot
collapse. Pinning rules are revised by the 2026-10-10 amendment below. Root groups own visibility; each container owns its immediate children's order.
JSX remains the authority for membership. No persisted parent graph is introduced.

Only root groups accept `pin="start"` or `pin="end"`. A headerless root group needs `aria-label`
and cannot collapse. This replaces Dashlet pinning and nested pin bands without a compatibility
alias. The automatic lane keeps a zero minimum height. Natural-height pinned groups never overlap;
when their combined height exceeds the available height, the outer Stack scrolls. DashPanel does
not own this content layout.

DashStack publishes a derived, immutable view of the mounted structure, including declared order,
parent IDs, field keys, depth and visibility. React hooks and imperative readers use the same view.
Nexus retains only durable ordering and collapse overrides. The derived view is empty before mount
and after unmount, so headless solvers must supply their declared default order before mounting.

Nexus owns numeric gesture write ownership. The public controller groups live edits into one
logical begin/update/commit/cancel lifecycle, without creating an undo system. Field revisions and
binding interaction identity fence cancellation against external changes. Rollback uses the normal
validated canonical pipeline and can be rejected by changed constraints. End events report this.

Ephemeral item interaction sources aggregate hover, focus and active state independently. Sources
may use app-owned IDs without shell registration. Applications own cross-view relationships and
visual meaning; ordinary hover never expands a group. An explicit DashStack reveal command opens
ancestors and focuses a registered input. A group’s optional `glow` paints only its heading,
using the Dashlet glow token or an author-supplied colour; it does not flood child groups.

TargetSlider edits one target field and displays an application-supplied achieved-result union.
The solver, feasible domain, request freshness and priority policy remain in the application.
Achieved-marker animation is presentation only and never writes intermediate values.

## Consequences

Consumers replace pinned Dashlets with headerless root groups and remove subgroup pin/collapse
props. Existing durable child orders remain usable because container and node identities stay
stable; membership always comes from current JSX. No persisted-schema migration is required.

The public examples and executable evidence are linked from
[linked controls](../development/linked-controls.md) and
[contract conformance](../reference/contract-conformance.md).

### Whole-value gesture amendment (2026-10-09)

Range detents require the same ownership and cancellation guarantees as single numeric controls.
Extend the existing controller to one complete JSON field through createValueGesture and
createValueInputGesture. This keeps private revision fencing in Nexus and avoids UI-owned rollback
based on equality alone. Numeric compatibility APIs remain number-only; UI products still own
pointer and keyboard state and transient spring paint.

## Amendment: local ordering pins and sticky lanes (2026-10-10)

Accepted by John. Dashlets and groups may declare `pin="start" | "end"` in any supported
ordering container. Pinning partitions immediate siblings; it does not change membership,
collapse, visibility, or scrolling inside groups. The existing one-subgroup-level limit remains.

DashStack owns `stickyLanes="start" | "end" | "both" | "none"`, defaulting to `"both"`.
Only selected root lanes stay visible during scrolling. If the selected lanes cannot fit,
the outer Stack scrolls all content without overlap. These are JSX presentation defaults,
not persisted Nexus settings. This supersedes the root-group-only pin restriction above.
