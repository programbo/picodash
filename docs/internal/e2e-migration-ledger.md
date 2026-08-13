# Contract Lab E2E migration ledger

The Contract Lab browser gate is one route with eight collected tests: two audit-report tests and
six Contract Lab journeys. The audit report journey is retained unchanged; the legacy specimen
matrix is removed in favor of cohesive journeys owned by the single route.

The retired `/style-lab` route and its route-only page were removed in the local-1-C007 cutover.
The neutral Style Lab now mounts as the `composition` preset inside the existing specimen host, so
the Console, status strip, diagnostics, and Dev Bridge connector remain on the same `/lab` route.

| Owner | Test file                             | Required journey                                                                              |
| ----- | ------------------------------------- | --------------------------------------------------------------------------------------------- |
| Audit | `apps/lab/tests/audit-report.spec.ts` | Complete audit evidence and unknown-audit 404                                                 |
| Lab   | `apps/lab/tests/contract-lab.spec.ts` | Versioned driver, independent Console/status, and offline specimen                            |
| Lab   | `apps/lab/tests/contract-lab.spec.ts` | Six presets, session persistence, and reset to Placement                                      |
| Lab   | `apps/lab/tests/contract-lab.spec.ts` | Same-scope Panel/List composition, collapse state, and the reachable Style Lab gallery/chart  |
| Lab   | `apps/lab/tests/contract-lab.spec.ts` | Shared AlertDialog open, cancel, and focus restoration                                        |
| Lab   | `apps/lab/tests/contract-lab.spec.ts` | Regular/compact density, coarse-pointer geometry, and portal-boundary movement                |
| Lab   | `apps/lab/tests/contract-lab.spec.ts` | Browser Dev Bridge discovery, disclosed writes/waits, restore, and stale-generation rejection |

The six Lab titles are the public acceptance surface. They collect browser console and page errors,
use no skips, retries, hidden exclusions, or parameterized test expansion, and are listed together
with the two retained audit tests by `bun run --filter @picodash/lab test:e2e:cap`.

Placement, interaction, composition, overlays, documents, and themes remain visible as accepted
preset descriptions. Only the landed Panel/List composition and shared AlertDialog behavior are
exercised in this cutover; planned behavior is not simulated by the specimen.
