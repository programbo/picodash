import { cva, type VariantProps } from 'class-variance-authority'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import { Select as SelectPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'
import { useStore } from 'zustand'
import { tweakerGeometryTokens } from './theme.js'
import { useTweakerTheme } from './tweaker-theme-context.js'
import {
  portalLayerZIndexForState,
  portalLayerZIndexValue,
  useTweakerProviderContext,
} from './tweaker-provider.js'
import { cn } from './utils.js'

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-(--tweaker-space-1-5) rounded-tweaker-control text-(length:--tweaker-font-size-xl) leading-(--tweaker-line-normal) font-(--tweaker-font-medium) whitespace-nowrap text-tweaker-text transition-colors duration-(--tweaker-duration-fast) outline-none disabled:pointer-events-none disabled:opacity-(--tweaker-opacity-disabled) focus-visible:ring-2 focus-visible:ring-tweaker-focus focus-visible:ring-offset-1 focus-visible:ring-offset-tweaker-canvas',
  {
    variants: {
      variant: {
        default:
          'bg-tweaker-accent text-tweaker-accent-text shadow-tweaker-sm hover:bg-tweaker-accent/90',
        ghost: 'hover:bg-tweaker-surface-muted hover:text-tweaker-text',
        outline:
          'border border-tweaker-control bg-tweaker-canvas shadow-tweaker-sm hover:bg-tweaker-surface-muted hover:text-tweaker-text',
        subtle: 'bg-tweaker-surface-muted text-tweaker-text hover:bg-tweaker-surface-muted/80',
      },
      size: {
        icon: 'size-(--tweaker-control-height-sm)',
        sm: 'h-(--tweaker-control-height-md) px-(--tweaker-space-2-5)',
        md: 'h-(--tweaker-control-height-lg) px-(--tweaker-space-3)',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
)

export interface ButtonProps
  extends ComponentProps<'button'>, VariantProps<typeof buttonVariants> {}

export function Button({ className, size, type = 'button', variant, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ size, variant }), className)} type={type} {...props} />
  )
}

export function Label({ className, ...props }: ComponentProps<'label'>) {
  return (
    <label
      className={cn(
        'text-(length:--tweaker-font-size-lg) leading-(--tweaker-line-tight) font-(--tweaker-font-medium) text-tweaker-text',
        className,
      )}
      {...props}
    />
  )
}

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'flex h-(--tweaker-control-height-md) w-full rounded-tweaker-control border-0 border-b border-tweaker-control bg-transparent px-(--tweaker-space-2-5) py-(--tweaker-space-1) text-(length:--tweaker-font-size-lg) leading-(--tweaker-line-tight) text-tweaker-text shadow-none outline-none transition-colors duration-(--tweaker-duration-fast) placeholder:text-tweaker-muted focus:bg-tweaker-canvas focus-visible:ring-2 focus-visible:ring-tweaker-focus disabled:cursor-not-allowed disabled:opacity-(--tweaker-opacity-disabled)',
        className,
      )}
      {...props}
    />
  )
}

export function Select(props: ComponentProps<typeof SelectPrimitive.Root>) {
  return <SelectPrimitive.Root {...props} />
}

export function SelectTrigger({
  children,
  className,
  ...props
}: ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        'flex h-(--tweaker-control-height-sm) w-full items-center justify-between gap-(--tweaker-space-1) rounded-tweaker-control border-0 border-b border-tweaker-control bg-transparent py-(--tweaker-space-0-5) pr-6 pl-(--tweaker-space-1-5) text-(length:--tweaker-font-size-lg) leading-(--tweaker-line-tight) text-tweaker-text shadow-none outline-none transition-colors duration-(--tweaker-duration-fast) focus:bg-tweaker-canvas focus-visible:ring-2 focus-visible:ring-tweaker-focus disabled:cursor-not-allowed disabled:opacity-(--tweaker-opacity-disabled)',
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown
          className="size-(--tweaker-icon-sm) shrink-0 opacity-(--tweaker-opacity-muted)"
          aria-hidden="true"
        />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

export function SelectValue(props: ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value {...props} />
}

export function SelectContent({
  children,
  className,
  collisionPadding = tweakerGeometryTokens.selectCollisionPadding,
  position = 'popper',
  sideOffset = tweakerGeometryTokens.selectSideOffset,
  style,
  ...props
}: ComponentProps<typeof SelectPrimitive.Content>) {
  const theme = useTweakerTheme()
  const { portalContainer, store } = useTweakerProviderContext()
  const zIndexFloor = useStore(store, (state) => portalLayerZIndexForState(state, 2))

  return (
    <SelectPrimitive.Portal container={portalContainer}>
      <SelectPrimitive.Content
        {...props}
        data-tweaker-theme={theme}
        avoidCollisions
        className={cn(
          'pointer-events-auto z-(--tweaker-layer-select) max-h-(--radix-select-content-available-height) max-w-(--radix-select-content-available-width) min-w-(--radix-select-trigger-width) overflow-hidden rounded-tweaker-surface border border-tweaker-border bg-tweaker-surface-raised text-tweaker-text shadow-(--tweaker-shadow-md)',
          className,
        )}
        collisionPadding={collisionPadding}
        position={position}
        sideOffset={sideOffset}
        sticky="always"
        style={{
          ...style,
          zIndex: portalLayerZIndexValue('--tweaker-layer-select', zIndexFloor),
        }}
      >
        <SelectPrimitive.ScrollUpButton className="flex h-(--tweaker-control-height-md) cursor-default items-center justify-center">
          <ChevronUp className="size-(--tweaker-icon-sm)" aria-hidden="true" />
        </SelectPrimitive.ScrollUpButton>
        <SelectPrimitive.Viewport className="p-(--tweaker-space-1)">
          {children}
        </SelectPrimitive.Viewport>
        <SelectPrimitive.ScrollDownButton className="flex h-(--tweaker-control-height-md) cursor-default items-center justify-center">
          <ChevronDown className="size-(--tweaker-icon-sm)" aria-hidden="true" />
        </SelectPrimitive.ScrollDownButton>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
}

export function SelectItem({
  children,
  className,
  ...props
}: ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={cn(
        'relative flex h-(--tweaker-control-height-md) w-full cursor-default items-center rounded-tweaker-control pr-8 pl-8 text-(length:--tweaker-font-size-lg) leading-(--tweaker-line-tight) outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-(--tweaker-opacity-disabled) data-[highlighted]:bg-tweaker-surface-muted data-[highlighted]:text-tweaker-text',
        className,
      )}
      {...props}
    >
      <span className="pointer-events-none absolute right-(--tweaker-space-2) flex size-(--tweaker-icon-sm) items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="size-(--tweaker-icon-sm)" aria-hidden="true" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

export function Switch({
  checked,
  className,
  disabled,
  onCheckedChange,
  ...props
}: Omit<ComponentProps<'button'>, 'onChange'> & {
  checked: boolean
  onCheckedChange?: (checked: boolean) => void
}) {
  return (
    <button
      aria-checked={checked}
      className={cn(
        'relative inline-flex h-(--_tweaker-switch-height) w-(--_tweaker-switch-width) shrink-0 items-center rounded-full border border-transparent bg-tweaker-control transition-colors duration-(--tweaker-duration-fast) outline-none focus-visible:ring-2 focus-visible:ring-tweaker-focus disabled:cursor-not-allowed disabled:opacity-(--tweaker-opacity-disabled) data-[state=checked]:bg-tweaker-accent',
        className,
      )}
      data-state={checked ? 'checked' : 'unchecked'}
      disabled={disabled}
      role="switch"
      type="button"
      onClick={() => {
        if (!disabled) onCheckedChange?.(!checked)
      }}
      {...props}
    >
      <span
        className="bg-tweaker-canvas shadow-tweaker-sm pointer-events-none block size-(--_tweaker-switch-thumb-size) rounded-full transition-transform duration-(--tweaker-duration-fast) data-[state=checked]:translate-x-(--_tweaker-switch-thumb-translate) data-[state=unchecked]:translate-x-0"
        data-state={checked ? 'checked' : 'unchecked'}
      />
    </button>
  )
}
