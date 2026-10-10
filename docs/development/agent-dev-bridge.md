# Agent Dev Bridge

The Agent Dev Bridge is a local development adapter for the public `@picodash/nexus` API. It gives
an agent a narrow, authenticated view of explicitly disclosed Contract Lab state: discover a
session, inspect values/scopes/diagnostics, set allowlisted values, and wait for a value or sequence
change. It does not expose an arbitrary Nexus debugger and must never run in production.

## External apps: current support boundary

The supported, end-to-end verified host workflow is currently **Contract Lab only**. The relay,
client, and browser connector are reusable APIs, but there is no shipped external Vite integration
or supported external install command yet. Dogfood `.28` excludes `@picodash/dev-bridge`; the
current snapshot packer still ships only Nexus, UI, DashPanel, DashStack, and Picodash. The Bridge
package is private and declares a `workspace:*` Nexus dependency. Copying its source or packing
it alone is not the reproducible external distribution path used by the public snapshots.

A missing `.picodash/dev-bridge.json` does not mean that a preview is broken. The Lab development
host creates that file when it starts the relay and credential broker. An ordinary Vite dev server,
production preview, or installed Picodash Provider does not start them or register a Nexus session.
The CLI consumes a running relay; it is not a host launcher.

For a production-preview consumer such as planetary designer, keep the preview unchanged. External
Bridge support needs a separate, explicitly enabled development workflow, with a compatible Bridge
package and a host adapter verified outside this monorepo. Changing `NODE_ENV` on a production
preview is not that integration. Until those pieces are delivered, use the Lab quickstart below to
try the protocol; it will inspect the Lab's own Nexus, not a separate application's state.

### What the host adapter must own

The existing lifecycle is implemented by the
[Lab development host](../../apps/lab/scripts/dev-host.mjs), not by `DashPanelProvider` or
`PicodashProvider`. It is a reference implementation, not a Vite plugin:

1. Start `startPicodashDevBridgeRelay` with the exact development browser origin and an ephemeral
   loopback port. The relay rejects `NODE_ENV=production`. Acquire the private host lock and write
   the agent URL/token to an owned `0600` credential file under a `0700` directory.
2. Start an ephemeral loopback credential broker. Its bodyless POST endpoint validates the browser
   origin and issues a separate, origin-bound, single-use browser credential. Pass only its URL to
   the web development process; strip agent credentials from that process's environment. Never put
   the agent bearer token in a `VITE_*` variable or browser bundle.
3. Mount a development-only browser connector against the application's actual Nexus instance.
   Fetch a fresh browser credential, then call `connectPicodashDevBridge` from the `/browser`
   entrypoint with a stable registration ID, explicit disclosure and permissions, and an abort
   signal. The Lab's `NEXT_PUBLIC_*` variable and Next.js launcher are host-specific plumbing.
4. Abort registration/connection before destroying Nexus, including unmount and hot-reload cleanup.
   Re-registration after browser reload creates a new generation; agents rediscover before writing.
   This is not a persistent connection to an old page or a transparent retry of an old mutation.
5. On shutdown, failed startup, or child exit, close the browser connection, broker, and relay;
   terminate the owned development child; remove only credential/lock files whose ownership still
   matches. Ignore credential files in Git and do not print tokens to logs.

The Lab connector is gated on development mode; the low-level browser API does not itself supply
that host gate. An external adapter must enforce its own opt-in development boundary. The verified
origin is a local HTTP browser origin. A tailnet/HTTPS preview is not covered by this loopback
recipe; credentials are bound to the exact origin, including scheme and port.

### Disclosure recipe

Start with explicit read-only disclosure, then allow individual inputs as needed. This example
exposes two existing Lab fields and one scope, and allows writes only to the metric:

```json
{
  "registrationId": "contract-lab-specimen",
  "disclosure": {
    "valueFields": ["specimenMetric", "specimenUnit"],
    "scopeIds": ["contract-lab-standalone-list"],
    "diagnostics": false
  },
  "permissions": { "writableFields": ["specimenMetric"] }
}
```

Use your own existing field keys, scope IDs, and registration ID when an external host becomes
available. Begin with `writableFields: []`, then add only intended inputs; writable fields must be
included in `valueFields`. Omitted disclosure lists and permissions default to empty, and diagnostics
defaults to false. Scope disclosure exposes that scope's metadata for inspection; it does not grant
metadata writes. Registration also enumerates Nexus field keys, so hiding a value does not hide the
existence of its field name. Do not treat disclosure as a way to conceal sensitive field names.

Keep disclosure and permission objects stable across React renders. The
[Lab connector](../../apps/lab/src/components/contract-lab/dev-bridge-connector.tsx) owns its connection
through effect cleanup and must reconnect if these inputs change. Its source shows the lifecycle;
it is not an installable consumer component.

## Quickstart with Contract Lab

Browser hosts pass an `AbortSignal` to `connectPicodashDevBridge` and abort it before destroying
their Nexus. Aborting cancels pending registration or closes an established connection; late
socket frames are ignored. Pending registration rejects with `AbortError`. A resolved connection
also exposes `close()` for explicit teardown. The Contract Lab ties this signal to effect cleanup.

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

The response distinguishes a successful transaction from a Nexus rejection or contract error.
The bridge does not bypass Nexus validation.

### Wait for a change

Wait for a value to equal `42`, requiring a sequence newer than `7`:

```bash
printf '%s\n' '{"timeoutMs":1000,"condition":{"type":"value_equals","field":"specimenMetric","value":42,"afterSequence":7}}' |
  node packages/dev-bridge/dist/cli.mjs wait \
    --session-id SESSION_ID --generation 1
```

The other condition is `{"type":"sequence_after","sequence":7}`. A wait returns
`outcome: "satisfied"` or `"timed_out"`; Ctrl-C aborts it.

### A Bridge sequence is not solver readiness

A successful `set-values` response means Nexus accepted the transaction. A satisfied
`sequence_after` wait means the Bridge observed a newer disclosed snapshot in that session
generation. The sequence is Bridge-owned, not a worker job ID or a guarantee that every Nexus
transaction produced a new snapshot. Changes outside disclosure may not advance it; disclosed
metadata or diagnostics changes can advance it without a solver result.

Neither result proves that React has painted, that a worker has finished, or that a computed design
matches the latest inputs. A solver result held outside Nexus is not visible through this Bridge.
After a canonical write, wait separately for the application's result readiness and correlate it
with the input revision or job ID. An old `ready` result is insufficient. If an app intentionally
publishes result status and revision into Nexus, it can disclose those fields read-only and wait
for the matching revision and ready state; Bridge does not add that application contract itself.

## Exit meanings

- `0`: command completed; a wait was satisfied and a set-values transaction was accepted.
- `2`: usage, credential configuration, or stdin JSON/schema error.
- `3`: transport, protocol, or local internal failure.
- `4`: bridge error such as unauthorized, unavailable session, stale generation, unsynchronized
  browser, or denied capability.
- `5`: Nexus set-values contract error or rejected transaction.
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

Implemented baseline: Nexus relay, browser connector, typed HTTP client, CLI, and Contract Lab
dogfood (discover, inspect, set, wait, and reload-generation rejection). The same journey now proves
Bridge writes through single and compound DashStack bindings, UI input observed by Bridge, stale
draft behavior after an external write, confirmed DashStack-owned overwrite observed through
inspect/wait, identified Nexus migration with a projected disclosed value, quarantined metadata
diagnostics, public metadata replacement, and a live Nexus session retained while DashPanel hides
and reopens. The same browser journey also creates and executes a value-free Nexus document export
plan, mutates the disclosed metric through Bridge, then analyzes and imports the captured document
locally; browser state and Bridge inspect/wait confirm restoration without exposing document
contents or adding Bridge authority. No Bridge extension was needed: focus, visibility, and
activation remain Provider-owned browser behavior rather than agent protocol authority; raw
quarantine payloads stay undisclosed.

The Contract Lab composition preset also mounts an independent, narrowly writable Style Lab
registration: `registrationId: "dashlet-style-lab"`, label `Contract Lab Style Lab`, disclosure of
only `switchValue` and `number` with no scopes or diagnostics, and a write allowlist containing only
`number`. Its browser journey selects this session by registration ID and browser tab ID. It first
proves that an untouched formatted Number blur leaves the canonical `1.234567` unchanged. It then
uses the one allowlisted Number write to make the focused Number presentation incompatible, proving
editor removal, shell focus repair, and one warning announcement. The same journey toggles the
public `SwitchDashlet` in the UI and proves the canonical boolean through `wait` and `inspect` while
the primary specimen session stays unchanged. `switchValue` remains non-writable through Bridge;
the registration discloses no other value, scope, or diagnostic authority.

After proving that isolation, the same journey performs one public UI-to-Bridge metadata
correlation on the primary `contract-lab-specimen` registration. It collapses `Standalone group`
through its accessible disclosure control, waits for the primary session sequence to advance,
rediscovers the current generation, and inspects the already disclosed
`contract-lab-standalone-list` scope for the durable `standalone-group` collapse override. The
journey does not write metadata through Bridge or expand disclosure. Deterministic collapse,
reorder, and reset behavior remains owned by the focused DashStack and Nexus tests.

MCP stdio parity is a follow-on only if the CLI proves useful. Bridge persistence, reset, and other
dangerous extensions remain deferred; they require preview, explicit confirmation, idempotency, and
an audit trail before implementation. Nexus document import/export remains a browser-local
consumer capability; document contents are not added to the Bridge protocol.

Background and tracking: [Picodash issue #80](https://github.com/programbo/picodash/issues/80).
