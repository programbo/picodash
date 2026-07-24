import * as React from 'react'
import {
  Dialog as AlertDialogPrimitive,
  DialogTrigger as AlertDialogTriggerPrimitive,
  Heading,
  ModalOverlay as ModalOverlayPrimitive,
  Modal as ModalPrimitive,
  Text,
  type DialogTriggerProps as AlertDialogTriggerPrimitiveProps,
  type ModalOverlayProps as ModalOverlayPrimitiveProps,
} from 'react-aria-components'

import { cn } from '#lib/utils'
import { Button } from '#components/ui/button'

const AlertDialogDescriptionContext = React.createContext<
  ((descriptionId: string) => () => void) | null
>(null)
const openAlertDialogs: symbol[] = []

function AlertDialogTrigger({ ...props }: AlertDialogTriggerPrimitiveProps) {
  return <AlertDialogTriggerPrimitive data-slot="alert-dialog-trigger" {...props} />
}

function AlertDialogOverlay({
  className,
  children,
  ...props
}: Omit<ModalOverlayPrimitiveProps, 'className' | 'children'> & {
  className?: string
  children: React.ReactNode
}) {
  return (
    <ModalOverlayPrimitive
      data-slot="alert-dialog-overlay"
      className={cn(
        'data-entering:animate-in data-entering:fade-in-0 data-exiting:animate-out data-exiting:fade-out-0 fixed inset-0 isolate z-50 bg-black/30 duration-100 supports-backdrop-filter:backdrop-blur-sm',
        className,
      )}
      {...props}
    >
      {children}
    </ModalOverlayPrimitive>
  )
}

function AlertDialog({
  className,
  size = 'default',
  children,
  isDismissable = false,
  isKeyboardDismissDisabled = false,
  isOpen,
  onOpenChange,
  overlayClassName,
  overlayStyle,
  portalContainer,
  style,
  'data-picodash-theme': picodashTheme,
  ...props
}: Omit<ModalOverlayPrimitiveProps, 'className' | 'children'> &
  Pick<React.ComponentProps<typeof ModalPrimitive>, 'isDismissable'> & {
    className?: string
    size?: 'default' | 'sm'
    children: React.ReactNode
    overlayClassName?: string
    overlayStyle?: React.CSSProperties
    portalContainer?: Element | null
    style?: React.CSSProperties
    'data-picodash-theme'?: string
  }) {
  const [descriptionIds, setDescriptionIds] = React.useState<readonly string[]>([])
  const dialogId = React.useRef(Symbol('alert-dialog')).current
  const isKeyboardDismissDisabledRef = React.useRef(isKeyboardDismissDisabled)
  const onOpenChangeRef = React.useRef(onOpenChange)
  isKeyboardDismissDisabledRef.current = isKeyboardDismissDisabled
  onOpenChangeRef.current = onOpenChange
  const registerDescription = React.useCallback((descriptionId: string) => {
    setDescriptionIds((currentIds) =>
      currentIds.includes(descriptionId) ? currentIds : [...currentIds, descriptionId],
    )
    return () => {
      setDescriptionIds((currentIds) => currentIds.filter((id) => id !== descriptionId))
    }
  }, [])

  React.useEffect(() => {
    if (!isOpen) return

    openAlertDialogs.push(dialogId)
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (
        event.key !== 'Escape' ||
        isKeyboardDismissDisabledRef.current ||
        openAlertDialogs[openAlertDialogs.length - 1] !== dialogId
      ) {
        return
      }
      const changeOpen = onOpenChangeRef.current
      if (!changeOpen) return
      event.preventDefault()
      event.stopPropagation()
      changeOpen(false)
    }

    document.addEventListener('keydown', dismissOnEscape, true)
    return () => {
      document.removeEventListener('keydown', dismissOnEscape, true)
      const index = openAlertDialogs.lastIndexOf(dialogId)
      if (index >= 0) openAlertDialogs.splice(index, 1)
    }
  }, [dialogId, isOpen])

  return (
    <AlertDialogOverlay
      {...props}
      isDismissable={isDismissable}
      isKeyboardDismissDisabled={isKeyboardDismissDisabled}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      shouldCloseOnInteractOutside={() => false}
      data-picodash-theme={picodashTheme}
      className={overlayClassName}
      style={overlayStyle}
      UNSTABLE_portalContainer={portalContainer ?? undefined}
    >
      <ModalPrimitive
        data-slot="alert-dialog-content"
        data-size={size}
        data-picodash-theme={picodashTheme}
        style={style}
        className={cn(
          'group/alert-dialog-content bg-picodash-surface-raised text-picodash-text ring-picodash-text/5 data-entering:animate-in data-entering:fade-in-0 data-entering:zoom-in-95 data-exiting:animate-out data-exiting:fade-out-0 data-exiting:zoom-out-95 dark:ring-picodash-text/10 fixed top-1/2 left-1/2 z-50 grid w-full -translate-x-1/2 -translate-y-1/2 gap-6 rounded-[min(var(--radius-4xl),24px)] p-6 shadow-xl ring-1 duration-100 outline-none data-[size=default]:max-w-xs data-[size=sm]:max-w-xs data-[size=default]:sm:max-w-md',
          className,
        )}
      >
        <AlertDialogPrimitive
          aria-describedby={descriptionIds.length > 0 ? descriptionIds.join(' ') : undefined}
          data-slot="alert-dialog"
          data-picodash-theme={picodashTheme}
          role="alertdialog"
          className="[display:inherit] gap-[inherit] outline-none"
        >
          <AlertDialogDescriptionContext.Provider value={registerDescription}>
            {children}
          </AlertDialogDescriptionContext.Provider>
        </AlertDialogPrimitive>
      </ModalPrimitive>
    </AlertDialogOverlay>
  )
}

function AlertDialogContent({
  className,
  size = 'default',
  children,
  ...props
}: React.ComponentProps<typeof AlertDialog>) {
  return (
    <AlertDialog className={className} size={size} {...props}>
      {children}
    </AlertDialog>
  )
}

function AlertDialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn(
        'grid grid-rows-[auto_1fr] place-items-center gap-1.5 text-center has-data-[slot=alert-dialog-media]:grid-rows-[auto_auto_1fr] has-data-[slot=alert-dialog-media]:gap-x-6 sm:group-data-[size=default]/alert-dialog-content:place-items-start sm:group-data-[size=default]/alert-dialog-content:text-left sm:group-data-[size=default]/alert-dialog-content:has-data-[slot=alert-dialog-media]:grid-rows-[auto_1fr]',
        className,
      )}
      {...props}
    />
  )
}

function AlertDialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn(
        'flex flex-col-reverse gap-2 group-data-[size=sm]/alert-dialog-content:grid group-data-[size=sm]/alert-dialog-content:grid-cols-2 sm:flex-row sm:justify-end',
        className,
      )}
      {...props}
    />
  )
}

function AlertDialogMedia({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-dialog-media"
      className={cn(
        "bg-picodash-surface-muted mb-2 inline-flex size-16 items-center justify-center rounded-full sm:group-data-[size=default]/alert-dialog-content:row-span-2 *:[svg:not([class*='size-'])]:size-8",
        className,
      )}
      {...props}
    />
  )
}

function AlertDialogTitle({
  className,
  ...props
}: Omit<React.ComponentProps<typeof Heading>, 'slot'>) {
  return (
    <Heading
      slot="title"
      data-slot="alert-dialog-title"
      className={cn(
        'text-lg font-medium sm:group-data-[size=default]/alert-dialog-content:group-has-data-[slot=alert-dialog-media]/alert-dialog-content:col-start-2',
        className,
      )}
      {...props}
    />
  )
}

function AlertDialogDescription({
  className,
  id: providedId,
  ...props
}: Omit<React.ComponentProps<typeof Text>, 'elementType' | 'slot'>) {
  const generatedId = React.useId()
  const descriptionId = providedId ?? generatedId
  const registerDescription = React.useContext(AlertDialogDescriptionContext)

  React.useEffect(() => registerDescription?.(descriptionId), [descriptionId, registerDescription])

  return (
    <Text
      slot="description"
      elementType="div"
      id={descriptionId}
      data-slot="alert-dialog-description"
      className={cn(
        'text-picodash-muted *:[a]:hover:text-picodash-text text-sm text-balance md:text-pretty *:[a]:underline *:[a]:underline-offset-3',
        className,
      )}
      {...props}
    />
  )
}

function AlertDialogAction({
  className,
  closeOnPress = true,
  ...props
}: React.ComponentProps<typeof Button> & { closeOnPress?: boolean }) {
  return (
    <Button
      slot={closeOnPress ? 'close' : undefined}
      data-slot="alert-dialog-action"
      className={cn(className)}
      {...props}
    />
  )
}

function AlertDialogCancel({
  className,
  variant = 'outline',
  size = 'default',
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      slot="close"
      data-slot="alert-dialog-cancel"
      className={cn(className)}
      variant={variant}
      size={size}
      {...props}
    />
  )
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogOverlay,
  AlertDialogTitle,
  AlertDialogTrigger,
}
