# Dev Bridge agent instructions

Read this file before changing `@picodash/dev-bridge`, its Lab host, or agent-facing Nexus
inspection. Also read [`../development/agent-dev-bridge.md`](../development/agent-dev-bridge.md),
[`../../packages/dev-bridge/README.md`](../../packages/dev-bridge/README.md), and the Nexus agent
instructions when changing Nexus-facing behavior.

## Decision lens

Dev Bridge shortens the feedback loop between an agent's intent, public Nexus behavior, and the
real browser UI. It is an adapter and consumer, not a privileged debugger or second state
authority. Make it easier to discover, inspect, mutate, wait, and diagnose only within an
application's explicit disclosure and write policies.

If Bridge friction makes DashPanel or DashList development harder to inspect, automate, or verify,
prioritize the smallest safe Bridge improvement before adding a product workaround. Dogfood that
improvement against a real browser Nexus consumer and feed general Nexus gaps back into Nexus.

## Non-negotiable boundaries

- Bind relay and broker servers to loopback and refuse production operation.
- Authenticate agent access; use origin-bound, single-use browser credentials.
- Enforce explicit disclosure, write allowlists, capabilities, session generations, sequencing,
  request identity, payload bounds, and redacted errors at every relevant boundary.
- Never bypass Nexus validation or expose arbitrary evaluation, arbitrary Nexus access, filesystem
  access, or application authority.
- Treat reload as a new generation and fence stale connections and mutation results.
- Keep credentials out of argv, browser child environments, and logs; create private files and
  clean them up only when ownership matches.
- The one-port-per-worktree policy applies only to web application servers. Relay and credential
  broker processes may bind as many ephemeral loopback ports as required.

Dangerous operations such as persistence, import, reset, or broad mutation remain deferred unless
their owning contract supplies preview, confirmation, idempotency, disclosure, and audit behavior.

## Evidence

Use protocol tests for authentication, validation, fencing, sequencing, error mapping, and cleanup.
Use the Contract Lab's real browser journey for the cohesive discover, inspect, write, wait, reload,
and stale-generation path. Do not duplicate the protocol matrix in browser tests.
