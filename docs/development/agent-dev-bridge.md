# Agent Dev Bridge

The Agent Dev Bridge is a local development adapter for the public `@picodash/store` API. It gives
an agent a narrow, authenticated view of explicitly disclosed Contract Lab state: discover a
session, inspect values/scopes/diagnostics, set allowlisted values, and wait for a value or sequence
change. It does not expose an arbitrary Store debugger and must never run in production.

## Quickstart with Contract Lab

From the repository root:

```bash
bun run port:reserve
bun run lab
```

Wait until the Lab host writes `.picodash/dev-bridge.json`. The file is private (`0600`),
gitignored, and contains the agent URL and bearer token. The relay and browser-credential broker
use ephemeral loopback ports; the Lab web server uses its Hermes-reserved fixed port.

Load the two values into the environment without placing the token in argv or shell history. This
example reads the file in short-lived Node processes and exports only the resulting environment
variables:

```bash
export PICODASH_DEV_BRIDGE_URL="$(node -e 'const fs=require("fs"); const c=JSON.parse(fs.readFileSync(".picodash/dev-bridge.json","utf8")); process.stdout.write(c.url)')"
export PICODASH_DEV_BRIDGE_TOKEN="$(node -e 'const fs=require("fs"); const c=JSON.parse(fs.readFileSync(".picodash/dev-bridge.json","utf8")); process.stdout.write(c.token)')"
bun run --filter @picodash/dev-bridge build
```

Use the built CLI with `node packages/dev-bridge/dist/cli.mjs`. It reads only
`PICODASH_DEV_BRIDGE_URL` and `PICODASH_DEV_BRIDGE_TOKEN`; it never accepts credentials as flags.

### Discover sessions

```bash
node packages/dev-bridge/dist/cli.mjs sessions
```

The JSON output includes `sessionId`, `generation`, `sequence`, disclosure/write allowlists, and
the capabilities `inspect`, `set_values`, and `wait`. Select a current session and keep both its
`sessionId` and `generation` together. A browser reload keeps the session ID but increments its
generation; rediscover before retrying and do not mutate with a stale reference.

### Inspect disclosed state

```bash
node packages/dev-bridge/dist/cli.mjs inspect \
  --session-id SESSION_ID --generation 1
```

### Set disclosed, writable values

The command body is JSON on stdin. This changes only fields the browser registration explicitly
made writable (the Contract Lab specimen uses `specimenMetric`):

```bash
printf '%s\n' '{"values":{"specimenMetric":42}}' |
  node packages/dev-bridge/dist/cli.mjs set-values \
    --session-id SESSION_ID --generation 1
```

The response distinguishes a successful transaction from a Store rejection or contract error.
The bridge does not bypass Store validation.

### Wait for a change

Wait for a value to equal `42`, requiring a sequence newer than `7`:

```bash
printf '%s\n' '{"timeoutMs":1000,"condition":{"type":"value_equals","field":"specimenMetric","value":42,"afterSequence":7}}' |
  node packages/dev-bridge/dist/cli.mjs wait \
    --session-id SESSION_ID --generation 1
```

The other condition is `{"type":"sequence_after","sequence":7}`. A wait returns
`outcome: "satisfied"` or `"timed_out"`; Ctrl-C aborts it.

## Exit meanings

- `0`: command completed; a wait was satisfied and a set-values transaction was accepted.
- `2`: usage, credential configuration, or stdin JSON/schema error.
- `3`: transport, protocol, or local internal failure.
- `4`: bridge error such as unauthorized, unavailable session, stale generation, unsynchronized
  browser, or denied capability.
- `5`: Store set-values contract error or rejected transaction.
- `6`: wait timed out.
- `130`: wait interrupted with Ctrl-C.

JSON responses are written to stdout; local CLI errors are redacted and written to stderr.

## Security and lifecycle

The dev host creates `.picodash` as `0700`, writes `dev-bridge.json` and its lock as `0600`, and
removes owned files on clean shutdown or child exit. It refuses a live lock and safely recovers a
stale lock. If a process was killed, remove only the stale `.picodash/dev-bridge.lock` after
confirming the recorded PID is no longer live, then restart `bun run lab`; do not reuse a stale
credential. Cleanup is ownership-checked and will not remove a replacement file.

The browser receives a separate, origin-bound, single-use credential from the Lab's local broker.
The agent bearer token is never passed to the browser child or printed in logs. Disclosure and
writable allowlists are enforced at registration and again on every relay/browser command. The
relay is loopback-only, rejects non-allowlisted origins, and is disabled in production builds.

When the browser reconnects after reload, the relay increments the session generation and rejects
old references. Always run `sessions` again; never retry a mutation using the old generation.

Stop the Lab with Ctrl-C so the host can close the broker/relay and remove owned credentials. If
the Lab is already stopped, a new start performs stale-lock recovery as described above.

## Scope and roadmap

Implemented baseline: Store relay, browser connector, typed HTTP client, CLI, and Contract Lab
dogfood (discover, inspect, set, wait, and reload-generation rejection). The same journey now proves
Bridge writes through single and compound DashList bindings, UI input observed by Bridge, stale
draft behavior after an external write, confirmed DashList-owned overwrite observed through
inspect/wait, identified Store migration with a projected disclosed value, quarantined metadata
diagnostics, public metadata replacement, and a live Store session retained while DashPanel hides
and reopens. The same browser journey also creates and executes a value-free Store document export
plan, mutates the disclosed metric through Bridge, then analyzes and imports the captured document
locally; browser state and Bridge inspect/wait confirm restoration without exposing document
contents or adding Bridge authority. No Bridge extension was needed: focus, visibility, and
activation remain Provider-owned browser behavior rather than agent protocol authority; raw
quarantine payloads stay undisclosed.

MCP stdio parity is a follow-on only if the CLI proves useful. Bridge persistence, reset, and other
dangerous extensions remain deferred; they require preview, explicit confirmation, idempotency, and
an audit trail before implementation. Store document import/export remains a browser-local
consumer capability; document contents are not added to the Bridge protocol.

Background and tracking: [Picodash issue #80](https://github.com/programbo/picodash/issues/80).
