# Portable development bundles

This workflow includes immutable versioned package archives, consumer examples, guides, install scripts and Intent skills.
It is separate from [local package archives](local-packages.md), which are simpler revision-stamped five-package bundles.

`bun run dogfood:pack 0.1.0-dogfood.N` builds an explicitly versioned bundle from clean source.
`bun run dogfood:test` checks bundle tooling; `bun run dogfood:check` exercises the packaged consumer.
`bun run dogfood:locate` resolves the explicitly pinned recommendation in `recommended-snapshot.json` and refuses a missing or dirty bundle.
The recommendation is a verified clean-source artifact, not an implicit selection of the newest trial.
Generated bundles are local output; the repository tracks the version and reproducible build/install workflow.

Use [consumer recipes](consumer-recipes.md) and the executable fixtures shipped in the bundle.
[Numeric targets](numeric-targets.md), [linked controls](linked-controls.md), [open-ended ranges](open-ended-ranges.md),
[dock layout](dock-reactive-layout.md) and [Dev Bridge](agent-dev-bridge.md) describe the corresponding current source features.
