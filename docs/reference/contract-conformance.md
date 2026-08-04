# Contract conformance matrix

This reference maps target contract areas to one primary verification owner. It prevents test bloat
by proving related invariants together and using E2E only for behavior that requires a browser.

## Status

> Contract: Draft
> Implementation: Prototype
> Evidence: Existing tests have not yet been audited against the target contracts.

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

| ID            | Contract area                                   | Primary evidence                            | Status    | Evidence |
| ------------- | ----------------------------------------------- | ------------------------------------------- | --------- | -------- |
| STORE-FIELD   | Canonical definitions and nominal handles       | Type tests plus pure ownership tests        | Prototype | —        |
| STORE-JSON    | JSON validation, clone, freeze, equality        | Property-based pure tests                   | Planned   | —        |
| STORE-TX      | Data-only snapshots and atomic commands         | Type tests plus model transaction tests     | Prototype | —        |
| STORE-ERROR   | Portable structured issues and contract errors  | Pure tests plus type tests                  | Planned   | —        |
| STORE-SCOPE   | Canonical views and scope lifecycle             | Model-based scope invariant tests           | Planned   | —        |
| STORE-META    | Built-in records and lazy durable scope state   | Pure codec and lifecycle tests              | Planned   | —        |
| STORE-ENTITY  | Entity uniqueness and host affinity             | Model-based registration tests              | Planned   | —        |
| STORE-GRAPH   | Declarative relationships, parents, cycles      | Generated graph invariant tests             | Planned   | —        |
| STORE-BINDING | Drafts, aliases, conflicts, cleanup             | Pure interaction state tests                | Prototype | —        |
| STORE-REPAIR  | Explicit repair plans and stale-plan rejection  | Table-driven transaction tests              | Prototype | —        |
| STORE-RESET   | Explicit reset domains and shared-field effects | Table-driven transaction tests              | Planned   | —        |
| STORE-ADAPTER | External ownership and unhealthy snapshots      | Adapter contract tests                      | Prototype | —        |
| STORE-PERSIST | Envelope, hydration, conflict, pending writes   | Pure driver tests; one browser-storage seam | Prototype | —        |
| STORE-DIAG    | Operational diagnostics and runtime inspection  | Pure state and privacy-boundary tests       | Planned   | —        |
| STORE-MIGRATE | Version chains and quarantine                   | Pure document/migration tests               | Planned   | —        |
| STORE-DOCS    | Export/import policy and atomic plans           | Document/property tests                     | Prototype | —        |
| STORE-REACT   | Context, hooks, selector equality               | React component/type tests                  | Prototype | —        |
| STORE-LIFE    | Destroy and use-after-destroy                   | Pure lifecycle tests                        | Planned   | —        |
| STORE-CAP     | Conditional identity and capability typing      | Compile-time configuration tests            | Planned   | —        |
| STORE-PACKAGE | Public, React, and integration entry contracts  | Package build/artifact/type tests           | Prototype | —        |

Store suites should use generated models for scope graphs, transaction batches, document mappings,
and persistence records instead of adding separate hand-written tests for every combination.

## DashPanel

| ID             | Contract area                                | Primary evidence                       | Status    | Evidence |
| -------------- | -------------------------------------------- | -------------------------------------- | --------- | -------- |
| PANEL-COMPOSE  | Provider/Panel composition and scope context | React component tests                  | Prototype | —        |
| PANEL-LIFE     | Visibility, removal, leases, reopen          | Component tests; one focus E2E journey | Prototype | —        |
| PANEL-GEOMETRY | Placement and boundary calculations          | Pure geometry/property tests           | Prototype | —        |
| PANEL-POINTER  | Pointer capture and committed drag result    | Contract Lab E2E                       | Prototype | —        |
| PANEL-KEYBOARD | Keyboard movement/action parity              | Component plus Contract Lab E2E        | Partial   | —        |
| PANEL-LAYOUT   | Durable override/reset/recovery              | Store/pure integration tests           | Prototype | —        |
| PANEL-PORTAL   | Portal stacking, theme, focus restoration    | Contract Lab cohesive overlay journey  | Prototype | —        |
| PANEL-A11Y     | Naming, actions, semantic DOM                | Component accessibility tests          | Prototype | —        |
| PANEL-THEME    | Theme propagation and system preference      | Component tests; one media-query E2E   | Prototype | —        |
| PANEL-PACKAGE  | Exports, CSS, peer contracts                 | Package build/artifact/type tests      | Prototype | —        |

Do not open a browser for deterministic placement matrices. E2E proves that real browser layout and
input choreography reach the already-tested canonical result.

## DashList

| ID            | Contract area                          | Primary evidence                           | Status    | Evidence |
| ------------- | -------------------------------------- | ------------------------------------------ | --------- | -------- |
| LIST-COMPOSE  | Standalone and inherited Store scope   | React component/type tests                 | Prototype | —        |
| LIST-IDENTITY | Stable item/group/binding IDs          | Pure registration and type tests           | Prototype | —        |
| LIST-ANATOMY  | Dashlet semantic structure             | Component accessibility tests              | Prototype | —        |
| LIST-BINDING  | Canonical values, drafts, issues       | Store tests plus component wiring tests    | Prototype | —        |
| LIST-GROUP    | Declarative containment and collapse   | Component plus pure metadata tests         | Prototype | —        |
| LIST-ORDER    | Reconciliation and customized order    | Model/property tests                       | Prototype | —        |
| LIST-POINTER  | Pointer reorder choreography           | One Contract Lab journey                   | Prototype | —        |
| LIST-KEYBOARD | Keyboard reorder and announcements     | Component plus one Contract Lab journey    | Partial   | —        |
| LIST-RESET    | Value/draft/metadata reset composition | Component and Store integration tests      | Planned   | —        |
| LIST-DOCS     | Scoped document UI composition         | Component test; browser download if needed | Prototype | —        |
| LIST-PACKAGE  | Exports, CSS, peer contracts           | Package build/artifact/type tests          | Prototype | —        |

Conditional rendering is not an obsolete-node oracle. Pruning tests require explicit inventories
and never derive deletion from mount absence.

## Picodash integration

| ID              | Contract area                               | Primary evidence                      | Status    | Evidence |
| --------------- | ------------------------------------------- | ------------------------------------- | --------- | -------- |
| PICO-CONTEXT    | One root across Provider, Panel, and List   | React integration test                | Prototype | —        |
| PICO-SAME-SCOPE | Panel plus primary List                     | React integration test                | Prototype | —        |
| PICO-CHILD      | Explicit child Lists and relationship graph | React plus Store graph test           | Planned   | —        |
| PICO-ACTIONS    | Descendant reset/export impact              | Integration component tests           | Planned   | —        |
| PICO-PORTAL     | Dashlets inside themed portaled Panel       | One Contract Lab integration journey  | Prototype | —        |
| PICO-CATALOG    | Ready-made Dashlet public contracts         | Type/component/catalog tests          | Prototype | —        |
| PICO-PACKAGE    | Facade exports and complete styles          | Package build/artifact/type tests     | Prototype | —        |
| PICO-EXAMPLE    | One complete supported host example         | Website journey and no-error baseline | Prototype | —        |

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
browser journeys. Neither waits for or reruns the other product's complete suite.

### Picodash stability

Requires stable foundation versions and passing integration rows. Facade-only work cannot waive a
failed foundation contract.

## Current readiness

| Product   | Contract readiness | Implementation readiness | Reason                                       |
| --------- | ------------------ | ------------------------ | -------------------------------------------- |
| Store     | Accepted API       | Not ready                | Panel metadata payload and evidence remain   |
| DashPanel | Draft              | Not ready                | Open API, responsive, focus, and theme rules |
| DashList  | Draft              | Not ready                | Open anatomy, reorder, layout, and state UX  |
| Picodash  | Draft              | Deferred                 | Depends on stable foundational contracts     |
