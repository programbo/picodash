# Documentation status conventions

This reference explains how Picodash documentation distinguishes intended contracts from shipped
behavior. It is for agents and developers who need to know whether a documented capability is a
decision, a prototype, an implementation, or verified behavior.

## Status axes

Contract status and implementation status are independent. Do not combine them into one label.

### Contract status

| Status     | Meaning                                                                                  |
| ---------- | ---------------------------------------------------------------------------------------- |
| `Draft`    | The behavior is aspirational and may change during contract review.                      |
| `Accepted` | The behavior is the current target contract. Changes require an explicit reason or ADR.  |
| `Revised`  | An accepted contract changed because evidence exposed a genuine constraint or ambiguity. |

### Implementation status

| Status        | Meaning                                                                                 |
| ------------- | --------------------------------------------------------------------------------------- |
| `Prototype`   | Existing code is useful evidence but has not been reconciled with the target contract.  |
| `Planned`     | The target behavior has no conforming implementation yet.                               |
| `Partial`     | Some target behavior exists, but known contract requirements remain missing.            |
| `Implemented` | The implementation appears to satisfy the documented contract.                          |
| `Verified`    | The conformance matrix links the behavior to passing evidence at the appropriate layer. |

`Implemented` is not a synonym for `Verified`. Code presence alone is not contract evidence.

## Required annotation

Every aspirational reference page starts with page-level status. Each API table or behavioral
section carries its own contract and implementation status when it differs from the page.

Use this form for a section:

```md
> Contract: Accepted
> Implementation: Planned
> Evidence: None
> Notes: Requires canonical scoped Nexus views.
```

Use status columns when documenting several APIs:

```md
| API              | Contract | Implementation | Notes                            |
| ---------------- | -------- | -------------- | -------------------------------- |
| `root.scope(id)` | Accepted | Planned        | Returns a canonical scoped view. |
```

## Evidence

Evidence should point to the primary owning test, not every overlapping test that happens to touch
the behavior. Accepted evidence includes:

- type tests for compile-time contracts;
- pure or model-based tests for deterministic state invariants;
- component tests for React, semantic DOM, ARIA, and event wiring;
- Contract Lab journeys for browser-only behavior;
- package and artifact checks for exports and distribution contracts.

Do not mark a capability `Verified` because a broad E2E journey passed without a precise assertion.

## Changing documentation during implementation

Implementation work updates the relevant status and evidence in the same change.

If implementation reveals a genuine constraint:

1. Describe whether the existing contract is unsafe, impossible, internally inconsistent, or
   incompatible with a higher-priority contract.
2. Revise the decision ledger and affected reference pages.
3. Add or amend an ADR when ownership, identity, persistence, or package boundaries change.
4. Update or replace conformance evidence.

Do not revise an accepted contract merely because a shortcut is easier to implement.

## Prototype policy

The implementation that predates these contracts is a working prototype and reference source. It
does not define compatibility requirements automatically. Prototype behavior may be retained,
redesigned, or removed after it is compared with the accepted contract.
