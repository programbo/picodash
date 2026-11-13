# Consolidation and verification record

Source audit and integration date: 2026-11-13. Integration branch: `integration/consolidate-latest`.
This record distinguishes implementation integration, documentation evidence and executed checks. It does not assign milestone completion percentages.

## Source disposition

| Source                                                                                                                               | Revision                                   | Disposition                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Original local main, including the first stale-baseline inventory                                                                    | `8a94eb312cffc7639f594ecbd09b81f4e82a0ba9` | Merged into integration; old inventory archived                                                                                                                                                       |
| Current DashStack, controls, gestures, subgroups, detachable groups, hotkeys, Bridge observations and consumer tooling               | `4e065ce28873b58c1dd2d1bd3aa0f0eec24549a6` | Integration base; retained                                                                                                                                                                            |
| Latest manual Panel sizing, sparse layout v2, interaction events, unclipped resize controls, scroll cues and local consumer workflow | `5c9d2451282dfb9f3bafc27d87030327a9fd6ffc` | Merged with explicit semantic conflict resolution in `6a19e527`                                                                                                                                       |
| Open numeric compatibility PR #107                                                                                                   | `e79a4f80d7261fd2d69f0e01dcae51e14cf08515` | Useful tiny-step arithmetic, scientific/localized parsing and NumberField interactions ported into evolved DashStack; old DashList source superseded. Reconciliation ancestry recorded in `e72ae6ff`. |
| Remote dependency-only main                                                                                                          | `5f4d71617d13541d04be2b23ab5b154957a32c42` | Already present through the current feature branch; dependency-only scope retained                                                                                                                    |

Backup refs preserve original main and resize tips: `backup/main-before-consolidation-20261113` and
`backup/resize-before-consolidation-20261113`. Other worktrees remain intact.
Older local branches often fail ancestry tests because their PRs were squash-merged. GitHub records confirm merged authored PRs
#148, #147, #126, #125, #124, #118, #117, #99, #98, #97, #96, #94, #93, #92, #91, #84, #83, #82, #81, #74, #73, #72, #69, #68 and #67.
Their obsolete implementations were not resurrected. Open automated dependency updates are separate proposed upgrades, not undiscovered authored product work.
The old uncommitted performance experiment uses removed packages/routes and remains untouched in its original worktree; untracked output is not merged as source.

## Reconciled seams

- Sparse Panel layout v2 now coexists with opaque Panel/group hotkeys and Stack metadata. Obsolete Panel recovery preserves unrelated valid preferences; a hydration regression covers the combined envelope.
- Detached group transfers use their session layout Nexus and preserve manual layout intent. Physical Panel activation remains separate from logical Stack membership.
- Bridge observations and interaction-event reads share protocol v4. A single session test proves observations survive event reads with independent event/snapshot sequences.
- Stack scroll measurement, item sources and reorder events coexist. Shared masks use measured geometry; exterior cues retain their scroll-position-only animation exception.
- Status treats signed zero consistently with choice identities. Slider/Range retain safe presentation fallbacks for unscalable steps.
- NumberField keeps the current dispatch-bounded edit authorization while recovering tiny-step keyboard, text, paste, wheel and localized scientific handling from PR #107.

The initial component/browser runs caught integration defects and stale journeys.
The merged Panel chrome required truncatable shortcut/title space, a shell minimum based on usable controls rather than placeholder text,
and a flex allocation for a Stack inside the new Panel content wrapper. Browser checks exercise those composed behaviors. Resize tests now enter **Contract tools** before using the harness.
TargetNumber label checks follow the deliberate above-field layout in `0b4dd39e`.
Drag tests select heading text rather than a header center occupied by new action controls. Dock-mode parity compares coordinates relative to the boundary so scrolling to a control cannot invalidate a viewport-coordinate baseline. Resize handles retain their own hit regions.
Phone sizing assertions respect the new minimum usable header width and the actual boundary rather than assuming an unconditional 16rem shell.
Long cohesive multi-context journeys have measured 60-second budgets; tests remain admitted in the normal suite.
Shared scroll-mask checks now assert pixel depth from the measured mask, separately from normalized scroll cue animation.
One browser run overlapped a package rebuild and saw missing generated CSS. That run is invalid evidence; builds and browser verification now run sequentially.

## Documentation reset

[The archive](../archive/2026-11-13/README.md) preserves 244 exact Markdown/llms files from the three source snapshots.
Its manifest maps original paths and archive paths and records SHA-256 digests. Archived task/planning filenames are inert to Intent discovery.
Legal notices, executable evaluation fixtures, task skills and operational records retain their owners.

Active references and six package READMEs were rebuilt from source. [Generated API pages](../reference/api/index.md)
list manifest entrypoints, every public runtime/type name, and exact emitted declarations. Source fingerprints detect stale inventories.
[The Nexus design audit](../design/nexus-api-audit.md) records consumer coupling, overlap, consistency and missing API families separately from shipped behavior.
No generic Nexus extension extraction is claimed by this consolidation.

## Executed verification

| Check                                                  | Observed result                                                                                                        |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Package release checks                                 | All six packages passed checks, tests, builds, artifact assertions and pack dry runs                                   |
| Nexus unit/type fixtures                               | 493 tests passed                                                                                                       |
| UI component/style tests                               | 88 tests passed                                                                                                        |
| DashPanel geometry/component tests                     | 263 tests passed                                                                                                       |
| DashStack component/control tests                      | 330 tests passed, including tiny-step fallback, signed-zero Status, parsing and edit-authorization regression coverage |
| Picodash integration/consumer fixtures                 | 35 tests passed, including retained detachable groups and contextual shortcuts                                         |
| Bridge protocol/browser-connector tests                | 62 tests passed, including combined event/observation session                                                          |
| Lab collection cap                                     | 23 tests collected, below the unchanged ceiling of 40                                                                  |
| Resize browser journeys after Lab-entry reconciliation | 3 passed                                                                                                               |
| Public API inventory and agent/motion artifacts        | Passed after documentation rebuild                                                                                     |

The final complete Lab rerun passed all 23 tests and the website suite passed all 3 tests.
The final full `bun run ready` passed the audit, six package release checks, artifact/document checks, workspace checks, all unit suites,
both app builds, all three clean evaluation-seed builds and both complete browser suites. One earlier Lab run stopped at a help-overlay keyboard-toggle assertion;
that assertion passed its focused rerun and the subsequent complete Lab run. No retry lane, skip or quarantine was added.

An isolated installed consumer of trial `0.1.0-dogfood.56` passed install, repeat install, frozen reinstall, typechecking,
component interactions and Vite/Next CSS builds after the final source fixes. Bundle tooling passed all seven tests.
The clean-source recommendation is `0.1.0-dogfood.57`; generated bundle receipts live under `output/dogfood`, outside tracked source.
Intent retains the two existing task guides; their examples and source mappings remain valid. No new independently authored task implementation
was generated during this consolidation; the fresh consumer executes the retained public examples and task fixtures.

Main promotion retains ancestry rather than flattening the product branches. The source revision table above and Git ancestry establish
which implementation lines were incorporated; archived target prose is not used as completion evidence.

## Dependency verification

The inherited release audit reported nine high/critical findings. Updated Next.js to 16.4.6, Vite+ and its core alias to 1.6.0,
Zod to ^4.6.7, and the Undici override to 8.12.4. The subsequent high-threshold audit found no vulnerabilities at that threshold
(432 packages checked; two findings below the threshold). Published advisories: [Next.js](https://github.com/advisories/GHSA-2464-fhr4-w9xw),
[Vite+ bundled tooling](https://github.com/advisories/GHSA-587h-7wmj-h5pm), [Zod](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5).
Global `vp env doctor` passed; its output identifies the available Node 26.13.1 runtime.
Frozen evaluation seeds remain fixture snapshots rather than implied current dependency recommendations.

## Fresh-checkout CI follow-up

The first pushed run exposed a facade release-order defect masked by existing local build output: public consumer fixtures imported
`@picodash/picodash` before its own declarations existed. The facade release command now builds before typechecking; deleting its
`dist` directory and running its release command passed all checks and 35 tests.

The Linux browser run also rejected an assumption that every Motion flight appears immediately in native `getAnimations()`.
Flight direction, keyframes, cancellation fencing, cleanup and reduced-motion behavior now have two deterministic owning tests.
The browser journey retains phase, real transfer, retained editor, focus, pointer and responsive outcomes without depending on Motion's native/JS engine.
No skip, retry-only lane or quarantined test was introduced.

The next fresh job found that the standalone facade release omitted its already-declared Bridge development dependency from the prebuild.
That job now builds Bridge alongside its product foundations. Moving both Bridge and facade output aside, then executing the exact setup
and facade release command, passed all checks and 35 tests. Bridge remains a development-only fixture dependency of the facade.

Linux also exposed scheduler overhead in the 10,000-input telemetry stress test and an unsettled help keyboard journey.
The telemetry test still advances 600 frames and verifies 600 updates followed by one commit, using synchronous `act` for each manually driven frame.
Help keyboard actions now wait for the dialog's focus handoff and completed dismissal before the next action. These assertions exercise the focus contract
rather than racing pending autofocus and exit work. No product behavior, timeout or retry budget changed for either correction.

The facade's detached-group tests also awaited focus after a fixed 20 ms even though opening schedules two animation frames.
Their focus assertions now wait for the required element through Testing Library; all eight detached-group tests pass.
The retained editor identity, draft text, contextual shortcut arbitration and hidden-context assertions are unchanged.

The combined Linux browser run exhausted the default 30-second whole-test budget late in the value-binding and style-lab journeys.
Each spans hundreds of lines of independent actions, reloads or presentation checks. They now use the same 60-second journey budget
as the other long composed scenario; ordinary assertion deadlines remain unchanged, with no retries, skips or extra test lane.
Both targeted journeys passed together locally (12.1 and 17.4 seconds).
