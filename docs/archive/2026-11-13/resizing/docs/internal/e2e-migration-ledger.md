# Contract Lab E2E migration ledger

The Contract Lab browser gate is one route with eight collected tests: two audit-report tests and
six Contract Lab journeys. The audit report journey is retained unchanged; the legacy specimen
matrix is removed in favor of cohesive journeys owned by the single route.

The retired `/style-lab` route and its route-only page were removed in the local-1-C007 cutover.
The neutral Style Lab now mounts as the `composition` preset inside the existing specimen host, so
the Console, status strip, diagnostics, and Dev Bridge connector remain on the same `/lab` route.

| Owner | Test file                             | Required journey                                                                                                                                                                                                   |
| ----- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Audit | `apps/lab/tests/audit-report.spec.ts` | Complete audit evidence and unknown-audit 404                                                                                                                                                                      |
| Lab   | `apps/lab/tests/contract-lab.spec.ts` | Versioned driver, independent Console/status, and offline specimen                                                                                                                                                 |
| Lab   | `apps/lab/tests/contract-lab.spec.ts` | Six presets, session persistence, and reset to Placement                                                                                                                                                           |
| Lab   | `apps/lab/tests/contract-lab.spec.ts` | Same-scope Panel/List composition, migrated diagnostics, public Style Lab Panel collapse/expand with focus retention, and the reachable gallery/chart                                                              |
| Lab   | `apps/lab/tests/contract-lab.spec.ts` | Shared AlertDialog open, cancel, and focus restoration                                                                                                                                                             |
| Lab   | `apps/lab/tests/contract-lab.spec.ts` | Regular/compact density, coarse-pointer geometry, and portal-boundary movement                                                                                                                                     |
| Lab   | `apps/lab/tests/contract-lab.spec.ts` | Browser Dev Bridge discovery, disclosed writes/waits, restore, stale-generation rejection, the independent read-only Style Lab registration, and one public Standalone DashGroup-to-disclosed-metadata correlation |

The six Lab titles are the public acceptance surface. They collect browser console and page errors,
use no skips, retries, hidden exclusions, or parameterized test expansion, and are listed together
with the two retained audit tests by `bun run --filter @picodash/lab test:e2e:cap`.

Placement, interaction, composition, overlays, documents, and themes remain visible as accepted
preset descriptions. Only the landed Panel/List composition and shared AlertDialog behavior are
exercised in this cutover; planned behavior is not simulated by the specimen.

The Composition journey retains only the rendered browser seams for Panel collapse: public
collapse/expand controls, focus retention, and the visible/inert Panel body. Deterministic
DashList behavior removed with the standalone browser matrix remains owned below E2E:

| Retired standalone browser assertion                                                       | Primary replacement evidence                                                                           |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| DashGroup collapse resolution and mounted descendant state                                 | `packages/dashlist/tests/dashlist.test.tsx`                                                            |
| Declaration order, customized order, reorder commit/cancel, and reset-to-declaration order | `packages/dashlist/src/ordering/model.test.ts` and `packages/dashlist/tests/dashlist.test.tsx`         |
| Collapse/order metadata reset                                                              | `packages/nexus/tests/scope-metadata.test.ts` and `packages/dashlist/tests/dashlist.test.tsx`          |
| Registered value and draft reset                                                           | `packages/nexus/tests/reset-registered-values.test.ts` and `packages/dashlist/tests/dashlist.test.tsx` |

Bridge discovery, disclosed writes and waits, document restore, and stale-generation rejection
remain together in the separate browser Dev Bridge journey; none moved into the Composition test.
That Bridge journey retains exactly one Standalone DashList metadata seam: after the independent
Style Lab registration leaves the primary session unchanged, it collapses one group through public
UI, waits for the primary sequence, and inspects the already disclosed collapse override. It does
not restore the retired reorder/reset sequence or a full metadata matrix.
