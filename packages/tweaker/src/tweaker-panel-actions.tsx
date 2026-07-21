import {
  ChevronsDownUp,
  ChevronsUpDown,
  Clipboard,
  Download,
  Ellipsis,
  FileJson,
  FileText,
  RotateCcw,
  Upload,
} from 'lucide-react'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
  type RefObject,
} from 'react'
import { useStore } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogTitle,
} from './components/ui/alert-dialog.js'
import { Button, buttonVariants } from './components/ui/button.js'
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from './components/ui/dropdown-menu.js'
import { collapsibleGroupsForState } from './tweaker-panel-action-state.js'
import {
  applyTweakerPanelImport,
  prepareTweakerPanelImport,
  serializeTweakerPanelValues,
  tweakerPanelDocumentFilename,
  tweakerPanelDocumentFormatFromFilename,
  tweakerPanelDocumentMimeType,
  tweakerPanelImportAccept,
  TweakerPanelImportError,
  type TweakerPanelImportAnalysis,
  type TweakerPanelImportChange,
  type TweakerPanelDocumentFormat,
} from './tweaker-panel-documents.js'
import { useTweakerPanelStoreApi } from './tweaker-panel-context.js'
import {
  modalZIndexForState,
  portalLayerZIndexForState,
  portalLayerZIndexValue,
  useTweakerProviderContext,
} from './tweaker-provider.js'
import { tweakerGeometryTokens } from './theme.js'
import { useTweakerTheme } from './tweaker-theme-context.js'
import type { TweakerConstraintRepair, TweakerFieldOutput } from './tweaker-validation.js'
import { cn } from './utils.js'

export function TweakerPanelActions({
  panelId,
  panelTitle,
}: {
  panelId: string
  panelTitle: string
}) {
  const store = useTweakerPanelStoreApi()
  const theme = useTweakerTheme()
  const { portalContainer, store: providerStore } = useTweakerProviderContext()
  const modalZIndex = useStore(providerStore, modalZIndexForState)
  const menuZIndex = useStore(providerStore, (state) => portalLayerZIndexForState(state, 3))
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [importRepair, setImportRepair] = useState<{
    analysis: Extract<TweakerPanelImportAnalysis, { status: 'repair' }>
    filename: string
  } | null>(null)
  const [status, setStatus] = useState('')
  const { collapsedGroups, items } = useStore(
    store,
    useShallow((state) => ({
      collapsedGroups: state.collapsedGroups,
      items: state.items,
    })),
  )
  const groups = useMemo(
    () => collapsibleGroupsForState({ collapsedGroups, items }),
    [collapsedGroups, items],
  )
  const allExpanded = groups.every((group) => !group.collapsed)
  const allCollapsed = groups.every((group) => group.collapsed)

  const announce = (message: string) => {
    setStatus('')
    requestAnimationFrame(() => setStatus(message))
  }

  const copyValues = async (format: TweakerPanelDocumentFormat) => {
    try {
      const serialized = serializeTweakerPanelValues(store.getState(), format)
      await navigator.clipboard.writeText(serialized)
      announce(`Copied panel values as ${format.toUpperCase()}.`)
    } catch (error) {
      announce(`Copy failed: ${errorMessage(error)}`)
    }
  }

  const exportValues = (format: TweakerPanelDocumentFormat) => {
    try {
      const serialized = serializeTweakerPanelValues(store.getState(), format)
      const url = URL.createObjectURL(
        new Blob([serialized], { type: tweakerPanelDocumentMimeType(format) }),
      )
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = tweakerPanelDocumentFilename(panelId, format)
      anchor.hidden = true
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
      setTimeout(() => URL.revokeObjectURL(url), 0)
      announce(`Exported panel values as ${format.toUpperCase()}.`)
    } catch (error) {
      announce(`Export failed: ${errorMessage(error)}`)
    }
  }

  const importFile = async (file: File) => {
    try {
      const format = tweakerPanelDocumentFormatFromFilename(file.name)
      const analysis = prepareTweakerPanelImport(store, await file.text(), format)
      if (analysis.status === 'invalid') throw new TweakerPanelImportError(analysis.errors)
      if (analysis.status === 'repair') {
        setImportRepair({ analysis, filename: file.name })
        return
      }
      applyTweakerPanelImport(store, analysis)
      announce(`Imported panel values from ${file.name}.`)
    } catch (error) {
      announce(`Import failed: ${errorMessage(error)}`)
    }
  }

  return (
    <>
      <DropdownMenuTrigger>
        <Button
          ref={triggerRef}
          aria-label={`Open actions for ${panelTitle}`}
          className="text-tweaker-muted ml-auto size-(--tweaker-icon-lg) shrink-0"
          size="icon"
          variant="ghost"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <Ellipsis className="size-(--tweaker-icon-sm)" aria-hidden="true" />
        </Button>
        <DropdownMenu
          data-tweaker-theme={theme}
          aria-label={`Actions for ${panelTitle}`}
          portalContainer={portalContainer}
          popoverClassName={menuContentClassName}
          popoverProps={{
            containerPadding: tweakerGeometryTokens.menuCollisionPadding,
            offset: tweakerGeometryTokens.menuSideOffset,
            shouldFlip: true,
          }}
          popoverStyle={{
            zIndex: portalLayerZIndexValue('--tweaker-layer-menu', menuZIndex),
          }}
        >
          {groups.length > 0 ? (
            <>
              <MenuItem
                disabled={allExpanded}
                icon={<ChevronsUpDown aria-hidden="true" />}
                onSelect={() => store.getState().setAllCollapsibleGroupsCollapsed(false)}
              >
                Expand all
              </MenuItem>
              <MenuItem
                disabled={allCollapsed}
                icon={<ChevronsDownUp aria-hidden="true" />}
                onSelect={() => store.getState().setAllCollapsibleGroupsCollapsed(true)}
              >
                Collapse all
              </MenuItem>
              <MenuSeparator />
            </>
          ) : null}

          <MenuSub label="Copy" icon={<Clipboard aria-hidden="true" />}>
            <FormatMenuItems verb="Copy" onSelect={copyValues} />
          </MenuSub>
          <MenuSub label="Export" icon={<Download aria-hidden="true" />}>
            <FormatMenuItems verb="Export" onSelect={exportValues} />
          </MenuSub>
          <MenuItem
            icon={<Upload aria-hidden="true" />}
            onSelect={() => importInputRef.current?.click()}
          >
            Import…
          </MenuItem>
          <MenuSeparator />
          <MenuItem
            destructive
            icon={<RotateCcw aria-hidden="true" />}
            onSelect={() => setResetDialogOpen(true)}
          >
            Reset…
          </MenuItem>
        </DropdownMenu>
      </DropdownMenuTrigger>

      <input
        ref={importInputRef}
        data-tweaker-panel-import={panelId}
        accept={tweakerPanelImportAccept}
        hidden
        type="file"
        onChange={async (event) => {
          const input = event.currentTarget
          const file = input.files?.[0]
          try {
            if (file) await importFile(file)
          } finally {
            input.value = ''
          }
        }}
      />

      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {status}
      </span>

      <AlertDialog
        data-tweaker-theme={theme}
        isOpen={resetDialogOpen}
        onOpenChange={(nextOpen) => {
          setResetDialogOpen(nextOpen)
          if (!nextOpen) requestAnimationFrame(() => triggerRef.current?.focus())
        }}
        portalContainer={portalContainer}
        overlayClassName="pointer-events-auto fixed inset-0 z-(--tweaker-layer-dialog) bg-(--tweaker-color-overlay) backdrop-blur-(--tweaker-blur-overlay)"
        overlayStyle={{
          zIndex: portalLayerZIndexValue('--tweaker-layer-dialog', modalZIndex),
        }}
        style={{
          zIndex: portalLayerZIndexValue('--tweaker-layer-dialog', modalZIndex),
        }}
        className="rounded-tweaker-surface border-tweaker-border bg-tweaker-surface-raised text-tweaker-text shadow-tweaker-panel pointer-events-auto fixed top-1/2 left-1/2 z-(--tweaker-layer-dialog) grid w-[min(24rem,calc(100dvw-2rem))] -translate-x-1/2 -translate-y-1/2 gap-(--tweaker-space-3) border p-(--tweaker-space-4) outline-none"
      >
        <div className="grid gap-(--tweaker-space-1)">
          <AlertDialogTitle className="text-(length:--tweaker-font-size-xl) leading-(--tweaker-line-normal) font-(--tweaker-font-semibold)">
            Reset {panelTitle}?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-tweaker-muted text-(length:--tweaker-font-size-lg) leading-(--tweaker-line-tight)">
            This restores every registered field to its default value. Panel position, order,
            groups, and metadata stay unchanged.
          </AlertDialogDescription>
        </div>
        <div className="flex justify-end gap-(--tweaker-space-2)">
          <AlertDialogCancel className={buttonVariants({ size: 'sm', variant: 'outline' })}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            className={cn(
              buttonVariants({ size: 'sm' }),
              'bg-(--tweaker-color-danger) text-(--tweaker-color-canvas) hover:bg-(--tweaker-color-danger)/90',
            )}
            onPress={() => {
              const result = store.getState().resetRegisteredFields()
              announce(
                result.success
                  ? 'Reset all registered panel values.'
                  : `Reset failed: ${formatFieldErrors(result.errors)}`,
              )
            }}
          >
            Reset values
          </AlertDialogAction>
        </div>
      </AlertDialog>

      <RepairReviewDialog
        beforeLabel="Imported"
        changes={importRepair?.analysis.changes ?? []}
        description="Some imported values need to be changed before they satisfy the current panel constraints. Review every change before applying the import."
        open={importRepair !== null}
        returnFocusRef={triggerRef}
        title={`Review import for ${panelTitle}`}
        onAbort={() => {
          setImportRepair(null)
          announce('Import aborted. Panel values were not changed.')
        }}
        onAccept={() => {
          if (!importRepair) return
          applyTweakerPanelImport(store, importRepair.analysis)
          announce(`Imported repaired panel values from ${importRepair.filename}.`)
          setImportRepair(null)
        }}
      />
    </>
  )
}

export function TweakerPanelConstraintRepairDialog({ panelTitle }: { panelTitle: string }) {
  const store = useTweakerPanelStoreApi()
  const proposal = useStore(store, (state) => state.repairProposal)
  const copy = repairProposalCopy(proposal?.source)

  return (
    <RepairReviewDialog
      beforeLabel={copy.beforeLabel}
      changes={proposal?.changes ?? []}
      description={copy.description}
      open={proposal !== null}
      title={`${copy.title} for ${panelTitle}`}
      onAbort={() => store.getState().abortRepairProposal()}
      onAccept={() => {
        const result = store.getState().acceptRepairProposal()
        if (!result.success) {
          throw new Error(formatFieldErrors(result.errors))
        }
      }}
    />
  )
}

const menuContentClassName =
  'pointer-events-auto z-(--tweaker-layer-menu) min-w-44 overflow-y-auto rounded-tweaker-surface border border-tweaker-border bg-tweaker-surface-raised p-(--tweaker-space-1) text-tweaker-text shadow-(--tweaker-shadow-md) ring-0 outline-none before:hidden'

const menuItemClassName =
  'relative flex h-(--tweaker-control-height-md) cursor-default items-center gap-(--tweaker-space-2) rounded-tweaker-control px-(--tweaker-space-2) text-(length:--tweaker-font-size-lg) leading-(--tweaker-line-tight) outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-(--tweaker-opacity-disabled) data-focused:bg-tweaker-surface-muted data-focused:text-tweaker-text [&>svg]:size-(--tweaker-icon-sm) [&>svg]:shrink-0'

function MenuItem({
  children,
  destructive = false,
  disabled,
  icon,
  onSelect,
  ...props
}: Omit<ComponentProps<typeof DropdownMenuItem>, 'children' | 'onAction'> & {
  children: ReactNode
  destructive?: boolean
  disabled?: boolean
  icon?: ReactNode
  onSelect?: () => void
}) {
  return (
    <DropdownMenuItem
      className={cn(menuItemClassName, destructive && 'text-tweaker-danger')}
      isDisabled={disabled}
      onAction={onSelect}
      {...props}
    >
      {icon}
      <span className="min-w-0 flex-1">{children}</span>
    </DropdownMenuItem>
  )
}

function MenuSeparator() {
  return <DropdownMenuSeparator className="bg-tweaker-border my-(--tweaker-space-1) h-px" />
}

function MenuSub({
  children,
  icon,
  label,
}: {
  children: ReactNode
  icon: ReactNode
  label: string
}) {
  const theme = useTweakerTheme()
  const { store } = useTweakerProviderContext()
  const menuZIndex = useStore(store, (state) => portalLayerZIndexForState(state, 3))

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className={menuItemClassName}>
        {icon}
        <span className="min-w-0 flex-1">{label}</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent
        data-tweaker-theme={theme}
        popoverClassName={menuContentClassName}
        popoverProps={{
          containerPadding: tweakerGeometryTokens.menuCollisionPadding,
          offset: tweakerGeometryTokens.menuSubmenuOffset,
          shouldFlip: true,
        }}
        popoverStyle={{
          zIndex: portalLayerZIndexValue('--tweaker-layer-menu', menuZIndex),
        }}
      >
        {children}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}

function FormatMenuItems({
  onSelect,
  verb,
}: {
  onSelect: (format: TweakerPanelDocumentFormat) => void | Promise<void>
  verb: string
}) {
  return (
    <>
      <MenuItem
        icon={<FileJson aria-hidden="true" />}
        onSelect={() => {
          void onSelect('json')
        }}
      >
        {verb} JSON
      </MenuItem>
      <MenuItem
        icon={<FileText aria-hidden="true" />}
        onSelect={() => {
          void onSelect('yaml')
        }}
      >
        {verb} YAML
      </MenuItem>
    </>
  )
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown error.'
}

function RepairReviewDialog({
  beforeLabel,
  changes,
  description,
  onAbort,
  onAccept,
  open,
  returnFocusRef,
  title,
}: {
  beforeLabel: string
  changes: readonly (TweakerPanelImportChange | TweakerConstraintRepair)[]
  description: string
  onAbort: () => void
  onAccept: () => void
  open: boolean
  returnFocusRef?: RefObject<HTMLElement | null>
  title: string
}) {
  const theme = useTweakerTheme()
  const { portalContainer, store: providerStore } = useTweakerProviderContext()
  const modalZIndex = useStore(providerStore, modalZIndexForState)
  const [acceptError, setAcceptError] = useState('')
  const wasOpenRef = useRef(open)

  useEffect(() => {
    if (wasOpenRef.current && !open && returnFocusRef) {
      requestAnimationFrame(() => returnFocusRef.current?.focus())
    }
    wasOpenRef.current = open
  }, [open, returnFocusRef])

  return (
    <AlertDialog
      data-tweaker-theme={theme}
      isOpen={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && open) onAbort()
        if (!nextOpen) {
          setAcceptError('')
        }
      }}
      portalContainer={portalContainer}
      overlayClassName="pointer-events-auto fixed inset-0 z-(--tweaker-layer-dialog) bg-(--tweaker-color-overlay) backdrop-blur-(--tweaker-blur-overlay)"
      overlayStyle={{
        zIndex: portalLayerZIndexValue('--tweaker-layer-dialog', modalZIndex),
      }}
      style={{
        zIndex: portalLayerZIndexValue('--tweaker-layer-dialog', modalZIndex),
      }}
      className="rounded-tweaker-surface border-tweaker-border bg-tweaker-surface-raised text-tweaker-text shadow-tweaker-panel pointer-events-auto fixed top-1/2 left-1/2 z-(--tweaker-layer-dialog) grid max-h-[min(80dvh,36rem)] w-[min(24rem,calc(100dvw-2rem))] -translate-x-1/2 -translate-y-1/2 gap-(--tweaker-space-3) overflow-hidden border p-(--tweaker-space-4) outline-none"
    >
      <div className="grid gap-(--tweaker-space-1)">
        <AlertDialogTitle className="text-(length:--tweaker-font-size-xl) leading-(--tweaker-line-normal) font-(--tweaker-font-semibold)">
          {title}
        </AlertDialogTitle>
        <AlertDialogDescription className="text-tweaker-muted text-(length:--tweaker-font-size-lg) leading-(--tweaker-line-tight)">
          {description}
        </AlertDialogDescription>
      </div>
      <div
        className="grid min-h-0 gap-(--tweaker-space-2) overflow-y-auto"
        aria-label="Proposed value changes"
      >
        {changes.map((change) => (
          <section
            key={change.field}
            className="border-tweaker-border grid gap-(--tweaker-space-1) border p-(--tweaker-space-2)"
          >
            <h3 className="text-(length:--tweaker-font-size-lg) font-(--tweaker-font-semibold)">
              {change.field}
            </h3>
            <dl className="grid grid-cols-[auto_1fr] gap-x-(--tweaker-space-2) gap-y-(--tweaker-space-1) text-(length:--tweaker-font-size-lg)">
              <dt className="text-tweaker-muted">{beforeLabel}</dt>
              <dd className="min-w-0 font-mono break-words">{formatFieldOutput(change.before)}</dd>
              <dt className="text-tweaker-muted">Proposed</dt>
              <dd className="min-w-0 font-mono break-words">{formatFieldOutput(change.after)}</dd>
            </dl>
            <ul className="list-disc pl-(--tweaker-space-4) text-(length:--tweaker-font-size-lg) text-(--tweaker-color-danger)">
              {change.errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      {acceptError ? (
        <p
          role="alert"
          className="text-(length:--tweaker-font-size-lg) text-(--tweaker-color-danger)"
        >
          {acceptError}
        </p>
      ) : null}
      <div className="flex justify-end gap-(--tweaker-space-2)">
        <AlertDialogCancel className={buttonVariants({ size: 'sm', variant: 'outline' })}>
          Abort
        </AlertDialogCancel>
        <AlertDialogAction
          closeOnPress={false}
          className={buttonVariants({ size: 'sm' })}
          onPress={() => {
            try {
              onAccept()
              setAcceptError('')
            } catch (error) {
              setAcceptError(errorMessage(error))
            }
          }}
        >
          Accept changes
        </AlertDialogAction>
      </div>
    </AlertDialog>
  )
}

function formatFieldOutput(output: TweakerFieldOutput) {
  return 'unset' in output ? '(unset)' : JSON.stringify(output.value)
}

function formatFieldErrors(errors: Record<string, readonly string[]>) {
  return Object.entries(errors)
    .flatMap(([field, fieldErrors]) => fieldErrors.map((error) => `${field}: ${error}`))
    .join(' ')
}

function repairProposalCopy(source: 'constraint' | 'default' | 'initial' | undefined) {
  if (source === 'initial') {
    return {
      beforeLabel: 'Initial',
      description:
        'The initial panel values need repair before they satisfy the registered field contracts. Accept the proposed values, or retain the supplied values and show their validation errors.',
      title: 'Review initial values',
    }
  }
  if (source === 'default') {
    return {
      beforeLabel: 'Default',
      description:
        'The field defaults need repair before they satisfy the registered field contracts. Accept the proposed values, or retain the declared defaults and show their validation errors.',
      title: 'Review default values',
    }
  }
  return {
    beforeLabel: 'Current',
    description:
      'The panel constraints changed and the current values need repair. Accept the proposed values, or keep the current values and show their validation errors.',
    title: 'Review changes',
  }
}
