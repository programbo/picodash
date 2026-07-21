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
import { tweakerGeometryTokens } from '../../theme.js'
import { useTweakerTheme } from '../../tweaker-theme-context.js'
import {
  portalLayerZIndexForState,
  portalLayerZIndexValue,
  useTweakerProviderContext,
} from '../../tweaker-provider.js'

function Select<T extends object, M extends 'single' | 'multiple' = 'single'>({
  className,
  ...props
}: SelectProps<T, M>) {
  return (
    <SelectPrimitive
      data-slot="select"
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
      className={cn('flex flex-1 text-left data-placeholder:text-tweaker-muted', className)}
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
        "flex h-(--tweaker-control-height-sm) w-full items-center justify-between gap-(--tweaker-space-1) rounded-tweaker-control border-0 border-b border-tweaker-control bg-transparent py-(--tweaker-space-0-5) pr-1 pl-(--tweaker-space-1-5) text-(length:--tweaker-font-size-lg) leading-(--tweaker-line-tight) text-tweaker-text whitespace-nowrap shadow-none outline-none transition-colors duration-(--tweaker-duration-fast) data-hovered:bg-tweaker-canvas data-focus-visible:ring-2 data-focus-visible:ring-tweaker-focus data-disabled:cursor-not-allowed data-disabled:opacity-(--tweaker-opacity-disabled) aria-invalid:border-tweaker-danger aria-invalid:ring-2 aria-invalid:ring-tweaker-danger/20 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-(--tweaker-space-1) [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-(--tweaker-icon-sm)",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronDownIcon className="text-tweaker-muted pointer-events-none size-4" />
    </ButtonPrimitive>
  )
}

function SelectContent({
  className,
  children,
  placement = 'bottom',
  offset = tweakerGeometryTokens.selectSideOffset,
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
  offset = tweakerGeometryTokens.selectSideOffset,
  crossOffset = 0,
  style,
  ...props
}: Omit<React.ComponentProps<typeof PopoverPrimitive>, 'className' | 'children'> & {
  className?: string
  children?: React.ReactNode
}) {
  const theme = useTweakerTheme()
  const { portalContainer, store } = useTweakerProviderContext()
  const zIndexFloor = useStore(store, (state) => portalLayerZIndexForState(state, 2))

  return (
    <PopoverPrimitive
      data-slot="select-content"
      data-tweaker-theme={theme}
      placement={placement}
      offset={offset}
      crossOffset={crossOffset}
      containerPadding={tweakerGeometryTokens.selectCollisionPadding}
      UNSTABLE_portalContainer={portalContainer ?? undefined}
      className={cn(
        'pointer-events-auto isolate z-(--tweaker-layer-select) max-h-(--available-height) w-(--trigger-width) min-w-(--trigger-width) origin-(--trigger-anchor-point) overflow-hidden rounded-tweaker-surface border border-tweaker-border bg-tweaker-surface-raised text-tweaker-text shadow-(--tweaker-shadow-md) duration-100 data-entering:animate-in data-entering:fade-in-0 data-entering:zoom-in-95 data-exiting:animate-out data-exiting:fade-out-0 data-exiting:zoom-out-95 data-[placement=bottom]:slide-in-from-top-2 data-[placement=left]:slide-in-from-right-2 data-[placement=right]:slide-in-from-left-2 data-[placement=top]:slide-in-from-bottom-2',
        className,
      )}
      style={composeRenderProps(style, (style) => ({
        ...style,
        zIndex: portalLayerZIndexValue('--tweaker-layer-select', zIndexFloor),
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
        'group/select-list max-h-[inherit] overflow-x-hidden overflow-y-auto p-(--tweaker-space-1) outline-hidden',
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
      className={cn('px-2 py-1 text-xs text-tweaker-muted', className)}
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
        "relative flex h-(--tweaker-control-height-md) w-full cursor-default items-center gap-(--tweaker-space-1) rounded-tweaker-control pr-8 pl-8 text-(length:--tweaker-font-size-lg) leading-(--tweaker-line-tight) outline-hidden select-none data-focused:bg-tweaker-surface-muted data-focused:text-tweaker-text data-disabled:pointer-events-none data-disabled:opacity-(--tweaker-opacity-disabled) [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-(--tweaker-icon-sm)",
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
      className={cn('pointer-events-none -mx-1 my-1 h-px bg-tweaker-border', className)}
      {...props}
    />
  )
}

function SelectEmpty({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="select-empty"
      className={cn(
        'hidden w-full justify-center py-2 text-center text-sm text-tweaker-muted group-data-empty/select-list:flex',
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
