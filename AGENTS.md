<!-- intent-maintainer:start -->

## Library Skill Maintenance

Use the repository’s installed Intent. If it is unavailable, report the missing dependency instead of downloading a replacement.
Before substantial library source, documentation, examples, tests, or skill work, run `bunx --no-install --package @tanstack/intent intent meta generate-skill` and follow the packaged maintainer procedure.
Use the current request and repository evidence. For initial skills, propose a useful batch and reuse any scope already agreed with the maintainer.
Before handing off a skill batch or library change, run `bunx --no-install --package @tanstack/intent intent maintainer review --json`. Follow the maintainer procedure to update affected guidance, run task checks, and record completed review outcomes. Report an evidence-backed no-op or missing evidence explicitly.
Create and incrementally maintain domain_map.yaml, skill_spec.md, and skill_tree.yaml in the established artifact location for every skill batch. Preserve prior tasks, maintainer decisions, and remaining work.
Keep maintainer decisions and changes in the repository; do not require the user to repeat the procedure in later sessions.
Use intent maintainer setup to initialize missing records, maintainer add to register skills, maintainer status to identify work, and maintainer sync to update generated metadata. Finish with intent maintainer check.
<!-- intent-maintainer:end -->

# Picodash agent guide

Read [the documentation index](docs/index.md), the matching package reference under `docs/reference`,
and [the Nexus audit](docs/design/nexus-api-audit.md) before changing state ownership or public contracts.
For Bridge work read [its current guide](docs/development/agent-dev-bridge.md).
For tests read [TESTING.md](TESTING.md); for servers read [development](docs/development/index.md).
For `apps/web`, also read [its AGENTS.md](apps/web/AGENTS.md). These routes are explicit, not transcluded.

## Authority

The user requested the old documentation be archived and the active docs rebuilt from code on 2026-11-13.
Current references describe implemented behavior. Proposed architecture is recorded separately; do not claim a proposal has shipped.
Old ADRs, completion statuses and target contracts live under `docs/archive` and are historical evidence, not active instructions.
Do not modify archived bytes. Legal notices, executable evaluation fixtures and Intent records retain their owners.

## Boundaries and conventions

Nexus is intended to be a generic typed data/state foundation, independently usable in any application.
It currently embeds consumer concepts; use the audit to identify them before extending those contracts.
Consumers should own orientation, named interactions and presentation policies. No extraction is implied merely by documenting the current coupling.
Nexus must make persisted and ephemeral state easy to expose without baking in application-specific names.

UI owns shared presentation, DashPanel owns hosting/placement, DashStack owns composition and bindings, Picodash integrates them,
and Dev Bridge consumes public Nexus APIs for development inspection. Foundation packages must not depend on the Bridge.
No blanket exports, cross-package source imports or edits to generated `dist` output.

Use Bun and the installed Vite+. Use `rg` for search, `vp lint` and `vp fmt`, and the owning typechecker.
Keep JSON values and payloads strict. Validate complete candidate batches before canonical mutation.
Keep pointer previews, resolved geometry, visibility, focus, activation and z-order ephemeral.
Persist only settled consumer preferences and application-authorized values.
Use the project's variant convention and `cn` helper instead of interpolated className strings.
Use semantic tokens, keyboard/pointer parity and accessible names. Preserve portal, theme, focus and overlay ownership.

Identify emergent protocols and model their states, events, guards and cleanup explicitly.
Recommend XState v5 when appropriate, otherwise use the project's trusted state model.
The worst state machine is the one you don't know you're writing.

Run the narrow owning check first. `bun run ready` is for release/integration boundaries.
After public source changes build packages, run `bun run docs:generate`, update behavioral references, and run `bun run docs:check`.
Run Intent's recorded review workflow before handoff. Make a scoped commit after appropriate QA and leave unrelated work untouched.

## Servers

Reserve the worktree's Hermes port with `bun run port:reserve`, use that port for web apps, and release it after merge.
One web app per worktree runs at a time; Bridge relays may use ephemeral loopback ports.
Never print credentials. Close only task-owned browser/server processes; preserve personal browsers and other active worktrees.
Use `AGENT_BROWSER_IDLE_TIMEOUT_MS=900000` for agent-browser and close the owned session on completion.

## Repository

`packages/{nexus,ui,dashpanel,dashstack,picodash,dev-bridge}` contain the six packages.
`apps/lab` contains the gallery, Contract Lab and application examples; `apps/web` contains the evaluation site.
`docs/reference/api` is generated from actual package artifacts. `docs/design` contains proposals and audits.
`docs/internal/consolidation-audit.md` records the integration evidence. `docs/archive` preserves superseded documentation.
