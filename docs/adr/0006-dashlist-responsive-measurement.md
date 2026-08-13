# ADR 0006: DashList responsive measurement

## Status

Accepted target contract.

## Context

DashList must stack inline rows below its own `18rem` inline size, remain responsive when embedded
outside DashPanel, and preserve DashPanel's accepted `width="fit-content"` behavior. CSS size
container queries require inline-size containment on the queried box. That containment removes the
List's descendants from intrinsic inline-size calculation, so a List cannot both query its own size
and contribute its actual content width to a fit-content host.

A fixed `contain-intrinsic-inline-size` substitutes one estimate for the missing contribution. It
cannot represent narrow and wide arbitrary Dashlet content, so it either prevents a host from
shrinking or permits wider content to overflow. The former `30cqi` label token has the same
dependency on an eligible size-query container and otherwise resolves against the small viewport.

## Decision

DashList resolves the conflict as follows:

- The root remains free of inline-size containment so arbitrary content contributes to intrinsic
  host sizing.
- One `ResizeObserver` per DashList compares the root content-box inline size with `18rem`. It also
  observes a private, out-of-flow `1rem` probe in the root element's owner document, so same-origin
  iframe hosts and runtime root-font-size changes update the comparison independently of List size.
- The result is transient React presentation state. Nearest-List context projects it only onto the
  owning root and group ordering containers; nested Lists observe and project their own state.
- CSS continues to own the layout. The marker selects the compact two-track and stacked-inline
  rules; JavaScript does not calculate track sizes or persist resolved geometry.
- `--picodash-dashlet-label-width` is a `<length>` cap with a `10rem` default. The wide grid derives
  its fluid label share from `clamp(6rem, 30%, var(--picodash-dashlet-label-width))`, where the
  percentage is relative to the List's own grid container.
- Responsive state is never written to Nexus, persistence, Dev Bridge, or the public component API.

## Consequences

- Intrinsically sized Panels and standalone hosts receive the List's actual content contribution.
- Narrow hosts and browser zoom trigger the same compact CSS layout from observed List width rather
  than viewport width.
- Nested Lists respond independently even when an ancestor List is compact.
- Server rendering emits the normal structure without a guessed compact state. The layout effect
  performs the first supported observation before paint and later threshold crossings rerender only
  the local List presentation state.
- Component tests must cover threshold changes, nested ownership, forwarded-ref transparency, and
  observer cleanup. Contract Lab remains the owner of rendered geometry and overflow evidence.

## Rejected alternatives

- **Put `container-type: inline-size` on DashList:** breaks content-derived `fit-content` sizing.
- **Use a fixed contained intrinsic size:** replaces arbitrary content width with an inaccurate
  constant.
- **Use viewport media queries or orphaned `cqi` units:** responds to the viewport rather than the
  standalone List.
- **Require every host to establish a query container:** makes standalone responsiveness depend on
  undocumented application structure and still conflicts with intrinsic hosts.
- **Measure and write pixel track sizes:** moves CSS layout into JavaScript and creates unnecessary
  high-frequency presentation state.

## Detailed record

The responsive layout, token contract, implementation status, and evidence are recorded in the
[DashList target reference](../reference/dashlist.md#responsive-row-and-compound-layout) and
[contract conformance matrix](../reference/contract-conformance.md#dashlist).
