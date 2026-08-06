import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type ComponentPropsWithRef,
  type CSSProperties,
  type ReactNode,
} from 'react'
import {
  Dialog,
  DialogTrigger,
  Heading,
  Modal,
  ModalOverlay,
  Text,
  type DialogProps as ReactAriaDialogProps,
  type DialogTriggerProps as ReactAriaDialogTriggerProps,
  type ButtonRenderProps,
  type HeadingProps as ReactAriaHeadingProps,
  type ModalOverlayProps as ReactAriaModalOverlayProps,
  type ModalRenderProps,
  type TextProps as ReactAriaTextProps,
} from 'react-aria-components'
import { Button, type ButtonProps } from './button.tsx'
import { usePicodashDensity, usePicodashTheme } from './theme-provider.tsx'
import { usePicodashOverlayDefaults, validateLayerBase } from './overlay-provider.tsx'
import { ActiveDialogLayer, resolveDialogLayer, useActiveDialogLayer } from './overlay-layer.tsx'

export type AlertDialogSize = 'default' | 'sm'

export type AlertDialogProps = Omit<ReactAriaDialogTriggerProps, 'children'> & {
  children: ReactNode
  isKeyboardDismissDisabled?: boolean
}

export type AlertDialogTriggerProps = Omit<ButtonProps, 'slot'>

export type AlertDialogOverlayProps = Omit<
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

export type AlertDialogContentProps = Omit<
  ReactAriaDialogProps,
  'aria-describedby' | 'aria-label' | 'aria-labelledby' | 'children' | 'role'
> & {
  children: ReactNode
  size?: AlertDialogSize
}

export type AlertDialogHeaderProps = ComponentPropsWithRef<'div'>
export type AlertDialogFooterProps = ComponentPropsWithRef<'div'>
export type AlertDialogMediaProps = ComponentPropsWithRef<'div'>
export type AlertDialogTitleProps = Omit<ReactAriaHeadingProps, 'slot'>
export type AlertDialogDescriptionProps = Omit<ReactAriaTextProps, 'elementType' | 'slot'>
export type AlertDialogActionProps = Omit<ButtonProps, 'slot'> & { closeOnPress?: boolean }
export type AlertDialogCancelProps = Omit<ButtonProps, 'slot'>

const keyboardDismissContext = createContext(false)

interface DescriptionRegistry {
  register(id: string): void
  unregister(id: string): void
}

const descriptionContext = createContext<DescriptionRegistry | undefined>(undefined)

type ClassNameFunction<T> = (values: T & { defaultClassName: string | undefined }) => string

function composeClassName<T>(
  privateClass: string,
  className: string | ClassNameFunction<T> | undefined,
) {
  if (typeof className === 'function') {
    return (values: T & { defaultClassName: string | undefined }) => {
      const callerClass = className(values)
      return callerClass ? `${privateClass} ${callerClass}` : privateClass
    }
  }
  return className ? `${privateClass} ${className}` : privateClass
}

type ModalStyle =
  | CSSProperties
  | ((values: ModalRenderProps & { defaultStyle: CSSProperties }) => CSSProperties | undefined)

function composeModalStyle(style: ModalStyle | undefined, zIndex: string): ModalStyle {
  if (typeof style === 'function') {
    return (values) => ({ ...style(values), zIndex })
  }
  return { ...style, zIndex }
}

export function AlertDialog({
  children,
  isKeyboardDismissDisabled = false,
  ...props
}: AlertDialogProps) {
  return (
    <keyboardDismissContext.Provider value={isKeyboardDismissDisabled}>
      <DialogTrigger {...props}>{children}</DialogTrigger>
    </keyboardDismissContext.Provider>
  )
}

export const AlertDialogTrigger = forwardRef<HTMLButtonElement, AlertDialogTriggerProps>(
  function AlertDialogTrigger({ className, ...props }, ref) {
    return (
      <Button
        {...props}
        ref={ref}
        slot={null}
        className={composeClassName<ButtonRenderProps>('picodash-alert-dialog-trigger', className)}
      />
    )
  },
)

export function AlertDialogOverlay({
  children,
  portalContainer,
  layerBase,
  className,
  style,
  ...props
}: AlertDialogOverlayProps) {
  const defaults = usePicodashOverlayDefaults()
  const keyboardDismissDisabled = useContext(keyboardDismissContext)
  const parentLayer = useActiveDialogLayer()
  const resolvedBase = layerBase === undefined ? defaults.layerBase : validateLayerBase(layerBase)
  const resolvedLayer = resolveDialogLayer(resolvedBase, parentLayer)
  const theme = usePicodashTheme()
  const density = usePicodashDensity()
  const resolvedPortalContainer =
    portalContainer ?? (typeof document !== 'undefined' ? document.body : undefined)
  const portalProps =
    portalContainer === undefined || resolvedPortalContainer === undefined
      ? {}
      : { UNSTABLE_portalContainer: resolvedPortalContainer }
  return (
    <ActiveDialogLayer value={resolvedLayer}>
      <ModalOverlay
        {...props}
        {...portalProps}
        isDismissable={false}
        isKeyboardDismissDisabled={keyboardDismissDisabled}
        shouldCloseOnInteractOutside={() => false}
        data-slot="alert-dialog-overlay"
        data-picodash-theme={theme}
        data-picodash-density={density}
        className={composeClassName<ModalRenderProps>('picodash-alert-dialog-overlay', className)}
        style={composeModalStyle(style, resolvedLayer)}
      >
        <Modal data-slot="alert-dialog-modal" style={{ zIndex: resolvedLayer }}>
          {children}
        </Modal>
      </ModalOverlay>
    </ActiveDialogLayer>
  )
}

export function AlertDialogContent({
  children,
  size = 'default',
  ...props
}: AlertDialogContentProps) {
  const [descriptionIds, setDescriptionIds] = useState<string[]>([])
  const register = useCallback((id: string) => {
    setDescriptionIds((current) => (current.includes(id) ? current : [...current, id]))
  }, [])
  const unregister = useCallback((id: string) => {
    setDescriptionIds((current) => current.filter((entry) => entry !== id))
  }, [])
  const registry = useMemo<DescriptionRegistry>(
    () => ({ register, unregister }),
    [register, unregister],
  )
  return (
    <descriptionContext.Provider value={registry}>
      <Dialog
        {...props}
        role="alertdialog"
        aria-describedby={descriptionIds.length > 0 ? descriptionIds.join(' ') : undefined}
        data-slot="alert-dialog-content"
        data-size={size}
      >
        {children}
      </Dialog>
    </descriptionContext.Provider>
  )
}

export const AlertDialogHeader = forwardRef<HTMLDivElement, AlertDialogHeaderProps>(
  function AlertDialogHeader({ className, ...props }, ref) {
    return <div {...props} ref={ref} data-slot="alert-dialog-header" className={className} />
  },
)

export const AlertDialogFooter = forwardRef<HTMLDivElement, AlertDialogFooterProps>(
  function AlertDialogFooter({ className, ...props }, ref) {
    return <div {...props} ref={ref} data-slot="alert-dialog-footer" className={className} />
  },
)

export const AlertDialogMedia = forwardRef<HTMLDivElement, AlertDialogMediaProps>(
  function AlertDialogMedia({ className, ...props }, ref) {
    return <div {...props} ref={ref} data-slot="alert-dialog-media" className={className} />
  },
)

export function AlertDialogTitle({ className, ...props }: AlertDialogTitleProps) {
  return <Heading {...props} slot="title" data-slot="alert-dialog-title" className={className} />
}

export function AlertDialogDescription({
  className,
  id: idProp,
  ...props
}: AlertDialogDescriptionProps) {
  const registry = useContext(descriptionContext)
  const generatedId = useId()
  const id = idProp ?? generatedId
  useEffect(() => {
    registry?.register(id)
    return () => registry?.unregister(id)
  }, [id, registry])
  return (
    <Text
      {...props}
      id={id}
      elementType="div"
      data-slot="alert-dialog-description"
      className={className}
    />
  )
}

export const AlertDialogAction = forwardRef<HTMLButtonElement, AlertDialogActionProps>(
  function AlertDialogAction({ closeOnPress = true, className, ...props }, ref) {
    return (
      <Button
        {...props}
        ref={ref}
        slot={closeOnPress ? 'close' : null}
        className={composeClassName<ButtonRenderProps>('picodash-alert-dialog-action', className)}
      />
    )
  },
)

export const AlertDialogCancel = forwardRef<HTMLButtonElement, AlertDialogCancelProps>(
  function AlertDialogCancel({ className, variant = 'outline', ...props }, ref) {
    return (
      <Button
        {...props}
        ref={ref}
        variant={variant}
        slot="close"
        className={composeClassName<ButtonRenderProps>('picodash-alert-dialog-cancel', className)}
      />
    )
  },
)
