# Picodash agent evaluations, version 1

These scenarios evaluate whether a coding agent can add Picodash to an existing React application
while making sound state-ownership, exposure, composition, accessibility, and verification
decisions.

Each scenario is a transparent, deterministic contract:

- `seed/` is a minimal working app with no Picodash dependency or implementation.
- `prompt.md` is the vendor-neutral task given to the coding agent.
- `seed/acceptance/` contains the acceptance harness. It is intentionally visible and must not be
  edited by the coding agent.
- `rubric.md` separates deterministic checks from manual code-review criteria.
- `expected-decisions.md` records the intended architectural decisions without prescribing
  incidental component structure.

## Manual release run

For each scenario:

1. Copy `seed/` to a clean temporary directory.
2. Install its existing dependencies.
3. Give the coding agent only the clean copy and the scenario `prompt.md`.
4. Do not let the agent edit files under `acceptance/`.
5. Run `bun run acceptance` in the completed copy.
6. Score the result with `rubric.md` and compare architectural choices with
   `expected-decisions.md`.

The initial seed is expected to fail acceptance because Picodash has not been implemented yet.
CI should run the deterministic acceptance tests against completed evaluation artifacts only; it
must not run or simulate a coding agent.

## Scenarios

| Scenario                      | Host               | Required state boundary         |
| ----------------------------- | ------------------ | ------------------------------- |
| `next-creative-controls`      | Next.js App Router | Existing React-owned state      |
| `vite-application-monitor`    | Vite               | Native Picodash Store           |
| `next-debug-feature-controls` | Next.js App Router | Existing external store adapter |
