# Contract conformance matrix

This reference maps target contract areas to one primary verification owner. It prevents test bloat
by proving related invariants together and using E2E only for behavior that requires a browser.

## Status

> Contract: Accepted
> Implementation: Partial
> Evidence: Nexus beta owning tests, consumer/browser proof, release checks, and package artifact checks.

An empty evidence cell means “not yet reconciled,” not “untested prototype.” Prototype tests may be
linked only after their assertions are confirmed to prove the target behavior.

## Dependency tooling evidence

The October 2026 dependency consolidation moves the workspace to Vite+ 1.0 and Vitest 5.0.1.
The existing owning suites pass all 1,037 package tests without added compatibility settings.
`vp check`, recursive package/application builds, package release checks, agent artifact checks,
and the high-severity audit pass. Runtime and package contracts are unchanged; the DashPanel
portal test changes only to match the updated formatter. Browser conformance remains owned by
the existing Contract Lab and website CI suites.

## Evidence rules

1. One contract area has one primary owner.
2. Higher layers prove integration without repeating lower-layer matrices.
3. A regression expands the primary invariant test unless the failure depends on a browser seam.
4. `Implemented` requires code; `Verified` requires linked passing evidence.
5. Deleted or revised contracts lose obsolete tests in the same cutover.
6. E2E count and runtime are budgets, not coverage goals.

## DashStack identity cutover (2026-10-08)

[ADR 0007](../adr/0007-dashstack-name-and-public-identity.md) defines the clean pre-release rename.
Nexus (461 tests), DashStack (263 tests), Dev Bridge (40 tests), and Picodash (7 tests) passed their
package release checks, including types, lint, builds, artifact contracts, and pack dry runs.
The [metadata codec test](../../packages/nexus/tests/metadata.test.ts) verifies the new durable key
and rejects both legacy-only and mixed-key records. The
[DashStack artifact check](../../packages/dashstack/tests/package-artifacts.mjs) verifies package
identity, exact exports, catalog identity, and absence of legacy names in shipped declarations and
styles. Agent artifacts, motion policy, evaluation manifests, and the 16-test Lab browser budget pass.

Production Lab and website builds pass. All three isolated Next.js/Vite evaluation seeds build
with the pinned Bun 1.3.14 and `install.globalStore = false`; the machine-wide shared cache caused
dependency-resolution failures on the first attempt. The local frozen-lockfile install also passes.
A live production Lab browser check verified the renamed
standalone binding view, the new CSS hooks without old hooks, slider keyboard changes, switch
changes, collapse/reopen, light and compact presentation, and the renamed reset confirmation and
successful reset of collapse metadata. No browser errors were recorded. This bounded smoke does
not claim a rerun of the full browser suite; Dev Bridge is disabled in the production Lab, so its
renamed Nexus consumer contract is covered by the owning Bridge tests rather than live disclosure.

## Phase 2 progress evidence

The sole `@picodash/ui` authority, current verified density recipe and coarse-pointer target rule,
independent DashPanel and DashStack consumers, Bridge-backed dogfooding, and package/artifact checks
are evidenced by the linked owning tests and Contract Lab journey. These representative consumer
slices complete Phase 2. Rows remain `Partial` where Phase 3 owns exhaustive stabilization,
adaptive presentations, rails, catalog entries, document workflows, or visual-token matrices.

## Recovery M4: standalone value binding

The `proves standalone value binding parity through UI, Bridge, themes, and remount` journey in
`apps/lab/tests/contract-lab.spec.ts` verifies the bounded browser composition of Text, Number,
Switch, and Display, including edits from either Stack, independent Bridge inspection and writes,
invalid canonical-value preservation, focus traversal, disabled controls, retained themes, narrow
layout, and teardown/remount. Application imports remain on public Nexus, UI, and DashStack paths.
This does not verify persistence, groups, reordering, documents, or Stack-level disabled cascading.
Owner hands-on acceptance was recorded on 2026-09-09.
See the [M4 evidence record](../internal/m4-value-binding.md).

## Nexus

| ID              | Contract area                                      | Primary evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Status   | Evidence                                                                                                                                                                                                                                                                                                                                           |
| --------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NEXUS-FIELD     | Canonical definitions and nominal handles          | [packages/nexus/tests/kernel.types.test.ts](../../packages/nexus/tests/kernel.types.test.ts), [packages/nexus/tests/kernel.test.ts](../../packages/nexus/tests/kernel.test.ts), and [packages/nexus/tests/package-artifacts.mjs](../../packages/nexus/tests/package-artifacts.mjs)                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Verified | Nominal field ownership and frozen key-only runtime handles are preserved. Type-only `PicodashFieldOf<Value>` and `PicodashExactFieldOf<Value>` views cover assignable scalar domains, exact compound domains, foreign structural rejection, scoped projections, and packed root declarations without adding runtime fields or mutation authority. |
| NEXUS-JSON      | JSON validation, clone, freeze, equality           | Property-based pure tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Verified | [packages/nexus/tests/json.test.ts](../../packages/nexus/tests/json.test.ts)                                                                                                                                                                                                                                                                       |
| NEXUS-TX        | Data-only snapshots and atomic commands            | [packages/nexus/tests/kernel.test.ts](../../packages/nexus/tests/kernel.test.ts)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Verified | [kernel.test.ts](../../packages/nexus/tests/kernel.test.ts)                                                                                                                                                                                                                                                                                        |
| NEXUS-ERROR     | Portable structured issues and contract errors     | [packages/nexus/tests/kernel-issues.test.ts](../../packages/nexus/tests/kernel-issues.test.ts)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Partial  | [kernel-issues.test.ts](../../packages/nexus/tests/kernel-issues.test.ts)                                                                                                                                                                                                                                                                          |
| NEXUS-SCOPE     | Canonical views and scope lifecycle                | [packages/nexus/tests/scope-metadata.test.ts](../../packages/nexus/tests/scope-metadata.test.ts), [packages/nexus/tests/binding-interaction.test.ts](../../packages/nexus/tests/binding-interaction.test.ts), and [packages/nexus/tests/reset-registered-values.test.ts](../../packages/nexus/tests/reset-registered-values.test.ts)                                                                                                                                                                                                                                                                                                                                                                                                                         | Verified | Canonical identity, invalid-ID privacy, shared values/fields, scoped attribution, populated scope-local interaction, destruction, and registered descendant targeting are covered.                                                                                                                                                                 |
| NEXUS-META      | Built-in records and lazy durable scope state      | [packages/nexus/tests/metadata.test.ts](../../packages/nexus/tests/metadata.test.ts), [scope-metadata.test.ts](../../packages/nexus/tests/scope-metadata.test.ts)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Verified | immutable codec plus atomic root/scoped authoring, no-op detection, pruning, and target-only notifications                                                                                                                                                                                                                                         |
| NEXUS-ENTITY    | Entity uniqueness and host affinity                | [packages/nexus/tests/integration.test.ts](../../packages/nexus/tests/integration.test.ts)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Verified | provider/entity lease runtime coverage                                                                                                                                                                                                                                                                                                             |
| NEXUS-GRAPH     | Declarative relationships, parents, cycles         | [packages/nexus/tests/integration.test.ts](../../packages/nexus/tests/integration.test.ts) and [nexus-scope-model.ts](../../packages/nexus/tests/support/nexus-scope-model.ts)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Verified | relationship generations, parent affinity, and descendant traversal                                                                                                                                                                                                                                                                                |
| NEXUS-RUNTIME   | Declarative leases and transient product channels  | [packages/nexus/tests/integration.test.ts](../../packages/nexus/tests/integration.test.ts), [packages/nexus/tests/declarative-integration.test.ts](../../packages/nexus/tests/declarative-integration.test.ts), [packages/nexus/tests/integration-react.test.tsx](../../packages/nexus/tests/integration-react.test.tsx), [packages/nexus/tests/integration-bindings.test.ts](../../packages/nexus/tests/integration-bindings.test.ts), [packages/nexus/tests/binding-interaction.test.ts](../../packages/nexus/tests/binding-interaction.test.ts), [packages/nexus/tests/root-lifecycle.test.ts](../../packages/nexus/tests/root-lifecycle.test.ts), and [packages/nexus/tests/dashstack-prune.test.ts](../../packages/nexus/tests/dashstack-prune.test.ts) | Verified | Provider/entity/relationship/binding leases, committed DashStack node presence, transient input state, stale detection, plan fencing, rollback/retry, and destroyed-root rejection are verified.                                                                                                                                                   |
| NEXUS-BINDING   | Binding acquisition, aliases, generations, cleanup | [packages/nexus/tests/integration-bindings.test.ts](../../packages/nexus/tests/integration-bindings.test.ts), [packages/nexus/tests/binding-interaction.test.ts](../../packages/nexus/tests/binding-interaction.test.ts), and [packages/nexus/tests/integration.types.test.ts](../../packages/nexus/tests/integration.types.test.ts)                                                                                                                                                                                                                                                                                                                                                                                                                         | Verified | Binding lease lifecycle, identity generations, transient drafts, stale conflicts, repair, overwrite, and cleanup evidence are verified.                                                                                                                                                                                                            |
| NEXUS-REPAIR    | Explicit repair plans and stale-plan rejection     | [packages/nexus/tests/binding-interaction.test.ts](../../packages/nexus/tests/binding-interaction.test.ts)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Verified | Non-stale parser repair, validation source `repair`, single-use plans, shared `invalid-binding-plan` taxonomy, and `stale_plan` are covered.                                                                                                                                                                                                       |
| NEXUS-OVERWRITE | Explicit stale-input overwrite plans               | [packages/nexus/tests/stale-input-overwrite.test.ts](../../packages/nexus/tests/stale-input-overwrite.test.ts) and [packages/nexus/tests/binding-interaction.test.ts](../../packages/nexus/tests/binding-interaction.test.ts)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Verified | Active stale-input creation, exact `invalid-stale-input-overwrite` context, opaque single-use plans, interactive revalidation, stale-plan/lifecycle fencing, and failure consumption are covered.                                                                                                                                                  |
| NEXUS-RESET     | Explicit reset domains and shared-field effects    | [packages/nexus/tests/reset-value.test.ts](../../packages/nexus/tests/reset-value.test.ts) and [packages/nexus/tests/reset-registered-values.test.ts](../../packages/nexus/tests/reset-registered-values.test.ts)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Verified | Field and registered-domain reset cover configured defaults, exact options, active input/display membership, descendant deduplication, validation atomicity, adapter attribution/failure, no-op and notification behavior, persistence results, and retained stale drafts.                                                                         |
| NEXUS-ADAPTER   | External ownership and unhealthy snapshots         | [packages/nexus/tests/adapter.test.ts](../../packages/nexus/tests/adapter.test.ts), [adapter.types.test.ts](../../packages/nexus/tests/adapter.types.test.ts), and [external-adapter.ts](../../packages/nexus/tests/support/external-adapter.ts)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Verified | Synchronous hydration, fail-closed writes, health recovery, diagnostics privacy, and teardown are verified; external-owned metadata persistence remains a separate capability and never becomes value authority.                                                                                                                                   |
| NEXUS-PERSIST   | Envelope, hydration, conflict, pending writes      | [packages/nexus/tests/persistence.test.ts](../../packages/nexus/tests/persistence.test.ts), [persistence.types.test.ts](../../packages/nexus/tests/persistence.types.test.ts), [external-persistence.test.ts](../../packages/nexus/tests/external-persistence.test.ts), [external-persistence-controller.test.ts](../../packages/nexus/tests/external-persistence-controller.test.ts), [adapter.types.test.ts](../../packages/nexus/tests/adapter.types.test.ts), [web-storage.test.ts](../../packages/nexus/tests/web-storage.test.ts), [web-storage.types.test.ts](../../packages/nexus/tests/web-storage.types.test.ts), and [memory-persistence.ts](../../packages/nexus/tests/support/memory-persistence.ts)                                            | Verified | Nexus-owned and external-owned envelopes, disclosure, metadata-only authority, quarantine, conflicts, recovery/erase plans, verified writes, safe failures, lifecycle teardown, and the optional Web Storage driver are covered.                                                                                                                   |
| NEXUS-DIAG      | Operational diagnostics and runtime inspection     | [packages/nexus/tests/diagnostics.test.ts](../../packages/nexus/tests/diagnostics.test.ts), [diagnostics.types.test.ts](../../packages/nexus/tests/diagnostics.types.test.ts), [adapter.test.ts](../../packages/nexus/tests/adapter.test.ts), and [persistence.test.ts](../../packages/nexus/tests/persistence.test.ts)                                                                                                                                                                                                                                                                                                                                                                                                                                      | Partial  | core namespace, subscriber aggregation/recovery, adapter health/privacy, persistence failure correlation/recovery, reentrancy, and teardown verified; inspectRuntime remains planned                                                                                                                                                               |
| NEXUS-MIGRATE   | Version chains and quarantine                      | [packages/nexus/tests/migration-recovery.test.ts](../../packages/nexus/tests/migration-recovery.test.ts), [documents-integration.test.ts](../../packages/nexus/tests/documents-integration.test.ts), [packages/nexus/tests/package-artifacts.mjs](../../packages/nexus/tests/package-artifacts.mjs), and [Contract Lab browser/Bridge journey](../../apps/lab/tests/contract-lab.spec.ts)                                                                                                                                                                                                                                                                                                                                                                    | Verified | Frozen migration payload/failures, source comparison, current-field projection, import migration, immutable per-scope quarantine/recovery, raw re-emission, safe diagnostics, and consumer/browser recovery are covered.                                                                                                                           |
| NEXUS-DOCS      | Export/import policy and atomic plans              | [packages/nexus/tests/documents.test.ts](../../packages/nexus/tests/documents.test.ts), [documents-integration.test.ts](../../packages/nexus/tests/documents-integration.test.ts), [documents.types.test.ts](../../packages/nexus/tests/documents.types.test.ts), [packages/nexus/tests/package-artifacts.mjs](../../packages/nexus/tests/package-artifacts.mjs), and [Contract Lab browser/Bridge journey](../../apps/lab/tests/contract-lab.spec.ts)                                                                                                                                                                                                                                                                                                       | Verified | Exact JSON, overlay semantics, targeting, disclosure/promotion, mappings, scope existence, migration, plan privacy/freshness, adapter/persistence atomicity, package declarations, and a real consumer journey are covered.                                                                                                                        |
| NEXUS-PRUNE     | Active node presence and explicit metadata pruning | [packages/nexus/tests/dashstack-prune.test.ts](../../packages/nexus/tests/dashstack-prune.test.ts), [packages/nexus/tests/scope-metadata.test.ts](../../packages/nexus/tests/scope-metadata.test.ts), [packages/dashstack/tests/dashstack.test.tsx](../../packages/dashstack/tests/dashstack.test.tsx), and [Nexus package artifact checker](../../packages/nexus/tests/package-artifacts.mjs)                                                                                                                                                                                                                                                                                                                                                               | Partial  | DASHSTACK-NODE-LEASE-1 and PRUNE-PLAN-1 Nexus seams, lifecycle fencing, candidate/effect review, explicit/inventory validation, stale plans, metadata-only execution, exact integration exports, and DashStack committed-presence dogfooding are verified; broader prune UX remains planned.                                                       |
| NEXUS-REACT     | Context, hooks, selector equality                  | [packages/nexus/tests/integration-react.test.tsx](../../packages/nexus/tests/integration-react.test.tsx), [packages/nexus/tests/react.test.tsx](../../packages/nexus/tests/react.test.tsx), [react.types.test.ts](../../packages/nexus/tests/react.types.test.ts), and [integration.types.test.ts](../../packages/nexus/tests/integration.types.test.ts)                                                                                                                                                                                                                                                                                                                                                                                                     | Verified | root/scoped context, standalone opt-in and inherited-host precedence, exact missing-context errors, nested traversal, conflict/foreign rollback, contextual selectors/equality, nested Provider reset, Strict Mode cleanup, and SSR no-acquisition evidence                                                                                        |
| NEXUS-LIFE      | Destroy and use-after-destroy                      | [packages/nexus/tests/root-lifecycle.test.ts](../../packages/nexus/tests/root-lifecycle.test.ts), [packages/nexus/tests/integration.test.ts](../../packages/nexus/tests/integration.test.ts), [packages/nexus/tests/integration-react.test.tsx](../../packages/nexus/tests/integration-react.test.tsx), [packages/nexus/tests/adapter.test.ts](../../packages/nexus/tests/adapter.test.ts), and [packages/nexus/tests/persistence.test.ts](../../packages/nexus/tests/persistence.test.ts)                                                                                                                                                                                                                                                                   | Partial  | root teardown, standalone/provider lease refusal, deepest-first committed React teardown/Strict Mode replay, use-after-destroy, detached survivors, diagnostics teardown, adapter subscription teardown, persistence ownership release, and discard refusal verified                                                                               |
| NEXUS-CAP       | Conditional identity and capability typing         | [packages/nexus/tests/persistence.types.test.ts](../../packages/nexus/tests/persistence.types.test.ts), [adapter.types.test.ts](../../packages/nexus/tests/adapter.types.test.ts), [documents.types.test.ts](../../packages/nexus/tests/documents.types.test.ts), and [web-storage.types.test.ts](../../packages/nexus/tests/web-storage.types.test.ts)                                                                                                                                                                                                                                                                                                                                                                                                      | Partial  | The beta persistence, external ownership, document, identity/schema, and Web Storage capability types are verified; future capability families remain intentionally later work.                                                                                                                                                                    |
| NEXUS-PACKAGE   | Public, React, and integration entry contracts     | [Nexus package artifact checker](../../packages/nexus/tests/package-artifacts.mjs)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Partial  | The beta root, React, integration, and Web Storage entries, declarations, SSR boundaries, conditional capabilities, and retired-export absence are verified; later integration surfaces remain outside the beta gate.                                                                                                                              |

Nexus suites should use generated models for scope graphs, transaction batches, document mappings,
and persistence records instead of adding separate hand-written tests for every combination.

## Agent Dev Bridge

> Contract: Accepted development baseline
> Implementation: Verified
> Evidence: `bun run --filter @picodash/dev-bridge release:check`, Lab host tests, and the Contract
> Lab browser journey.

| ID             | Contract area                                     | Primary evidence                                                                                                                                                        | Status   | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BRIDGE-SESSION | Authentication, disclosure, generations, sequence | [relay security tests](../../packages/dev-bridge/tests/relay-security.test.ts) and [browser connector tests](../../packages/dev-bridge/tests/browser-connector.test.ts) | Verified | Origin-bound single-use registration, exact disclosure, stale-generation fencing, and disclosed-state-only sequence advancement are covered.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| BRIDGE-OPS     | Inspect, allowlisted writes, waits, and errors    | [relay observation tests](../../packages/dev-bridge/tests/relay-observation.test.ts) and [CLI tests](../../packages/dev-bridge/tests/cli.test.ts)                       | Verified | REST validation, Nexus outcomes, request fencing, wait semantics, redacted errors, and CLI behavior are covered.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| BRIDGE-PACKAGE | Public entries, executable artifact, Lab host     | [package artifact checks](../../packages/dev-bridge/tests/package-artifacts.mjs), `apps/lab/scripts/dev-host.test.mjs`, and `apps/lab/tests/contract-lab.spec.ts`       | Verified | Built exports and CLI, ephemeral relay/broker lifecycle, bound DashStack input/display, retained DashPanel hide/reopen, and generation fencing are covered. The independent `dashlet-style-lab` registration discloses only `switchValue` and `number`, permits writes only to `number`, proves one focused incompatibility and focus-repair path through that write, and observes the non-writable Switch through public UI interaction. One Standalone DashGroup collapse is also correlated through wait/inspect with its already disclosed primary-session metadata. No UI-runtime Bridge extension, scope disclosure, diagnostic disclosure, or Bridge metadata write is introduced. |

The verified baseline is private development tooling. Persistence, import, reset, and broader
agent protocols remain deferred and are not implied by these rows.

Browser connector tests cover aborting pending registration before Nexus destruction and ignoring
late socket frames. The Lab host passes its effect cleanup signal to the connector; the retained
theme browser journey exercises teardown without use-after-destroy errors.

The standalone collapse correlation is a higher-layer Bridge consumer seam, not a DashStack behavior
matrix. `packages/dashstack/tests/dashstack.test.tsx` remains the primary owner for deterministic
collapse and reorder behavior; Nexus and DashStack focused tests remain the owners for metadata and
reset semantics.

## Shared UI foundation

| ID         | Contract area                                                  | Primary evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Status   | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UI-THEME   | Theme/density resolution and attributes                        | [packages/ui/tests/theme-provider.test.tsx](../../packages/ui/tests/theme-provider.test.tsx), [theme-provider.types.test.ts](../../packages/ui/tests/theme-provider.types.test.ts), and [apps/lab/tests/phone-artifacts.spec.ts](../../apps/lab/tests/phone-artifacts.spec.ts)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Partial  | Provider defaults, nested independent overrides, custom-theme typing, system subscription/cleanup, carrier attributes, all three retained built-in preferences, both system resolutions, and one complete app-owned custom theme including public elevation through the detached Panel carrier are covered; broader detached-root seams remain planned                                                                                                      |
| UI-OVERLAY | Portal inheritance, layer order, a11y                          | [packages/ui/tests/overlay-provider.test.tsx](../../packages/ui/tests/overlay-provider.test.tsx), [overlay-provider.types.test.ts](../../packages/ui/tests/overlay-provider.types.test.ts), [packages/ui/tests/alert-dialog.test.tsx](../../packages/ui/tests/alert-dialog.test.tsx), [packages/ui/tests/popover.test.tsx](../../packages/ui/tests/popover.test.tsx), and [apps/lab/tests/contract-lab.spec.ts](../../apps/lab/tests/contract-lab.spec.ts)                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Partial  | Provider defaults plus Popover standalone, inherited, explicit, and body portals; exact theme/density; validated layer minimums; private active-parent propagation; and nested AlertDialog ordering are covered. The browser journey proves a detached choice Popover computes above its modal, remains interactive, and restores focus. Broader browser overlay seams remain planned.                                                                      |
| UI-POPOVER | Product-neutral positioned overlay and private active layering | [packages/ui/tests/popover.test.tsx](../../packages/ui/tests/popover.test.tsx), [packages/ui/tests/popover.types.test.tsx](../../packages/ui/tests/popover.types.test.tsx), [packages/ui/tests/package-artifacts.mjs](../../packages/ui/tests/package-artifacts.mjs), and [apps/lab/tests/contract-lab.spec.ts](../../apps/lab/tests/contract-lab.spec.ts)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Verified | React Aria props/ref/render behavior, caller class/style, Provider/default/explicit portals, detached theme/density, finite integer layer bases, nested descendant propagation, private export exclusions, exact facade identity, and real computed modal ordering are covered.                                                                                                                                                                             |
| UI-BUTTON  | Variants, sizes, press, disabled, pending                      | [packages/ui/tests/button.test.tsx](../../packages/ui/tests/button.test.tsx), [button.types.test.ts](../../packages/ui/tests/button.types.test.ts), and the [Contract Lab Themes journey](../../apps/lab/tests/contract-lab.spec.ts)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Verified | Semantic output/ref, defaults and hooks, native type, React Aria press/click and render behavior, disabled/pending semantics, class composition, negative prop typing, compact geometry, and coarse-pointer hit-target behavior are covered                                                                                                                                                                                                                 |
| UI-DIALOG  | AlertDialog composition, focus, dismissal                      | [packages/ui/tests/alert-dialog.test.tsx](../../packages/ui/tests/alert-dialog.test.tsx), [alert-dialog.types.test.ts](../../packages/ui/tests/alert-dialog.types.test.ts), [packages/ui/tests/popover.test.tsx](../../packages/ui/tests/popover.test.tsx), [packages/ui/tests/package-artifacts.mjs](../../packages/ui/tests/package-artifacts.mjs), and [apps/lab/tests/contract-lab.spec.ts](../../apps/lab/tests/contract-lab.spec.ts)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Partial  | AlertDialog family exports, accepted type/ref boundaries, semantic structure, descriptions, action/cancel behavior, controlled state, portal/layer policy, nested choice Popover ordering/interaction, and trigger-focus restoration are covered; React Aria Escape ordering and broader outside-hiding browser seams remain planned.                                                                                                                       |
| UI-MENU    | Commands, submenus, confirmation, focus                        | [packages/ui/tests/action-menu.test.tsx](../../packages/ui/tests/action-menu.test.tsx) and [action-menu.types.test.ts](../../packages/ui/tests/action-menu.types.test.ts)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Partial  | Controlled/uncontrolled state, command closure, disabled/typeahead semantics, submenu composition with the complete themed menu surface, confirmation sequencing, portal inheritance/overrides, and private layer expressions are covered; browser focus/aim/collision seams remain planned                                                                                                                                                                 |
| UI-TOOLTIP | Timing, trigger semantics, touch boundary                      | [packages/ui/tests/tooltip.test.tsx](../../packages/ui/tests/tooltip.test.tsx) and [tooltip.types.test.tsx](../../packages/ui/tests/tooltip.types.test.tsx)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Partial  | Deterministic timing prop wiring/state defaults, controlled state, wrapperless composition, exact child order, portal/layer/theme/density overrides, invalid-base rejection, and retired-prop typing are covered; hover timing, browser placement, touch, and focus-restoration seams remain planned                                                                                                                                                        |
| UI-HEADER  | DashHeader slots, order, root ref, and DOM                     | [packages/ui/tests/dash-header.test.tsx](../../packages/ui/tests/dash-header.test.tsx) and [dash-header.types.test.tsx](../../packages/ui/tests/dash-header.types.test.tsx)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Verified | Neutral div/ref and native prop forwarding, fixed wrapper order/hooks, title and non-nullish slot presence, unchanged slot semantics, and exact negative/positive type surface are covered                                                                                                                                                                                                                                                                  |
| UI-CHROME  | Generic primitive semantics and behavior                       | [packages/ui/tests/button.test.tsx](../../packages/ui/tests/button.test.tsx), [button.types.test.ts](../../packages/ui/tests/button.types.test.ts), [packages/ui/tests/dash-header.test.tsx](../../packages/ui/tests/dash-header.test.tsx), [packages/ui/tests/alert-dialog.test.tsx](../../packages/ui/tests/alert-dialog.test.tsx), [packages/ui/tests/action-menu.test.tsx](../../packages/ui/tests/action-menu.test.tsx), [packages/ui/tests/popover.test.tsx](../../packages/ui/tests/popover.test.tsx), and [packages/ui/tests/tooltip.test.tsx](../../packages/ui/tests/tooltip.test.tsx)                                                                                                                                                                                                                                                                                                                                   | Partial  | Button, DashHeader, and Popover are verified shared primitives; AlertDialog, ActionMenu, and deterministic Tooltip structure are covered while their remaining browser-only seams stay planned.                                                                                                                                                                                                                                                             |
| UI-CSS     | Public token and structural CSS inventory                      | [packages/ui/tests/css-contract.test.ts](../../packages/ui/tests/css-contract.test.ts), [packages/ui/style.css](../../packages/ui/style.css), [scripts/check-motion-policy.mjs](../../scripts/check-motion-policy.mjs), and the [Contract Lab Themes journey](../../apps/lab/tests/contract-lab.spec.ts)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Partial  | Exact 79-name inventory, built-in color completeness, carrier selectors, retired-name exclusion, current regular/compact token recipes, coarse-pointer Button/ActionMenu target rules, Button recipes, product-neutral DashHeader flex/title structure, AlertDialog, ActionMenu, Tooltip slots/recipes, and the shared Motion-versus-CSS implementation boundary are covered; detached-root browser behavior and exhaustive selector audits remain partial. |
| UI-PACKAGE | Public props, exports, and stylesheet entry                    | [packages/ui/tests/theme-provider.types.test.ts](../../packages/ui/tests/theme-provider.types.test.ts), [packages/ui/tests/overlay-provider.types.test.ts](../../packages/ui/tests/overlay-provider.types.test.ts), [packages/ui/tests/button.types.test.ts](../../packages/ui/tests/button.types.test.ts), [packages/ui/tests/dash-header.types.test.tsx](../../packages/ui/tests/dash-header.types.test.tsx), [packages/ui/tests/alert-dialog.types.test.ts](../../packages/ui/tests/alert-dialog.types.test.ts), [packages/ui/tests/action-menu.types.test.ts](../../packages/ui/tests/action-menu.types.test.ts), [packages/ui/tests/popover.types.test.tsx](../../packages/ui/tests/popover.types.test.tsx), [packages/ui/tests/tooltip.types.test.tsx](../../packages/ui/tests/tooltip.types.test.tsx), [packages/ui/tests/package-artifacts.mjs](../../packages/ui/tests/package-artifacts.mjs), and package release checks | Verified | Public props, named runtime/type exports, exact package entries/dependency/peers/side effects, declaration markers, private layer export exclusions, built stylesheet, and explicit product reexports are covered; remaining browser behavior and exhaustive selector audits stay in their owning rows.                                                                                                                                                     |

Shared UI tests prove product-neutral contracts once. DashPanel and DashStack tests prove only how
their owned behavior composes those primitives; they do not repeat the primitive matrix.

## DashPanel

Hybrid release continuity is verified by the placement journey in
`apps/lab/tests/contract-lab.spec.ts`: sampled frames stay between the released and allocated dock
rectangles, without a coordinate-handoff jump. `apps/lab/tests/phone-artifacts.spec.ts` verifies
the release uses the shared 150ms Motion transition and records phone-sized playback evidence.
The placement journey also samples a continuously moving return target: the proxy advances during
movement and finishes fading without waiting for the pointer to stop.

The same placement journey contracts a Hybrid Panel near each bottom corner and checks that release
restores its intrinsic height with its bottom aligned to the boundary. The phone boundary journey
checks automatic-band overflow, unfaded start/end lanes, and scroll-fade at the top, middle, and
bottom, retains the scrolled position after mask events, and records screenshots and playback
evidence. The Panel portal test distinguishes internal content scroll from viewport scroll.
The phone placement journey also contracts ordinary non-DashStack content, captures its fade at
the start/middle/end, retains its scroll offset, and checks that the final action is reachable.
Shared UI's CSS contract test and motion-policy
check cover the bundled scroll-timeline exception; unsupported browsers retain unfaded scrolling.

M3 owner hands-on approval was recorded on 2026-09-09. The persistence journey also covers Console
and driver reset of settled overrides, malformed JSON and incompatible-envelope fallback to current
defaults, and readiness after the asynchronous specimen mounts. The placement journey verifies
that canceling allocation motion preserves docked minimization and that hidden geometry cannot
seed a zero-scale allocation animation after reopening.

The dependency-refresh gate uses Next.js 16.3.4, Motion 13.2, and the matching Vite+ 0.3.1
toolchain. The placement journey also verifies preservation of caller-owned transforms after
allocation; obsolete schema envelopes recover to declared Lab defaults. The expand/collapse
journey protects the animated maximum-height limit from intermediate geometry renders. The
experimental Charts 0.12 contract pin remains unchanged; Vitest stays aligned with Vite+.

The organizational-group follow-up closes the former short-height gap: pinned bands retain their
natural heights and the Stack switches to outer scrolling when they exhaust the available space.
The standalone value-binding and two-Panel Style Lab journeys force a 96px Stack, verify that the
three bands do not overlap and remain reachable, then expand it and verify restored middle scrolling.

| ID             | Contract area                                | Primary evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Status   | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PANEL-COMPOSE  | Provider/Panel composition and scope context | `packages/dashpanel/tests/dashpanel.test.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                               | Verified | Root/scoped context, nested relationships, Provider reset, Panel policy scoping/reset, policy defaults/dynamic updates/nested reset, invalid-policy rejection, and teardown are covered.                                                                                                                                                                                                                                                                                                                                                                                                                  |
| PANEL-LIFE     | Visibility, removal, leases, reopen          | `packages/dashpanel/src/runtime/panel-runtime.test.ts`, `packages/dashpanel/tests/dashpanel.test.tsx`, and `apps/lab/tests/contract-lab.spec.ts`                                                                                                                                                                                                                                                                                                                            | Partial  | Transient floating collapse, docked Fixed/Hybrid minimize with retained full-body geometry and detached Reveal controls, complete hiding of minimized Reveal carriers, placement-independent zero-box hiding, default visibility, latest callbacks, stable Launcher entry identity for unique and repeated Panel targets, close/reopen retention, confirmed removal action, layout commands, cleanup, browser focus, and Bridge-backed hidden Nexus updates are covered.                                                                                                                                  |
| PANEL-GEOMETRY | Placement and boundary calculations          | `packages/dashpanel/src/placement/placement.test.ts`, `packages/dashpanel/src/placement/dock-policy.test.ts`, `packages/dashpanel/src/placement/drag-intent.test.ts`, `packages/dashpanel/src/geometry/boundary.test.ts`, `packages/dashpanel/src/geometry/inset.test.ts`, `packages/dashpanel/src/geometry/placement-geometry.test.ts`, `packages/dashpanel/src/portal.test.tsx`, `packages/dashpanel/tests/dashpanel.test.tsx`, and `apps/lab/tests/contract-lab.spec.ts` | Partial  | Normalization, policy inheritance, boundary/inset algebra, containment, snap/dock projection, exact live snap attraction, resistant detach geometry, Hybrid dock-zone selection, rendered dock pickup origins, boundary-constrained intrinsic height, visual-viewport/inset free anchors, rendered size caps, and browser geometry across Floating, Fixed, and Hybrid modes are covered; viewport-change stabilization remains Phase 3 work.                                                                                                                                                              |
| PANEL-DOCK     | Arena occupancy, collision, and allocation   | `packages/dashpanel/src/placement/dock-arena.test.ts`, `packages/dashpanel/src/runtime/panel-runtime.test.ts`, `packages/dashpanel/src/geometry/placement-geometry.test.ts`, `packages/dashpanel/src/portal.test.tsx`, and `apps/lab/tests/contract-lab.spec.ts`                                                                                                                                                                                                            | Verified | Exact-slot and shared-main-slot occupancy, retained hidden/collapsed leases, atomic rejection and explicit retry after release, occupied-target drag release preserving the settled placement, the complete left/right allocation and offset matrix, Fixed/Hybrid parity, adjacent-corner width allocation, mixed-mode rendered rectangles, allocation-aware Hybrid target-proxy geometry, and live peer allocation previews that reverse on Hybrid detach are covered.                                                                                                                                   |
| PANEL-POINTER  | Pointer capture and committed drag result    | `packages/dashpanel/src/placement/drag-intent.test.ts`, `packages/dashpanel/src/portal.test.tsx`, `packages/dashpanel/tests/dashpanel.test.tsx`, `apps/lab/tests/contract-lab.spec.ts`, and `apps/lab/tests/phone-artifacts.spec.ts`                                                                                                                                                                                                                                        | Partial  | Full-header pickup outside interactive controls, native pointer capture, no-jump docked pickup, live exact snap attraction, resisted detach and catch-up, theme-defined Motion snap/detach translation with continuous in-flight replacement, Motion-driven Hybrid corner/side/return proxy, sticky whole-gesture movement, latest-intent commit after returning to the pickup rectangle, occupied-target rejection, containment, cancellation, drift fencing, focus retention, real browser drag, and phone-sized artifact capture are covered. Transient feedback remains outside Nexus and Dev Bridge. |
| PANEL-KEYBOARD | Keyboard movement/action parity              | `packages/dashpanel/src/portal.test.tsx`, `packages/dashpanel/tests/dashpanel.test.tsx`, and `apps/lab/tests/contract-lab.spec.ts`                                                                                                                                                                                                                                                                                                                                          | Partial  | Enter/Space movement mode, 1/10-pixel arrows, projected-displacement commits, sticky whole-gesture movement, snap-proximity settlement, Hybrid detach thresholds, descendant layout-motion isolation, Escape restore, containment, focus retention, and pointer-outcome parity are covered.                                                                                                                                                                                                                                                                                                               |
| PANEL-LAYOUT   | Durable override/reset/recovery              | `packages/dashpanel/src/runtime/panel-runtime.ts`, `packages/dashpanel/src/runtime/panel-runtime.test.ts`, `packages/dashpanel/tests/dashpanel.test.tsx`, and `apps/lab/tests/contract-lab.spec.ts`                                                                                                                                                                                                                                                                         | Verified | Settled placement overrides write through Nexus, survive a real Web Storage reload, and remain independently visible through the disclosed Dev Bridge scope; reset removes the override and survives another reload; malformed persisted Panel metadata is quarantined, emits the scoped diagnostic, and renders the current declared default. Dormant valid records remain reconciled under policy changes and policy-disabled states.                                                                                                                                                                   |
| PANEL-PORTAL   | Portal stacking, theme, focus restoration    | `packages/dashpanel/src/portal.test.tsx`, `packages/dashpanel/tests/dashpanel.test.tsx`, and `apps/lab/tests/contract-lab.spec.ts`                                                                                                                                                                                                                                                                                                                                          | Partial  | Exact detached ownership, transformed/scrolled containing-block coordinate mapping, theme/density carriers, root-capture pointer and focus activation of the top Panel, focus retention, and geometry independence are covered; the exhaustive multi-Panel stacking matrix remains Phase 3 work.                                                                                                                                                                                                                                                                                                          |
| PANEL-A11Y     | Naming, actions, semantic DOM                | `packages/dashpanel/tests/dashpanel.test.tsx`, `packages/dashpanel/src/actions.test.tsx`, and `apps/lab/tests/contract-lab.spec.ts`                                                                                                                                                                                                                                                                                                                                         | Partial  | Semantic aside, naming, retained/inert bodies, edge-directed Minimize/Reveal icons, focus transfer between replacement controls, aligned SVG collapse/close controls, a non-interactive header drag surface plus visually hidden keyboard move control, visible action-menu icon, confirmed removal, rejected placement/reset status, keyboard movement, and browser focus behavior are covered; adaptive modal semantics remain planned.                                                                                                                                                                 |
| PANEL-ADAPT    | Modal drawer/sheet projection and exclusion  | Component tests; one modal E2E seam                                                                                                                                                                                                                                                                                                                                                                                                                                         | Planned  | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| PANEL-THEME    | Theme/density overrides and detached roots   | `packages/dashpanel/tests/dashpanel.test.tsx`, `packages/dashpanel/src/portal.test.tsx`, and `apps/lab/tests/phone-artifacts.spec.ts`                                                                                                                                                                                                                                                                                                                                       | Partial  | Provider/Panel theme and density composition, detached portal carriers, the retained light/dark/system preferences, media-query switching, and one app-owned Ocean fixture using only public tokens are covered; exhaustive token audits remain Phase 3 work.                                                                                                                                                                                                                                                                                                                                             |
| PANEL-CSS      | Public token inventory and consumption       | `packages/dashpanel/tests/package-artifacts.mjs`, `packages/dashpanel/tests/style.test.ts`, `apps/lab/tests/contract-lab.spec.ts`, `apps/lab/tests/phone-artifacts.spec.ts`, and `scripts/check-motion-policy.mjs`                                                                                                                                                                                                                                                          | Partial  | Width and magnetic-motion tokens, balanced shell/header geometry, full-header drag surface, centered icon controls, rotating collapse and dock arrows, resolved-geometry contact-aware Panel/proxy/Reveal radii, Reveal-above-Panel stacking, text-mutation-aware Motion measured height, target-proxy transitions, and same-side allocation FLIP, transform/opacity dock retraction, active-drag and reduced-motion fallbacks, phone-sized visual artifacts, translucent blurred surface, and the static shared-token recipe are covered; the exhaustive token inventory remains later work.             |
| PANEL-CATALOG  | Accepted owner entries and references        | Static catalog/artifact tests                                                                                                                                                                                                                                                                                                                                                                                                                                               | Planned  | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| PANEL-PACKAGE  | Exports, CSS, peer contracts                 | `packages/dashpanel/tests/package-artifacts.mjs` and `packages/dashpanel/tests/dashpanel.types.test.ts`                                                                                                                                                                                                                                                                                                                                                                     | Partial  | Root/style/package exports, placement/boundary declarations, Provider and Panel boundary/inset/dock prop typing, placement-owned logical-size and minimum-size style exclusions, unchanged runtime keys, dependencies, peers, and retired export absence are checked; `/catalog` remains later entries.                                                                                                                                                                                                                                                                                                   |

Do not open a browser for deterministic placement matrices. E2E proves that real browser layout and
input choreography reach the already-tested canonical result.

## DashStack

| ID                | Contract area                                              | Primary evidence                                                                                                                                                                                                                                       | Status   | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LIST-COMPOSE      | Standalone and inherited Nexus scope                       | `packages/dashstack/tests/dashstack.test.tsx`                                                                                                                                                                                                          | Partial  | Explicit root/scoped resolution, nearest Provider scope, explicit child scopes, nested relationships, immutable identity, standalone lease cleanup, StrictMode/SSR no-acquisition, nested Stack isolation, and committed custom declaration agreement are covered; broader composition remains Partial.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| LIST-IDENTITY     | Stable item/group/binding IDs                              | `packages/dashstack/tests/dashstack.types.test.ts`, `packages/dashstack/tests/dashstack.test.tsx`, and `packages/dashstack/src/ordering/model.test.ts`                                                                                                 | Partial  | Dashlet and DashGroup explicit IDs share one Stack-wide namespace and are committed exactly once, with invalid/duplicate/mismatch failures and durable node reconciliation covered; broader binding identity remains Phase 3 work.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| LIST-ANATOMY      | Dashlet semantic structure                                 | `packages/dashstack/tests/dashstack.test.tsx`                                                                                                                                                                                                          | Partial  | Neutral root, list/listitem/group roles, visible labels, non-text aria-label validation, heading levels, status region, arrays/fragments, retained children, and group containment are covered.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| LIST-BINDING      | Canonical values, drafts, issues                           | Nexus tests, [packages/dashstack/tests/dashstack-bindings.test.tsx](../../packages/dashstack/tests/dashstack-bindings.test.tsx), and `apps/lab/tests/contract-lab.spec.ts`                                                                             | Partial  | Single and compound leases, canonical values, typed input/display contexts, callback policy, issue attribution/IDs, announcements, rollback, cleanup, Bridge writes, UI writes, external-write staleness, and shell-owned confirmed overwrite are covered; broader binding composition remains Partial.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| LIST-PRESENTATION | Ready-made canonical presentation mismatches               | `packages/dashstack/tests/ready-made.test.tsx`, `packages/dashstack/tests/choice-controls.test.tsx`, `packages/dashstack/tests/value-controls.test.tsx`, and `apps/lab/tests/contract-lab.spec.ts`                                                     | Verified | Scalar, choice, and value families retain exact canonical fallbacks, inline `role="note"` descriptions, no `aria-invalid`, and no repair writes. Focused Number, Slider, Range, temporal, and Color editor removal repairs focus to the named shell. Initial and unfocused mismatches stay silent; focused false-to-true transitions announce once through the nearest persistent Stack status region; persistent and message-only changes stay silent; restoration permits one later announcement; StrictMode and nested Stacks do not duplicate it. The Style Lab proves focused Number removal and one announcement after an allowlisted external Bridge write in a real browser.                                                                                                                                                                                                                                                                                                                                                                                 |
| LIST-GROUP        | Declarative containment and collapse                       | `packages/dashstack/tests/dashstack.test.tsx`                                                                                                                                                                                                          | Partial  | Group containment, one organizational subgroup level, nested Dashlet rejection, collapse behavior, durable collapse metadata, and focus repair before hidden/inert commit are covered; future rail variants remain planned.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| LIST-ORDER        | Reconciliation and customized order                        | `packages/dashstack/src/ordering/model.test.ts`, `packages/dashstack/tests/dashstack.test.tsx`, `packages/dashstack/tests/style.test.ts`, and `packages/dashstack/tests/package-artifacts.mjs`                                                         | Partial  | Root and grouped declarations persist durable ordering overrides with pin-band constraints, no cross-band movement, no write on cancellation, and explicit reset behavior. Root start/end bands remain visible around the automatic-band scrollport when height is constrained.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| LIST-POINTER      | Pointer reorder choreography                               | `packages/dashstack/tests/dashstack.test.tsx`                                                                                                                                                                                                          | Partial  | Pointer reordering starts from shell handles, validates membership and bands, rejects cross-pointer and cross-modality attachment, supports cancellation on external drift, and commits durable override only once.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| LIST-KEYBOARD     | Keyboard reorder and announcements                         | `packages/dashstack/src/ordering/model.test.ts` and `packages/dashstack/tests/dashstack.test.tsx`                                                                                                                                                      | Partial  | Keyboard movement uses the same commit/cancel and band constraints as pointer sessions, including pre-pickup key preservation, valid-edge/Home/End behavior, and focused-handle retention around commit and cancel.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| LIST-A11Y         | Collection/rail semantics, names, focus, announcements     | `packages/dashstack/tests/dashstack.test.tsx`, `packages/dashstack/tests/ui-controls.test.tsx`, `packages/dashstack/tests/value-controls.test.tsx`, `packages/dashstack/tests/choice-controls.test.tsx`, and `apps/lab/tests/contract-lab.spec.ts`     | Partial  | Collection names, labels, roles, heading levels, collapse focus repair, focused-handle retention, and reorder announcements are covered. The registered-primary-target matrix covers safe row clicks, exact built-in targets, unusable-target fallback, focused editor removal, read-only descriptions, supplementary help, structural choice markers, cross-document target fallback, and ref cleanup. The Style Lab adds real-browser safe-row focus, help focus return, read-only Slider/Range operation, mismatch focus repair, and one announcement; rail-specific semantics remain Phase 3 work.                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| LIST-RAIL         | Rail reveal, toggle, reorder, and orientation precedence   | Component tests; one Contract Lab rail journey                                                                                                                                                                                                         | Planned  | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| LIST-ACTIONS      | Targeting, availability, reuse, confirmation               | `packages/dashstack/src/actions.tsx`, `packages/dashstack/tests/dashstack.test.tsx`, and `apps/lab/tests/contract-lab.spec.ts`                                                                                                                         | Partial  | Expand/collapse and reset actions target nearest/explicit scopes with availability state, immutable hooks, stable execution identities, stale-state rechecks, no-op disabled behavior, and confirmation-gated reset execution.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| LIST-RESET        | Value/draft/metadata reset composition                     | `packages/dashstack/tests/dashstack.test.tsx`, `packages/nexus/tests/reset-registered-values.test.ts`, and `packages/nexus/tests/scope-metadata.test.ts`                                                                                               | Partial  | Active registered values, owned drafts, and order/collapse metadata reset through separate public contracts with exact inspection, explicit confirmation, atomic metadata updates, and no-op disabled states.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| LIST-DOCS         | Scoped JSON plans, review, import, and export              | Component tests plus browser I/O seams                                                                                                                                                                                                                 | Planned  | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| LIST-CSS          | Product tokens and shared-token consumption                | `packages/dashstack/tests/package-artifacts.mjs`, `packages/dashstack/tests/style.test.ts`, `packages/dashstack/tests/dashstack.test.tsx`, `apps/lab/tests/contract-lab.spec.ts`, and `scripts/check-motion-policy.mjs`                                | Partial  | CSS imports UI styles, owns only Stack/group/Dashlet structure, scopes the status rule, and covers the label-width cap, container-relative label track, shared four-track ordering grid, nearest-Stack compact selector ownership, inline stacking, Slider mark positioning, distinct row/group hover layers, shell/help focus, logical marker spacing, selected Checkbox/Radio/Segmented structure, forced-colors marker treatment, the Checkbox coarse-pointer target, and reduced-motion removal for all Stack transitions. Style Lab verifies representative LTR, RTL, forced-colors, help, and read-only rendering; broader responsive geometry and complete token-consumption evidence remain Planned.                                                                                                                                                                                                                                                                                                                                                         |
| LIST-SLIDER-MARKS | Slider mark structure, offsets, and rendered direction     | `packages/dashstack/tests/ui-controls.test.tsx`, `packages/dashstack/tests/style.test.ts`, and `apps/lab/tests/contract-lab.spec.ts`                                                                                                                   | Verified | Slider keeps authored mark labels and order in one pointer-inert layer inside SliderTrack. Component and style evidence covers min/mid/max percentages, negative and nonzero ranges, zero-span logical start, semantic hooks, and unchanged input events; the existing Style Lab composition journey proves the representative layer aligns to the rendered track and mirrors its geometry in LTR and RTL.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| LIST-CATALOG      | Stable ready-made inventory, owner entries, and exclusions | `packages/dashstack/src/catalog.ts`, `packages/dashstack/tests/package-artifacts.mjs`, and `node scripts/check-agent-artifacts.mjs`                                                                                                                    | Verified | The 16 DashStack catalog entries comprise three composition entries, seven retained ready-made Dashlets, and six actions. Artifact checks verify unique IDs, root exports, frozen JSON metadata, and exclusion of the fifteen deferred root implementations and experimental charts. M7 owner approval was recorded on 2026-09-17.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| LIST-COMPOSITION  | Typed JSX composition grammar and compound field semantics | `packages/dashstack/tests/ready-made*.test.tsx`, `packages/dashstack/tests/ui-controls.test.tsx`, `packages/dashstack/tests/choice-controls*.test.tsx`, `packages/dashstack/tests/value-controls*.test.tsx`, and `apps/lab/tests/contract-lab.spec.ts` | Partial  | All 22 implemented ready-made prop surfaces preserve field-domain checks at direct JSX, unannotated `createElement` field bindings, explicit aliases, specialized generic wrappers, safe unspecialized aliases, and unspecialized `ComponentProps`. Exact compound views reject additional, missing, narrower, indexed, optional, and union-wide members. Focused tests also cover forbidden built-in props, finite/unique options, duplicate and ordered-array mismatches, exact canonical fallbacks, untouched formatted Number values, alpha-preserving Color formats, strict temporal values, nested/ambient locale behavior, explicit Status maps, and public shell composition. The `/lab` Style Lab asserts two non-overlapping hybrid Panels containing all 22 implemented Dashlets, four stable groups, a headerless root group pinning Search and automatic Color rows, read-only Slider/Range controls, rounded Number presentation, alpha Color editing, and the six existing gallery groups. Broader touch and responsive matrices remain Phase 3 work. |
| LIST-CHOICE-POPUP | Select, Combobox, and MultiSelect detached popup hosting   | `packages/ui/tests/popover.test.tsx`, `packages/dashstack/tests/choice-controls.test.tsx`, and `apps/lab/tests/contract-lab.spec.ts`                                                                                                                   | Verified | All three choice controls use the public shared UI Popover while retaining the DashStack structural class, React Aria positioning, selection, disabled/read-only behavior, and focus. Shared UI owns inherited/explicit portal, exact theme/density, host non-mutation, and private active-parent layer ordering; the existing AlertDialog browser journey proves a real detached Select listbox computes above its modal, selects, and restores focus.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| LIST-CHARTS       | Experimental TanStack Charts boundary and cleanup          | `packages/dashstack/tests/charts.test.tsx`, `packages/dashstack/tests/charts.types.test.ts`, `packages/dashstack/tests/package-artifacts.mjs`, and `apps/lab/tests/contract-lab.spec.ts`                                                               | Partial  | The exact optional `@tanstack/charts@0.12.0` peer, native `ChartDefinition`, root/catalog isolation, SSR-empty history, accessible naming, bounded samples, disabled SVG animation, and the reachable `/lab` gallery Sparkline are covered. Streaming suspension, resubscription, and cleanup use the rendered target's owner document and owner-window `IntersectionObserver`, including iframe and no-observer cases; no ambient realm is used after render. Responsive resize and broader theme/browser accessibility evidence remain.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| LIST-PACKAGE      | Exports, CSS, peer contracts                               | `packages/dashstack/tests/package-artifacts.mjs`                                                                                                                                                                                                       | Partial  | Exact root, `/ui`, `/catalog`, `/charts`, style, and package exports; runtime/declaration keys; dependencies; optional chart peer isolation; CSS; SSR; and built artifacts pass. Remaining package status follows the broader Phase 3 feature matrix.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

Conditional rendering is not an obsolete-node oracle. Pruning tests require explicit inventories
and never derive deletion from mount absence.

## Picodash integration

| ID              | Contract area                                   | Primary evidence                                                                                                                                                                                                                                                                                   | Status  | Evidence                                                                                                                                                                                                                                                                                                                               |
| --------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PICO-CONTEXT    | Provider composition, nesting, Panel/Stack root | `packages/picodash/tests/picodash.test.tsx` and `packages/picodash/tests/picodash.types.test.ts`                                                                                                                                                                                                   | Partial | Public DashPanel Provider delegation, root-Nexus typing, inherited Provider props, dock narrowing, and the Panel/Stack root composition are covered; integrated coordinators and full nesting remain Planned.                                                                                                                          |
| PICO-SAME-SCOPE | Panel plus primary Stack                        | `packages/picodash/tests/picodash.test.tsx`                                                                                                                                                                                                                                                        | Partial | The canonical facade components prove that an id-less primary DashStack resolves its containing DashPanel scope; integrated actions and additional-Stack targeting remain Planned.                                                                                                                                                     |
| PICO-CHILD      | Explicit child Stacks and relationship graph    | React plus Nexus graph test                                                                                                                                                                                                                                                                        | Planned | —                                                                                                                                                                                                                                                                                                                                      |
| PICO-MENU       | Same-scope contribution and replacement rules   | Integration component and type tests                                                                                                                                                                                                                                                               | Planned | —                                                                                                                                                                                                                                                                                                                                      |
| PICO-ACTIONS    | Additional Stacks preserve primary targeting    | Integration component tests                                                                                                                                                                                                                                                                        | Planned | —                                                                                                                                                                                                                                                                                                                                      |
| PICO-PORTAL     | Dashlets inside themed portaled Panel           | [packages/picodash/tests/picodash.types.test.ts](../../packages/picodash/tests/picodash.types.test.ts), [packages/picodash/tests/package-artifacts.mjs](../../packages/picodash/tests/package-artifacts.mjs), and [apps/lab/tests/contract-lab.spec.ts](../../apps/lab/tests/contract-lab.spec.ts) | Partial | The facade exactly reexports shared Popover. The Style Lab proves choice popup detachment and presentation, while the AlertDialog journey proves a real DashStack `/ui` Select popover computes above its modal, remains interactive, clears after selection, and restores focus; broader integrated overlay stacking remains Planned. |
| PICO-THEME      | One-import styles and orthogonal theme/density  | `packages/picodash/tests/package-artifacts.mjs` and `packages/picodash/tests/picodash.types.test.ts`                                                                                                                                                                                               | Partial | The facade imports the public UI, DashPanel, and DashStack styles and preserves inherited theme/density props; expanded CSS and integrated portal evidence remain Planned.                                                                                                                                                             |
| PICO-CATALOG    | Exact entry aggregation and facade reexports    | Type/package/catalog tests                                                                                                                                                                                                                                                                         | Planned | —                                                                                                                                                                                                                                                                                                                                      |
| PICO-PACKAGE    | Facade exports and complete styles              | `packages/picodash/tests/package-artifacts.mjs` and `packages/picodash/tests/picodash.types.test.ts`                                                                                                                                                                                               | Partial | Exact alpha root, `/ui`, style, and package entries; canonical owner identities for all 22 ready-made components, specialized prop aliases, and safe unspecialized `ComponentProps`; dependency/peer contracts; retired-entry absence; and packed artifacts are covered. `/catalog` and the complete launch facade remain Planned.     |
| PICO-EXAMPLE    | Four canonical fixtures; one integrated journey | Compile/package tests plus website E2E                                                                                                                                                                                                                                                             | Planned | —                                                                                                                                                                                                                                                                                                                                      |

Picodash does not repeat Nexus field matrices, DashPanel geometry matrices, or DashStack ordering
matrices.

## Browser budget

The existing Contract Lab hard ceiling of 40 collected tests remains a ceiling, not a target. The
target suite should use substantially fewer cohesive journeys when lower layers own deterministic
coverage.

Browser admission remains limited to:

- real computed layout and pointer capture;
- focus traversal/restoration and portal stacking;
- scroll, viewport, zoom, and media-query behavior;
- browser storage seams;
- complete cross-product or public journeys.

No browser test is admitted for parsers, validators, reducers, serialization matrices, type
inference, static exports, deterministic geometry, or component semantics available to a renderer.

## Regression admission

When a defect is found:

1. Link it to an existing contract ID or add a missing contract area.
2. Expand the cheapest primary evidence.
3. Add E2E only when the defect requires browser behavior to reproduce faithfully.
4. Merge the assertion into an existing cohesive journey when possible.
5. Remove superseded overlapping coverage.

## Release gates

### Nexus alpha

> Gate status: Verified for consumer dogfooding on 2026-08-06.
> Evidence: The linked Nexus conformance rows and `bun run --filter @picodash/nexus release:check`.

Required before consumer dogfooding:

- core field/value/transaction/scope behavior implemented;
- structured errors and nominal ownership verified;
- Nexus-owned metadata records and lazy scope creation verified;
- public, React selector, and integration-lease entries usable without private imports;
- synchronous Nexus-owned persistence and the manual external-value adapter usable;
- persistence failures retain a complete pending envelope and never silently overwrite conflicts;
- package/artifact checks passing;
- no known partial-mutation or silent-persistence-loss path.

### Nexus beta

> Gate status: Verified for consumer dogfooding on 2026-08-09.
> Evidence: The linked Nexus conformance rows, the cohesive [Contract Lab browser/Bridge journey](../../apps/lab/tests/contract-lab.spec.ts), and the Nexus package check/test suites.

Required after DashPanel and DashStack dogfooding:

- scoped context and relationship model verified;
- persistence conflict/erase recovery and external adapters fully verified;
- document policies and recovery paths verified;
- repair, overwrite, prune, import, and export stale-plan behavior verified;
- consumer findings reconciled without private API bypasses.

### DashPanel and DashStack stability

Each foundational UI product requires its owned deterministic/component evidence plus only its
browser journeys. Neither waits for or reruns the other product's complete suite. Both require a
compatible shared UI foundation whose package, theme, and consumed primitive contracts pass.

### Picodash stability

Requires stable foundation versions and passing integration rows. Facade-only work cannot waive a
failed foundation contract.

## Current readiness

| Package/facade | Contract readiness | Implementation readiness | Reason                                                   |
| -------------- | ------------------ | ------------------------ | -------------------------------------------------------- |
| Nexus          | Accepted           | Beta verified            | Exact beta gate passed after consumer dogfooding         |
| UI             | Accepted           | Foundation implemented   | Consumer seams remain Partial; stability is not declared |
| DashPanel      | Accepted           | Active dogfooding        | Partial rows remain before its stability gate            |
| DashStack      | Accepted           | Active dogfooding        | Partial and Planned UX rows remain before stability      |
| Picodash       | Accepted           | Integration prototype    | Depends on stable foundational products                  |
| Dev Bridge     | Accepted baseline  | Verified for dogfooding  | Private development adapter over public Nexus            |

## Recovery M5: DashStack data closure

The existing standalone binding browser journey now covers persisted values, rejected atomic
batches leaving live and saved values unchanged, invalid drafts discarded on refresh, reset
cancellation, and confirmed reset from either Stack surviving reload. DashStack binding/action tests
and Nexus validation/persistence tests retain ownership of their deterministic contracts.
The bounded slice is browser-verified locally and owner-approved on 2026-09-09.
See [M5 evidence](../internal/m5-dashstack-data.md).

## Recovery M6: DashStack organization

The standalone binding journey exercises group and child ordering, pointer/keyboard child outcome
parity, cancellation and preview without persistence, independent collapse, saved organization
through reload, and confirmed reset of one Stack. Read-only Bridge scopes expose the saved child
order. See [M6 evidence](../internal/m6-dashstack-organization.md); owner approval was received on 2026-09-10, including reported Safari use.

The expanded M6 long-list journey in `apps/lab/tests/reordering.spec.ts` verifies translucent
blurred drag paint, shadow, animated displacement, fixed pin lanes, edge scrolling, retained node
identity, and cancelled child-drag draft retention. Motion is a DashStack runtime dependency;
visual session state stays outside Nexus. The owning keyboard reorder test also checks that child
content mounts only once across candidate moves and commit.

Owner-reported M6 drag corrections add browser evidence for the exact halfway trigger, multiple
rendered displacement positions, and an enabled/disabled backdrop comparison. CSS duration parsing
preserves seconds and milliseconds after build optimization; translucent background paint avoids
fading the whole dragged subtree. See the M6 drag review corrections for the local checks.

## Recovery M7: Dashlet curation approved

Workspace tuning begins the candidate inventory with Text, Number, Slider, Switch, and Display.
It reuses M5 values and persistence, discloses its Stack through the existing Bridge session, and
adds slider-to-number/readout closure and read-only/disabled theme review to the standalone binding
journey. This is a partial candidate slice; see the [working disposition ledger](../internal/m7-dashlet-curation.md).
The broader published inventory is not newly approved by these five candidates.
The first candidate run found and corrected missing Slider thumb label propagation. The owning
ready-made control test checks the visible-label reference; the browser checks the accessible name.

M7's completed candidate scope retains Text, Number, Slider, Switch, Select, Segmented, and Display.
The expanded binding journey exercises source/detail choices, actual preview changes, keyboard
navigation, invalid choice rejection, read-only/disabled states, persistence and confirmed reset.
The stable catalog admits these seven and excludes fifteen deferred evaluation implementations;
package artifact checks enforce that boundary. See the M7 ledger for the explicit dispositions
and owner review gate. This supersedes earlier blanket stable claims for all 22 implementations.

The owner approved M7 on 2026-09-17 with no blockers. Remaining UI fixes carry forward to M8
integrated prototype parity and polish; this approval does not promote the deferred controls.

## Dashlet refinement gallery

The `/lab` default view is a single document-scrolling gallery for all 22 implemented ready-made
Dashlets plus the experimental Chart and Sparkline. Following the owner correction on 2026-10-07, it presents inline controls with independent
read-only, disabled, and reorder toggles. Block is used for multiline and rich content, with validation, color-format,
choice, temporal, and structured-readout examples. The existing six contract presets remain
available through **Contract tools**; this view choice survives session reloads.

The gallery phone journey in `apps/lab/tests/contract-lab.spec.ts` owns computed mobile input
font size, document scrolling without nested scrollports, responsive overflow, popup interaction,
theme/density switching, and navigation back to the contract harness. The Lab applies a 16px
minimum to text-entry controls on narrow or coarse-pointer devices, including detached overlays,
without restricting viewport scaling. Actual iOS keyboard-focus zoom remains a physical-device
check; Chromium mobile emulation proves the CSS precondition only. This gallery does not change
M7 catalog admission or promote deferred Dashlets.

Local verification passed for the gallery journey at 320px, 390px, and 844px, including a disclosed
Bridge Number write reflected in the read-only example. The existing Console/driver, six-preset
reload, two-panel Style Lab, and regular/compact coarse-pointer journeys also passed. Lab type
checking and focused source lint passed. No package release gate is claimed.

### Default-theme recovery, 2026-10-07

Owner-directed first pass restores a Leva-inspired built-in palette and filled controls, explicit
row placement, full-track field widths, inert affordance markers, and single slider readouts.
The public layout union is now inline/block; historical full-width evidence above is superseded.
The public consumer-theme interface is unchanged; custom recipes have not been visually requalified.

Verification for this pass: DashStack's 254 tests, shared UI's 81 tests, DashStack format/lint/type
checks, focused gallery lint, and the Lab production build passed. The live Lab was inspected at
320px, 390px and 960px. Four grid tracks remain at each width with no horizontal page overflow;
at 320px the standard slider retains a 101px track. Light/dark rendering, read-only value
preservation, disabled controls, inert affordances, group disclosure, keyboard reorder commit and
cancellation were exercised. This uses the desktop browser, not a physical phone. The updated phone
journey is committed but the full Lab E2E suite was not run. Drag animation quality, custom themes,
Panel composition and the DashStack rename remain later work.

The follow-up Lab width trial caps the gallery content at 320px, shrinking further for narrow
viewports. The production build passed; a live desktop measurement confirmed the 320px content
width without horizontal page overflow.

### Dashlet control cleanup, 2026-10-07

The next owner-directed pass replaces the separate help icon with an underlined label trigger,
removes excess slider-output and row padding, aligns grips and labels with the first control row,
stretches radio options, joins segmented choices horizontally, and gives temporal fields consistent
widths. DateRange now presents separate From and To rows. Focus within a Dashlet outlines the full
row; the Color input no longer adds a narrower duplicate ring. Hidden React Aria form companions
and collection templates no longer reserve a visible control column.

Verification: all 254 DashStack tests and the Lab production build passed. Live browser inspection
confirmed the 320px content cap, no document overflow at 320px and 390px viewports, matching Date
and Time widths, first-row MultiSelect alignment, full-row Color focus, help dismissal/focus return,
and keyboard DateRange editing. The Number control retains its own accessible name independently
of the help trigger. Date/time literal spacing survives wrapping. This is desktop-browser evidence;
physical-phone behavior, custom-theme qualification, and the full Lab E2E suite were not checked in
this pass.

### Visual controls and grouped dates, 2026-10-07

The Lab now groups its four date/time examples in a reorderable Date & time group, demonstrates
Number unit formatting as Distance, and omits the standalone Checkbox example. Checkbox remains
available in the public component inventory. Search and choice disclosure actions share the
filled input surface; tag removal targets are 24px with 44px coarse-pointer targets. Block labels
span the three content columns and chart defaults are 144px/48px for chart/sparkline.

All 256 DashStack tests and the Lab production build passed. Browser evidence verified the grip
centre against the midpoint between the Stack edge and label, identical Display/label line heights
and vertical centres, date-group keyboard reorder/cancel, 24px tag removal and re-selection, unit
formatting, chart geometry, and no horizontal overflow at a 320px viewport. The colour popover fits
that viewport; hue editing preserves alpha, opacity editing updates the field, Escape restores
swatch focus, and read-only mode prevents opening. The added component test owns visual colour
editing and disabled/read-only protection. Physical touch, all custom themes and the full Lab E2E
suite remain untested in this pass. Calendar popovers and the TanStack Charts 1.0 migration were
researched, not implemented.

### Calm selection and calendar convenience, 2026-10-07

Dashlet surfaces now reach the Lab Stack edges. Group headers give grip, disclosure, and label
separate centered tracks; the grip aligns with child grips. Selected choices retain non-color
indicators with a subdued fill. Open popups suppress the parent row focus surface, while keyboard
option focus remains visible. Date, DateTime, and DateRange add optional React Aria calendars.

All 258 DashStack tests passed, including calendar serialization, complete range commits,
DateTime time/zone preservation, empty DateTime initialization, and locked date triggers. Package
format/lint/type checks and the Lab production build passed. Live desktop-browser checks verified
320px Stack/row widths, matching group/child grip positions and centered header targets, direct
segment editing, calendar selection, Escape focus restoration, read-only triggers, and keyboard
MultiSelect focus. The calendar fits a 320px viewport without horizontal document overflow.
Physical touch, custom-theme qualification, and the full Lab E2E suite were not run in this pass.

### Group hover and balanced row insets, 2026-10-07

Dashlet end padding follows the visible grip inset while row surfaces remain edge-to-edge.
Grips dim at rest and brighten on hover, keyboard focus, or press; inert squares stay subdued.
Group disclosure uses a centered rotating glyph. Hovering a group header extends its highlight
through the children's first column. Select now aligns its value at the start and includes the
same disclosure cue as Combobox and MultiSelect, without copying the listbox's selection marker.

All 258 DashStack tests, package checks, and the Lab production build passed. Browser inspection
measured matching 9px grip/value insets, 0.45 resting/1 hovered grip opacity, 0.3 decoration opacity,
centered header targets, a connected group hover rail, and working Select changes. The 320px
viewport had no horizontal document overflow. Physical touch and custom themes were not checked.

### Disclosure rhythm and visible tracks, 2026-10-07

Draggable group headers use the same chevron-to-label spacing as non-draggable headers.
Select centers its value within the trigger. Segments form a local stacking context and raise
keyboard focus above adjoining segments. Slider, range, meter, and progress tracks use translucent
text color so the track stays distinct from the row hover surface in both light and dark modes.

All 258 DashStack tests, package checks, and the Lab build passed. Browser measurements confirmed
zero Select value/trigger center offset and identical 16px chevron-center-to-label distances for
Date & time and More examples. Keyboard navigation raised only the focused segment; screenshots
showed its complete outline above both neighbours. Hovered Range tracks remained visible in light
and dark modes. Physical touch and custom-theme qualification were not checked in this pass.

### Segment pointer-border correction, 2026-10-07

The preceding keyboard-only stacking fix missed pointer selection: without `data-focus-visible`,
the next segment still painted over the selected segment's right border. Selected segments now
sit above unselected neighbours, and focused segments sit above selected segments regardless of
input modality. Keyboard focus retains its distinct outline.

All 258 DashStack tests, package checks, and the Lab build passed. Live browser screenshots now
cover all three segment positions with pointer selection and all three with keyboard navigation,
including the previously missing right edges of the first and middle pointer-selected segments.

### Group colour hierarchy and header disclosure, 2026-10-07

Group titles keep their existing size with semibold, strong theme text by default. The optional
`labelColor` prop colors title and chevron; CSS derives the header and first-column hover tint
at 10% from the same color. The Lab compares a warm-gold Date & time group with neutral More
examples, using appropriate gold shades in light and dark modes. Child fields and grips remain
neutral. The existing disclosure button's hit area fills the header except the reorder grip,
with a full-header keyboard focus outline and no extra tab stop or duplicate toggle handler.

All 258 DashStack tests, package checks, and the Lab build passed. The public type fixture covers
theme-variable colors; the component fixture checks native style preservation and prevents prop
leakage to DOM. Browser checks verified title and empty-header clicks, grip click isolation,
Space disclosure, group reorder/cancel without collapse, light/dark presentation, retained neutral
field colors, and no horizontal overflow at a 320px viewport. Physical touch and custom-theme
qualification remain untested in this pass.

### Rounded chips and shorter slider thumbs, 2026-10-07

MultiSelect chips and their remove buttons now use the theme surface radius (10px in the
default theme). Fine-pointer slider and range thumbs shorten from the bottom while compensating
for React Aria's centered transform to keep the original top edge. Coarse-pointer sizing is unchanged.

All 258 DashStack tests, package checks, and the Lab build passed. Live browser measurements
confirmed regular thumbs changed from 24px to 18px with their top still 12px above the track;
Compact thumbs changed from 20px to 15px with their top still 10px above the track. The marked
slider now has 2px regular and 1px Compact clearance before its mark boxes, replacing 4px overlap
in both densities. Screenshots verified the chips and marks; keyboard adjustment and pointer
dragging of a range thumb both updated values. Physical touch was not tested.

### Pointed slider thumbs, 2026-10-08

Fine-pointer slider and range thumbs now have wider bodies, rounded upper corners, and a short
pointed bottom. The shape is painted on a pseudo-element so clipping does not cut off the native
thumb's focus outline or hit area. Existing height and top alignment are preserved.

All 258 DashStack tests, package checks, and the Lab build passed. Live browser inspection confirmed
12px regular and 10px Compact widths, unchanged 18px/15px heights, and retained 2px/1px mark
clearance. Screenshots covered the regular slider/range shapes and Compact marks. Pointer dragging
and keyboard adjustment changed the slider value; keyboard focus retained a 2px outline with no
clip on the thumb itself. Coarse-pointer appearance is unchanged and physical touch was not tested.

### Range endpoint recovery and switch motion, 2026-10-08

The trailing grid column respects its content minimum and numeric badges do not wrap. When both
range thumbs coincide at the configured maximum, Start paints above End so the lower bound can
be dragged inward. End remains on top at the minimum. The priority derives from the controlled
value without additional interaction state.

The switch marker is a rounded rectangle. Its 150ms transform transition uses ease-in-out
movement and a small pressed stretch, with direction-aware travel. Keyboard focus and the
reduced-motion media query remove the transition.

All 258 DashStack tests, package checks, and the Lab build passed. Existing CSS expectations were
updated for the new grid sizing and switch geometry. Live pointer checks collapsed and recovered
both 100–100 and 0–0 in regular and Compact modes. The 100–100 badge remained one line without
overflow at a 320px viewport. Pointer and Space toggles worked on the switch; computed keyboard
focus duration was 0s. Reduced-motion handling was checked in source; RTL and physical touch
were not exercised in this pass.

### Off switch track contrast, 2026-10-08

The Off switch uses the same 22% translucent theme text color as slider tracks. Live browser
checks confirmed identical computed colors and a visible Off track over the hovered row in
both light and dark modes. All 258 DashStack tests, package checks, and the Lab build passed.

### Slider update isolation, 2026-10-08

Dashlet bindings select their own fields and interaction state. Stack ordering subscribes to the
collapse fence independently of the live announcement region. Successful inputs no longer publish
redundant empty announcements, and command errors expire directly against their canonical values
record without a follow-up clearing render. Nexus writes, validation, thumb positions, and linked
readouts remain synchronous; no easing, debounce, or deferred value was introduced.

The repeated-slider fixture in `packages/dashstack/tests/dashstack-bindings.test.tsx` measures 20
successive inputs. Before this change, each of its four Dashlets rendered 60 times. Afterward,
the slider and same-field display each render 20 times; the unrelated bound and unbound Dashlets
do not render. The fixture checks the canonical value, native range value, and linked display
after every input. Existing rejection tests now also check announcement clearing and command-error
expiry after unrelated canonical writes, including a subsequent rejection.

All 263 DashStack tests, package checks, and the Lab build passed. Live browser checks covered
regular and Compact slider/range dragging, keyboard adjustment, read-only rejection, and disabled
inputs. During a drag, the main and marked sliders showed the same intermediate values and thumb
positions in every sampled observation. No browser errors were recorded. This establishes reduced
render work and functional live behavior, not a calibrated pointer-to-paint latency measurement.

### Choice and date state polish, 2026-10-08

MultiSelect chips use a subtle theme-accent tint and balanced inline padding when removal is
unavailable. Disabled listbox options use the disabled-opacity token. Visually hidden read-only
descriptions are excluded from content-column counting, so Select retains the full field width
without losing its accessible description. Date range endpoints form two tighter joined rows;
calendar actions use the theme accent when enabled and muted grey at disabled opacity otherwise.

All 263 DashStack tests, package checks, and the Lab build passed. Live regular-dark and Compact-light
checks confirmed read-only Select occupied its full available width (183px and 191px), symmetric
chip padding (8px and 6px), and date-range heights of 48px and 42px. Disabled Option C retained its
disabled semantics with 0.5 opacity. Calendar icons settled to grey at 0.5 opacity in read-only and
disabled modes; enabled icons were blue. Direct range-date adjustment and calendar opening both
worked. Screenshots covered chips, joined dates, and read-only presentation; no browser errors
were recorded. Physical touch and forced-colors rendering were not exercised in this pass.

### Date-range seam correction and colour gallery cleanup, 2026-10-08

The spacing request above referred to the horizontal gap beside the calendar button. Endpoint
rows therefore return to their original 32px regular / 28px Compact height, with a shared filled
background and no gap or rounded seam against the calendar action. Live browser geometry confirmed
a zero-pixel horizontal gap in both densities, and the calendar still opened correctly.

The gallery now includes only the additional alpha-capable colour formats HEXA, HSLA, and HSBA.
HEX, RGB, HSL, and HSB examples were removed because the gallery's translucent value cannot be
edited through them. The main RGBA control remains. Browser inspection confirmed the three retained
labels and no uneditable-format warnings. Package checks, seven stylesheet tests, and the Lab
production build passed; no browser errors were recorded.

The final date-range adjustment adds a one-pixel horizontal control-border divider between From
and To, stopping at the calendar column. Browser checks confirmed unchanged 32px regular / 28px
Compact row heights and no horizontal gap beside the calendar button. The Lab build and seven
stylesheet tests passed.

The divider now mixes 30% theme text into the field background for stronger dark-mode contrast.
Live dark/light screenshots confirmed the one-pixel line and unchanged geometry; the Lab build,
format check, and seven stylesheet tests passed.

### Linked gallery values, 2026-10-08

The Lab gallery demonstrates application-owned composition through public Nexus fields, Dashlet
bindings, and unbound DashStack controls. RadioGroup, Combobox, Select, and Segmented bind to
`choice`; CheckboxGroup and MultiSelect bind to `selections`. Numeric range and slider values live
in one `numeric` field so narrowing the range clamps the slider in one update. Meter derives the
range width in the fixed 0–100 domain; Progress derives the slider position within that range.
A collapsed range displays the fixed value and determinate 0% Progress until reopened.

Date and Time project one timestamp in Australia/Perth. DateTime edits that same timestamp.
DateRange includes both endpoint days; moving the window clamps the date while preserving time.
Clearing the timestamp clears both projections; clearing the range removes the bounds. Validation
rejects programmatic writes outside the numeric or temporal window. These are example rules, not
a new Nexus computed-field or dependency API.

The nine [gallery model tests](../../apps/lab/src/components/contract-lab/gallery-model.test.ts)
pass, covering shared source values, atomic clamping, computed endpoints, collapsed ranges,
timezone projections, clearing, and rejected writes without mutation. Run them with
`vp test apps/lab/src/components/contract-lab/gallery-model.test.ts`. Scoped formatting, lint,
and type checks and the Lab production build pass. Live browser checks cover bidirectional
choice/selection updates, slider bounds and normalized progress, collapsed-range recovery,
date/time projection and date-window clamping, calendar bounds, Compact rendering, read-only
date rejection, and disabled controls. No browser errors were recorded. Dev Bridge remains
disabled in this production Lab; canonical transactions are verified through the public Nexus
API in the model tests. This pass does not claim physical touch or the full browser suite.

### Fixed-scale constrained and bipolar sliders, 2026-10-08

`Slider` and `SliderDashlet` separate the full min/max scale from optional `allowedRange`
interaction bounds. The Lab retains its 0–100 track and fixed marks while Range edits clamp the
shared value atomically. Brighter allowed-track segments and endpoint ticks explain the stops;
dimmed segments remain clickable and clamp to the nearest endpoint. The input has an accessible
allowed-range description. Unlike the earlier linked-gallery collapsed presentation, a collapsed
range now retains the Slider thumb at its single allowed position.

Optional `fillOrigin` paints from the origin to the value, using accent above and danger below.
The independent Bipolar example starts at zero, with −100%, 0%, and 100% marks and a signed readout.

All 277 DashStack tests and nine gallery model tests pass, with scoped types/lint/format checks,
package build, and Lab production build. Direct control tests exercise clamped changes, collapsed
bounds, read-only/disabled guards, invalid configuration, and signed fill geometry. A ready-made
binding test proves that incompatible constraints display a warning without rewriting Nexus.
Live browser checks covered clicks in unavailable track regions, dragging to a boundary and back,
keyboard End/arrow input, range-driven clamping and collapsed-range recovery, and red/blue bipolar
fills. Compact light mode at 390px had no horizontal page overflow; regular dark mode also passed
visual inspection. No browser errors were recorded. Production Dev Bridge remained disabled;
physical touch and screen-reader speech were not exercised.

### Constrained fill and Range thumb separation, 2026-10-08

The linked Slider now fills from zero. Its fill stays visible at 35% colour strength outside the
allowed interval and full strength inside; the underlying full scale and constraint ticks remain.
Component coverage checks both portions and a collapsed interval without an available fill segment.

Fine-pointer Range thumbs keep their hit rectangles while their resting paint is slightly shorter.
Tight theme-surface shadows separate overlapping shapes. Hover enlarges paint to 115%; keyboard
focus and dragging use 125%, with dragging on top. Keyboard feedback is immediate and reduced
motion disables transitions. At collapsed endpoints, the handle that can move inward remains above
its neighbour, including when the other handle has keyboard focus.

All 277 DashStack tests passed; the expanded owning control tests and final stylesheet tests also
passed. Package checks, Motion policy, package build, and Lab production build passed. Live browser
checks verified both exposed edges of a 50–54 overlap could be dragged apart, constrained fill
colours and lengths, keyboard enlargement, and Compact/light rendering. Pointer drags also
reopened both 0–0 and 100–100 while the opposite handle had keyboard focus. Physical touch and a
live reduced-motion preference change were not exercised; the latter is covered by the CSS policy.

### Slider thumb separation from fill, 2026-10-08

Fine-pointer Slider thumbs now share the Range thumb's tight theme-surface shadow, keeping the
ticket shape distinct from a same-colour fill. Positive bipolar fill remains blue and negative
fill remains red. Hit geometry and motion are unchanged. All seven stylesheet tests and the
package and Lab production builds passed. Live browser checks covered positive and negative
values, dark rendering, and the light theme's white shadow; no browser errors were recorded.

### Application-owned order priority, 2026-10-08

DashStack exposes `useDashStackOrder()` for nearest-container committed order and
`useDashStackOrder('root')` for the containing Stack's root order. Both use the render path's
reconciliation and leave interpretation to the application. Component coverage exercises saved
order, pinned bands, dormant IDs, nested groups, preview/cancel, commit, external writes, and reset.
The package artifact test checks the public export.

The Lab derives Slider/Range priority from that snapshot. Slider above Range expands either
endpoint to accommodate its value; Range edits retain the higher Slider. Slider below Range is
constrained, and Range edits clamp it atomically. The marked Slider uses the same root priority.
Pure model coverage checks both directions and single-observation numeric transactions.

Live browser verification moved Slider across Range in both directions, expanded Range by setting
Slider to 100, confirmed a lower Range could not exclude it, then shrank the higher Range and
confirmed Slider clamping and endpoint limits. The marked Slider followed the same values.
No browser errors were recorded. Production Dev Bridge remained disabled; this run observed the
rendered controls and used public Nexus APIs in model/component tests.

### Planetary application lab, 2026-10-08

`/lab/planetary` demonstrates an application-owned solver through DashStack and Nexus. The Lab
adapts the existing planetary calculator's pure geometry and contact checks, with provenance and
scope documented beside the solver. Two reorderable targets rank reduction and tooth-size errors
lexicographically. Physical limits remain hard constraints; the resulting gear set is computed
from accepted values and committed order. No solution or priority copy is stored in Nexus.

Seven model tests cover source-default parity, priority differences, representative geometry
invariants under both priorities, and rejected-write closure. Scoped formatting, type/lint checks,
and the Lab production build passed. Desktop browser checks verified preview versus commit,
order-driven inference, infeasible input retention, discard recovery, feasible resizing, and reset.
At 390 CSS pixels, dark regular and light compact layouts had no horizontal overflow; group collapse
preserved the inferred result. No browser errors were recorded. Physical touch was not exercised.
Production Dev Bridge remained disabled; the development connector discloses only the design field
and planetary scope, with design writes allowlisted.

### Mirrored Range thumb chamfers, 2026-10-08

Fine-pointer Range thumbs now chamfer only the outer bottom corner, leaving the inner edge flat.
The endpoint shapes swap in RTL. The single Slider retains its symmetric tip; hit areas, focus
rings, overlap priority, and hover/drag scale are unchanged. This is a paint-only CSS refinement.
Seven stylesheet tests, scoped formatting, the DashStack package build, and the Lab production
build passed. Live browser checks confirmed opposite chamfers, unchanged Slider paint, and keyboard
changes for both Range endpoints. Regular dark and 390px compact light rendering were inspected,
with no horizontal overflow or browser errors. RTL and physical touch were not exercised live.

The follow-up extends each outer chamfer across the full thumb width, removing the bottom shelf
and restoring a point at the flat inner edge. Regular and compact dark rendering were checked in
the live Lab; seven stylesheet tests and both package/Lab builds passed without browser errors.

Range thumb translation now places the flat inner edge on the track value, shifting the hit area
and focus ring together. The painted thumb scales about that inner bottom corner. Live geometry
checks in regular and compact density put both inner edges within 0.01 CSS px of their track values;
focus used the opposing edge origins at 1.25 scale, and hover used 1.15 scale. Pointer dragging and
both keyboard endpoints remained functional. Seven stylesheet tests and package/Lab builds passed;
no browser errors were recorded.

The fine-pointer Range track now reserves the full 1.25-scale endpoint width plus spacing on both
sides. At 0–100, browser geometry confirmed both enlarged thumbs and focus outlines remain inside
the input column in regular and compact density. Endpoint keyboard operation still reaches 0 and 100. Seven stylesheet tests, scoped formatting, and package/Lab builds passed; no browser errors
were recorded.

### Local dogfood package delivery, 2026-10-09

Versioned snapshots contain Nexus, UI, DashPanel, DashStack, and the Picodash facade, with exact
internal versions, resolved catalog dependencies, licenses, an installer, and source/hash metadata.
Source package manifests retain their workspace versions. Dev Bridge is excluded.
See [the installation and feedback guide](../development/dogfooding.md).

`bun run dogfood:test` owns manifest normalization, unrelated-consumer configuration preservation,
update/rollback mapping, and corrupt/unsafe archive rejection. `bun run dogfood:check <bundle>
[alternate-bundle]` exercises actual tarballs in a temporary standalone consumer outside the
monorepo: installation, repeat installation, optional version switching and vendored rollback,
frozen reinstall, package version/path checks, public TypeScript consumption, a packed Switch
updating an application selector, and Vite/Next.js production builds with packaged CSS.
The executable component is owned by `packages/picodash/tests/dogfood`.

Package release checks and these consumer checks passed with Bun 1.4.0, React 19.3.0, Vite+ 0.3.1,
and Next.js 16.3.4. Interaction evidence is a DOM component test; these packaging checks do not
claim new rendered-browser evidence or stable support for every package API. Registry publication
and workspace consumer installation remain outside this delivery path.

### Application consumer recipes, 2026-10-09

The [application recipes](../development/consumer-recipes.md) use public package entrypoints and
application-owned helpers for a derived SVG, a fixed two-target priority group, and a compound
requested-design record. They do not add a planetary solver, general headless order resolver, or
external agent transport.

[The consumer tests](../../packages/picodash/tests/dogfood/designer.test.tsx) verify member-attributed
invalid drafts, preservation of accepted inputs, external-write staleness, committed UI/headless
priority agreement, canceled and no-op reordering, atomic root document restoration, persistence
reload, and failed-write recovery. These tests passed in the isolated tarball consumer alongside
repeat installation, version switching/rollback, frozen reinstallation, public types, and Vite/Next
CSS builds. This is DOM and package-consumption evidence, not rendered geometry or remote-agent proof.

[Discovery tests](../../scripts/dogfood/dogfood.test.mjs) verify that `dogfood:locate` resolves only
the committed recommendation and rejects unavailable or dirty snapshots. Snapshot `.2` includes the
recipes and their source examples; the public runtime APIs are unchanged from `.1`.

### Numeric target consumer recipe, 2026-10-09

The [NumberField target recipe](../development/numeric-targets.md) documents the public unbound
control adapter, unit formatting, accepted/achieved readout, and scalar versus record draft
boundaries. [Its DOM test](../../packages/picodash/tests/dogfood/numeric-target.test.tsx) verifies
incomplete text while editing, rejected numbers, null drafts, error association, read-only discard,
disabled input, and recovery. The fixture passed against installed `.2` tarballs outside the
repository with public typechecking and Vite/Next CSS builds. Snapshot `.3` adds this guide and
copyable source; runtime APIs are unchanged. Control-local incomplete text is not Nexus persistence.

### Consumer feedback corrections, 2026-10-09

The dogfooding guide's Tailwind host adapter was compiled with Tailwind 4.3.3 and checked in Chrome
using the public theme provider's rendered markup and packaged UI CSS. Inline aliases produced
dark canvas/text `rgb(16, 18, 22)` / `rgb(198, 204, 220)` and nested light canvas/text
`rgb(237, 240, 245)` / `rgb(52, 61, 80)`. A plain-alias counterexample produced a transparent canvas.

Designer and numeric examples now rely on the shell-owned discard action. Their owning consumer
tests require exactly one discard button and operate it. The default-priority import test now
restores an explicitly saved default source into an already reordered target, rather than testing
only fresh targets. Factories explicitly seed this application's business priority while preserving
hydrated order; general Nexus overlay semantics and runtime packages are unchanged.

A separate Chrome session verified native select-all/Backspace/Tab clearing in the standalone `.2`
consumer from accepted `1.5` and rejected `4`: empty input, missing-value error, one discard action,
and unchanged actual solution. The installed agent-browser empty-fill helper instead restored prior
text on blur in both Picodash and isolated React Aria. This is recorded as an automation-path caveat,
not a proven NumberField defect. All owned probe browser sessions were closed. The corrected
examples also passed the isolated `.2` consumer check, including types and Vite/Next CSS builds.
Snapshot `.4` bundles these corrections without changing public runtime code.

### Open-ended range consumer recipe, 2026-10-09

The [open-ended range recipe](../development/open-ended-ranges.md) composes public `RangeSlider`
and `Checkbox` controls over one atomic `{ min, max: number | null }` request. It preserves Any and
explicit finite intent as the feasible ceiling changes. The guide separates requested bounds,
finite presentation, and achieved solver output; it documents numeric thumb semantics and the
continuous nature of Slider `allowedRange`. Marks do not enforce a sparse feasible set.

[The DOM fixture](../../packages/picodash/tests/dogfood/open-count-range.test.tsx) verifies no-write
projection updates, endpoint edits, explicit Any selection, unavailable intent, and Infinity
rejection. It passed with public typechecking in the isolated `.2` tarball consumer, alongside
repeat/frozen installation and Vite/Next CSS builds. This is DOM and package-consumption evidence,
not screen-reader or engineering-solver validation. Snapshot `.5` adds the guide and copyable
example without changing runtime packages or the existing consumer application.

### Authored Dashlet emphasis, 2026-10-09

`band`, `glow`, and `tint` are independent boolean-or-CSS-color shell props, with three inherited
theme defaults falling back to the current accent. They have no status meaning or Nexus writes.
[The owning test](../../packages/dashstack/tests/emphasis.test.tsx) covers defaults, custom colors,
true-to-false updates, native wrapper preservation, unchanged canonical values, focus retention,
and validation draft/error relationships. Public type fixtures reject numeric emphasis amounts.
[The consumer fixture](../../packages/picodash/tests/dogfood/emphasis.test.tsx) exercises the facade
and bound control through installed packages.

Chrome inspection of the rebuilt Lab verified the three individual treatments and their combined
ready-made TextDashlet in dark/regular and light/compact modes. At 360px there was no page overflow.
The combined row retained its 2px focus outline and inset glow while another row was hovered. A
consumer-inherited band token resolved to `rgb(180, 70, 150)`; RTL placed the 3px band 2px from the
right edge. Theme-default bands resolved to dark `rgb(0, 133, 255)` and light `rgb(8, 104, 206)`.
The mechanical design scan reported no findings. Forced-colors suppression is stylesheet behavior,
not a screen-reader or forced-colors browser certification. The Lab examples are under More examples.

Snapshot `.6` is the first runtime release of these props. Older `.2`–`.5` snapshots remain immutable
and require an upgrade for this feature. No application consumer was upgraded by this change.

## Organizational subgroups and linked controls (2026-10-09 checkpoint)

ADR 0008 replaces leaf pinning with root-group pinning, adds one non-collapsible subgroup level,
and exposes mounted effective structure plus explicit reveal/focus. Nexus numeric gestures retain
canonical live edits with revision-fenced cancellation, binding-draft ownership and teardown.
Source-owned item attention stays ephemeral. TargetSlider separates editable targets from explicit
achieved-result states and independent marks; the achieved marker does not mutate values.

Owning evidence: `subgroups.test.tsx`, `target-slider.test.tsx`, `numeric-gesture.test.ts`,
`item-interaction.test.ts`, and the installed-consumer `LinkedControls.tsx` fixture. The .8 isolated
consumer passed repeat install, update/rollback, frozen reinstall, type checking, DOM interaction,
and Vite/Next CSS checks, including update/rollback against .7. Its clean source is
`c1f7fcd3a6d01d370922ee4cc7a78dbb798f69aa`.

The follow-up has 288 passing DashStack tests and 195 passing DashPanel tests. The existing phone,
standalone value-binding, and two-Panel Style Lab journeys pass. They cover editable TargetSlider
values, a stable accessible thumb name, held-key Escape rollback, an external write during a
gesture, reduced-motion achieved zero, label-free reference ticks, read-only/disabled controls,
and inner/outer overflow recovery. Numeric Panel widths now serialize as CSS pixels.

Maz reports real .7 designer adoption: shared target manipulation, Escape rollback, explicit
reveal/focus after reopening a Panel, preserved scope metadata, and desktop/390px/desktop
transitions with byte-identical saved scope JSON and restored docking. These are consumer-reported
checks, distinct from the repository browser journeys. Full touch-device and assistive-technology
acceptance remains open; modal drawers/sheets and rail/pop-out Dashlets remain unimplemented.

The .8 consumer found a documentation delivery gap: `linked-controls.md` existed in the bundle
but was absent from the installer copy list. The installer now discovers all bundled Markdown
guides. The isolated check compares installed guides and examples byte-for-byte and compiles the
vendored examples. It reproduces the missing-file failure against immutable .8; the correction
ships as .9 without rewriting .8.

Clean snapshot .9 (`d70648b39e3b53185b2f97a62580a905ffc72893`) passes the strengthened isolated
check, including installed guide/example byte equality, compiled installed recipes, repeat and
frozen reinstall, .8 update/rollback, component interactions and Vite/Next CSS builds. The runtime
UI is unchanged from .8; the production Lab was restored and its target/achieved rendering and
linked editing were inspected without browser errors.

### Panel-hosted short-height scroll preservation

Maz's .9 consumer found that intrinsic Panel measurement could clear the outer Stack's scroll
position after group expansion or keyboard focus. Geometry-only overflow checks did not prove
reachability. Panel measurement now preserves descendant horizontal and vertical scroll offsets
across its temporary intrinsic/minimum size probes. The existing two-Panel Style Lab journey
constrains the actual Panel boundary, tabs within its overflowing Stack, refreshes geometry, and
asserts that focus remains inside the visible scrollport. This regression failed before the fix
and passes after it; all 195 DashPanel tests also pass. Phone-sized Chromium inspection remains
separate from real touch-device and software-keyboard acceptance.

Snapshot .10 (`af789e8bcf0465f41905b4d5597fa11b337d7056`) contains this correction. Its release
gate and isolated consumer checks pass, including installed guides/examples, repeat/frozen
installation, .9 update/rollback, component interactions and Vite/Next CSS builds. Maz owns
independent adoption and verification in the planetary designer.

### Target comparison controls, 2026-10-09

TargetNumber adds editable Target and read-only Actual columns with configurable labels below and
a shared display-only suffix. TargetSlider places its editable unit-bearing input above the thumb;
its label is centered where possible, clamped inside track edges, and lifted during interaction.
Pending readouts keep their wording and result space stable. Dynamic-capacity compositions retain
independent numeric intent through `inputValue` and the existing numeric gesture factory.

Owning evidence: `packages/dashstack/tests/target-slider.test.tsx` covers binding edits, independent
actual results, zero/pending/no-fit/error, custom names, read-only policy, draft retention and honest
out-of-range values. The existing phone gallery journey checks endpoint/midpoint containment and
side-by-side field/label geometry. Desktop pointer inspection confirms the target label lifts 4px,
scales 1.06, and stays inside the right endpoint while the thumb scales 1.25. Light/compact and
390px layouts were visually checked. The package release gate and artifact checks pass after
merging main's dependency updates. The consumer's solver and delayed freshness indicator remain
application-owned.

Snapshot .11 (`f4063deff895ae7f33235266c0a34b394e6cc811`) passes the package release gate
and isolated consumption check, including installed guides/compiled recipes, repeat/frozen install,
.10 update/rollback, component interactions, and Vite/Next CSS builds. The production Lab is
restored. Planetary-designer adoption remains Maz-owned.

### Compact target input feedback, 2026-10-09

Snapshot .12 (`8a4da67ace3556880b0355cafe747f37c8a35c83`) refines TargetSlider styling without
changing its API or value behavior. The editable value uses the achieved marker's text-size token,
reduced vertical padding, and an accent bottom border joined to the thumb. Hover or focus on either
surface scales the field to 1.15 and the thumb to 1.25 together. Normal-flow positioning preserves
the join across field heights; coarse-pointer touch targets and reduced-motion behavior remain.

Desktop browser measurements confirm matching 10px text, a 19.5px field height, an exact resting
field-to-thumb join, and containment at the right track endpoint. The existing gallery browser
journey passes numeric editing, rollback, endpoint containment, read-only/disabled states and phone
layout. Motion checks, package checks and all 292 DashStack tests pass. The isolated consumer check
passes installed guides/compiled recipes, repeat/frozen installation, .11 update/rollback, component
interactions and Vite/Next CSS builds. The production Lab is restored; consumer adoption remains
Maz-owned.

### Authored slider endpoint detents and target edge alignment, 2026-10-09

Slider and SliderDashlet add optional startDetent/endDetent numeric stops. Their labels and meanings
remain author-owned. Pure/component evidence in `packages/dashstack/tests/detent-slider.test.tsx`
covers both endpoints, their combinations, RTL arrows, held-key boundary resistance, singleton and
nonaligned capacities, skipped numeric gaps, native accessibility edits, disabled/read-only policy,
Nexus Escape rollback, external-write ownership, changed capacity, hidden ancestors and reveal.
The DashStack suite passes 298 tests. Configuration errors fail explicitly; canonical mismatches
remain honest outputs without implicit repair.

The existing gallery browser journey exercises real pointer resistance, entry/exit at both stops,
keyboard parity and captured-pointer Escape rollback. Detent crossings alone use a stiff Motion
spring; ordinary numeric dragging remains direct and reduced motion removes the spring. The same
journey checks TargetSlider labels within their container after insetting the track by half the
enlarged thumb width, plus numeric entry and phone overflow. The installed linked-controls recipe
uses public startDetent props and a Nexus numeric validator. Snapshot verification is recorded after
packaging below.

Snapshot .13 (`d9aa4ddb60c518d0eab7ae9d897bcf6c5027845f`) passes the release gate and isolated
consumer check: installed guide/recipe equality, recipe compilation, repeat/frozen installs,
.12 update/rollback, component interactions, and Vite/Next CSS builds. Desktop visual inspection
confirms the minimum target label overlaps its enlarged thumb while both remain inside the input
column. The production Lab is rebuilt from the committed source. Consumer adoption remains Maz-owned.

### Presentation warning row geometry, 2026-10-09

Consumer feedback exposed a shared inline-layout defect: an active presentation warning was treated
as a trailing value, shrinking both the warning and the preceding paired control. Warnings now
occupy their own full control-width row; the trailing-value cap applies only without a warning.
The gallery browser regression failed before the correction (44px warning in a 153px control area)
and passes afterward, checking full-width TargetNumber fields and a warning below them. Ordinary
valid layout returns when the canonical value becomes representable again.

The focused TargetNumber component test independently accepts literal 2.9 at step 0.1 with no min,
min 0, or min 1.5, while actual 3.425 remains independent. No floating-point tolerance was added;
the consumer's original numeric warning is not reproduced without its exact canonical value.

Snapshot .14 (`3261039ad52a92e2d2b75ded8f4bee2727d6015e`) passes package release checks and
isolated consumption, including installed recipe compilation, repeat/frozen installation,
.13 update/rollback, component interactions and Vite/Next CSS builds. The source change is limited
to warning layout; numeric acceptance is unchanged. The Lab is rebuilt from that source.

### Dashlet band edge alignment, 2026-10-09

Dashlet bands now use two thin-border units (2px in the default theme) and align with the
shell's outer inline-start edge, outside the reorder handle background. Manual production-Lab
browser evidence checked light/dark themes and a 390px compact viewport. A temporary band
decoration on the gallery's reorderable Number row exercised the hovered-handle combination:
computed band width 2px, outer-edge offset 0px, and no overlap with the handle. The existing
non-reorderable band examples use the same shared selector. Screenshots were inspected; no
consumer application state was changed.

Snapshot .15 (`6980d7b4ecd4ed53dac974062532736a2aa0a482`) passes the package release gate and
isolated consumer checks: repeat/frozen installs, .14 update/rollback, installed recipe types,
component interaction and Vite/Next CSS builds. The production Lab uses the verified band CSS.

### Target result slot and author-owned pending feedback, 2026-10-09

TargetSlider now places no-fit, error, empty-pending and outside-scale feedback in the existing
achieved-readout area. It removes the separate reserved message line while retaining the marks row.
Long detail remains in accessible status text, associated with the numeric input and thumb; short
visual feedback remains visible. TargetNumber and TargetSlider public control-root data-result and
aria-busy hooks are documented, including an opt-in whole-Dashlet :has selector. No default busy
animation, tint, or visible calculating prose is added.

The existing target component suite passes 11 tests, covering unchanged input/marker identity on
pending with lastValue, exact busy/result attributes, no-fit/error detail association, and no
unintended value callbacks. A temporary browser fixture bundled the actual built public controls:
ready, pending with/without lastValue, no-fit, error and outside-scale values keep identical track
and following-row positions (97.5px marked regular height; 72.5px unmarked compact height). Input
focus remains intact throughout; feedback ends before reference marks. Dark desktop and light
390px compact screenshots were inspected. This is isolated-control browser evidence; consumer
application adoption remains Maz-owned. Adoption docs also explain explicit wrapper ID forwarding
and the runtime invalid-node-id diagnostic exposed by consumer integration.

Pointer verification also exercises the visible result text: its pointer-down is isolated from the
interactive track, so clicking No match preserves target 2.37 (the initial in-track version moved
it to 5). The full-message hover title remains available. This final correction changes no layout.

Snapshot .16 (`88a982797e9730621320e250a656c9b6138f9dec`) passes the package release gate and
isolated consumer install/repeat/frozen, .15 update/rollback, recipe type checks, interactions and
Vite/Next CSS builds. The Lab is rebuilt and restarted from that source.

### Flat target field/thumb join, 2026-10-09

TargetSlider removes the editable value field's lower corner radii (including the inner numeric
input/unit shell) and the thumb paint's upper radii. Other slider thumbs retain their existing
shape. Built-control browser inspection confirms 0px lower field/input and upper thumb radii during
hover, preserving the connected blue underline and existing focus/scale behavior. This refinement
is committed separately from the following reference-marker experiment so it can be retained.

### Experimental TargetSlider reference dots and stems, 2026-10-09

Marked TargetSliders replace ticks and the separate achieved arrow with fixed reference dots. An
exact actual-result match grows a stem to the readout; the previous stem retracts. Off-mark actual
values retain their exact position with a stem, and unmarked controls retain the arrow. This is a
presentation experiment isolated from the flat-join commit `9ddb26e`; reverting the experiment does
not restore the curved field/thumb join. Mark labels and accessible descriptions are preserved.

The target component suite passes 12 tests, including mark-node retention, binary-rounding matches,
pending lastValue, off-mark results, no-fit retraction, and unchanged value callbacks. The owning
DashStack check and motion policy check pass. A built-public-control browser fixture shows paired
grow/retract transforms across animation frames, completing in about 150ms without row-height
change (97.5px regular). Dots begin 2px below the track; a selected 10px stem reaches the readout.
Dark regular and light 390px compact screenshots were inspected. Reduced-motion stems switch with
0s transition duration. An RTL DOM-direction probe confirms marker/readout horizontal alignment;
it does not establish full React Aria locale-driven RTL interaction. These are isolated-control
checks; application adoption and feedback remain with Maz. The owned browser sessions were closed.

Snapshot .17 (`73b50ac44622ea0b583a08e4e6e4c2d430ae2af9`) passes the package release gate and
isolated consumer checks: repeat/frozen installs, .16 update/rollback, installed recipe types,
component interaction and Vite/Next CSS builds. The Lab production build also passes. The flat
field/thumb join is commit `9ddb26e`; the independently reversible marker experiment is `73b50ac`.

### Singleton TargetSlider domain, 2026-10-09

TargetSlider and its bound Dashlet accept equal finite bounds. A compatible singleton has a
stationary centre thumb with honest equal ARIA min/max/current values and read-only semantics;
it never enters React Aria's zero-span percentage calculation. Target, actual and mark positioning
also handle zero span explicitly. The numeric field remains mounted with the existing authored
readOnly/disabled policy, preserving independent intent. Incompatible targets retain their warning
without a fabricated thumb. No-fit and pending remain explicit application-owned result states.

The target suite passes 15 tests, including singleton no-op pointer/key events, pending/no-fit,
expansion and collapse focus restoration, retained input/control identity, incompatible values,
disabled tab order, and bound-control/locale parity without canonical writes. Owning formatting,
lint and types pass. Built-control browser inspection confirms 97.5px regular and 85.5px compact
marked row heights across the boundary. Pending/no-fit keep the same height. The flat label/thumb
join is 0px apart after correcting the stationary thumb's top alignment. A fresh browser session
confirms focused thumb transfer in both directions, unchanged singleton keys, and no browser errors.
Dark and light compact screenshots were inspected; all owned sessions were closed. Consumer
application adoption remains Maz-owned; no solver or consumer-private styling was changed.

Snapshot .18 (`d0b4cffc25087e39e80040ed53410335eb7a6800`) passes all package release checks and
the isolated consumer's repeat/frozen installs, .17 update/rollback, installed recipe types,
component interaction and Vite/Next CSS builds. The production Lab build also passes.

### Solid segmented selection, 2026-10-09

The moving SegmentedControl selection indicator now uses solid theme accent paint and accent-text
foreground. Selected segments retain neutral structural borders instead of an accent border that
can be occluded by a focused neighbouring segment in read-only mode. Keyboard focus outlines,
selection underline, React Aria motion and read-only behavior remain unchanged. Forced colors use
Highlight/HighlightText rather than fixed brand colors.

The owning formatting/lint/type check and build pass. A built-package browser fixture exercises
Ring/Sun/Carrier: clicking Sun in a read-only Ring group leaves Ring selected with its solid fill
intact and no write/error; editable pointer and arrow-key selection still reaches Carrier. Dark
regular and light 390px compact captures were inspected alongside disabled controls. Reduced motion
reports a 0s indicator transition. The owned browser session was closed and its process exited.

Snapshot .19 (`67fddcf6f1a2f2aceb05cc9bc45209d730842c98`) passes the package release gate,
including all 303 DashStack tests, and the isolated consumer checks: repeat/frozen installation,
.18 update/rollback, installed recipe types, interactions, and Vite/Next CSS builds. The Lab
production build passes with the same selection styling.

### TargetSlider alignment and marker slot motion, 2026-10-09

Resting target labels and achieved labels align with the unscaled endpoint thumb edges; the target
field scales inward at endpoints. Achieved readout offset follows its animated position instead of
jumping to the destination offset. Dots touch the track and its painted caps extend 2px beyond the
endpoint centres in regular density. Selected stems extend over 240ms with ease-out; the achieved
text is 8px below the track in regular density and 6px in compact density. Unmarked arrows retain
their clearance. Value coordinates, direct thumb motion and canonical data are unchanged.

Marker array indices deliberately identify visual slots. Changed values retain the same nodes,
added slots fade/move in from the right edge, and removed slots fade/move back there. Removing all
marks completes exits. Exiting dots immediately lose selection. Animation is 240ms and interruptible;
hidden groups and reduced motion snap. A live media-query subscription handles preference changes.

All 16 target tests pass, including replaced feasible sets, growth/shrink/empty/duplicate sets,
slot identity and absence of writes. Owning formatting/lint/types/build and motion policy pass.
A built-package browser fixture verifies partial-frame positions/opacities, settled counts, rapid
updates, empty-set exit/reentry, and live reduced-motion toggles. Regular dark and compact light
RTL captures were inspected. Endpoint label edges match resting thumbs within subpixel rounding;
390px viewport has no horizontal overflow. Browser errors are empty and the owned session closed.
Consumer application adoption remains separately verified by its owner.

Snapshot .20 (`67cb549e1ca82e5028b833188027ea2a141fe786`) passes the package release gate,
including all 304 DashStack tests, and isolated consumer repeat/frozen installs, .19 update/rollback,
installed recipe types, component interaction, and Vite/Next CSS builds. The production Lab was
built and restarted; its Target Bore input was edited to zero and the rendered joined field/thumb,
actual value, reference dots and caps were inspected without browser errors. The stylesheet contract
check now accepts shared selector lists while retaining its logical-offset and pointer-inert checks.

### Segmented spring and solid MultiSelect chips, 2026-10-09

The segmented underline is removed. React Aria still owns indicator placement; a CSS linear()
sampled damped spring supplies a small overshoot over two fast intervals (300ms by default).
No additional JavaScript or dependency import is needed. Existing focus-visible and reduced-motion
rules disable the transition. MultiSelect chips now use theme accent/accent-text with transparent
remove buttons, a light hover tint, disabled dimming, focus outlines and system-color overrides.

Owning formatting/lint/types/build and motion policy pass. Built-control browser evidence covers
read-only Ring/Sun clicks without writes, editable pointer/arrow-key selection, chip removal,
read-only chips without removal actions and disabled chip dimming. A pointer capture samples a
212.7px indicator movement through a small overshoot, settling to zero in 300ms. Keyboard and
reduced-motion transition durations are 0s. Dark and light compact presentation was inspected at
390px width; browser errors are empty. Owned sessions were closed and their process exits checked.

Snapshot .21 (`98ee03bf362ddc4aaaa5c6d10827046fc336e32d`) passes all package release checks
(including 304 DashStack tests) and isolated consumer repeat/frozen installs, .20 update/rollback,
types, component interactions and Vite/Next CSS builds. The Lab production build passes; the live
light compact gallery at 390px shows solid blue chips and no segmented underline without overflow
or browser errors. Source changes in this snapshot are CSS and documentation only.

### Bore track and target-label join (2026-10-09)

Detent Slider and SliderDashlet now show a connected, dimmed detent gap, endpoint dots and a
formatted readout beneath the thumb. The default start-detent bore has three dots; singleton
minimum/maximum deduplicate. Tests cover readout placement, bound formatting, sentinel labels,
no duplicate badge and no presentation writes. Existing keyboard, cancellation and ownership
tests pass. TargetSlider computes its scaling origin from the two clamped label positions.

Built-package browser checks verify Off/min/intermediate/max, regular and compact RTL, singleton
dots, reduced motion, and 390px width without horizontal overflow. Target input and painted thumb
edges meet at minimum/maximum through hover scaling (within 0.02px rounding); centre focus stays
centred. Label bottom and thumb top remain joined. Browser errors are empty. The firmer detent
spring settles a 24px transition in about 110ms in the recorded browser run, within 0.5px at 76ms.
Keyboard entry into Off still works. Owned browser sessions were closed and their processes exited.

Snapshot .22 (`186734df358bc1b8a533e856d001932a8a789ebf`) passes the complete release gate,
including all 306 DashStack tests. The isolated consumer passes install, repeat/frozen reinstall,
.21 update/rollback, types, component interaction and Vite/Next CSS builds. The rebuilt Lab serves
the new controls; live Home-to-Off and editable target-at-minimum checks pass, with the calculated
10px origin, no horizontal overflow or browser errors. Snapshot recommendation is updated only
after these checks. Consumer application adoption remains owned by Maz.

### Range detents and compact target feedback (2026-10-09)

RangeSlider and RangeDashlet accept start/end detents on their corresponding thumbs. The native
two-thumb control retains ordering, per-end accessible values, numeric-only track clicks and
fresh-press keyboard entry into a detent. Whole-record gestures use the same Nexus revision and
binding ownership as numeric gestures; Escape cannot overwrite an intervening external write.
The installed open-ended range recipe maps a finite UI sentinel to canonical null atomically.

Ordinary Slider and RangeSlider add paint-only spring settling when individual steps span at least
8px. Detent transitions use the same stiff spring. Fine continuous steps stay direct, and reduced
motion disables settling. A browser sample of a stepped Range settles within 0.5px by 88ms and
reaches zero by 121ms. Native pointer entry into Any and RTL keyboard exit back to 12 were verified.

TargetSlider no longer reserves both ordinary marker-label space and achieved-readout space.
Dot-only fixtures measure 68px high with 4px below the actual readout; visible marker captions retain
a separate row (86px total, 4px clearance). TargetNumber Actual has a transparent background and
only a bottom border. Built-control dark and RTL captures were inspected, including 390px width
without horizontal overflow. Owned browser sessions were closed and their process exits checked.

The complete package release gate passes (476 Nexus, 40 Dev Bridge, 81 UI, 310 DashStack,
195 DashPanel and 16 facade tests). The production Lab build passes. Live Lab keyboard End enters
Any (13), ArrowLeft returns to 12, and the Actual border computes to 0/0/1px with a transparent
background. At 390px there is no horizontal overflow. The fresh live browser reports no errors;
its owned session closes successfully.

Snapshot .23 (`9ea29d052bcf459249cda5f4dec76e477b6c851d`) is clean and immutable. Isolated
consumer checks pass repeat/frozen installation, .22 update/rollback, installed recipe types,
component interaction and Vite/Next CSS builds. The recommendation advances after those checks;
consumer application adoption remains owned by Maz.

## Detachable groups (2026-10-10)

[ADR 0009](../adr/0009-detachable-groups.md) adds one session-only Panel per opted-in labelled root
group. The primary integration owner is
[`detachable-groups.test.tsx`](../../packages/picodash/tests/detachable-groups.test.tsx): retained
editor/draft identity, immutable logical membership and values, remembered collapse, actual host
visibility/reveal, responsive return, source teardown, Strict Mode, pins, independent hosts and the
transition reducer. The three affected package release checks pass: DashStack 310 tests, DashPanel
195 tests, Picodash 22 tests, plus declarations, builds and package artifact contracts.

The detachable journey in [`reordering.spec.ts`](../../apps/lab/tests/reordering.spec.ts) proves
native pointer capture handoff after vertical preview, Escape rollback, settled position, home-drop
feedback/return, keyboard focus, retained DOM identity, disclosure and responsive fallback. Manual
Lab inspection covers the relocated grid and both themes. Motion policy, Lab types and production
build pass. Desktop fine-pointer support is intentional; mobile sheet detachment, cross-Stack
transfer and nested detachable groups are outside this contract. See the public
[usage and lifecycle](picodash.md#detachable-groups), including the post-hydration content mount.

Snapshot `0.1.0-dogfood.24` is built from clean source `e9dd7b623f518a88de855bd60d1bcec9cab045c3`.
The full six-package release gate passes 1,124 tests. Its isolated consumer verifies repeat install,
`.23` rollback and `.24` reinstall, frozen installation, declarations, the shipped detachable
example's retained bound control, and Vite/Next production CSS builds. The recommendation is
updated only after those checks; the external app is not modified.

### Local pinning and sticky lanes (2026-10-10)

Local ordering partitions and keyboard boundaries are covered by
`packages/dashstack/tests/subgroups.test.tsx`; the existing ordering model owns reconciliation.
The control-desk journey in `apps/lab/tests/reordering.spec.ts` covers subgroup pointer boundaries,
all four root sticky modes, retained controls during mode changes, and the outer overflow fallback.
The API extends the source after dogfood `.25`; no older immutable bundle gains this behavior.

### Dogfood .26: local ordering pins and sticky lanes (2026-10-10)

Clean snapshot `0.1.0-dogfood.26` records source commit
`453a99a96f6f71f1cce5e6c128d3d3cd70e13b26`. The six-package release gate passes 1,128 tests.
The isolated consumer passes 13 tests, public type checks, repeated and frozen installation,
`.26` to `.25` rollback and `.26` reinstall, and Vite/Next production CSS builds. The shipped
`SubgroupPriorities.tsx` exercises subgroup pins and the Stack sticky policy through installed
public packages. The recommendation advances only after these checks pass.

### Dogfood .27: draggable subgroup header spacing (2026-10-10)

Clean snapshot `0.1.0-dogfood.27` records source commit
`85a2767be0dff2579ee480c5e4a2ddaf16f2aa52`. Non-collapsible draggable headings no longer reserve
an empty disclosure column. The control-desk browser journey verifies title/row-label alignment
at desktop and 390px viewport widths alongside reordering and sticky-lane behavior.
The release gate passes 1,128 tests. Isolated consumer installation, rollback to `.26`, reinstall,
13 consumer tests, public types, and Vite/Next production CSS builds pass.

### Range actual results and thumb focus (2026-10-10)

RangeSlider and RangeDashlet expose an independent optional result and result formatter.
`range-result.test.tsx` owns result states, bounds independence, detent results, bound forwarding,
and the regression where release clicks redirected End focus to Start. Shared marker extraction
retains the existing TargetSlider tests and reduced-motion behavior.
The control-desk browser journey checks result geometry at 390px and 1280px and real pointer
press/release followed by keyboard input on ordinary and detent Slider/Range controls: no pointer
focus ring, retained active endpoint, and a keyboard focus ring. The OpenCountRange consumer recipe
uses the inline actual result without a separate result Dashlet. Package checks, focused tests,
Lab production build, and the browser journey pass. The bridge-dependent phone journey could not
run against the production Lab because its private development-bridge file is absent.

### Dogfood .28: Range results and thumb focus (2026-10-10)

Clean snapshot `0.1.0-dogfood.28` records source commit
`847a210cb70dd0405d251934f316b23392177144`. All 1,134 release-gate tests pass, including
317 DashStack tests. The isolated consumer passes 13 tests, public type checks, repeated and
frozen installation, `.28` to `.27` rollback and `.28` reinstall, and Vite/Next production CSS
builds. The shipped OpenCountRange recipe consumes the inline result through installed public
packages. The recommendation advances only after these checks pass.

### Workspace-edge panel recipe (2026-10-10)

The dogfooding guide now includes a measured workspace below an app header, inherited 12px
insets, a zero-inset Hybrid full-left Panel, tuple forms, and saved-placement/default-reset
semantics. Its code matches `tests/dogfood/WorkspacePanel.tsx`, checked against public exports
with the installed TypeScript compiler. Facade checks and the five packaging tests pass. Future
snapshot packing and isolated consumer typechecking include the fixture. The immutable `.28`
bundle and current release recommendation are unchanged; this is documentation and example work,
not new runtime behavior or new rendered-browser evidence.

The recipe also enables four corner docks plus full-left/full-right at the Provider, lets the
main Panel inherit that policy, and narrows a Candidates Panel to the full sides. It documents
Provider maximum versus Panel narrowing, corner height caps, quarter-zone drag targeting, and
app-owned canvas readout clearance. The expanded fixture passes TypeScript checking; the 37
existing dock-arena, drag-intent, and dock-policy tests pass. This adds no runtime behavior.

### Docked reveal focus and document scrolling (2026-10-10)

Minimize/Reveal control focus transfers use `preventScroll` so focusing a retained Panel during
its offscreen translation does not request scrolling to that transient position. The existing
DashPanel component test asserts both focus options; all 41 component tests pass. The Lab placement
specimen now exposes a public Document portal choice, and the existing phone placement journey
checks pointer and Enter reveal at a viewport-flush right boundary, sampling document scroll each
frame and on scroll/focus events through the transition while asserting Minimize receives focus.
That Chromium journey and the Lab production build pass. The reported in-app-browser lurch was
not reproduced in Chromium before the fix; this is regression coverage, not a claim of a failing
Chromium reproduction or a fresh in-app-browser verification. The consumer guide distinguishes
portal clipping, focus scrolling, and transformed versus settled dock geometry. No new dogfood
snapshot was created; `.28` remains immutable and does not contain this fix.

### Disabled segmented option presentation (2026-10-10)

Segmented options now apply the shared disabled-opacity token to the visible segment rather than
only styling the hidden legacy marker. Disabled selected options retain their selection indicator;
read-only options retain normal emphasis. Forced colors uses system GrayText and a selected outline
without opacity dimming. The gallery includes an individually disabled segment. The existing long
control-desk browser journey verifies light/dark computed styles, selected and whole-group disabled
states, read-only distinction, keyboard skipping, and forced colors; its screenshots were visually
reviewed. All eight stylesheet tests and the Lab build pass. The source and live Lab include the
fix; dogfood `.28` is unchanged and does not include it.

### Hidden Panel mutation feedback (2026-10-11)

DashPanel's root layout observer compares each attribute's first old value with its settled
value at delivery. Temporary intrinsic-measurement style/hidden writes and unchanged controlled
input attributes no longer trigger another geometry measurement. Genuine attribute changes,
child changes and text changes remain observable. This preserves hidden Panels and their dock
reservations without treating probe writes as application layout changes.

The native MutationObserver regression in `packages/dashpanel/src/portal.test.tsx` fails before
the fix with 18 unnecessary geometry reads and passes afterward. All 196 DashPanel tests and
owning formatting, lint and type checks pass, including hidden corner width, inherited styles,
portal relocation and retained content. In an isolated Gearset Designer production build, the
reported eight-planet document reproduces a freeze when Canvas hides both Panels after Preview
cycles. A paused Chromium stack identifies root-observer geometry work; two observers deliver
hundreds of callbacks without another rendered frame. The fixed build completes Preview cycles,
hide-both, hidden-boundary resize and alternating reopen at 1280, 1000 and 390px, without the
bounded diagnostic guard intervening. A second replay with native observers and no guard also
completes at all three widths, without browser errors. The original report of freezing on Preview expansion alone
has not been reproduced; it is not claimed as the same confirmed trigger.

Clean snapshot `0.1.0-dogfood.30` records source `c4c5aba2472b95f89bf5c1da0442f1e0cbbd7baa`.
All 1,135 package release tests pass. Isolated repeat/frozen installation, update/rollback with
`.29`, 13 consumer tests, public types and Vite/Next CSS builds pass. The actual installed `.30`
tarballs also complete the Gearset Designer freeze sequence at all three viewport widths using
native observers, with no browser errors. The consumer source and live preview remain Maz-owned.

### Settled layout events and initial dock geometry (2026-10-11)

DashPanel filters paint-only transition properties and unrelated event origins before measuring.
A relevant event is handled once per affected Panel across its capture targets. Content layout,
font size, custom properties, image loads, unknown animations, composed shadow content and
ancestor transforms remain observable. Paint-only ancestor motion does not cancel dragging.
Hidden inherited-context changes now perform one intrinsic/minimum measurement pair, rather than
falling through to repeat the same work. Dock allocation motion waits for positioned geometry
measured against the resolved boundary; provisional viewport measurements while a declared
boundary ref mounts cannot become animation baselines. Later allocation changes still animate.

All 198 DashPanel tests and owning checks pass. Regressions fail before their fixes: one fill-opacity
event causes 14 boundary reads, one hidden inherited change measures each Panel four times instead
of twice, and initial docking requests a translation from an unpositioned rectangle. The motion
test verifies initial and mounting-boundary transitions do not animate, followed by a real
allocation change that does.

The same Gearset Designer production fixture (80mm, 58/30/118 teeth, eight planets, 1920x1200)
was measured with the same automated hover and real fill-opacity transitions. Baseline `.30`
normal/repeat p95 frame gaps were 233/217ms paused, 250/233ms playing and 433/417ms with panels
hidden. The candidate's normal/repeat samples are 16.7–16.8ms across all scenarios, with at least
300 transition events and unchanged solve IDs per sample. Captured settled-handler time falls
from 2.75–5.17 seconds per sample to 0.2–0.7ms. These are local Chromium measurements, not a
hardware-independent performance guarantee. The unchanged fade remains enabled.

A saved top-right startup capture at 1280x800 records 97 frames at x910/y63, 370x469.33px, with
no startup animation. Before the fix the first painted Panel was translated far outside the
boundary. This proves the captured Chrome startup path; a separate report of two flights in the
in-app browser is not independently reproduced.

Clean snapshot `0.1.0-dogfood.31` records source `2aca6ddbc9a15f48a72a2ee2a519083515465398`.
All 1,137 package tests and release checks pass. Isolated repeat/frozen installation, `.30`
update/rollback, 13 consumer tests, public types and Vite/Next CSS builds pass. The installed
shipping tarballs repeat the hover benchmark at 16.8ms p95 in every unsuppressed phase, with
324–648 real transition events and unchanged solves. The shipping startup capture also starts
and remains at the final top-right geometry without animation. Owned browser sessions and the
isolated preview are closed; live consumer adoption remains with Maz.

### Compact slider paint on touch devices (2026-10-11)

Coarse-pointer Slider, Range, TargetSlider and detent thumbs retain 44x44px interaction envelopes
but paint only the compact pointed shapes. Range flat edges align at the value in LTR and RTL.
Target fields attach to the painted thumb; track endpoint insets still reserve the touch area.
Fine-pointer geometry is unchanged.

Gearset Designer on dogfood .31 reproduced the reported squares with real coarse-pointer
emulation: all six thumb pseudo-elements measured 44x44px with no clip. Applying the built
candidate stylesheet gives 12x18px Slider and 12x16px Range paint inside unchanged 44x44px targets.
A CDP touch drag beginning 15px outside the painted thumb changed the bore from 9.8 to 15.5.
LTR/RTL inner-edge alignment and restored desktop 12px thumb geometry pass. A 390px capture
verifies target-field attachment and readout placement under reduced motion. This is Chromium
touch emulation, not physical-device or Dia verification.

The existing phone gallery journey now asserts compact clipped paint independently from its
44px hit targets. Those assertions pass against the rebuilt production Lab; the later journey
cannot complete without the development host's .picodash/dev-bridge.json. The unrelated Themes
journey stops earlier at a pre-existing fixed-panel boundary assertion. Owning stylesheet tests,
formatting, lint, types and package/Lab builds pass.

Clean snapshot `0.1.0-dogfood.32` records source `6f8ea56ee82634d41bf0faa1a988e224671e7d23`.
All 1,137 package release tests pass. Isolated repeat/frozen installs, .31 update/rollback,
13 consumer tests, public types and Vite/Next CSS builds pass. The packed DashStack stylesheet
has the same SHA-256 as the built stylesheet used for the touch/RTL/desktop browser checks.
The owned browser session and its processes exited. Live Gearset Designer adoption remains
with Maz.

### Compact numeric fields on touch devices (2026-10-11)

NumberField keeps its existing native input and editing behavior. The shell supplies a transparent
44px touch perimeter that focuses the input when tapped, while the numeric face uses 32px and
TargetSlider's attached face uses 28px (or larger theme geometry). The unit suffix focuses the
same input. Disabled inputs remain disabled. TargetSlider expands this perimeter upward, keeping
the slider thumb below available for dragging. TargetNumber's Actual output keeps its bottom
border and matches the compact target height. Fine-pointer sizing and font sizes are unchanged.

The owning TargetNumber test verifies shell/suffix focus, no value write on focus, and disabled
refusal. An isolated Gearset Designer production build at 390px with actual coarse-pointer
emulation verifies the native input receives focus from a touch seven pixels above the visible
attached field, followed by a successful 4.4 edit. Rendered attached shells measure 27px plus the
2px accent border; standalone numeric input/TargetNumber faces measure 32px, and the invisible
perimeters remain 44px. No page errors were observed. The 17 target-control tests and owning
formatting/lint/types pass.

The consumer's .32 adoption confirms six 44px thumb hit targets with compact clipped paint and
outside-paint touch dragging. Its production CSS processor rewrites native :dir selectors into
language selectors, so an English-language document switched to dir=rtl does not receive RTL
thumb paint there. The prior native package-stylesheet RTL proof does not establish that consumer
build seam; it remains open separately from the mobile size corrections.

Clean snapshot `0.1.0-dogfood.33` records source `f16fbdb036d69e1f6f3854d684345fbfca9a4b88`.
All 1,138 package release tests pass. Isolated repeat/frozen installs, .32 update/rollback,
13 consumer tests, public types and Vite/Next CSS builds pass. The candidate test preview and
owned browser processes exited. Live designer adoption remains with Maz.

### Detachable group action icons (2026-10-12)

The home heading uses Lucide `picture-in-picture-2` while inline and `picture-in-picture`
while detached. Existing Detach/Show accessible names and return behavior are preserved.
The facade stylesheet sizes both icons with the shared medium icon token; Lab imports that
stylesheet so its integration-owned styles are exercised. Picodash's 25 owning tests,
lint/types, artifact checks and production Lab build pass. A rendered browser round trip
verifies both SVG identities, 16px theme sizing and restoration of the inline icon after return.

Clean snapshot `0.1.0-dogfood.34` records source `f5f1d9686f2a0380c1704c09b2e41e10e190d0ab`.
All 1,138 package release tests pass. Isolated repeat/frozen installs, .33 update/rollback,
13 consumer tests, public types and Vite/Next CSS builds pass. The owned browser session and
its processes exited. Live designer adoption remains with Maz.

### Detach gesture return and retained-content activation (2026-10-12)

The initial pull now distinguishes leaving home and previewing return before release. It can
return in one gesture, while Escape still restores inline presentation from every provisional
state. Panel activation uses the nearest physical Panel for native pointer/focus events so a
retained editor's original React ancestor cannot raise the source over its detached host. React
activation remains available for overlays outside Panel surfaces. The integration host supplies
`picture-in-picture` for Return; the retained home uses `app-window-mac` for Show panel, and
inline Detach retains `picture-in-picture-2`.

Two focused regressions reproduced the original activation and transition failures before the
fix. All 27 Picodash and 198 DashPanel tests pass, with owning lint/types and a production Lab
build. The existing detach browser journey passes with same-gesture return and Escape during
return preview, plus retained editor/order, settled return and responsive fallback assertions.
An isolated Gearset Designer copy using the candidate packages and an enabled detachable
Geometry group verifies a real Tooth size reorder over Configuration: order changes while the
detached host remains active at z-index 10 above the source at 0. All three icon placements and
button return pass; no browser page errors occurred. This is candidate-preview browser evidence,
not a claim of live designer adoption.

Clean snapshot `0.1.0-dogfood.35` records source `7cd0fef407dbd4f4c126a638aeb6dae7a2245891`.
All 1,140 package release tests and 13 isolated consumer tests pass, along with repeat/frozen
installation, .34 update/rollback, public types and Vite/Next builds. The candidate preview and
owned browser processes exited. Live designer adoption remains with Maz.

### Unlabeled block placement (2026-10-12)

A block shell without a rendered label uses one initial grid row, with content in column two
on row one beside the affordance. Labeled/help-heading blocks retain their second content row.
The existing accessible-name requirement is unchanged. Owning formatting/lint/types and build
pass. In an owned browser on Gearset Designer, loading the built candidate stylesheet moves the
unlabeled Playback content from row two to row one and from a 35px to 5px top inset; its shell
shrinks from 104px to 74px. The labeled block remains on row two. This is candidate-stylesheet
proof, not live deployment.

Clean snapshot `0.1.0-dogfood.36` records source `e37dab353638afa41cb2d1e9572354b149a9b4a2`.
All 1,140 package release tests and 13 isolated consumer tests pass, including repeat/frozen
installation, .35 update/rollback, public types and Vite/Next builds. The owned browser exited.
Live designer adoption remains with Maz.

### Sticky footer, header click and button transfer feedback (2026-10-12)

Populated sticky end lanes remove the root list's 3px trailing padding. An owned browser on
Gearset Designer verifies the gap from the end band to the list bottom changes from 3px to 0px
with the built candidate stylesheet, preserving sticky positioning. Detachable header clicks
toggle collapse once when movement stays below the drag threshold; grip/action clicks remain
independent.

Button transfers use an actual-Panel 240ms Motion transform, with proportional scaling and no
duplicate editor. Return has an explicit transient phase, completing on arrival, interaction or
a reduced-motion preference change. Motion setup now runs after parent refs attach; previously
the feedback controller could remain absent because its child layout effect ran too early.
The existing native-browser detach journey verifies both live compositor flights, header
collapse/expand, retained drafts, drag cancellation, one-gesture return, collapsed restoration,
reduced-motion interruption and mobile fallback. It passes against the production Lab. A paused
midpoint verifies visible translation without vertical text distortion. Owning types/lint/build
and all 27 facade tests pass.

Clean snapshot `0.1.0-dogfood.37` records source `a2608ca280135aa0022bd9eeb786e036bfe01249`.
All 1,140 package release tests and 13 isolated consumer tests pass, including repeat/frozen
installation, .36 update/rollback, public types and Vite/Next builds. The owned browser exited.
Live designer adoption remains with Maz.

### Foreground scroll cues (2026-10-12)

The shared scroll-fade stylesheet adds a 10×6px foreground triangle centred in each faded edge,
pointing toward unseen content. Parent pseudo-elements anchor to the actual scrollport outside
its mask, ignore pointer input and add no layout space. Local anchor/timeline scopes isolate
nested and adjacent scrollers. The progressive enhancement needs CSS anchors and scroll
timelines; unsupported anchors retain the existing fade. Forced colors use CanvasText.

An owned browser on the designer verified start, middle, end and overflow removal against the
candidate stylesheet, including the foreground colour and pointer pass-through. The existing
phone boundary-contraction journey now verifies the same cue states and forced-colors behavior
against the rebuilt production Lab. Its start-fade assertion now accepts overflow shorter than
the existing 96px fade range. The journey passes, as do all 81 owning UI tests and type/lint checks.
Motion policy and the design detector pass; the owned browser exited.

Clean snapshot `0.1.0-dogfood.38` records source `e88f703c962ac57fb8e9a56b7a2e2dc78e162d7b`.
All 1,140 package release tests and 13 isolated consumer tests pass, including repeat/frozen
installation, .37 update/rollback, public types and Vite/Next builds. Live designer adoption remains
with Maz.

### Detachable group header hover parity (2026-10-12)

The group-header hover rail now reaches the immediate content list through the detachable
home/surface wrappers, preserving the same first-column highlight as ordinary groups in both
text directions. It does not broaden hover styling to nested lists or detached surfaces.
The existing retained-group browser journey verifies hover entry/exit before detachment and
after reattachment, alongside its draft, focus, drag and reduced-motion checks. It passes
against the rebuilt Lab; a candidate stylesheet in the designer confirms the visible rail.
DashStack types/lint and the design detector pass. The owned browser was closed.

Clean snapshot `0.1.0-dogfood.39` records source `a59787c1aaacc9606e585d36ce78c1defb7cd660`.
All 1,140 package release tests and 13 isolated consumer tests pass, including repeat/frozen
installation, .38 update/rollback, public types and Vite/Next builds. Live designer adoption remains
with Maz.
