# Nexus Reconciliation Ledger (Implementation Evidence, Not Contract Authority)

## Purpose and precedence

This ledger records current Nexus implementation evidence for **this repository state** so Nexus implementers can plan edits safely.

It is non-authoritative.

- Authoritative precedence remains:
  1. Accepted Nexus decision artifacts in `docs/reference/nexus.md` and `docs/reference/nexus-contract-decisions.md`.
  2. Product route docs such as roadmap and ADR references.
  3. This ledger as implementation evidence only.
- If this ledger conflicts with accepted docs, the docs take priority and the implementation must change to match.

## Snapshot

- Package: `@picodash/nexus`
- Branch snapshot: `86b63803` baseline plus the Nexus alpha persistence, interaction-boundary, destroyScope, and root lifecycle revision
- Scope: Nexus package implementation-only evidence, excluding docs-owned contract meaning.

## Category definitions

- **RETAIN** — Keep this file in Nexus package runtime and preserve its current role.
- **REWRITE** — Keep this file in Nexus, but narrow/replace behavior to match Nexus contracts and tests.
- **MOVE** — Transfer ownership to another package after contract reconciliation (same code intent, different package owner).
- **DELETE** — Remove this file from Nexus package runtime after migration/archival and no remaining package-level callers.

## Source module ledger (10 files)

| File                                       | Category | Current reachability / evidence                                                                                                                                                   | Target owner / replacement                                             | Completion condition                                                                                                                               |
| ------------------------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/nexus/src/index.ts`              | RETAIN   | Export hub required by `packages/nexus/package.json`; package runtime starts here for `@picodash/nexus` and tests import this entry directly.                                     | Nexus package boundary owner keeps as is.                              | Keep exported API and type surface aligned with accepted Nexus target contracts.                                                                   |
| `packages/nexus/src/json.ts`               | RETAIN   | Reachable from `src/index.ts` through `kernel/index.ts`; used by `packages/nexus/tests/json.test.ts`; imports the canonical JSON type from `src/kernel/index.ts`.                 | Nexus-owned JSON codec layer remains.                                  | Keep utility behavior stable for Nexus value snapshots and cloning evidence.                                                                       |
| `packages/nexus/src/kernel/index.ts`       | RETAIN   | Reachable from `src/index.ts`; authoritative runtime for root/scoped Nexuses, metadata commands, and root lifecycle teardown.                                                     | Nexus core kernel remains.                                             | Keep runtime path stable while reconciling contracts, lifecycle, and diagnostics.                                                                  |
| `packages/nexus/src/metadata.ts`           | RETAIN   | Runtime-imported by `kernel/index.ts`; its reverse import from `kernel/index.ts` is type-only. Metadata behavior is exercised in `metadata.test.ts` and `scope-metadata.test.ts`. | Nexus-owned metadata codec remains.                                    | Keep codec/runtime contracts and errors aligned with scoped metadata scope rules.                                                                  |
| `packages/nexus/src/react.ts`              | RETAIN   | Exported through `packages/nexus/package.json` `./react`; runtime behavior verified in `react.test.tsx` and `react.types.test.ts`.                                                | Nexus-owned React selector API remains.                                | Keep only verified explicit selector API (`usePicodashNexusSelector`, `shallowEqual`).                                                             |
| `packages/nexus/src/adapter.ts`            | RETAIN   | Reachable from the kernel for the synchronous manual external-value adapter and its target public types.                                                                          | Nexus-owned adapter runtime and public types.                          | Keep initialization, fail-closed writes, health diagnostics, and teardown covered by adapter tests and type tests.                                 |
| `packages/nexus/src/persistence.ts`        | RETAIN   | Reachable from the kernel for Nexus-owned envelope codecs, synchronous hydration, pending-write/conflict state, and the root-shared persistence capability.                       | Nexus-owned persistence authority and codec layer.                     | Keep deterministic envelope validation, disclosure policy, conflict refusal, lifecycle release, and capability types covered by persistence tests. |
| `packages/nexus/src/diagnostics.ts`        | RETAIN   | Reachable from the kernel and package entry; owns only the target diagnostics runtime and public types.                                                                           | Nexus-owned diagnostics channel rebuilt to the approved namespace.     | Core namespace, privacy, aggregation, recovery, and lifecycle teardown are covered by focused tests.                                               |
| `packages/nexus/src/integration.ts`        | RETAIN   | Exports the approved Provider/entity/relationship lease protocol; binding and orientation channels remain excluded.                                                               | Nexus-owned integration entry remains the approved low-level protocol. | Keep runtime/type/artifact evidence aligned without adding unmodeled product behavior.                                                             |
| `packages/nexus/src/runtime-controller.ts` | RETAIN   | Private root-keyed runtime controller for active provider/entity/relationship generations, descendant traversal, and lifecycle resources.                                         | Nexus-owned private runtime support.                                   | Keep unreachable from public package exports and extend only for accepted lifecycle slices.                                                        |

## Test and support-module ledger (25 files)

| File                                                       | Category | Evidence / extension target                                                                                                                                                   | Completion condition                                                         |
| ---------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `packages/nexus/tests/fixtures/package-artifacts.mjs`      | RETAIN   | Verifies exported entry surfaces and reachable import boundary (`./dist/index.mjs`, `./dist/react.mjs`, `./dist/integration.mjs`).                                            | Keep to ensure package artifact and boundary invariants for Nexus entries.   |
| `packages/nexus/tests/integration.test.ts`                 | RETAIN   | Provider/entity/relationship lease and destroyScope runtime evidence.                                                                                                         | Keep as primary integration lifecycle test owner.                            |
| `packages/nexus/tests/root-lifecycle.test.ts`              | RETAIN   | Root destruction options, lease refusal, private resource teardown, use-after-destroy, and detached survivor evidence.                                                        | Keep as primary root lifecycle test owner while capability phases are added. |
| `packages/nexus/tests/integration.types.test.ts`           | RETAIN   | Exact generic signatures, opaque handles, and root non-reexport type evidence.                                                                                                | Keep as integration type contract evidence.                                  |
| `packages/nexus/tests/json.test.ts`                        | RETAIN   | Directly validates `clonePicodashValue` and value JSON equality behavior used by runtime and docs references.                                                                 | Keep and expand when JSON/value cloning contract edges change.               |
| `packages/nexus/tests/kernel-issues.test.ts`               | RETAIN   | Proves issue/reporting transitions and contract-error boundaries in kernel path.                                                                                              | Keep while kernel error/rejection behavior is being stabilized.              |
| `packages/nexus/tests/diagnostics.test.ts`                 | RETAIN   | Proves diagnostic namespace, subscriber aggregation/recovery, privacy, reentrancy, adapter conditions, and teardown behavior.                                                 | Keep as primary diagnostics behavior evidence.                               |
| `packages/nexus/tests/diagnostics.types.test.ts`           | RETAIN   | Proves public diagnostic snapshot, identity, severity, and specialized type contracts.                                                                                        | Keep as diagnostics type evidence.                                           |
| `packages/nexus/tests/kernel.test.ts`                      | RETAIN   | Core Nexus kernel behavioral tests for value, scope, and transaction semantics.                                                                                               | Keep as primary regression suite for Nexus core.                             |
| `packages/nexus/tests/kernel.types.test.ts`                | RETAIN   | Type-level proof for kernel config/options/result contracts.                                                                                                                  | Keep until public Nexus type surface converges to accepted contracts.        |
| `packages/nexus/tests/metadata.test.ts`                    | RETAIN   | Validates durable metadata behavior and command boundaries.                                                                                                                   | Keep as regression for `metadata.ts` and scoped metadata contracts.          |
| `packages/nexus/tests/adapter.test.ts`                     | RETAIN   | Owns the synchronous external adapter initialization, notification, write, health, reentrancy, privacy, and teardown matrix.                                                  | Keep as primary manual adapter behavior evidence.                            |
| `packages/nexus/tests/adapter.types.test.ts`               | RETAIN   | Proves external/nexus-owned configuration discrimination, adapter context, diagnostic specialization, and initialization error types.                                         | Keep as adapter public type evidence.                                        |
| `packages/nexus/tests/persistence.test.ts`                 | RETAIN   | Owns Nexus-owned envelope save/hydration, driver-free initial envelopes, disclosure policy, pending/error flush, conflict refusal, shared capability, and lifecycle behavior. | Keep as primary persistence capability behavior evidence.                    |
| `packages/nexus/tests/persistence.types.test.ts`           | RETAIN   | Proves persistent transaction result, capability/state/diagnostic types, and compile-time identity/schema requirements.                                                       | Keep as persistence public type evidence.                                    |
| `packages/nexus/tests/package-artifacts.mjs`               | RETAIN   | Enforces package exports and import reachability; checks retired React exports.                                                                                               | Keep as Nexus artifact packaging evidence.                                   |
| `packages/nexus/tests/react.test.tsx`                      | RETAIN   | Runtime behavior tests for selector hook and equality semantics.                                                                                                              | Keep while React entry remains supported.                                    |
| `packages/nexus/tests/react.types.test.ts`                 | RETAIN   | Type checks for `usePicodashNexusSelector`, `shallowEqual`, and snapshot types.                                                                                               | Keep to protect explicit selector API contract.                              |
| `packages/nexus/tests/scope-metadata.test.ts`              | RETAIN   | Proves scope-ID, metadata, and scoped command behavior.                                                                                                                       | Keep as scoped metadata/metadata-command regression suite.                   |
| `packages/nexus/tests/support/external-adapter.ts`         | RETAIN   | Exercised by the adapter contract matrix and fixture-foundation invariants; exposes controlled synchronous failure and notification modes.                                    | Keep as the adapter protocol harness.                                        |
| `packages/nexus/tests/support/fixture-foundation.test.ts`  | RETAIN   | Fixture-invariant assertions for canonical value behavior used by Nexus tests; not a compatibility gate.                                                                      | Keep as fixture evidence only.                                               |
| `packages/nexus/tests/support/json-fixtures.ts`            | RETAIN   | JSON boundary test vectors used by JSON/value tests.                                                                                                                          | Keep and update vectors if decoder/codec constraints change.                 |
| `packages/nexus/tests/support/memory-persistence.ts`       | RETAIN   | Synchronous backend harness records reads, writes, subscriptions, failures, foreign notifications, and teardown calls for persistence tests.                                  | Keep as the persistence protocol harness.                                    |
| `packages/nexus/tests/support/standard-schema-fixtures.ts` | RETAIN   | Provides validated schema fixtures for kernel validation contracts.                                                                                                           | Keep as schema contract fixture source for pass/fail tests.                  |
| `packages/nexus/tests/support/nexus-scope-model.ts`        | RETAIN   | Supports scope-model fixture invariants and destroy-oracle behavior for relationships and scope transitions.                                                                  | Keep as evidence for scope behavior during Nexus rewrite.                    |

## Prototype island and reachability note

- The deleted ten-file prototype island was not runtime-reachable from Nexus package exports
  (`packages/nexus/src/index.ts`, `src/react.ts`, or `src/integration.ts`).
- The retained source set is the complete current Nexus package runtime and public type surface;
  support fixtures import JSON types through the public package entry.
- Any later accepted document, interaction, item, ordering, presentation, or expanded validation
  capability requires a new target implementation under its accepted owner; the deleted physical
  prototype modules are not rewrite or migration targets.

## Unresolved dependencies

- `@picodash/dashlist` must own future ordering and presentation capabilities after Nexus/DashList
  boundary alignment; the deleted Nexus prototype modules are not migration targets.
- Nexus integration lease protocol is implemented and verified; binding leases and orientation overrides remain unresolved later slices.
- Root lifecycle teardown is implemented for kernel state, integration lease refusal, diagnostics, manual adapter subscriptions, and Nexus-owned persistence ownership/subscriptions; other capability resources remain unresolved later slices.
- Nexus contract for scoped interaction/lease behavior still requires a new target implementation;
  no deleted physical module is a future rewrite target.

## Maintenance and retirement rule

- Every source or test file add/remove/reclassification in Nexus is a tracked transition; update this ledger in the same change.
- Evidence links, completion conditions, and status wording must be refreshed whenever file category changes.
- Do not mark a category as complete until Nexus package evidence (package artifact checks, module reachability, and focused Nexus test updates) confirms the transition.
- Keep ledger and source/test transitions synchronized until all `RETAIN/REWRITE/MOVE/DELETE` transitions for Nexus are complete.
