# Shared UI target reference

The shared UI foundation gives DashPanel and DashList one theme system and one set of generic,
accessible presentation primitives without making either product depend on the other.

## Status

> Contract: Accepted package boundary, initial component inventory, and reexport boundaries;
> revised portal-container element type
>
> Implementation: Partial
>
> Evidence: [Theme provider component tests](../../packages/ui/tests/theme-provider.test.tsx),
> [theme provider type tests](../../packages/ui/tests/theme-provider.types.test.ts), [Button
> component tests](../../packages/ui/tests/button.test.tsx), [Button type tests](../../packages/ui/tests/button.types.test.ts),
> [AlertDialog component tests](../../packages/ui/tests/alert-dialog.test.tsx), [AlertDialog type
> tests](../../packages/ui/tests/alert-dialog.types.test.ts),
> [CSS contract tests](../../packages/ui/tests/css-contract.test.ts), and the [package artifact
> checker](../../packages/ui/tests/package-artifacts.mjs).
>
> Notes: `@picodash/ui` replaces `@picodash/theme` in the target architecture. No compatibility
> alias is planned before the first stable release.

## Package purpose

`@picodash/ui` owns presentation contracts that must behave identically in DashPanel and DashList.
It is a supporting foundation for the package family, not another independently positioned product
or a home for miscellaneous reusable code.

| Package               | Direct foundations                 |
| --------------------- | ---------------------------------- |
| `@picodash/store`     | None                               |
| `@picodash/ui`        | None; it does not import Store     |
| `@picodash/dashpanel` | Store and UI                       |
| `@picodash/dashlist`  | Store and UI                       |
| `@picodash/picodash`  | Store, UI, DashPanel, and DashList |

Store remains framework-independent and never imports UI. DashPanel and DashList may each consume
Store and UI, but never one another. Picodash is the integrated facade above those foundations.

## Admission rules

A public component or presentation contract belongs here only when:

1. at least DashPanel and DashList use it without product-specific behavior;
2. its semantics do not mention Panel, List, Dashlet, Store, scope, placement, or ordering;
3. its accessibility, theme, and interaction behavior should be identical for every consumer; and
4. it owns no product state, commands, registration, persistence, or domain policy.

Similarity alone is insufficient. A shared visual treatment with different product semantics stays
in the owning products and may share only tokens or lower primitives.

## Owned contracts

The accepted ownership boundary includes:

- `light`, `dark`, `system`, and application-defined named-theme resolution;
- the orthogonal `regular | compact` density axis;
- public semantic `--picodash-*` tokens and package-private derived variables;
- theme and density context, data attributes, and detached-root propagation support;
- the shared structural stylesheet for UI-owned components;
- generic accessible chrome and action-menu composition primitives admitted by the rules above;
- `DashHeader` as presentational header composition.

The initial component inventory, public prop policy, theme utilities, tokens, and product reexports
are accepted below. Exact compact recipe values, private structural selectors, and exhaustive
token-consumption tables are implementation evidence rather than unresolved API contracts.

## Initial public component inventory

> Contract: Revised — portal containers are HTML elements
>
> Implementation: Partial — theme and overlay Providers plus the initial ActionMenu family are
> implemented; the remaining shared UI inventory is planned.

The initial public components are exported from the `@picodash/ui` root. Every component exports a
named `*Props` type. No dedicated component subpath is introduced for this inventory.

| Family       | Initial public components                                                      |
| ------------ | ------------------------------------------------------------------------------ |
| Theme        | `PicodashThemeProvider`, `PicodashOverlayProvider`, and the accepted context   |
|              | hooks and public types.                                                        |
| Header       | `DashHeader`.                                                                  |
| Button       | `Button`.                                                                      |
| Confirmation | `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, |
|              | `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`,            |
|              | `AlertDialogMedia`, `AlertDialogOverlay`, `AlertDialogTitle`,                  |
|              | `AlertDialogTrigger`.                                                          |
| Action menu  | `ActionMenu`, `ActionMenuItem`, `ActionSubmenu`, `ActionMenuSeparator`.        |
| Tooltip      | `Tooltip`, `TooltipContent`, `TooltipProvider`, `TooltipTrigger`.              |

The public `ActionMenu` root replaces the prototype technique in which `ActionSubmenu` changes
meaning when placed in a hidden root context. `ActionSubmenu` always means a nested submenu in the
target contract. Raw dropdown-menu components remain implementation details.

The initial inventory deliberately excludes `LinkButton`, raw dropdown components, generic
`Dialog`, `Badge`, `Card`, `Input`, `InputGroup`, `Label`, `Meter`, `ProgressBar`, `ScrollArea`,
`Select`, `Separator`, `Slider`, `Switch`, `Tabs`, `Textarea`, `Toggle`, `ToggleGroup`, and
`Toolbar`. They remain product-owned, package-private, or prototype candidates until both
foundational products demonstrate the same product-neutral contract. DashList's Draft anatomy
`Toolbar` remains available from DashList; exclusion here does not remove it.

## Public prop-type policy

> Contract: Accepted
>
> Implementation: Planned

Every public component exports a named Picodash-owned `*Props` type. A type may extend an identified
public React Aria props interface when the inherited interaction surface is intentionally part of
the contract. It must use `Omit` to reserve any prop whose meaning, structure, accessibility, or
portal behavior Picodash fixes.

- Public types never use `ComponentProps<typeof InternalComponent>`, an internal variant helper,
  or the inferred props of a private wrapper. Internal refactors therefore cannot silently change
  the public surface.
- Native presentational regions use an explicit `ComponentPropsWithRef<'element'>` base when
  ordinary DOM props are part of their contract.
- Documentation lists the Picodash additions, omissions, defaults, and fixed semantics. Other
  inherited props retain the named React Aria component's behavior within the supported dependency
  range.
- Upgrading React Aria requires compile-time positive and negative API tests before publication.
  A newly inherited or changed upstream prop is reviewed as a public API change rather than
  accepted accidentally.
- Public component types include their React 19 ref where the rendered root has a stable public
  element. Compound state-only roots and wrapperless composition components do not invent a ref.

## Theme, density, and overlay providers

> Contract: Accepted
>
> Implementation: Partial
>
> Evidence: [Theme provider component tests](../../packages/ui/tests/theme-provider.test.tsx) and
> [theme provider type tests](../../packages/ui/tests/theme-provider.types.test.ts). Overlay
> providers remain Planned.

`PicodashThemeProvider` owns resolved color theme and density. It establishes the DOM carrier for
`data-picodash-theme` and `data-picodash-density`; it does not own portal placement or layer policy.
Its public value domains are:

```ts
type PicodashTheme = 'light' | 'dark' | 'system'
type PicodashThemeOption<CustomTheme extends string = never> = PicodashTheme | CustomTheme
type PicodashResolvedTheme<CustomTheme extends string = never> = 'light' | 'dark' | CustomTheme
type PicodashDensity = 'regular' | 'compact'
```

The public Provider and context types are:

```ts
interface PicodashThemeProviderProps<CustomTheme extends string = never> {
  children: ReactNode
  theme?: PicodashThemeOption<CustomTheme>
  density?: PicodashDensity
}

interface PicodashOverlayProviderProps {
  children: ReactNode
  portalContainer?: HTMLElement | null
  layerBase?: number
}

interface PicodashOverlayDefaults {
  readonly portalContainer: HTMLElement | null
  readonly layerBase?: number
}
```

The public hooks are:

```ts
usePicodashTheme(): string
usePicodashDensity(): PicodashDensity
usePicodashOverlayDefaults(): Readonly<PicodashOverlayDefaults>
```

- An omitted `theme` or `density` inherits the nearest theme context value.
- Without an ancestor, `theme` defaults to `system` and `density` defaults to `regular`.
- `system` resolves to `light` or `dark`; a declared custom name remains that resolved name.
- `usePicodashTheme` returns a resolved name and never returns `system`. The public hooks do not
  throw outside a Provider; they return the standalone defaults.
- The Theme Provider owns no setter, persistence, or change callback. Theme and density are
  controlled presentation inputs.
- `compact` is a density value, never a theme name. Built-in and custom color themes work with both
  densities without compound names.
- Its private `display: contents` carrier holds `data-picodash-theme` and
  `data-picodash-density`. The Provider exposes no carrier layout props or ref.
- A Product Provider may expose theme or density overrides, but it composes this shared Provider
  rather than implementing a second resolver.

`PicodashOverlayProvider` owns product-neutral defaults for detached UI primitives. It is a context
boundary, not a theme carrier or Store boundary.

The current implementation evidence is in
[overlay-provider.test.tsx](../../packages/ui/tests/overlay-provider.test.tsx) and
[overlay-provider.types.test.ts](../../packages/ui/tests/overlay-provider.types.test.ts). Real browser
portal, focus, and detached-root seams remain to be verified.

Portal containers are `HTMLElement` hosts rather than arbitrary `Element` values. This matches the
shared React Aria portal-context boundary and every current Picodash host. Geometry boundaries
remain `Element` because SVG geometry is valid there; accepting SVG as an overlay host would require
an unsafe narrowing before React Aria could consume it.

- `portalContainer={undefined}` inherits the nearest overlay default. Without an ancestor, the
  browser default is `document.body`.
- `portalContainer={null}` explicitly selects `document.body`; it does not mean "do not render."
- `layerBase={undefined}` inherits the nearest overlay layer base. An explicit `layerBase` replaces
  the inherited value and must be a finite integer.
- Invalid explicit layer bases throw a synchronous configuration `TypeError` rather than being
  silently rounded or ignored.
- An explicit portal or layer prop on an overlay primitive takes precedence over context.
- The semantic `--picodash-layer-*` tokens remain each overlay family's minimum layer. A nested
  overlay must resolve above the overlay that opened it. Exact offsets remain implementation
  details and must not become public arithmetic consumers rely on.
- The Overlay Provider renders no DOM and connects its resolved portal choice to React Aria's
  portal context internally. `usePicodashOverlayDefaults` exposes only the resolved Provider
  defaults; active parent-overlay layers and z-index calculations remain private.

Product Providers compose both shared Providers internally. A standalone application may also use
either shared Provider without Store, DashPanel, or DashList. Neither shared Provider imports or
subscribes to Store.

Each detached overlay root repeats the resolved theme and density attributes. The shared portal
container itself is never decorated or mutated, because one container may host overlays from
different nested contexts. The current prototype behavior in which `PicodashThemeProvider` accepts
and decorates `portalContainer` is replaced during migration.

React Aria owns modal focus containment, outside-content hiding, topmost Escape handling, and
trigger-focus restoration. Confirmation dialogs are not outside-dismissable by default, but Escape
remains available unless the caller explicitly disables keyboard dismissal. Shared UI does not add
a document-level Escape stack or subscribe to DashPanel merely to calculate overlay behavior.

`TooltipProvider` remains a separate optional timing context. It is not folded into either shared
Provider and Product Providers do not reset it.

The prototype exports `PicodashThemeContextProvider`, `useResolvedPicodashTheme`,
`resolvePicodashTheme`, and `readPicodashSystemTheme`. These become private implementation details
during migration: consumers configure presentation through the public Providers and read resolved
context through the three accepted hooks.

## Button

> Contract: Accepted
>
> Implementation: Verified
>
> Evidence: [Button component tests](../../packages/ui/tests/button.test.tsx) and [Button type
> tests](../../packages/ui/tests/button.types.test.ts).

`Button` renders a semantic button with normalized pointer, keyboard, touch, focus, disabled, and
pending behavior. It represents an action; navigation uses a Link rather than a button styled as a
link.

```ts
import type { ButtonProps as ReactAriaButtonProps } from 'react-aria-components'

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive'
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg'

type ButtonProps = ReactAriaButtonProps &
  RefAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant
    size?: ButtonSize
    iconOnly?: boolean
  }
```

- `variant` defaults to `primary`. `subtle` is omitted because it overlaps `secondary`; `link` is
  omitted because it obscures navigation semantics.
- `size` defaults to `md`. `iconOnly?: boolean` creates a square button at the selected size instead
  of multiplying the size union with `icon-*` variants.
- An icon-only button requires an accessible name. Its icon is decorative unless the caller gives
  it a separate semantic role outside the Button contract.
- Theme density changes the geometry behind each named size without changing the public size
  vocabulary. Compact density continues to preserve coarse-pointer hit targets.
- `isDisabled`, `isPending`, `onPress`, and the remaining interaction props follow React Aria's
  Button contract. Documentation uses `onPress`; inherited `onClick` remains a compatibility alias.
- The public API does not add a duplicate `disabled` prop. Consumers use `isDisabled`.
- `type` defaults to `button` so placement inside a form does not submit accidentally.
- The root forwards its button ref. React Aria children/render-function support and its constrained
  `render` escape hatch remain available; an `asChild` API is not added.
- `className` and semantic data attributes support deliberate customization, but callers should
  prefer the stable variant, size, and token contracts. The root emits `data-slot="button"`,
  `data-variant`, and `data-size`; `data-icon-only` is emitted only when `iconOnly` is true.

The initial implementation uses the private `picodash-button` class for structural CSS while
composing caller-provided string or render-function class names. The focused tests cover semantic
output, ref forwarding, defaults, explicit hooks and native type, React Aria press/click wiring,
disabled and pending semantics, render-function children and escape hatch, and the negative public
type surface. Compact geometry values and coarse-pointer hit-target review remain UI-CSS work.

The initial UI package does not export `LinkButton`. If a product later needs a shared Link, it must
define navigation behavior and accessibility as a separate contract.

The prototype's `default` variant becomes `primary`. Its duplicate `default`/`md`, `icon`/icon-size,
`subtle`, and `link` options are removed during migration rather than retained as aliases.

## AlertDialog composition

> Contract: Accepted
>
> Implementation: Partial
>
> Evidence: [AlertDialog component tests](../../packages/ui/tests/alert-dialog.test.tsx) and
> [AlertDialog type tests](../../packages/ui/tests/alert-dialog.types.test.ts). React Aria Escape
> ordering, focus restoration, outside-content hiding, and computed nested stacking remain browser
> verification seams.

`AlertDialog` presents a consequential choice that requires an explicit action or cancellation. It
does not analyze an operation, generate confirmation copy, or execute a product command.

The exact public type boundary is:

```ts
import type {
  DialogProps as ReactAriaDialogProps,
  DialogTriggerProps as ReactAriaDialogTriggerProps,
  HeadingProps as ReactAriaHeadingProps,
  ModalOverlayProps as ReactAriaModalOverlayProps,
  TextProps as ReactAriaTextProps,
} from 'react-aria-components'

type AlertDialogSize = 'default' | 'sm'

type AlertDialogProps = Omit<ReactAriaDialogTriggerProps, 'children'> & {
  children: ReactNode
  isKeyboardDismissDisabled?: boolean
}

type AlertDialogTriggerProps = Omit<ButtonProps, 'slot'>

type AlertDialogOverlayProps = Omit<
  ReactAriaModalOverlayProps,
  | 'children'
  | 'defaultOpen'
  | 'isDismissable'
  | 'isKeyboardDismissDisabled'
  | 'isOpen'
  | 'onOpenChange'
  | 'shouldCloseOnInteractOutside'
  | 'UNSTABLE_portalContainer'
> & {
  children: ReactNode
  portalContainer?: HTMLElement | null
  layerBase?: number
}

type AlertDialogContentProps = Omit<
  ReactAriaDialogProps,
  'aria-describedby' | 'aria-label' | 'aria-labelledby' | 'children' | 'role'
> & {
  children: ReactNode
  size?: AlertDialogSize
}

type AlertDialogHeaderProps = ComponentPropsWithRef<'div'>
type AlertDialogFooterProps = ComponentPropsWithRef<'div'>
type AlertDialogMediaProps = ComponentPropsWithRef<'div'>
type AlertDialogTitleProps = Omit<ReactAriaHeadingProps, 'slot'>
type AlertDialogDescriptionProps = Omit<ReactAriaTextProps, 'elementType' | 'slot'>
type AlertDialogActionProps = Omit<ButtonProps, 'slot'> & { closeOnPress?: boolean }
type AlertDialogCancelProps = Omit<ButtonProps, 'slot'>
```

`AlertDialog` alone owns controlled or uncontrolled open state and keyboard-dismiss policy.
`AlertDialogOverlay` cannot open a second state channel and cannot enable outside dismissal. Its
`portalContainer` and `layerBase` are the standard explicit overrides of the nearest overlay
defaults. `AlertDialogContent` fixes its role and accessible relationships; callers compose the
required title instead of replacing it with an unrelated `aria-label`.

```tsx
<AlertDialog isOpen={open} onOpenChange={setOpen}>
  <AlertDialogTrigger>Reset…</AlertDialogTrigger>

  <AlertDialogOverlay>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Reset values?</AlertDialogTitle>
        <AlertDialogDescription>
          This replaces every current value with its declared default.
        </AlertDialogDescription>
      </AlertDialogHeader>

      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction>Reset</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialogOverlay>
</AlertDialog>
```

- `AlertDialog` is the controlled or uncontrolled open-state root.
- `AlertDialogTrigger` is the actual pressable trigger. It does not own a second open state.
- `AlertDialogOverlay` owns the detached portal root, backdrop, and modal overlay behavior.
- `AlertDialogContent` owns the modal container and `alertdialog` semantics. It is not an alias for
  `AlertDialog`.
- `AlertDialogHeader`, `AlertDialogFooter`, and optional `AlertDialogMedia` are presentational
  composition regions.
- At least one `AlertDialogTitle` supplies the accessible name. Descriptions are optional; every
  rendered `AlertDialogDescription` is associated with the dialog.
- Title and description content accept `ReactNode`, preserving formatted explanations, field
  summaries, and links rather than narrowing confirmation copy to plain strings.
- Arbitrary review or customization content may be composed in `AlertDialogContent` between the
  header and footer. Interactive field controls belong in that body region rather than inside
  `AlertDialogDescription`, whose content is associated through `aria-describedby`.
- `AlertDialogCancel` always closes the dialog.
- `AlertDialogAction` closes by default. `closeOnPress={false}` keeps it open for validation,
  asynchronous work, or another operation that may fail and needs recoverable feedback.

The trigger may be omitted when application state controls the dialog, including confirmation
opened from an action menu whose item is no longer mounted. React Aria retains focus containment,
outside-content hiding, topmost Escape handling, and restoration to a surviving trigger or prior
focus target. Product composition remains responsible for a deliberate fallback when its initiating
control is removed.

Outside interaction never dismisses an AlertDialog. Escape dismisses the topmost dialog unless
keyboard dismissal is explicitly disabled. There is no public `isDismissable` escape hatch; a
dismissable workflow uses a different modal contract rather than weakening AlertDialog semantics.

The prototype currently makes `AlertDialog` own overlay, modal, and dialog content while
`AlertDialogContent` aliases the same component, and its `AlertDialogTrigger` is the open-state root.
Those meanings are replaced during migration. The prototype's manual document-level Escape stack
is also removed in favor of React Aria's overlay behavior.

## ActionMenu

> Contract: Accepted
>
> Implementation: Partial
>
> Evidence: [ActionMenu component tests](../../packages/ui/tests/action-menu.test.tsx), [ActionMenu
> type tests](../../packages/ui/tests/action-menu.types.test.ts), and the [package artifact
> checker](../../packages/ui/tests/package-artifacts.mjs).

`ActionMenu` presents caller-supplied commands. It owns generic menu interaction and optional
confirmation composition, but it does not discover product commands, interpret their results, or
report product status.

```tsx
<ActionMenu label="Actions for Settings">
  <ActionMenuItem icon={<Copy />} label="Duplicate" onAction={duplicate} />

  <ActionSubmenu icon={<Download />} label="Export">
    <ActionMenuItem label="Export JSON" onAction={exportJson} />
  </ActionSubmenu>

  <ActionMenuSeparator />

  <ActionMenuItem
    label="Reset…"
    variant="destructive"
    confirmation={{
      title: 'Reset settings?',
      description: 'This restores every field to its declared default.',
      actionLabel: 'Reset values',
    }}
    onAction={reset}
  />
</ActionMenu>
```

`ActionMenuConfirmation` is a readable object rather than an ordered tuple:

```ts
import type {
  MenuTriggerProps as ReactAriaMenuTriggerProps,
  SeparatorProps as ReactAriaSeparatorProps,
} from 'react-aria-components'

interface ActionMenuConfirmation {
  title: ReactNode
  description: ReactNode
  actionLabel: ReactNode
}

type ActionMenuItemVariant = 'default' | 'destructive'

type ActionMenuProps = Pick<
  ReactAriaMenuTriggerProps,
  'defaultOpen' | 'isOpen' | 'onOpenChange'
> & {
  label: string
  trigger?: ReactElement
  children: ReactNode
  portalContainer?: HTMLElement | null
  layerBase?: number
}

interface ActionMenuItemProps {
  label: string
  icon?: ReactNode
  onAction: () => void | Promise<void>
  isDisabled?: boolean
  variant?: ActionMenuItemVariant
  confirmation?: ActionMenuConfirmation
}

interface ActionSubmenuProps {
  label: string
  icon?: ReactNode
  isDisabled?: boolean
  children: ReactNode
}

type ActionMenuSeparatorProps = Omit<ReactAriaSeparatorProps, 'orientation'>
```

- `ActionMenu` requires a string `label`, used as the menu's accessible name. Without a custom
  `trigger`, it renders the standard ellipsis `Button`; a custom trigger must satisfy React Aria's
  pressable and accessible-name requirements.
- React Aria's controlled and uncontrolled open props remain available. Menu items close the menu
  after activation; an item requiring confirmation closes the menu before opening AlertDialog.
- Portal and layer defaults come from `PicodashOverlayProvider`. Explicit root portal/layer props
  override that context; nested submenus inherit the root overlay and do not portal independently.
- `ActionMenuItem` accepts a string `label`, decorative `icon?: ReactNode`, `onAction`,
  `isDisabled`, `variant`, and optional `confirmation`. String labels preserve reliable typeahead.
- Confirmation and destructive appearance are independent. A non-destructive operation may require
  confirmation, while `variant="destructive"` supplies danger styling without generating copy.
- Product code supplies all confirmation copy and the action callback. ActionMenu does not await,
  parse, or announce asynchronous results; an asynchronous callback owns its failure and status
  reporting.
- Interactive controls are not allowed inside menu-item labels. The item itself is the single
  interactive target.
- `ActionSubmenu` accepts a string `label`, optional decorative icon, `isDisabled`, and command
  children. It always means a nested submenu and never changes meaning according to hidden context.
- `ActionMenuSeparator` is presentational and participates in no command or selection state.

The initial ActionMenu is a statically composed command menu. It does not expose links, dynamic
collection input, or single/multiple selection. Current values such as placement or theme are
expressed as labelled commands whose no-op current command is identified and disabled. A future
radio/check menu requires its own accessibility and state contract rather than overloading
`ActionMenuItem`.

The root also exposes no raw Popover-props bag, public long-press mode, or public placement-tuning
API initially. It owns standard end-aligned placement, collision padding, and flipping. A concrete
consumer need may add an explicit positioning prop later without exposing the underlying Popover.

The prototype's root-context `ActionSubmenu`, Lucide-constructor-only icon props, `disabled` alias,
and destructive confirmation tuple are replaced during migration. Product-owned ready-made actions
remain in DashPanel or DashList and compose these shared primitives.

## Tooltip

> Contract: Accepted
>
> Implementation: Partial
>
> Evidence: `packages/ui/tests/tooltip.test.tsx`, `tooltip.types.test.tsx`, and package artifact checks cover deterministic composition, timing/state wiring, public types, portal/layer overrides, detached theme/density attributes, and structural CSS. Browser placement, touch, and focus-restoration seams remain Partial.

`Tooltip` supplies a short, non-interactive description for a focusable element. It supplements the
trigger's accessible name and visible interface; it never contains information required to operate
the application.

The exact public type boundary is:

```ts
import type {
  TooltipProps as ReactAriaTooltipProps,
  TooltipTriggerComponentProps as ReactAriaTooltipTriggerComponentProps,
} from 'react-aria-components'

interface TooltipProviderProps {
  children: ReactNode
  delay?: number
  closeDelay?: number
}

type TooltipProps = Pick<
  ReactAriaTooltipTriggerComponentProps,
  'closeDelay' | 'defaultOpen' | 'delay' | 'isOpen' | 'onOpenChange'
> & {
  children: ReactNode
}

interface TooltipTriggerProps {
  children: ReactElement
}

type TooltipContentProps = Omit<
  ReactAriaTooltipProps,
  | 'children'
  | 'defaultOpen'
  | 'isEntering'
  | 'isExiting'
  | 'isOpen'
  | 'onOpenChange'
  | 'triggerRef'
  | 'UNSTABLE_portalContainer'
> &
  RefAttributes<HTMLDivElement> & {
    children: ReactNode
    portalContainer?: HTMLElement | null
    layerBase?: number
  }
```

The root owns the only Tooltip open-state channel. The trigger is a wrapperless structural slot and
therefore accepts no DOM styling, event, or ref props of its own. Content owns the stable `div` ref,
positioning, styling, theme propagation, and explicit overlay overrides; callers cannot replace the
root-owned trigger ref or React Aria's unstable portal prop.

```tsx
<TooltipProvider delay={500} closeDelay={0}>
  <Tooltip>
    <TooltipTrigger>
      <Button iconOnly aria-label="More information">
        <Info aria-hidden />
      </Button>
    </TooltipTrigger>

    <TooltipContent placement="top">Changes are saved automatically.</TooltipContent>
  </Tooltip>
</TooltipProvider>
```

- `TooltipProvider` is an optional timing context. It accepts `delay` and `closeDelay`, which
  default to 500 and 0 milliseconds. It owns no theme, portal, layer, Product Provider, or Store
  state.
- Omitted Provider timing props inherit from the nearest `TooltipProvider`. A per-instance value on
  `Tooltip` takes precedence. DashPanel, DashList, and Picodash Providers do not expose duplicate
  timing props or reset an enclosing Tooltip context.
- `Tooltip` works without `TooltipProvider` and owns `isOpen`, `defaultOpen`, `onOpenChange`,
  `delay`, and `closeDelay`.
- Exactly one `TooltipTrigger` and one `TooltipContent` are composed in that order.
- `TooltipTrigger` requires one focusable or pressable React element and renders no DOM wrapper. A
  custom trigger must preserve valid semantics, forward its ref, and spread supplied interaction
  props. The public API does not add `asChild` because trigger composition is already wrapperless.
- `TooltipContent` accepts `ReactNode`, but interactive descendants are prohibited. Large,
  scrollable, essential, or interactive explanations use a Popover, Dialog, or visible content.
- `TooltipContent` exposes React Aria's `placement`, `offset`, `crossOffset`, `shouldFlip`, and
  `containerPadding` vocabulary rather than translating Radix-style `side` and `align` props. It
  also accepts the standard explicit portal and layer overrides.
- The arrow is built in, decorative, and token-styled; it is not a separate public component.
- Portal and layer defaults come from `PicodashOverlayProvider`. The detached content root repeats
  the resolved theme and density attributes.
- Pointer hover observes the warm-up delay, keyboard focus opens immediately, and blur, pointer
  exit, or Escape closes the tooltip. React Aria owns handoff between nearby tooltips.
- Ordinary touch interaction does not reveal tooltips. Every trigger and operation must remain
  understandable and usable without one.
- An icon-only trigger supplies its own accessible name. Tooltip content describes the named
  control; it does not replace that name.

The prototype's `delayDuration`, ignored `skipDelayDuration`, Radix-style placement aliases, and
duplicated Product implementations are removed during migration. The website's large scrollable
prop-type inspector also migrates to a disclosure that supports its actual content rather than
expanding the Tooltip contract.

## Excluded contracts

UI does not own:

- Store values, scopes, bindings, persistence, documents, or selectors;
- Panel placement, drag surfaces, collapse, close, visibility, Panel portal ownership, or Panel
  actions;
- List nodes, groups, Dashlets, ordering, disclosure, resets, or field presentation;
- ready-made Dashlets or Dashlet-oriented unbound controls;
- Picodash aggregate behavior or integration policy.

`@picodash/dashlist/ui` remains the DashList-owned surface for unbound controls that carry Dashlet
presentation semantics. Shared UI is not a replacement name for that surface.

Generic action-menu primitives render caller-owned actions, submenus, separators, availability,
status announcements, and dangerous-operation confirmations. They do not discover targets or own
Panel/List commands. DashPanel and DashList supply their behavior and may explicitly reexport the
generic primitives alongside product-owned action components.

The target owner of modal confirmation primitives is `@picodash/ui`. The canonical confirmation
family is `AlertDialog` and its action, cancel, content, description, footer, header, media, overlay,
title, and trigger components, imported from `@picodash/ui`. The Picodash facade may explicitly
reexport the same components from `@picodash/picodash/ui`; that convenience path does not change
ownership. Product packages own only the confirmation copy, effect analysis, and commands composed
inside those primitives.

The prototype currently has duplicated AlertDialog implementations under DashPanel and DashList.
Those copies are reachable through `@picodash/dashpanel/ui` and `@picodash/dashlist/ui`, while
`@picodash/picodash/ui` currently reexports the DashList copy. During migration, DashPanel `/ui` is
removed, AlertDialog leaves DashList `/ui`, and the retained DashList entrypoint narrows to its
accepted unbound-control inventory. The existing exports are migration evidence, not the target
ownership model.

## `DashHeader`

> Contract: Accepted
>
> Implementation: Verified

`DashHeader` lays out header content supplied by its caller. It does not decide what a header means
or operate Panel or List state.

The initial API is slot-only with fixed semantic positions:

```tsx
<DashHeader
  className="inspector-header"
  slots={{
    leading: <DragHandle />,
    title: <h2>Inspector</h2>,
    actions: <ActionMenu />,
    trailing: <CloseButton />,
  }}
/>
```

```ts
interface DashHeaderSlots {
  leading?: ReactNode
  title?: ReactNode
  actions?: ReactNode
  trailing?: ReactNode
}

type DashHeaderProps = Omit<ComponentPropsWithRef<'div'>, 'children'> & {
  slots: Readonly<DashHeaderSlots>
}
```

- The root is a neutral `div`, not an HTML `header`. The title heading and owning Panel or List
  supply semantics without risking inappropriate or repeated banner landmarks.
- `slots` is required. Its keys are `leading`, `title`, `actions`, and `trailing` in that DOM order;
  every individual value remains optional.
- The title wrapper always renders as the flexible, minimum-width-zero layout column, including
  when empty. The other wrappers render only when their slots are populated.
- Stable public styling hooks are `data-slot="dash-header"` on the root and
  `data-slot="dash-header-{leading,title,actions,trailing}"` on slot wrappers.
- Slot nodes render unchanged. DashHeader does not clone them, inject labels or handlers, or infer
  heading semantics. The `title` node owns its heading element and level.
- `actions` is layout only and adds no Toolbar role or keyboard behavior. The caller composes an
  explicitly named Toolbar when those semantics are appropriate.
- The root accepts ordinary `div` attributes, styling props, event handlers, and a React 19 ref.
  Events propagate normally; DashPanel owns drag-surface exclusions for interactive slot content.
- The public API has no `children`, polymorphic `as`, `asChild`, render function, variant, density,
  or behavior props. Density and theme affect its shared CSS recipe through inherited tokens.
- Internal subcomponents may organize the implementation but are not public until a concrete
  consumer need defines their contracts.

DashPanel supplies any grab surface, collapse control, title, menu, and close control through these
slots and retains all associated behavior. DashList may supply a title and List behavior menu. The
shared component never starts dragging, toggles state, closes a Panel, or executes an action.

The slots are the complete content of the shared primitive; DashHeader has no implicit default
elements. DashPanel and DashList create their own default slot nodes internally from their
domain-level props. Neither product initially exposes a generic `headerSlots` override. If a future
product contract admits one, an omitted value retains the product default, `null` removes an
optional default, and a node replaces that position. Additive customization uses an explicit
domain API, such as action-menu composition, rather than implicit slot appending.

DashPanel and DashList explicitly reexport `DashHeader`, `DashHeaderProps`, and `DashHeaderSlots`
for consumer convenience. They must not blanket-export all of `@picodash/ui`.

The implementation and type evidence is in [dash-header.test.tsx](../../packages/ui/tests/dash-header.test.tsx)
and [dash-header.types.test.tsx](../../packages/ui/tests/dash-header.types.test.tsx). The component tests
cover the neutral root/ref, native prop forwarding, fixed wrapper order and hooks, title-wrapper
presence, non-nullish optional-slot rendering, and unchanged slot semantics. The type tests cover
the exact slot-only public surface and reject children, top-level slot values, polymorphic props,
presentation props, and product behavior.

## Theme and stylesheet contract

> Contract: Accepted shared and product-owned token inventories, ownership, naming, density, and
> verification rules
>
> Implementation: Partial
>
> Evidence: [CSS contract tests](../../packages/ui/tests/css-contract.test.ts). Built-in recipes,
> accepted token names, and carriers are covered; compact numeric recipes and shared structural
> primitives remain Partial or Planned.

Theme and density remain independent. Density changes geometry tokens but not color-theme identity,
semantics, or durable state. Portaled or otherwise detached roots repeat the resolved
`data-picodash-theme` and `data-picodash-density` attributes when they leave the nearest carrier's
DOM ancestry.

The target CSS dependency order is:

1. `@picodash/ui/style.css` for shared recipes, tokens, and UI-owned structure;
2. the consuming product's `style.css` for Panel- or List-owned structure;
3. the host's named-theme overrides and deliberate customization.

`@picodash/ui/style.css` defines every shared token exactly once. DashPanel and DashList import that
foundation before their own structural styles and never copy or redefine its recipes.

### Token ownership and compatibility

- Public shared tokens use `--picodash-*` and describe product-neutral color, spacing, typography,
  control geometry, icon, radius, opacity, border, elevation, motion, blur, or layer roles.
- Public product tokens include their owning domain noun: `--picodash-panel-*`,
  `--picodash-list-*`, or `--picodash-dashlet-*`.
- Private derived values and component formulas use `--_picodash-*`. They are neither documented
  customization points nor compatibility promises.
- Raw CSS variables are the framework-independent public contract. Tailwind aliases such as
  `bg-picodash-surface` are replaceable build conveniences rather than a second public token API.
- Public token names and semantic purposes are stable. Built-in recipe values are documented
  defaults that may evolve while preserving the role and required accessibility behavior.
- A named custom theme defines all 24 public shared color tokens and an appropriate CSS
  `color-scheme` under its `data-picodash-theme="name"` selector. This makes the named recipe complete
  instead of silently extending an undocumented light or dark base. Non-color tokens retain their
  shared defaults unless the host deliberately overrides them. A host that wants only a partial
  local restyle may override a built-in light or dark selector instead.
- Shared elevation uses the generic `--picodash-shadow-elevated`; the prototype name
  `--picodash-shadow-panel` is retired because Lists also use that role for dragged rows and groups.
- The prototype's viewer shadow and viewer layer are not shared tokens. They are excluded from the
  initial public inventory with the deferred viewer Dashlet. A future accepted viewer uses the
  shared overlay and elevation contracts unless evidence justifies a DashList-owned customization
  token. The Dashlet field minimum becomes `--picodash-dashlet-field-min-height`, while
  `--picodash-panel-width` remains DashPanel-owned.
- Raised, drag, tooltip, popover, menu, and dialog layers remain shared generic roles.

Each product reference lists its owned tokens and every shared token it consumes. Shared rows link
back to this canonical inventory rather than redefining their meaning. This gives standalone
consumers a complete dependency list while retaining one owner for each contract.

### Shared public token inventory

> Contract: Accepted names and semantic roles
>
> Implementation: Prototype values require migration to the accepted names

The 79 public shared tokens are exactly:

| Category   | Exact token set                                                                                                                                                                                                                         |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Colors     | `--picodash-color-{canvas,surface,surface-raised,surface-muted,text,text-strong,text-muted,border,control-border,well,focus,accent,accent-text,success,info,warning,alert,danger,overlay}` and `--picodash-color-data-{1..5}`           |
| Spacing    | `--picodash-space-{0-5,1,1-5,2,2-5,3,4,5}`                                                                                                                                                                                              |
| Typography | `--picodash-font-family`, `--picodash-font-size-{xs,sm,md,lg,xl,2xl,3xl}`, `--picodash-font-weight-{light,normal,medium,semibold}`, `--picodash-line-height-{none,tight,normal,relaxed}`, and `--picodash-letter-spacing-{normal,wide}` |
| Geometry   | `--picodash-control-height-{xs,sm,md,lg}`, `--picodash-icon-{xs,sm,md,lg}`, `--picodash-radius-{control,surface}`, `--picodash-border-width-thin`, and `--picodash-opacity-{disabled,disabled-soft,muted,subtle}`                       |
| Effects    | `--picodash-shadow-{sm,md,elevated,inner}` and `--picodash-blur-{surface,overlay}`                                                                                                                                                      |
| Motion     | `--picodash-duration-fast` and `--picodash-easing-out`                                                                                                                                                                                  |
| Layers     | `--picodash-layer-{raised,drag,tooltip,popover,menu,dialog}`                                                                                                                                                                            |

Brace notation in this table enumerates literal names; it does not describe a wildcard extension
point. Adding another suffix changes the public inventory and requires the same contract review as
adding a new token.

The prototype names `--picodash-color-control`, `--picodash-font-{light,normal,medium,semibold}`,
`--picodash-line-{none,tight,normal,relaxed}`, `--picodash-tracking-{normal,wide}`,
`--picodash-border-thin`, `--picodash-ease-out`, and `--picodash-layer-select` migrate respectively
to the accepted `control-border`, `font-weight-*`, `line-height-*`, `letter-spacing-*`,
`border-width-thin`, `easing-out`, and `layer-popover` names. No compatibility aliases are required
before the first stable release.

The regular recipe initially retains the prototype's exercised values under the accepted names.
Those values remain documented defaults rather than immutable API constants. Compact numeric values
are implementation evidence established by the first cohesive visual pass because the prototype is
already dense and arbitrary reductions would risk legibility. Changing those values does not change
the accepted density vocabulary or semantic token roles.

### Density recipes

`regular` and `compact` recipes override shared spacing, typography, control-height, and icon tokens.
They do not change colors, elevations, radii, or layer ordering. Product-specific geometry may also
respond to density through its product-owned tokens. Coarse-pointer media rules preserve at least
44 CSS pixel hit targets even when compact visual geometry is smaller.

### CSS verification

One static artifact suite verifies that:

- every public token is defined by exactly one owning stylesheet;
- every referenced public token exists;
- documented product inventories match actual consumption or an explicit inherited dependency;
- private `--_picodash-*` names do not appear as public customization guidance; and
- product stylesheets do not redefine shared recipes.

The final packaging review must prove that a standalone DashPanel or DashList installation receives
all required shared styles through documented imports and does not depend on Picodash facade CSS.

## Public surfaces

| Surface                  | Contract | Implementation | Purpose                                                                                            |
| ------------------------ | -------- | -------------- | -------------------------------------------------------------------------------------------------- |
| `@picodash/ui`           | Accepted | Partial        | Theme/density slice is available; remaining shared UI inventory is Planned.                        |
| `@picodash/ui/style.css` | Accepted | Partial        | Shared token recipes and carriers are available; compact values and structural CSS remain Planned. |
| Product reexports        | Accepted | Planned        | Explicit stable conveniences only.                                                                 |
| Additional UI subpaths   | Deferred | Not started    | Added only for a demonstrated package need.                                                        |
| `@picodash/theme` alias  | Rejected | Prototype      | Current package is replaced during migration.                                                      |

There is no initial `@picodash/ui/catalog`. The component catalog is product-composition metadata,
while UI primitives remain documented through this reference and their TypeScript declarations.

## Explicit reexports

> Contract: Accepted
>
> Implementation: Planned

- `@picodash/ui` exports the complete accepted inventory and every named public type defined in this
  reference.
- `@picodash/dashpanel` and `@picodash/dashlist` each reexport `DashHeader`, `ActionMenu`,
  `ActionMenuItem`, `ActionSubmenu`, `ActionMenuSeparator`, and their public types, including
  `ActionMenuConfirmation`. These are the shared identities used by each product's header and
  action-composition APIs.
- The product roots do not reexport `Button`, AlertDialog, Tooltip, or the shared Providers merely
  because their implementations use them. Consumers needing those generic primitives import them
  from `@picodash/ui`.
- `@picodash/picodash` reexports the same header and ActionMenu identities needed by its integrated
  Panel and List APIs. `@picodash/picodash/ui` explicitly mirrors the complete `@picodash/ui`
  inventory as a facade convenience.
- No package uses `export *` to create these promises. Every reexport is named, and each reexported
  type is identical to the UI-owned type rather than a facade wrapper.

## Implementation evidence to complete

No unresolved shared-UI contract question blocks implementation. Conformance work must still record:

1. exact compact recipe defaults established by cohesive visual and coarse-pointer review;
2. exhaustive shared-token consumption tables generated from the implemented stylesheets; and
3. public data-slot inventories plus private structural-selector audits for each implemented
   component.

## Related documents

- [ADR 0003: Shared UI foundation](../adr/0003-shared-ui-foundation.md)
- [DashPanel target reference](dashpanel.md)
- [DashList target reference](dashlist.md)
- [Picodash target reference](picodash.md)
