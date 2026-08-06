# Contract conformance matrix

This reference maps target contract areas to one primary verification owner. It prevents test bloat
by proving related invariants together and using E2E only for behavior that requires a browser.

## Status

> Contract: Accepted
> Implementation: Partial
> Evidence: Store Phase 1 kernel tests and package artifact checks.

An empty evidence cell means “not yet reconciled,” not “untested prototype.” Prototype tests may be
linked only after their assertions are confirmed to prove the target behavior.

## Evidence rules

1. One contract area has one primary owner.
2. Higher layers prove integration without repeating lower-layer matrices.
3. A regression expands the primary invariant test unless the failure depends on a browser seam.
4. `Implemented` requires code; `Verified` requires linked passing evidence.
5. Deleted or revised contracts lose obsolete tests in the same cutover.
6. E2E count and runtime are budgets, not coverage goals.

## Store

| ID            | Contract area                                     | Primary evidence                                                                                                                                                                   | Status    | Evidence                                                                                                                             |
| ------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| STORE-FIELD   | Canonical definitions and nominal handles         | [packages/store/tests/kernel.types.test.ts](../../packages/store/tests/kernel.types.test.ts) and [packages/store/tests/kernel.test.ts](../../packages/store/tests/kernel.test.ts)  | Verified  | [kernel.types.test.ts](../../packages/store/tests/kernel.types.test.ts), [kernel.test.ts](../../packages/store/tests/kernel.test.ts) |
| STORE-JSON    | JSON validation, clone, freeze, equality          | Property-based pure tests                                                                                                                                                          | Verified  | [packages/store/tests/json.test.ts](../../packages/store/tests/json.test.ts)                                                         |
| STORE-TX      | Data-only snapshots and atomic commands           | [packages/store/tests/kernel.test.ts](../../packages/store/tests/kernel.test.ts)                                                                                                   | Verified  | [kernel.test.ts](../../packages/store/tests/kernel.test.ts)                                                                          |
| STORE-ERROR   | Portable structured issues and contract errors    | [packages/store/tests/kernel-issues.test.ts](../../packages/store/tests/kernel-issues.test.ts)                                                                                     | Partial   | [kernel-issues.test.ts](../../packages/store/tests/kernel-issues.test.ts)                                                            |
| STORE-SCOPE   | Canonical views and scope lifecycle               | [packages/store/tests/scope-metadata.test.ts](../../packages/store/tests/scope-metadata.test.ts); canonical identity, invalid-ID privacy, shared values/fields, scoped attribution | Partial   | scope views and snapshots implemented; populated interaction state and destruction remain planned                                    |
| STORE-META    | Built-in records and lazy durable scope state     | [packages/store/tests/metadata.test.ts](../../packages/store/tests/metadata.test.ts), [scope-metadata.test.ts](../../packages/store/tests/scope-metadata.test.ts)                  | Verified  | immutable codec plus atomic root/scoped authoring, no-op detection, pruning, and target-only notifications                           |
| STORE-ENTITY  | Entity uniqueness and host affinity               | Model-based registration tests                                                                                                                                                     | Planned   | —                                                                                                                                    |
| STORE-GRAPH   | Declarative relationships, parents, cycles        | Generated graph invariant tests                                                                                                                                                    | Planned   | —                                                                                                                                    |
| STORE-RUNTIME | Declarative leases and transient product channels | Model lifecycle and subscription tests                                                                                                                                             | Planned   | —                                                                                                                                    |
| STORE-BINDING | Drafts, aliases, conflicts, cleanup               | Pure interaction state tests                                                                                                                                                       | Prototype | —                                                                                                                                    |
| STORE-REPAIR  | Explicit repair plans and stale-plan rejection    | Table-driven transaction tests                                                                                                                                                     | Prototype | —                                                                                                                                    |
| STORE-RESET   | Explicit reset domains and shared-field effects   | [packages/store/tests/scope-metadata.test.ts](../../packages/store/tests/scope-metadata.test.ts)                                                                                   | Partial   | DashPanel and DashList metadata reset evidence; registered-value reset remains planned                                               |
| STORE-ADAPTER | External ownership and unhealthy snapshots        | Adapter contract tests                                                                                                                                                             | Prototype | —                                                                                                                                    |
| STORE-PERSIST | Envelope, hydration, conflict, pending writes     | Pure driver tests; one browser-storage seam                                                                                                                                        | Prototype | —                                                                                                                                    |
| STORE-DIAG    | Operational diagnostics and runtime inspection    | Pure state and privacy-boundary tests                                                                                                                                              | Planned   | —                                                                                                                                    |
| STORE-MIGRATE | Version chains and quarantine                     | Pure document/migration tests                                                                                                                                                      | Planned   | —                                                                                                                                    |
| STORE-DOCS    | Export/import policy and atomic plans             | Document/property tests                                                                                                                                                            | Prototype | —                                                                                                                                    |
| STORE-REACT   | Context, hooks, selector equality                 | React component/type tests                                                                                                                                                         | Prototype | —                                                                                                                                    |
| STORE-LIFE    | Destroy and use-after-destroy                     | Pure lifecycle tests                                                                                                                                                               | Planned   | —                                                                                                                                    |
| STORE-CAP     | Conditional identity and capability typing        | Compile-time configuration tests                                                                                                                                                   | Planned   | —                                                                                                                                    |
| STORE-PACKAGE | Public, React, and integration entry contracts    | [Store package artifact checker](../../packages/store/tests/package-artifacts.mjs)                                                                                                 | Partial   | [package-artifacts.mjs](../../packages/store/tests/package-artifacts.mjs)                                                            |

Store suites should use generated models for scope graphs, transaction batches, document mappings,
and persistence records instead of adding separate hand-written tests for every combination.

## Shared UI foundation

| ID         | Contract area                               | Primary evidence                              | Status  | Evidence |
| ---------- | ------------------------------------------- | --------------------------------------------- | ------- | -------- |
| UI-THEME   | Theme/density resolution and attributes     | Component tests; one media-query E2E seam     | Planned | —        |
| UI-OVERLAY | Portal inheritance, layer order, a11y       | Component tests; one nested-overlay E2E seam  | Planned | —        |
| UI-BUTTON  | Variants, sizes, press, disabled, pending   | Component accessibility and interaction tests | Planned | —        |
| UI-DIALOG  | AlertDialog composition, focus, dismissal   | Component accessibility and interaction tests | Planned | —        |
| UI-MENU    | Commands, submenus, confirmation, focus     | Component accessibility and interaction tests | Planned | —        |
| UI-TOOLTIP | Timing, trigger semantics, touch boundary   | Component accessibility and interaction tests | Planned | —        |
| UI-HEADER  | DashHeader slots, order, root ref, and DOM  | Component accessibility and type tests        | Planned | —        |
| UI-CHROME  | Generic primitive semantics and behavior    | Component accessibility and interaction tests | Planned | —        |
| UI-CSS     | Public token and structural CSS inventory   | Static CSS and artifact contract tests        | Planned | —        |
| UI-PACKAGE | Public props, exports, and stylesheet entry | Positive/negative type, artifact, build tests | Planned | —        |

Shared UI tests prove product-neutral contracts once. DashPanel and DashList tests prove only how
their owned behavior composes those primitives; they do not repeat the primitive matrix.

## DashPanel

| ID             | Contract area                                | Primary evidence                       | Status    | Evidence |
| -------------- | -------------------------------------------- | -------------------------------------- | --------- | -------- |
| PANEL-COMPOSE  | Provider/Panel composition and scope context | React component tests                  | Prototype | —        |
| PANEL-LIFE     | Visibility, removal, leases, reopen          | Component tests; one focus E2E journey | Prototype | —        |
| PANEL-GEOMETRY | Placement and boundary calculations          | Pure geometry/property tests           | Prototype | —        |
| PANEL-DOCK     | Arena occupancy, collision, and allocation   | Model/property geometry tests          | Planned   | —        |
| PANEL-POINTER  | Pointer capture and committed drag result    | Contract Lab E2E                       | Prototype | —        |
| PANEL-KEYBOARD | Keyboard movement/action parity              | Component plus Contract Lab E2E        | Partial   | —        |
| PANEL-LAYOUT   | Durable override/reset/recovery              | Store/pure integration tests           | Prototype | —        |
| PANEL-PORTAL   | Portal stacking, theme, focus restoration    | Contract Lab cohesive overlay journey  | Prototype | —        |
| PANEL-A11Y     | Naming, actions, semantic DOM                | Component accessibility tests          | Prototype | —        |
| PANEL-ADAPT    | Modal drawer/sheet projection and exclusion  | Component tests; one modal E2E seam    | Planned   | —        |
| PANEL-THEME    | Theme/density overrides and detached roots   | Component tests; portal E2E seam       | Prototype | —        |
| PANEL-CSS      | Public token inventory and consumption       | Artifact plus static CSS contract test | Planned   | —        |
| PANEL-CATALOG  | Accepted owner entries and references        | Static catalog/artifact tests          | Planned   | —        |
| PANEL-PACKAGE  | Exports, CSS, peer contracts                 | Package build/artifact/type tests      | Prototype | —        |

Do not open a browser for deterministic placement matrices. E2E proves that real browser layout and
input choreography reach the already-tested canonical result.

## DashList

| ID            | Contract area                                            | Primary evidence                                       | Status    | Evidence |
| ------------- | -------------------------------------------------------- | ------------------------------------------------------ | --------- | -------- |
| LIST-COMPOSE  | Standalone and inherited Store scope                     | React component/type tests                             | Prototype | —        |
| LIST-IDENTITY | Stable item/group/binding IDs                            | Pure registration and type tests                       | Prototype | —        |
| LIST-ANATOMY  | Dashlet semantic structure                               | Component accessibility tests                          | Prototype | —        |
| LIST-BINDING  | Canonical values, drafts, issues                         | Store tests plus component wiring tests                | Prototype | —        |
| LIST-GROUP    | Declarative containment and collapse                     | Component plus pure metadata tests                     | Prototype | —        |
| LIST-ORDER    | Reconciliation and customized order                      | Model/property tests                                   | Prototype | —        |
| LIST-POINTER  | Pointer reorder choreography                             | One Contract Lab journey                               | Prototype | —        |
| LIST-KEYBOARD | Keyboard reorder and announcements                       | Component plus one Contract Lab journey                | Partial   | —        |
| LIST-A11Y     | Collection/rail semantics, names, focus, announcements   | Component accessibility tests; one rail focus E2E seam | Planned   | —        |
| LIST-RAIL     | Rail reveal, toggle, reorder, and orientation precedence | Component tests; one Contract Lab rail journey         | Planned   | —        |
| LIST-ACTIONS  | Targeting, availability, reuse, confirmation             | Component/type and Store integration tests             | Planned   | —        |
| LIST-RESET    | Value/draft/metadata reset composition                   | Component and Store integration tests                  | Planned   | —        |
| LIST-DOCS     | Scoped JSON plans, review, import, and export            | Component tests plus browser I/O seams                 | Planned   | —        |
| LIST-CSS      | Product tokens and shared-token consumption              | Artifact plus static CSS contract test                 | Planned   | —        |
| LIST-CATALOG  | Accepted owner entries and ready-made metadata           | Static catalog/artifact tests                          | Planned   | —        |
| LIST-PACKAGE  | Exports, CSS, peer contracts                             | Package build/artifact/type tests                      | Prototype | —        |

Conditional rendering is not an obsolete-node oracle. Pruning tests require explicit inventories
and never derive deletion from mount absence.

## Picodash integration

| ID              | Contract area                                   | Primary evidence                       | Status    | Evidence |
| --------------- | ----------------------------------------------- | -------------------------------------- | --------- | -------- |
| PICO-CONTEXT    | Provider composition, nesting, Panel/List root  | React integration and type tests       | Prototype | —        |
| PICO-SAME-SCOPE | Panel plus primary List                         | React integration test                 | Prototype | —        |
| PICO-CHILD      | Explicit child Lists and relationship graph     | React plus Store graph test            | Planned   | —        |
| PICO-MENU       | Same-scope contribution and replacement rules   | Integration component and type tests   | Planned   | —        |
| PICO-ACTIONS    | Additional Lists preserve primary targeting     | Integration component tests            | Planned   | —        |
| PICO-PORTAL     | Dashlets inside themed portaled Panel           | One Contract Lab integration journey   | Prototype | —        |
| PICO-THEME      | One-import styles and orthogonal theme/density  | Artifact and component tests           | Planned   | —        |
| PICO-CATALOG    | Exact entry aggregation and facade reexports    | Type/package/catalog tests             | Planned   | —        |
| PICO-PACKAGE    | Facade exports and complete styles              | Package build/artifact/type tests      | Prototype | —        |
| PICO-EXAMPLE    | Four canonical fixtures; one integrated journey | Compile/package tests plus website E2E | Planned   | —        |

Picodash does not repeat Store field matrices, DashPanel geometry matrices, or DashList ordering
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

### Store alpha

Required before consumer dogfooding:

- core field/value/transaction/scope behavior implemented;
- structured errors and nominal ownership verified;
- Store-owned metadata records and lazy scope creation verified;
- public, React selector, and integration-lease entries usable without private imports;
- synchronous Store-owned persistence and the manual external-value adapter usable;
- persistence failures retain a complete pending envelope and never silently overwrite conflicts;
- package/artifact checks passing;
- no known partial-mutation or silent-persistence-loss path.

### Store beta

Required after DashPanel and DashList dogfooding:

- scoped context and relationship model verified;
- persistence conflict/erase recovery and external adapters fully verified;
- document policies and recovery paths verified;
- repair, overwrite, prune, import, and export stale-plan behavior verified;
- consumer findings reconciled without private API bypasses.

### DashPanel and DashList stability

Each foundational UI product requires its owned deterministic/component evidence plus only its
browser journeys. Neither waits for or reruns the other product's complete suite. Both require a
compatible shared UI foundation whose package, theme, and consumed primitive contracts pass.

### Picodash stability

Requires stable foundation versions and passing integration rows. Facade-only work cannot waive a
failed foundation contract.

## Current readiness

| Package/facade | Contract readiness | Implementation readiness | Reason                                            |
| -------------- | ------------------ | ------------------------ | ------------------------------------------------- |
| Store          | Accepted           | Begin Phase 1            | First independent product in the accepted roadmap |
| UI             | Accepted           | Sequenced for Phase 2    | Implement the minimum needed by both UI products  |
| DashPanel      | Accepted           | Sequenced after Store/UI | Foundation dogfooding dependencies remain         |
| DashList       | Accepted           | Sequenced after Store/UI | Foundation dogfooding dependencies remain         |
| Picodash       | Accepted           | Deferred to Phase 4      | Depends on stable foundational products           |
