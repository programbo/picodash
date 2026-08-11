import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'
import { UNSAFE_PortalProvider } from 'react-aria'
import {
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
  Separator,
  SubmenuTrigger,
  type MenuTriggerProps as ReactAriaMenuTriggerProps,
  type SeparatorProps as ReactAriaSeparatorProps,
} from 'react-aria-components'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './alert-dialog.tsx'
import { Button } from './button.tsx'
import { usePicodashDensity, usePicodashTheme } from './theme-provider.tsx'
import { usePicodashOverlayDefaults, validateLayerBase } from './overlay-provider.tsx'
import { ActiveOverlayLayer, resolveOverlayLayer, useActiveOverlayLayer } from './overlay-layer.tsx'

export interface ActionMenuConfirmation {
  title: ReactNode
  description: ReactNode
  actionLabel: ReactNode
  /** Invalidates an open confirmation when the reviewed operation changes. */
  guard?: ActionMenuConfirmationGuard
}

export interface ActionMenuConfirmationGuard {
  readonly fingerprint: string
  readonly getFingerprint: () => string
  readonly subscribe: (listener: () => void) => () => void
}

export type ActionMenuItemVariant = 'default' | 'destructive'

export type ActionMenuProps = Pick<
  ReactAriaMenuTriggerProps,
  'defaultOpen' | 'isOpen' | 'onOpenChange'
> & {
  label: string
  trigger?: ReactElement
  children: ReactNode
  portalContainer?: HTMLElement | null
  layerBase?: number
}

export interface ActionMenuItemProps {
  label: string
  icon?: ReactNode
  onAction: () => void | Promise<void>
  isDisabled?: boolean
  variant?: ActionMenuItemVariant
  confirmation?: ActionMenuConfirmation
}

export interface ActionSubmenuProps {
  label: string
  icon?: ReactNode
  isDisabled?: boolean
  children: ReactNode
}

export type ActionMenuSeparatorProps = Omit<ReactAriaSeparatorProps, 'orientation'>

interface PendingConfirmation {
  confirmation: ActionMenuConfirmation
  onAction: () => void | Promise<void>
  variant: ActionMenuItemVariant
}

interface ActionMenuContextValue {
  enqueueConfirmation(value: PendingConfirmation): void
}

const ActionMenuContext = createContext<ActionMenuContextValue | undefined>(undefined)

function Icon({ children }: { children: ReactNode }) {
  return (
    <span className="picodash-action-menu-icon" aria-hidden="true">
      {children}
    </span>
  )
}

function EllipsisIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <circle cx="3" cy="8" r="1.25" />
      <circle cx="8" cy="8" r="1.25" />
      <circle cx="13" cy="8" r="1.25" />
    </svg>
  )
}

function MenuLabel({
  icon,
  label,
  submenu = false,
}: {
  icon?: ReactNode
  label: string
  submenu?: boolean
}) {
  return (
    <>
      {icon ? <Icon>{icon}</Icon> : null}
      <span className="picodash-action-menu-label">{label}</span>
      {submenu ? (
        <svg
          className="picodash-action-submenu-indicator"
          viewBox="0 0 16 16"
          aria-hidden="true"
          focusable="false"
        >
          <path d="m6 3 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      ) : null}
    </>
  )
}

export function ActionMenu({
  label,
  trigger,
  children,
  portalContainer,
  layerBase,
  defaultOpen,
  isOpen,
  onOpenChange,
}: ActionMenuProps) {
  const defaults = usePicodashOverlayDefaults()
  const parentLayer = useActiveOverlayLayer()
  const resolvedBase = layerBase === undefined ? defaults.layerBase : validateLayerBase(layerBase)
  const resolvedLayer = resolveOverlayLayer('menu', resolvedBase, parentLayer)
  const controlled = isOpen !== undefined
  const [localOpen, setLocalOpen] = useState(defaultOpen ?? false)
  const [pending, setPending] = useState<PendingConfirmation | null>(null)
  const [confirmationOpen, setConfirmationOpen] = useState(false)
  const open = controlled ? isOpen : localOpen
  const theme = usePicodashTheme()
  const density = usePicodashDensity()

  const handleOpenChange = useCallback(
    (next: boolean) => {
      onOpenChange?.(next)
      if (!controlled) setLocalOpen(next)
    },
    [controlled, onOpenChange],
  )

  const enqueueConfirmation = useCallback((value: PendingConfirmation) => {
    setPending(value)
  }, [])

  useEffect(() => {
    if (pending && !open && !confirmationOpen) setConfirmationOpen(true)
  }, [confirmationOpen, open, pending])

  useEffect(() => {
    const guard = pending?.confirmation.guard
    if (!guard) return
    const validate = () => {
      if (guard.getFingerprint() === guard.fingerprint) return
      setConfirmationOpen(false)
      setPending(null)
    }
    validate()
    return guard.subscribe(validate)
  }, [pending])

  const context = useMemo<ActionMenuContextValue>(
    () => ({ enqueueConfirmation }),
    [enqueueConfirmation],
  )
  const portalProps =
    portalContainer === undefined
      ? undefined
      : {
          getContainer: () =>
            portalContainer ?? (typeof document !== 'undefined' ? document.body : null),
        }
  const menu = (
    <Menu
      aria-label={label}
      selectionMode="none"
      shouldCloseOnSelect
      data-slot="action-menu"
      data-picodash-theme={theme}
      data-picodash-density={density}
      className="picodash-action-menu"
    >
      {children}
    </Menu>
  )
  const triggerElement = trigger ?? (
    <Button
      aria-label={label}
      variant="ghost"
      size="sm"
      iconOnly
      className="picodash-action-menu-trigger"
    >
      <EllipsisIcon />
    </Button>
  )
  const content = (
    <ActiveOverlayLayer value={resolvedLayer}>
      <MenuTrigger defaultOpen={defaultOpen} isOpen={isOpen} onOpenChange={handleOpenChange}>
        {triggerElement}
        <Popover
          placement="bottom end"
          offset={4}
          containerPadding={8}
          shouldFlip
          className="picodash-action-menu-popover"
          style={{ zIndex: resolvedLayer }}
          data-picodash-theme={theme}
          data-picodash-density={density}
        >
          {menu}
        </Popover>
      </MenuTrigger>
    </ActiveOverlayLayer>
  )
  const handleConfirmationOpenChange = useCallback((next: boolean) => {
    setConfirmationOpen(next)
    if (!next) setPending(null)
  }, [])
  return (
    <ActionMenuContext.Provider value={context}>
      {portalProps ? (
        <UNSAFE_PortalProvider {...portalProps}>{content}</UNSAFE_PortalProvider>
      ) : (
        content
      )}
      {pending ? (
        <ActiveOverlayLayer value={resolvedLayer}>
          <AlertDialog isOpen={confirmationOpen} onOpenChange={handleConfirmationOpenChange}>
            <AlertDialogTrigger
              aria-label="Confirmation"
              className="picodash-action-menu-confirmation-trigger"
            />
            <AlertDialogOverlay layerBase={layerBase} portalContainer={portalContainer}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{pending.confirmation.title}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {pending.confirmation.description}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel
                    onPress={() => {
                      setConfirmationOpen(false)
                      setPending(null)
                    }}
                  >
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    variant={pending.variant === 'destructive' ? 'destructive' : 'primary'}
                    onPress={() => {
                      const guard = pending.confirmation.guard
                      if (guard && guard.getFingerprint() !== guard.fingerprint) {
                        setConfirmationOpen(false)
                        setPending(null)
                        return
                      }
                      const action = pending.onAction
                      setConfirmationOpen(false)
                      setPending(null)
                      void action()
                    }}
                  >
                    {pending.confirmation.actionLabel}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialogOverlay>
          </AlertDialog>
        </ActiveOverlayLayer>
      ) : null}
    </ActionMenuContext.Provider>
  )
}

export function ActionMenuItem({
  label,
  icon,
  onAction,
  isDisabled = false,
  variant = 'default',
  confirmation,
}: ActionMenuItemProps) {
  const context = useContext(ActionMenuContext)
  return (
    <MenuItem
      textValue={label}
      isDisabled={isDisabled}
      data-slot="action-menu-item"
      data-variant={variant}
      className="picodash-action-menu-item"
      onAction={() => {
        if (confirmation) context?.enqueueConfirmation({ confirmation, onAction, variant })
        else void onAction()
      }}
    >
      <MenuLabel icon={icon} label={label} />
    </MenuItem>
  )
}

export function ActionSubmenu({ label, icon, isDisabled = false, children }: ActionSubmenuProps) {
  const parentLayer = useActiveOverlayLayer()
  const submenuLayer = resolveOverlayLayer('menu', undefined, parentLayer)
  const theme = usePicodashTheme()
  const density = usePicodashDensity()
  return (
    <SubmenuTrigger>
      <MenuItem
        textValue={label}
        isDisabled={isDisabled}
        data-slot="action-submenu"
        className="picodash-action-submenu"
      >
        <MenuLabel icon={icon} label={label} submenu />
      </MenuItem>
      <Popover
        placement="end top"
        className="picodash-action-submenu-popover"
        style={{ zIndex: submenuLayer }}
        data-picodash-theme={theme}
        data-picodash-density={density}
      >
        <ActiveOverlayLayer value={submenuLayer}>
          <Menu
            aria-label={label}
            selectionMode="none"
            shouldCloseOnSelect
            className="picodash-action-submenu-menu"
          >
            {children}
          </Menu>
        </ActiveOverlayLayer>
      </Popover>
    </SubmenuTrigger>
  )
}

export function ActionMenuSeparator({ className, ...props }: ActionMenuSeparatorProps) {
  return (
    <Separator
      {...props}
      orientation="horizontal"
      data-slot="action-menu-separator"
      className={
        className ? `picodash-action-menu-separator ${className}` : 'picodash-action-menu-separator'
      }
    />
  )
}
