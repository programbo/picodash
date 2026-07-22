'use client'

import * as React from 'react'
import {
  Dialog as DialogPrimitive,
  DialogTrigger as DialogTriggerPrimitive,
  Heading,
  ModalOverlay as ModalOverlayPrimitive,
  Modal as ModalPrimitive,
  Text,
  type DialogProps as DialogPrimitiveProps,
  type DialogTriggerProps as DialogTriggerPrimitiveProps,
  type ModalOverlayProps as ModalOverlayPrimitiveProps,
} from 'react-aria-components'

import { cn } from '#lib/utils'
import { Button } from '#components/ui/button'
import { XIcon } from 'lucide-react'

const DialogDescriptionContext = React.createContext<
  ((descriptionId: string) => () => void) | null
>(null)

function DialogTrigger({ ...props }: DialogTriggerPrimitiveProps) {
  return <DialogTriggerPrimitive data-slot="dialog-trigger" {...props} />
}

function DialogClose({
  className,
  variant = 'outline',
  size = 'default',
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      slot="close"
      data-slot="dialog-close"
      variant={variant}
      size={size}
      className={cn(className)}
      {...props}
    />
  )
}

function DialogOverlay({
  className,
  children,
  ...props
}: Omit<ModalOverlayPrimitiveProps, 'className' | 'children'> & {
  className?: string
  children: React.ReactNode
}) {
  return (
    <ModalOverlayPrimitive
      data-slot="dialog-overlay"
      className={cn(
        'fixed inset-0 isolate z-50 bg-black/30 duration-100 data-entering:animate-in data-entering:fade-in-0 data-exiting:animate-out data-exiting:fade-out-0 supports-backdrop-filter:backdrop-blur-sm',
        className,
      )}
      {...props}
    >
      {children}
    </ModalOverlayPrimitive>
  )
}

function Dialog({
  className,
  children,
  showCloseButton = true,
  isDismissable = true,
  overlayClassName,
  overlayStyle,
  portalContainer,
  style,
  'data-picodash-theme': picodashTheme,
  ...props
}: Omit<ModalOverlayPrimitiveProps, 'className' | 'children'> &
  Pick<React.ComponentProps<typeof ModalPrimitive>, 'isDismissable'> & {
    className?: string
    children: React.ReactNode
    showCloseButton?: boolean
    overlayClassName?: string
    overlayStyle?: React.CSSProperties
    portalContainer?: Element | null
    style?: React.CSSProperties
    'data-picodash-theme'?: string
  }) {
  const [descriptionIds, setDescriptionIds] = React.useState<readonly string[]>([])
  const registerDescription = React.useCallback((descriptionId: string) => {
    setDescriptionIds((currentIds) =>
      currentIds.includes(descriptionId) ? currentIds : [...currentIds, descriptionId],
    )
    return () => {
      setDescriptionIds((currentIds) => currentIds.filter((id) => id !== descriptionId))
    }
  }, [])

  return (
    <DialogOverlay
      isDismissable={isDismissable}
      {...props}
      data-picodash-theme={picodashTheme}
      className={overlayClassName}
      style={overlayStyle}
      UNSTABLE_portalContainer={portalContainer ?? undefined}
    >
      <ModalPrimitive
        data-slot="dialog-content"
        data-picodash-theme={picodashTheme}
        style={style}
        className={cn(
          'fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-6 rounded-[min(var(--radius-4xl),24px)] bg-picodash-surface-raised p-6 text-sm text-picodash-text shadow-xl ring-1 ring-picodash-text/5 duration-100 outline-none data-entering:animate-in data-entering:fade-in-0 data-entering:zoom-in-95 data-exiting:animate-out data-exiting:fade-out-0 data-exiting:zoom-out-95 sm:max-w-md dark:ring-picodash-text/10',
          className,
        )}
      >
        <DialogPrimitive
          aria-describedby={descriptionIds.length > 0 ? descriptionIds.join(' ') : undefined}
          data-slot="dialog"
          data-picodash-theme={picodashTheme}
          className="[display:inherit] [gap:inherit] outline-none"
        >
          <DialogDescriptionContext.Provider value={registerDescription}>
            {children}
          </DialogDescriptionContext.Provider>
          {showCloseButton && (
            <DialogClose
              variant="ghost"
              className="bg-picodash-surface-muted absolute top-4 right-4"
              size="icon-sm"
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </DialogClose>
          )}
        </DialogPrimitive>
      </ModalPrimitive>
    </DialogOverlay>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="dialog-header" className={cn('flex flex-col gap-1.5', className)} {...props} />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    >
      {children}
      {showCloseButton && <DialogClose variant="outline">Close</DialogClose>}
    </div>
  )
}

function DialogTitle({ className, ...props }: Omit<React.ComponentProps<typeof Heading>, 'slot'>) {
  return (
    <Heading
      slot="title"
      data-slot="dialog-title"
      className={cn('text-base leading-none font-medium', className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  id: providedId,
  ...props
}: Omit<React.ComponentProps<typeof Text>, 'elementType' | 'slot'>) {
  const generatedId = React.useId()
  const descriptionId = providedId ?? generatedId
  const registerDescription = React.useContext(DialogDescriptionContext)

  React.useEffect(() => registerDescription?.(descriptionId), [descriptionId, registerDescription])

  return (
    <Text
      slot="description"
      elementType="div"
      id={descriptionId}
      data-slot="dialog-description"
      className={cn(
        'text-sm text-picodash-muted *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-picodash-text',
        className,
      )}
      {...props}
    />
  )
}

export {
  type DialogPrimitiveProps,
  type DialogTriggerPrimitiveProps,
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
  DialogTrigger,
}
