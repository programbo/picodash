# Testing agent instructions

Read [`../../TESTING.md`](../../TESTING.md), the conformance matrix, and the matching product
reference before changing tests. One contract has one primary test owner; verify it at the cheapest
layer that can faithfully observe the behavior.

- Nexus pure, type, reducer, serialization, and model tests own state invariants.
- DashPanel and DashList component tests own React wiring, semantic DOM, ARIA, and deterministic
  events.
- Pure product tests own geometry, ordering, reconciliation, and graph algorithms.
- Dev Bridge protocol tests own authentication, validation, fencing, sequencing, and status/error
  mapping.
- Contract Lab E2E owns only real layout, pointer capture, focus traversal and restoration, portals,
  browser storage, media queries, viewport, zoom, and cohesive browser seams.
- Picodash integration tests prove composition without repeating foundation matrices.
- Website E2E proves public journeys, not internal permutations.

For a regression, identify the violated contract, expand its lowest faithful invariant test, and add
browser evidence only when the failure requires a browser. Merge browser evidence into an existing
cohesive journey when possible and remove overlapping obsolete coverage in the same cutover.

Do not create one test per documented sentence. Prefer table-driven, property-based, or model-based
coverage for large state spaces. The Contract Lab ceiling is 40 collected tests, not a target.
There are no hidden, quarantine, skipped, fixme, retry-only, or legacy browser suites.

Run the narrowest owning package check and tests first. Use `bun run release:check` or
`bun run ready` only at a release boundary or when explicitly requested.
