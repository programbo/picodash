# Picodash initial Intent batch

Two independently useful consumer tasks are covered: bind application controls with the facade,
and add persistent docked-panel shortcuts with DashPanel. This is a bounded batch, not a claim
of whole-library coverage. Nexus-only persistence recovery, advanced Stack composition, and
Dev Bridge are outside this initial guide set.

Evidence: package public exports, the existing installed `Controls.tsx` interaction fixture,
consumer recipes, DashPanel source and its shortcut component/browser tests. Source package
version is 0.0.0; dogfood staging stamps each guide with the immutable bundle version.

Decisions: package-owned skills ship under `skills/`; no Intent runtime dependency; consumer
allowlist stays explicit. Shared CSS is loaded once. Guidance uses public APIs and preserves
application-owned state and solver rules. Recording uses the TanStack state protocol; Nexus owns
only committed preference text. No shortcut implies authorization for unrelated actions.

Verification is recorded in tests/skills/README.md. Maintainer sync, validate, review, and check
must pass before recommending the bundle. Installed bundle smoke tests verify discovery and
run the guide-backed controls and shortcut examples.

## Coverage and batch history

2026-10-12 follow-up to dogfood.40: extend the existing Panel guide to closeable floating and
non-collapsible Panels; extend the facade guide to contextual detachable groups. Keep skill IDs
stable. Bindings remain opaque Nexus metadata, keyed by Stack/group identity; eligibility is
derived from original Panel runtime. Visible duplicate contexts use active-parent arbitration.
Task fixtures: ContextualShortcuts.tsx and contextual-shortcuts.test.tsx. Source baseline 9af52fa.
Fresh consumer and browser evidence is recorded in tests/skills/README.md after execution.

## 2026-11-13 consolidation

The user requested an archive of old target contracts and a code-first documentation reset.
Existing bind-controls and docked-panel-shortcuts tasks remain the selected batch. Their source paths
now point to rebuilt implementation references; old ADRs/status claims are historical.
Manual Panel sizing and contextual group detachment coexist; the latter retains session layout v2.
No generic Nexus extension or new skill is claimed. The Nexus audit records consumer coupling and
API consistency/completeness proposals separately from implemented behavior.
Verification and any fresh-consumer limitation are recorded in docs/internal/consolidation-audit.md.
