# Application and development-server agent instructions

Read this file before changing `apps/lab`, `apps/web`, Playwright server configuration, or local
server scripts. For web changes, also read `apps/web/AGENTS.md` explicitly. For Contract Lab tests,
read the testing instructions and every product reference exercised by the journey.

## Application ownership

- `apps/web` is the production Next.js evaluation website. `/` is its only public route.
- `apps/lab` is the local Contract Lab at `/lab` and renders checked-in audit reports.
- Applications own routing, transport, authentication, authorization, exposure policy, and which
  Panels and Dashlets are mounted.

## Ports and lifecycle

The root `web`, `lab`, and E2E commands use the default server ports in the primary checkout. In a
linked worktree, `bun run port:configure` checks `6034-6039` in order, skips unavailable ports,
and writes the first free port to that worktree's ignored `.env.local` as both `WEBSITE_PORT` and
`LAB_PORT`. Those root commands run the configuration automatically. Do not select ad hoc ports
outside the assigned range.

The one-port-per-worktree convention applies to web application servers. Dev Bridge may use
multiple ephemeral loopback ports for its relay and browser-credential broker. Keep those ports
loopback-only and never replace the Lab web server's configured port with an ephemeral one.

Server launchers must forward termination signals and clean up only resources they own. Do not
pass Dev Bridge bearer credentials to browser children, argv, or logs.

## Evidence

Use Contract Lab for browser-only product seams and the real Dev Bridge consumer path. Use website
E2E for public journeys. Do not use either suite to duplicate package-level state or protocol
matrices. Keep framework-specific advice out of package examples unless the package has an accepted
host contract.
