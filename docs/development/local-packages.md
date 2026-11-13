# Use Picodash in another local app

Build installable archives of Nexus, UI, DashPanel, DashStack, and Picodash:

```sh
bun run package:local
```

The command builds each package and checks its exported artifacts before packing it. Archives go to
a new revision-stamped directory under `~/.local/share/picodash/packages/`, outside the worktree.
The printed `node …/install.mjs /path/to/app` command installs all five archives into an existing
app. The installer adds dependencies and overrides pointing to these local archives, preserving
other package settings. Its README contains the same command, and `manifest.json` records the source
revision and archive checksums. `latest.json` points to the newest bundle.

The overrides keep transitive `@picodash` dependencies local; their pre-v1 versions are not looked
up in a registry. React 19 or later is required.

```tsx
import { DashPanel, DashPanelProvider } from '@picodash/dashpanel'
import '@picodash/dashpanel/style.css'
import '@picodash/dashpanel/resize-handles.css'
```

The optional second stylesheet supports `resize-edges-external`, `resize-edges-parallel`,
`resize-corners-external`, and `resize-corners-internal`. The [DashPanel reference](../reference/dashpanel.md)
explains their composition and the `showSizeConstraintIndicator` opt-in. Integrated apps import
`@picodash/picodash/style.css` for the foundation styles instead. Next.js hosts keep interactive
composition behind a client boundary and import styles from their global stylesheet entry.

To select another output parent:

```sh
bun run package:local --output /path/to/packages
```

Verify a bundle in an isolated temporary consumer, independently of workspace imports:

```sh
bun run package:local:verify
bun run package:local:verify /path/to/a/bundle
```

Verification installs the archives, typechecks public React APIs, bundles browser JavaScript and
CSS, and mounts standalone and integrated compositions. It records the result and temporary
consumer path in `verification.json`. It starts no server. The checked-in fixture lives in
[`packages/picodash/tests/local-consumer`](../../packages/picodash/tests/local-consumer/).

Rebuild and reinstall after changing Picodash. Each bundle uses a new path so the consuming app's
lockfile identifies the selected artifact. This workflow creates local pre-v1 packages; release
status and the remaining product gates are recorded in the [conformance matrix](../reference/contract-conformance.md).
