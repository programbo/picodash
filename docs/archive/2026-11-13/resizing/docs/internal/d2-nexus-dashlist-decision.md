# D2: Nexus fitness for DashList data

Decision: **Keep the exercised Nexus data slice**. Owner approval: **Approved**. D2 is complete.
The owner accepted the retained minimum and deferred capabilities on 2026-09-09.
The owner approved M4 and M5 hands-on; this decision records acceptance of the resulting scope. Baseline: M5 merged at
`559d2df1cf2f5de43b06df2ca301b2dc050949ad` (PR #125), with required checks passing.

## Prototype comparison

Source inspection at historical checkpoint `6a9c56e8` shows `PicodashItem` taking string field
names and control-level defaults, parsing, and validation. Its render context exposed value,
field state, `setInput`, reset, and accessibility IDs. The built-in example used a Panel store;
the store viewer combined values, field state, items, ordering, interaction, and repair proposal.
Sources: `packages/panel/src/components/panel/PicodashItem.tsx`,
`apps/web/src/components/items/built-in/built-in-items-panel.tsx`, and
`apps/web/src/components/home/home-store.tsx` at that commit. This is a source comparison, not a
fresh historical runtime replay or a claim that every prototype behavior has been recovered.

The current example retains explicit JSX and a value/input render context, while defining defaults
and validators once in an application-owned Nexus. Ready-made and composed controls share field
handles across independent Lists without a Panel. This adds an explicit field-definition step,
but avoids defining the same canonical meaning in each editor. The composed controls still wire
draft values and accessibility explicitly; no separate application draft store is needed.

## Capability dispositions

These dispositions bound recovery work. They do not silently repeal accepted contracts or authorize
deleting unexercised implementation. Any later removal requires its own contract reconciliation.

| Capability                                          | Disposition | Evidence and boundary                                                                                                                                                             |
| --------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Immutable root field registration                   | Keep        | Three centrally declared defaults and validators serve both Lists. Dynamic schema registration is not required by this slice.                                                     |
| Nominal field handles                               | Keep        | `nexus.fields.*` supplies typed bindings in both compositions without string lookup. Keep the usage surface; this does not independently justify every internal type mechanism.   |
| Canonical values and validation                     | Keep        | Invalid names and out-of-range intervals remain visible while canonical values and readouts stay valid.                                                                           |
| Binding drafts and structured issues                | Keep        | Editors retain rejected input and accessible feedback; refresh restores valid saved values. Binding registration and cleanup remain package-owned.                                |
| Atomic transactions                                 | Keep        | A valid three-field write updates all values; an invalid batch changes neither live values nor saved payload. Ordinary use needs `setValues`, not application-managed revisions.  |
| Confirmed value reset                               | Keep        | Cancel preserves draft and values; confirm restores registered defaults and discards target drafts. Defaults survive reload in both Lists.                                        |
| Persistence                                         | Keep        | Dedicated Web Storage payload survives reload; save status reflects Nexus state. Drafts remain transient. Application owns storage setup and initialization failure presentation. |
| Repair plans                                        | Defer       | M4/M5 need no repair-plan UI. Do not add one without a reproduced ordinary workflow.                                                                                              |
| Explicit stale overwrite                            | Defer       | Preserve existing dirty-peer semantics, but M5 does not establish the need for a new overwrite workflow. Its reset proof targets one dirty List with a clean peer.                |
| External-store adaptation                           | Defer       | These examples use Nexus-owned values. A real external-store consumer must justify and verify adaptation separately.                                                              |
| Documents, migrations, advanced conflict resolution | Defer       | No acceptance follows from code or test presence. M5 does not prove these workflows or concurrent-tab conflict recovery.                                                          |

No blocking simplification or removal is demonstrated. Reject replacing Nexus or maintaining
application mirror state for this slice: it would recreate the validated draft, shared-value,
reset, and persistence behavior already approved. Keep leases, plans, revisions, and nominal-type
implementation details out of ordinary application setup; do not add convenience layers merely
to conceal unused capabilities.

## Minimum data contract for subsequent work

Applications define typed JSON fields with defaults and synchronous validation, create one root,
provide stable List/node identities, and bind controls using public field handles. Valid writes
commit atomically and notify controls/readouts; invalid drafts never replace canonical values.
Confirmed reset restores registered defaults and discards target drafts. Opt-in persistence saves
canonical values, restores them on reload, and reports unsuccessful saves honestly. Applications
own root lifetime and storage; DashList owns binding lifetime, issues, and accessible interaction.

M6 may exercise public Nexus metadata for settled order and collapse overrides, while leaving
drag previews transient. Those organization capabilities need M6 evidence; D2 does not approve
them in advance. Documents, pruning, migration, and repair UI remain outside that next slice.

## Evidence and decision gate

The existing `proves standalone value binding parity` browser journey covers both compositions,
Bridge-inspected canonical state, invalid input, atomic rejection, reset cancellation and
confirmation, persistence, refresh, themes, and phone layout. The 254 DashList tests supply owning
component evidence; they are not a reason to retain every implemented feature. See
[M4](m4-value-binding.md) and [M5](m5-dashlist-data.md) for the exercised scope and owner approval.

No additional test gate is identified for this bounded decision. The owner accepted Keep for the listed minimum and Defer for the unproven capabilities.
The local decision record remains uncommitted.
