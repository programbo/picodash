# `@picodash/dev-bridge`

`@picodash/dev-bridge` is a development-only, adapter-like consumer of the public
`@picodash/nexus` contract. It lets a local agent discover explicitly disclosed Nexus sessions,
inspect disclosed values/scopes/diagnostics, set allowlisted values, and wait for a value or
sequence change while an explicitly enabled development host is running. It is not a Nexus extension, application API,
or production transport.

## Current surface

- `@picodash/dev-bridge` exports the loopback relay, typed client, and protocol types. The package
  also provides the separate `picodash-dev-bridge` CLI binary.
- `@picodash/dev-bridge/browser` exports the browser connector used by the Contract Lab.
  Its optional abort signal cancels registration and closes the connection during host teardown;
  see the operational guide for ownership and cleanup.
- The relay serves an authenticated HTTP client API and an origin-bound, single-use browser
  credential over the `picodash.dev-bridge.v3` WebSocket subprotocol. Version 3 adds explicit read-only observations and build identity; the subprotocol cutover
  prevents version 1/2 peers from silently accepting an incompatible snapshot contract.
- Browser registrations disclose value fields, scope IDs, and diagnostics explicitly; writable
  fields must be a subset of disclosed value fields.

The baseline supports `sessions`, `inspect`, `set-values`, and `wait`. The exact local setup,
credential handling, and exit codes are in [the operational guide](../../docs/development/agent-dev-bridge.md).

## External development consumers

Dogfood .53 and later deliver this private package as an opt-in development dependency:
`bun /path/to/CURRENT/install.mjs /path/to/app --dev-bridge`. A portable `/host` export and the
`picodash-dev-bridge-host --origin http://127.0.0.1:PORT -- COMMAND [ARGS...]` launcher own the
relay, broker, development child/process group and private credentials. The browser entry exports
`connectPicodashDevBridgeFromBroker`; missing broker or disabled development quietly returns a
no-op result. Production previews remain unchanged. [Copyable external setup](../../docs/development/agent-dev-bridge.md#external-development-apps)
includes lifecycle, selection, credentials and rollback through the current installer.

Explicitly disclosed named application observations stay read-only and outside Nexus. Their
available/unavailable envelope and `observation_equals` wait can correlate an app-owned terminal
solver revision with requested preferences and solved actuals. Public Panel metadata can join the
same app projection. This does not add solver authority or app commands. The v3 subprotocol fences
older peers. [Observation and revision recipe](../../docs/development/agent-dev-bridge.md#correlate-solver-completion-with-the-accepted-request)
explains no-op/presentation writes, terminal no-fit/error, and retained stale results.

## Development boundary

The relay refuses to start when `NODE_ENV=production`. It binds loopback only, uses ephemeral
ports, keeps agent and browser credentials separate, and writes no credentials to command-line
arguments. The bridge does not add Nexus behavior or change Nexus persistence semantics.

The implemented baseline is Nexus relay/browser/client/CLI plus Contract Lab dogfood. The Lab now
uses the existing inspect/set/wait surface to verify bound Dashlets, retained Panel lifecycle, and
DashStack stale-draft overwrite confirmation without exposing transient UI plans through the Bridge.
The same disclosed session now dogfoods an identified Nexus migration, safe quarantined-metadata
diagnostics, and public metadata replacement without exposing raw quarantine payloads. It also
captures a value-free Nexus document export plan, mutates the disclosed metric through Bridge, and
restores the captured document through public Nexus analysis/import while Bridge inspect/wait
observes the result; document contents stay browser-local and the protocol is unchanged.
Consider MCP stdio parity only if the CLI proves useful. Bridge persistence/reset extensions are
deferred; any future dangerous operation needs preview, confirmation, idempotency, and an audit
trail.

Implementation status and primary verification owners are recorded in the
[contract conformance matrix](../../docs/reference/contract-conformance.md#agent-dev-bridge).
