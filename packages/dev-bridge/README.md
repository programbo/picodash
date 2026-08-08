# `@picodash/dev-bridge`

`@picodash/dev-bridge` is a development-only, adapter-like consumer of the public
`@picodash/store` contract. It lets a local agent discover explicitly disclosed Store sessions,
inspect disclosed values/scopes/diagnostics, set allowlisted values, and wait for a value or
sequence change while the Contract Lab is running. It is not a Store extension, application API,
or production transport.

## Current surface

- `@picodash/dev-bridge` exports the loopback relay, typed client, and protocol types. The package
  also provides the separate `picodash-dev-bridge` CLI binary.
- `@picodash/dev-bridge/browser` exports the browser connector used by the Contract Lab.
- The relay serves an authenticated HTTP client API and an origin-bound, single-use browser
  credential over the `picodash.dev-bridge.v1` WebSocket subprotocol.
- Browser registrations disclose value fields, scope IDs, and diagnostics explicitly; writable
  fields must be a subset of disclosed value fields.

The baseline supports `sessions`, `inspect`, `set-values`, and `wait`. The exact local setup,
credential handling, and exit codes are in [the operational guide](../../docs/development/agent-dev-bridge.md).

## Development boundary

The relay refuses to start when `NODE_ENV=production`. It binds loopback only, uses ephemeral
ports, keeps agent and browser credentials separate, and writes no credentials to command-line
arguments. The bridge does not add Store behavior or change Store persistence semantics.

The implemented baseline is Store relay/browser/client/CLI plus Contract Lab dogfood. Next, dogfood
DashList and DashPanel and feed genuine public-contract gaps back to Store. Consider MCP stdio parity
only if the CLI proves useful. Persistence/import/reset extensions are deferred; any future
dangerous operation needs preview, confirmation, idempotency, and an audit trail.
