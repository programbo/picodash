import * as React from 'react'
import { useStore } from 'zustand'
import {
  Button as ButtonPrimitive,
  composeRenderProps,
  Header as HeaderPrimitive,
  ListBoxItem as ListBoxItemPrimitive,
  ListBox as ListBoxPrimitive,
  ListBoxSection as ListBoxSectionPrimitive,
  Popover as PopoverPrimitive,
  SearchField,
  Select as SelectPrimitive,
  SelectValue as SelectValuePrimitive,
  Separator as SeparatorPrimitive,
  type ListBoxProps,
  type SearchFieldProps,
  type ListBoxSectionProps as SelectGroupProps,
  type SelectProps,
  type SelectValueProps,
} from 'react-aria-components'

import { cn } from '#lib/utils'
import { InputGroup, InputGroupAddon, InputGroupInput } from '#components/ui/input-group'
import { ChevronDownIcon, SearchIcon, CheckIcon } from 'lucide-react'
import { picodashGeometryTokens } from '../../lib/theme/theme.js'
import { usePicodashTheme } from '../../lib/theme/picodash-theme-context.js'
import {
  portalLayerZIndexForState,
  portalLayerZIndexValue,
  useOptionalPicodashProviderContext,
  type PicodashProviderContextValue,
} from '../../state/provider/picodash-provider.js'

type SelectPopoverProps = Omit<
  React.ComponentProps<typeof PopoverPrimitive>,
  'className' | 'children'
> & {
  className?: string
  children?: React.ReactNode
}

function Select<T extends object, M extends 'single' | 'multiple' = 'single'>({
  className,
  ...props
}: SelectProps<T, M>) {
  const theme = usePicodashTheme()

  return (
    <SelectPrimitive
      data-slot="select"
      data-picodash-theme={theme}
      className={composeRenderProps(className, (className) => cn('min-w-0', className))}
      {...props}
    />
  )
}

function SelectGroup<T extends object>({ className, ...props }: SelectGroupProps<T>) {
  return (
    <ListBoxSectionPrimitive
      data-slot="select-group"
      className={cn('scroll-my-1.5 p-1', className)}
      {...props}
    />
  )
}

function SelectValue<T extends object>({ className, children, ...props }: SelectValueProps<T>) {
  return (
    <SelectValuePrimitive
      data-slot="select-value"
      className={cn('data-placeholder:text-picodash-muted flex flex-1 text-left', className)}
      {...props}
    >
      {typeof children === 'function'
        ? children
        : ({ selectedItems, selectedText, defaultChildren }) =>
            selectedItems.length > 1 ? selectedText : defaultChildren}
    </SelectValuePrimitive>
  )
}

function SelectTrigger({
  className,
  size = 'default',
  children,
  ...props
}: Omit<React.ComponentProps<typeof ButtonPrimitive>, 'children'> & {
  children?: React.ReactNode
  size?: 'sm' | 'default'
}) {
  return (
    <ButtonPrimitive
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "rounded-picodash-control border-picodash-control text-picodash-text data-hovered:bg-picodash-canvas data-focus-visible:ring-picodash-focus aria-invalid:border-picodash-danger aria-invalid:ring-picodash-danger/20 flex h-(--picodash-control-height-sm) w-full items-center justify-between gap-(--picodash-space-1) border-0 border-b bg-transparent py-(--picodash-space-0-5) pr-1 pl-(--picodash-space-1-5) text-(length:--picodash-font-size-lg) leading-(--picodash-line-tight) whitespace-nowrap shadow-none transition-colors duration-(--picodash-duration-fast) outline-none aria-invalid:ring-2 data-disabled:cursor-not-allowed data-disabled:opacity-(--picodash-opacity-disabled) data-focus-visible:ring-2 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-(--picodash-space-1) [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-(--picodash-icon-sm)",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronDownIcon className="text-picodash-muted pointer-events-none size-4" />
    </ButtonPrimitive>
  )
}

function SelectContent({
  className,
  children,
  placement = 'bottom',
  offset = picodashGeometryTokens.selectSideOffset,
  crossOffset = 0,
  ...props
}: Omit<React.ComponentProps<typeof PopoverPrimitive>, 'className' | 'children'> & {
  className?: string
  children?: React.ReactNode
}) {
  return (
    <SelectPopover
      className={className}
      placement={placement}
      offset={offset}
      crossOffset={crossOffset}
      {...props}
    >
      <SelectList>{children}</SelectList>
    </SelectPopover>
  )
}

function SelectPopover({
  className,
  children,
  placement = 'bottom start',
  offset = picodashGeometryTokens.selectSideOffset,
  crossOffset = 0,
  style,
  ...props
}: SelectPopoverProps) {
  const theme = usePicodashTheme()
  const provider = useOptionalPicodashProviderContext()
  const surfaceProps: SelectPopoverSurfaceProps = {
    ...props,
    children,
    className,
    crossOffset,
    offset,
    placement,
    style,
    theme,
  }

  return provider ? (
    <ProviderSelectPopover {...surfaceProps} provider={provider} />
  ) : (
    <SelectPopoverSurface {...surfaceProps} />
  )
}

function ProviderSelectPopover({
  provider,
  ...props
}: SelectPopoverSurfaceProps & {
  provider: PicodashProviderContextValue
}) {
  const zIndexFloor = useStore(provider.store, (state) => portalLayerZIndexForState(state, 2))

  return (
    <SelectPopoverSurface
      {...props}
      portalContainer={provider.portalContainer}
      zIndexFloor={zIndexFloor}
    />
  )
}

type SelectPopoverSurfaceProps = SelectPopoverProps & {
  portalContainer?: HTMLElement | null
  theme: string
  zIndexFloor?: number
}

function SelectPopoverSurface({
  className,
  children,
  placement,
  offset,
  crossOffset,
  portalContainer,
  style,
  theme,
  zIndexFloor,
  ...props
}: SelectPopoverSurfaceProps) {
  return (
    <PopoverPrimitive
      data-slot="select-content"
      data-picodash-theme={theme}
      placement={placement}
      offset={offset}
      crossOffset={crossOffset}
      containerPadding={picodashGeometryTokens.selectCollisionPadding}
      UNSTABLE_portalContainer={portalContainer ?? undefined}
      className={cn(
        'rounded-picodash-surface border-picodash-border bg-picodash-surface-raised text-picodash-text data-entering:animate-in data-entering:fade-in-0 data-entering:zoom-in-95 data-exiting:animate-out data-exiting:fade-out-0 data-exiting:zoom-out-95 data-[placement=bottom]:slide-in-from-top-2 data-[placement=left]:slide-in-from-right-2 data-[placement=right]:slide-in-from-left-2 data-[placement=top]:slide-in-from-bottom-2 pointer-events-auto isolate z-(--picodash-layer-select) max-h-(--available-height) w-(--trigger-width) min-w-(--trigger-width) origin-(--trigger-anchor-point) overflow-hidden border shadow-(--picodash-shadow-md) duration-100',
        className,
      )}
      style={composeRenderProps(style, (style) => ({
        ...style,
        ...(zIndexFloor === undefined
          ? {}
          : { zIndex: portalLayerZIndexValue('--picodash-layer-select', zIndexFloor) }),
      }))}
      {...props}
    >
      {children}
    </PopoverPrimitive>
  )
}

function SelectList<T extends object>({ className, ...props }: ListBoxProps<T>) {
  return (
    <ListBoxPrimitive
      data-slot="select-list"
      className={cn(
        'group/select-list max-h-[inherit] overflow-x-hidden overflow-y-auto p-(--picodash-space-1) outline-hidden',
        className,
      )}
      {...props}
    />
  )
}

function SelectInput({ className, ...props }: SearchFieldProps) {
  return (
    <SearchField
      {...props}
      autoFocus
      data-slot="select-input-wrapper"
      className={cn('p-1 pb-0', className)}
    >
      <InputGroup>
        <InputGroupInput
          data-slot="select-input"
          className="[&::-webkit-search-cancel-button]:hidden"
        />
        <InputGroupAddon>
          <SearchIcon className="size-4 shrink-0 opacity-50" />
        </InputGroupAddon>
      </InputGroup>
    </SearchField>
  )
}

function SelectLabel({ className, ...props }: React.ComponentProps<typeof HeaderPrimitive>) {
  return (
    <HeaderPrimitive
      data-slot="select-label"
      className={cn('text-picodash-muted px-2 py-1 text-xs', className)}
      {...props}
    />
  )
}

function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ListBoxItemPrimitive>) {
  return (
    <ListBoxItemPrimitive
      data-slot="select-item"
      textValue={typeof children === 'string' ? children : undefined}
      className={cn(
        "rounded-picodash-control data-focused:bg-picodash-surface-muted data-focused:text-picodash-text relative flex h-(--picodash-control-height-md) w-full cursor-default items-center gap-(--picodash-space-1) pr-8 pl-8 text-(length:--picodash-font-size-lg) leading-(--picodash-line-tight) outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-(--picodash-opacity-disabled) [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-(--picodash-icon-sm)",
        className,
      )}
      {...props}
    >
      {composeRenderProps(children, (children, { isSelected }) => (
        <>
          <span className="flex flex-1 shrink-0 gap-2 whitespace-nowrap">{children}</span>
          <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
            {isSelected ? <CheckIcon className="pointer-events-none" /> : null}
          </span>
        </>
      ))}
    </ListBoxItemPrimitive>
  )
}

function SelectSeparator({ className, ...props }: React.ComponentProps<typeof SeparatorPrimitive>) {
  return (
    <SeparatorPrimitive
      data-slot="select-separator"
      className={cn('bg-picodash-border pointer-events-none -mx-1 my-1 h-px', className)}
      {...props}
    />
  )
}

function SelectEmpty({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="select-empty"
      className={cn(
        'text-picodash-muted hidden w-full justify-center py-2 text-center text-sm group-data-empty/select-list:flex',
        className,
      )}
      {...props}
    />
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectInput,
  SelectItem,
  SelectLabel,
  SelectList,
  SelectPopover,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
  SelectEmpty,
}
