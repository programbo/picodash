# Shared UI agent instructions

Read this file before changing shared presentation or replacing `packages/theme`. Then read
[`../adr/0003-shared-ui-foundation.md`](../adr/0003-shared-ui-foundation.md) and
[`../reference/ui.md`](../reference/ui.md).

## Decision lens

`@picodash/ui` lets DashPanel and DashList share identical product-neutral theme, density,
structural, overlay, and accessibility behavior. Admit a primitive only when both products can use
the same semantics and interactions without product state or commands.

UI is supporting infrastructure, not another state or behavior owner. It must not know about
Stores, Panels, Lists, Dashlets, placement, ordering, or persistence.

## Implementation constraints

- Keep color theme and density orthogonal. `compact` is never a theme.
- Preserve coarse-pointer hit targets when compact density reduces geometry.
- Keep detached portal roots aligned with resolved theme and density without mutating their shared
  portal container.
- Use semantic `--picodash-*` tokens and named Picodash-owned public prop types.
- Extend React Aria interfaces deliberately and omit reserved semantic or structural props.
- Do not publish internal variant-helper types or `ComponentProps<typeof InternalComponent>`.
- Keep generic Button, AlertDialog, Tooltip, and Provider imports UI-owned. DashPanel and DashList
  explicitly reexport only the shared contracts accepted by their references.
- Replace the theme prototype cleanly; do not retain a second theme authority or compatibility
  alias without an accepted decision.

Shared component tests own semantic DOM, ARIA, deterministic events, and theme/density propagation.
Use browser evidence only for genuine focus, portal, media-query, or rendered-geometry seams.
