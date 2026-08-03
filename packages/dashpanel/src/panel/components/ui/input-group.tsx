import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Group, type GroupProps } from 'react-aria-components'

import { cn } from '../../lib/utils.js'
import { Button } from './button.js'
import { Input } from './input.js'
import { Textarea } from './textarea.js'

function InputGroup({ className, ...props }: GroupProps) {
  return (
    <Group
      data-slot="input-group"
      className={cn(
        'group/input-group bg-picodash-well has-[[data-slot=input-group-control]:focus-visible]:border-picodash-focus has-[[data-slot=input-group-control]:focus-visible]:ring-picodash-focus/30 has-[[data-slot][aria-invalid=true]]:border-picodash-danger has-[[data-slot][aria-invalid=true]]:ring-picodash-danger/20 rounded-picodash-control relative flex h-(--picodash-control-height-md) w-full min-w-0 items-center border border-transparent transition-[color,box-shadow] duration-(--picodash-duration-fast) outline-none in-data-[slot=combobox-content]:focus-within:border-inherit in-data-[slot=combobox-content]:focus-within:ring-0 has-[[data-slot=input-group-control]:focus-visible]:ring-3 has-[[data-slot][aria-invalid=true]]:ring-3 has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col has-[>textarea]:h-auto has-[>[data-align=block-end]]:[&>input]:pt-(--picodash-space-3) has-[>[data-align=block-start]]:[&>input]:pb-(--picodash-space-3) has-[>[data-align=inline-end]]:[&>input]:pr-(--picodash-space-1-5) has-[>[data-align=inline-start]]:[&>input]:pl-(--picodash-space-1-5)',
        className,
      )}
      {...props}
    />
  )
}

const inputGroupAddonVariants = cva(
  "flex h-auto cursor-text items-center justify-center gap-(--picodash-space-2) py-(--picodash-space-1-5) text-(length:--picodash-font-size-lg) leading-(--picodash-line-tight) font-(--picodash-font-medium) text-picodash-muted select-none group-data-[disabled=true]/input-group:opacity-(--picodash-opacity-disabled) **:data-[slot=kbd]:rounded-picodash-control **:data-[slot=kbd]:bg-picodash-muted/10 **:data-[slot=kbd]:px-(--picodash-space-1-5) [&>svg:not([class*='size-'])]:size-(--picodash-icon-md)",
  {
    variants: {
      align: {
        'inline-start':
          'order-first pl-(--picodash-space-2) has-[>button]:ml-[calc(-1*var(--picodash-space-1))] has-[>kbd]:ml-[calc(-1*var(--picodash-space-0-5))]',
        'inline-end':
          'order-last pr-(--picodash-space-2) has-[>button]:mr-[calc(-1*var(--picodash-space-1))] has-[>kbd]:mr-[calc(-1*var(--picodash-space-0-5))]',
        'block-start':
          'order-first w-full justify-start px-(--picodash-space-2-5) pt-(--picodash-space-2) group-has-[>input]/input-group:pt-(--picodash-space-2) [.border-b]:pb-(--picodash-space-2)',
        'block-end':
          'order-last w-full justify-start px-(--picodash-space-2-5) pb-(--picodash-space-2) group-has-[>input]/input-group:pb-(--picodash-space-2) [.border-t]:pt-(--picodash-space-2)',
      },
    },
    defaultVariants: {
      align: 'inline-start',
    },
  },
)

function InputGroupAddon({
  className,
  align = 'inline-start',
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof inputGroupAddonVariants>) {
  return (
    <div
      role="group"
      data-slot="input-group-addon"
      data-align={align}
      className={cn(inputGroupAddonVariants({ align }), className)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button')) {
          return
        }
        e.currentTarget.parentElement?.querySelector('input')?.focus()
      }}
      {...props}
    />
  )
}

const inputGroupButtonVariants = cva(
  'flex items-center gap-(--picodash-space-2) rounded-picodash-control text-(length:--picodash-font-size-lg) leading-(--picodash-line-tight) shadow-none',
  {
    variants: {
      size: {
        xs: "h-(--picodash-control-height-xs) gap-(--picodash-space-1) rounded-picodash-control px-(--picodash-space-1-5) [&>svg:not([class*='size-'])]:size-(--picodash-icon-xs)",
        sm: '',
        'icon-xs':
          'size-(--picodash-control-height-xs) rounded-picodash-control p-0 has-[>svg]:p-0',
        'icon-sm': 'size-(--picodash-control-height-md) p-0 has-[>svg]:p-0',
      },
    },
    defaultVariants: {
      size: 'xs',
    },
  },
)

function InputGroupButton({
  className,
  type = 'button',
  variant = 'ghost',
  size = 'xs',
  ...props
}: Omit<React.ComponentProps<typeof Button>, 'size' | 'type'> &
  VariantProps<typeof inputGroupButtonVariants> & {
    type?: 'button' | 'submit' | 'reset'
  }) {
  return (
    <Button
      type={type}
      data-size={size}
      variant={variant}
      className={cn(inputGroupButtonVariants({ size }), className)}
      {...props}
    />
  )
}

function InputGroupText({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      className={cn(
        "text-picodash-muted flex items-center gap-(--picodash-space-2) text-(length:--picodash-font-size-lg) leading-(--picodash-line-tight) [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-(--picodash-icon-md)",
        className,
      )}
      {...props}
    />
  )
}

function InputGroupInput({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <Input
      data-slot="input-group-control"
      className={cn(
        'flex-1 rounded-none border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0 aria-invalid:ring-0',
        className,
      )}
      {...props}
    />
  )
}

function InputGroupTextarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <Textarea
      data-slot="input-group-control"
      className={cn(
        'flex-1 resize-none rounded-none border-0 bg-transparent py-(--picodash-space-2) shadow-none ring-0 focus-visible:ring-0 aria-invalid:ring-0',
        className,
      )}
      {...props}
    />
  )
}

export {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupInput,
  InputGroupTextarea,
}
