# `@picodash/dashstack`

DashStack organizes typed Nexus-backed controls, readouts, visualizations, previews, and actions
into ordered, groupable React Stacks. Applications may host it in their own layout without
DashPanel or Picodash.

## Status

> Contract: Accepted
>
> Implementation: Partial overall; current components remain prototype evidence until the
> DashStack stability gate is complete.

## Package paths

- `@picodash/dashstack`: DashStack composition, stable ready-made Dashlets, and Stack actions.
- `@picodash/dashstack/ui`: controlled, unbound controls for custom Dashlets.
- `@picodash/dashstack/catalog`: static metadata for accepted public DashStack components.
- `@picodash/dashstack/charts`: experimental `ChartDashlet` and `SparklineDashlet` prototypes.
- `@picodash/dashstack/style.css`: required DashStack and Dashlet structural styles.
- `@picodash/dashstack/package.json`: package metadata for tooling.

Import the stylesheet once in the host application's global stylesheet or JavaScript entrypoint:

```css
@import '@picodash/dashstack/style.css';
```

The `/charts` entrypoint is pre-alpha, requires the exact optional `@tanstack/charts` `0.12.0`
peer, and is excluded from the stable root inventory and component catalog.

Exact component props and behavior are owned by the
[DashStack target reference](../../docs/reference/dashstack.md). Catalog metadata follows the
[component catalog contract](../../docs/reference/catalog.md), and responsive behavior follows
[ADR 0006](../../docs/adr/0006-dashstack-responsive-measurement.md). The pre-release name and
metadata cutover are recorded in [ADR 0007](../../docs/adr/0007-dashstack-name-and-public-identity.md).

## Verification

```bash
bun run --filter @picodash/dashstack check
bun run --filter @picodash/dashstack test
bun run --filter @picodash/dashstack release:check
```

## Recovery inventory

The retained ready-made candidates are Text, Number, Slider, Switch, Select, Segmented, and Display.
Other existing root Dashlet exports remain evaluation prototypes and are excluded from the stable
catalog. See the [M7 disposition ledger](../../docs/internal/m7-dashlet-curation.md); owner approval was
recorded on 2026-09-17.

For Picodash's desktop detachable groups, the explicit `@picodash/dashstack/integration` seam
connects logical group structure to a host without adding a DashPanel dependency. Application
usage is documented in [Detachable groups](../../docs/reference/picodash.md#detachable-groups).
