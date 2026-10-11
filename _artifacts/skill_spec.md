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
