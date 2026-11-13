# Dock-reactive layout

useDashPanel and provider snapshots expose current placement and drag/dock previews. Applications can react to these ephemeral facts without persisting resolved geometry. Stack remains independently usable and does not import Panel.

Implementation: [source](../../packages/dashpanel/src/runtime/panel-controller.tsx). Public names and signatures: [API inventory](../reference/api/index.md).
Examples and behavior checks: [consumer fixtures](../../packages/picodash/tests/dogfood).
