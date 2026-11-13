# Install current local packages

`bun run package:local` builds Nexus, UI, DashPanel, DashStack and Picodash, checks their artifacts, then writes revision-stamped archives
under `~/.local/share/picodash/packages/`. The output includes checksums, a manifest and an installer command for an existing consumer app.
`--output /path/to/packages` selects another output parent. React 19+ is required.

Run `bun run package:local:verify /path/to/bundle` to install into an isolated temporary consumer, typecheck, bundle JavaScript and CSS,
and mount standalone and integrated examples. This uses packed archives instead of workspace source imports.
It records a verification result and starts no server.

The installer adds local archive dependencies and overrides so transitive `@picodash` packages resolve to the same bundle.
Review the target app's package manifest changes and rebuild/reinstall after source changes.
Import `@picodash/picodash/style.css` for integrated composition, or the standalone product styles you use.
`@picodash/dashpanel/resize-handles.css` is an optional additional resize recipe.

Scripts: [pack](../../scripts/package-local.mjs), [install](../../scripts/install-local-bundle.mjs),
[verify](../../scripts/verify-local-packages.mjs). Fixture: [local consumer](../../packages/picodash/tests/local-consumer).
