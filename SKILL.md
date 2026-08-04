---
name: picodash
description: Work with Picodash contracts, prototypes, and package boundaries without confusing aspirational APIs with shipped behavior.
---

# Picodash workspace skill

Use this skill for repository work involving Store, DashPanel, DashList, Picodash integration,
themes, the evaluation website, or the Contract Lab.

## Current operating state

Product implementation is paused until the aspirational contracts and release gates are reviewed.
Documentation, contract analysis, prototype inspection, and QA planning remain allowed. Do not
silently change an accepted contract to preserve a prototype shortcut.

## Route the question

- Product purpose: `docs/product/value-propositions.md`
- Roadmap: `docs/ROADMAP.md`
- Store architecture: `docs/adr/0002-provider-level-store-and-scoped-views.md`
- Store decisions: `docs/reference/store-contract-decisions.md`
- Store API: `docs/reference/store.md`
- DashPanel API: `docs/reference/dashpanel.md`
- DashList API: `docs/reference/dashlist.md`
- Picodash integration: `docs/reference/picodash.md`
- Status conventions: `docs/reference/document-status.md`
- QA ownership and release gates: `docs/reference/contract-conformance.md`
- Test policy: `TESTING.md`
- Workspace rules and glossary: `AGENTS.md`

Accepted decisions and accepted reference sections outrank current source, tests, package READMEs,
`PRODUCT.md`, `CONTEXT.md`, and historical planning documents.

## Product boundaries

- Store is the framework-independent value, transaction, scope, persistence, document, adapter, and
  diagnostics product.
- DashPanel is the standalone Provider and movable/dockable Panel product.
- DashList is the standalone List, group, Dashlet, binding, and reorder product.
- Picodash integrates stable versions of the three foundations.
- DashPanel and DashList depend on Store/theme, not on one another.
- Store never imports either UI product; it owns their validated persisted record shapes and exposes
  translation through `@picodash/store/integration`.

## Store rules

- Root values are canonical; scoped Stores are immutable organizational views, not child value
  stores or access-control boundaries.
- `scopeId` is opaque and root-global. Parent-child relationships come only from active declarative
  boundaries.
- Snapshots contain immutable data; commands live on the stable Store API.
- Binding input uses `parse → schema → validate`; every other value source uses
  `schema → validate` and never invokes a UI parser.
- Values, drafts, documents, and persisted payloads are JSON-compatible.
- All validation, adapters, migrations, and core persistence are synchronous.
- Expected data rejection returns structured issues. Ownership, lifecycle, and reentrancy misuse
  throws a structured contract error.
- Opaque plans are root-owned and single-use; changed captured state returns `stale_plan` without
  mutation.
- External-owned mode persists Picodash metadata only. Store-owned mode persists permitted values
  plus Picodash metadata.
- Imperative Panel deregistration is not a target API.

## QA

Use one primary owner per contract and the cheapest faithful test layer. Keep deterministic state,
geometry, ordering, serialization, and type matrices below the browser. Contract Lab E2E is for
real pointer, layout, focus, portal, browser-storage, media-query, and cohesive integration seams.

Run focused checks first:

```bash
bun run --filter @picodash/store check
bun run --filter @picodash/store test
bun run --filter @picodash/dashpanel check
bun run --filter @picodash/dashlist check
bun run --filter @picodash/picodash check
```

Use `bun run ready` only for the full gate or when explicitly requested. Reserve worktree ports with
`bun run port:reserve` before starting local servers.
