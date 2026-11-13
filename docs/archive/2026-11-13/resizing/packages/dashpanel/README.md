# `@picodash/dashpanel`

DashPanel hosts arbitrary React content in movable, resizable, dockable Panels. It uses Nexus for
settled layout and UI for shared presentation, without requiring DashList.

Import `@picodash/dashpanel/style.css` once in the application's stylesheet or JavaScript entry.
The optional `@picodash/dashpanel/resize-handles.css` import supplies the single/parallel external
edge and corner recipes; load it after the main stylesheet. Apply `resize-edges-external`,
`resize-edges-parallel`, `resize-corners-external`, or `resize-corners-internal` to a Panel as needed.

The size-constraint indicator is hidden by default. Set `showSizeConstraintIndicator` to show it
immediately before the action menu when a constraint is active.

The [DashPanel reference](../../docs/reference/dashpanel.md) owns the complete API. See the
[local package guide](../../docs/development/local-packages.md) to build and install local archives.
These pre-v1 packages retain the implementation status recorded in the reference.
