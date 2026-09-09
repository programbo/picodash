# D1: keep Nexus for DashPanel

Decision: **Keep**. Owner hands-on validation: **Approved**. D1 is complete.
Recorded on 2026-09-09 after the owner confirmed Nexus is suitable for DashPanel and authorized
closing the decision. This is a recovery milestone decision, not acceptance of every Nexus API.

## Retained surface

Retain application-owned Nexus creation and destruction, stable Nexus and Panel identities,
Nexus-owned settled Panel layout metadata, the public Web Storage persistence driver, and layout
reset through DashPanel actions. Applications provide the Nexus to `DashPanelProvider` and declare
Panel defaults. DashPanel owns placement and transient interaction; Nexus owns durable overrides.

Ordinary Panel setup does not require application code to operate leases, revision counters, or
repair plans. These are not additional application-facing requirements approved by this decision.
The application still owns storage configuration, initialization failure handling, and root cleanup.

## Evidence and simplification assessment

The owner approved the browser experience. The existing Contract Lab journey titled
“persists, restores, resets, and safely recovers settled DashPanel layout” proves saved placement
through reload, Bridge-visible metadata, reset through another reload, and recovery to declared
defaults for invalid or obsolete saved data. Package tests own Panel wiring and Nexus invariants.

The final M4 checks passed on PR #124, merged as `e5e77e4a01ee0e7496ef959029aebf086a585089`.
That change also fixed cancellation of pending Bridge registration before root destruction and
added a deterministic regression test. The full 14-journey Lab suite passed in hosted CI.

No blocking simplification is identified in the exercised slice. Keep the current public
composition; do not introduce an additional setup abstraction without demonstrated friction.
This does not classify unexercised implementation or tests as necessary product requirements.

## Deferred capabilities and rejected alternative

Documents, application-authored migrations, advanced repair or stale-overwrite plans, external
store adaptation, and DashList value/binding behavior are not justified by the DashPanel slice.
Their existing contracts are not removed or globally approved by D1. Reassess them only in their
owning milestones when a supported workflow needs them.

Reject replacing Nexus or introducing a separate application-owned layout store for this slice:
the exercised public composition delivers durable layout, reset, and cleanup without a demonstrated
benefit from another state authority. No new ownership or package-boundary contract is introduced.

## DashList proof obligation

M4 establishes basic standalone value binding. M5 must prove visible invalid drafts with valid
canonical values, all-or-nothing multi-field writes, confirmed reset to defaults, and persistence
through refresh, using both ready-made and composed controls. D2 then decides Nexus fitness for
DashList data. D1 does not remain open while that separate evidence is gathered.
