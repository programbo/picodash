# Testing

Each behavior has a cheapest faithful owner. Nexus owns values, validation, persistence, documents, leases and state protocols.
UI, Panel, Stack and Picodash component tests own deterministic rendering, accessibility, events and composition.
Bridge tests own authentication, disclosure, allowlists, sequencing and generation fencing.
Browser tests own real layout, pointer capture, focus traversal, portals, scrolling, storage, media queries and cohesive journeys.

Run the changed test first, then its owning package checks. Public exports and bundles require artifact checks and a packed consumer.
Use `vp lint`, `vp fmt`, and the owning typechecker. At a release or integration boundary run `bun run ready`.
Do not present static type success as browser behavior or archived test counts as current evidence.

The Lab suite has a hard ceiling of 40 collected tests and one Playwright configuration. No skip, fixme, focused, quarantine or retry-only lane.
`bun run test:e2e:lab:cap` lists and validates it. All six contract presets run through `/lab` after **Contract tools**;
`window.__PICODASH_LAB__` provides only reset and preset setup. Assertions use public UI, Bridge or observable results.
Website tests are separate and must not depend on Lab state. Phone evidence uses the admitted Lab suite, not another browser harness.

Use roles and accessible names first. Semantic identity/geometry hooks are appropriate when no accessible selector exists.
Browser automation owns its sessions and bounded server lifetime. Do not kill personal browsers or other worktrees' servers.
Reserve the worktree port before starting a web server and release it after merge.

See [development commands](docs/development/index.md) and [current integration evidence](docs/internal/consolidation-audit.md).
