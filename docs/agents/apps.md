# Application and development-server agent instructions

Read this file before changing `apps/lab`, `apps/web`, Playwright server configuration, or local
server scripts. For web changes, also read `apps/web/AGENTS.md` explicitly. For Contract Lab tests,
read the testing instructions and every product reference exercised by the journey.

## Application ownership

- `apps/web` is the production Next.js evaluation website. `/` is its only public route.
- `apps/lab` opens `/lab` to the mobile Dashlet refinement gallery. **Contract tools** opens the
  six-preset Contract Lab on the same route. The app also renders checked-in audit reports.
- `/lab/planetary` is the controls-only planetary example: reorderable reduction/module targets,
  hard physical constraints, and inferred gear geometry. Solver provenance and limits live in
  [`../../apps/lab/src/components/contract-lab/planetary/README.md`](../../apps/lab/src/components/contract-lab/planetary/README.md).
- Applications own routing, transport, authentication, authorization, exposure policy, and which
  Panels and Dashlets are mounted.

Keep `install.globalStore = false` in the root `bunfig.toml`. Turbopack rejects dependency
symlinks that point outside its repository filesystem root. After a Next.js upgrade, remove
stale generated `.next` directories if a build cannot resolve its internal PostCSS transform.

## Ports and lifecycle

Reserve the worktree's Hermes range with `bun run port:reserve` and release it with
`bun run port:release` after the work is merged. Use the repository's assigned web server ports;
do not choose ad hoc alternatives.

The one-port-per-worktree convention applies to web application servers. Dev Bridge may use
multiple ephemeral loopback ports for its relay and browser-credential broker. Keep those ports
loopback-only and never replace the Lab web server's reserved port with an ephemeral one.

Server launchers must forward termination signals and clean up only resources they own. Do not
pass Dev Bridge bearer credentials to browser children, argv, or logs. Stale-lock recovery must
confirm ownership and process death before removing files.

## Evidence

Use Contract Lab for browser-only product seams and the real Dev Bridge consumer path. Use website
E2E for public journeys. Do not use either suite to duplicate package-level state or protocol
matrices. Keep framework-specific advice out of package examples unless the package has an accepted
host contract.

To exercise an already-running Lab on its allocated port, set `LAB_PORT` and
`LAB_REUSE_SERVER=1` when running `bun run --cwd apps/lab test:e2e`. The default still starts and
owns its server; reuse is an explicit local verification option, never a second server allocation.
