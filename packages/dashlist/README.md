# `@picodash/dashlist`

DashList organizes typed Nexus-backed controls, readouts, visualizations, previews, and actions
into ordered, groupable React Lists. Applications may host it in their own layout without
DashPanel or Picodash.

## Status

> Contract: Accepted
>
> Implementation: Partial overall; current components remain prototype evidence until the
> DashList stability gate is complete.

## Package paths

- `@picodash/dashlist`: DashList composition, stable ready-made Dashlets, and List actions.
- `@picodash/dashlist/ui`: controlled, unbound controls for custom Dashlets.
- `@picodash/dashlist/catalog`: static metadata for accepted public DashList components.
- `@picodash/dashlist/charts`: experimental `ChartDashlet` and `SparklineDashlet` prototypes.
- `@picodash/dashlist/style.css`: required DashList and Dashlet structural styles.
- `@picodash/dashlist/package.json`: package metadata for tooling.

Import the stylesheet once in the host application's global stylesheet or JavaScript entrypoint:

```css
@import '@picodash/dashlist/style.css';
```

The `/charts` entrypoint is pre-alpha, requires the exact optional `@tanstack/charts` `0.12.0`
peer, and is excluded from the stable root inventory and component catalog.

Exact component props and behavior are owned by the
[DashList target reference](../../docs/reference/dashlist.md). Catalog metadata follows the
[component catalog contract](../../docs/reference/catalog.md), and responsive behavior follows
[ADR 0006](../../docs/adr/0006-dashlist-responsive-measurement.md).

## Verification

```bash
bun run --filter @picodash/dashlist check
bun run --filter @picodash/dashlist test
bun run --filter @picodash/dashlist release:check
```
