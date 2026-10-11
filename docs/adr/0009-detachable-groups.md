# ADR 0009: Detachable groups

Accepted 2026-10-10 by John's implementation go-ahead. The preserved design is in
Salon/Mira/Technical/picodash-detachable-groups.md.

## Contract

`DashGroup detachable` opts a labelled root group into Picodash hosting; `true` chooses Hybrid,
while `"floating"` and `"hybrid"` choose the initial placement mode. Subgroups and headerless groups
cannot detach. Standalone DashStack requires an integration host for this opt-in.

Picodash coordinates one retained content surface and one transient Panel host. Logical Stack
membership, scope, IDs, bindings, committed order and inline collapse preference never change.
A stable portal container moves between an inline slot and the Panel body, preserving React state
and drafts without a second editor. DashStack reports presentation location and actual visibility;
explicit reveal activates the detached host instead of changing the inline collapse preference.

Header whitespace/title are a pointer drag surface; disclosure and actions remain separate.
Vertical movement previews reordering. At 48px horizontal travel from pickup, cancel the reorder
preview and continue as a Panel. Release settles; Escape/pointer cancellation restores the original
presentation without committing order or discarding drafts. Only the home Stack accepts return.
Pointer entry previews an expanded empty home slot; release restores remembered disclosure.
The initial pull can return without re-grabbing once it has left and re-entered the home Stack;
Escape throughout that provisional gesture restores inline presentation.

A tabbable Detach action moves focus into the Panel. Its Return to stack action returns focus home.
The retained home exposes Show panel. Detached controls occupy the Panel's DOM tab order, never the
old slot. First placement is beside the heading, projected into the Provider boundary; later button
opens reuse session placement. Drag opens retain the grab offset. Return releases Panel occupancy.

Detachment is enabled on fine-pointer desktop viewports at least 768px wide. Entering unsupported
layout returns inline without automatically detaching again. This is an initial integration policy,
not an automatic DashPanel breakpoint. Source removal tears down the host. Hidden source Panels do
not imply Return. Reduced motion changes no focus or state outcomes.

## Foundation seams

DashStack owns an explicit `/integration` group-host seam: retained content, logical presentation,
reveal and cancellation of its own reorder preview. DashPanel owns an explicit `/integration`
transfer seam for pointer handoff, home-target precedence and a replacement Return action
whose optional icon is supplied by the integration host. Neither
foundation imports the other. These seams are bounded protocols, not private runtime access.

Detached hosting layout is session-only, held in a separate metadata-only Nexus with no fields,
adapter or persistence. It uses normal validated layout commands but never stores detached layout
in the application's durable document. The application's Nexus remains the only value authority.
Picodash owns the transition reducer, live DOM relocation, desktop policy and return choreography.

## Verification

Pure transition tests, retained-editor/focus/structure component tests and native browser gestures
must prove the round trip before package recommendation. Browser acceptance includes reorder cancel,
Escape, drafts, one editor, original collapse, drop feedback, repeated placement, docking release,
mobile fallback, theme, reduced motion and source teardown. No cross-Stack moves or nested detach.
