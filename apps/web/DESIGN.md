# Picodash Web Alpha Shell

`apps/web` is a one-route evaluation shell for the first public Picodash packages. The homepage
explains what the current alpha supports and shows the two standalone products in place:

- `@picodash/dashpanel` renders arbitrary React content inside a Store-backed Panel Provider.
- `@picodash/dashlist` composes a named Dashlet and one group level against its own root Store.

The shell creates two independent empty Root Stores in the sole client component. This keeps the
Panel and List examples honest about their separate package boundaries while they are still alpha
surfaces.

## Route contract

- `/` is the only public route.
- `/docs`, `/examples`, `/store`, `/usage`, `/themes`, `/more-examples`, and `/lab` return `404`.
- The hero uses the exact current-alpha scope statement and links to the current contract references.

## Implementation contract

- `src/app/(home)/page.tsx` remains a Server Component and owns static copy and navigation.
- `src/components/alpha-products.tsx` is the only Client Component and imports only the public
  Store, UI, DashPanel, and DashList package roots plus React.
- `src/app/layout.tsx` imports public package styles in dependency order, followed by local CSS.
- The page does not expose planned placement, field bindings, ready-made Dashlets, controls,
  documents, or integrated Picodash workflows.

## Responsive behavior

The layout uses a constrained content column, wrapping actions, and a two-column product grid that
collapses to one column below `42rem`. Product demos cap their inline size so the 390px mobile view
does not introduce horizontal scrolling.
