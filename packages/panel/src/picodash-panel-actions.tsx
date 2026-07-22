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
import { collapsibleGroupsForState } from './picodash-panel-action-state.js'
import {
  applyPicodashPanelImport,
  preparePicodashPanelImport,
  serializePicodashPanelValues,
  picodashPanelDocumentFilename,
  picodashPanelDocumentFormatFromFilename,
  picodashPanelDocumentMimeType,
  picodashPanelImportAccept,
  PicodashPanelImportError,
  type PicodashPanelImportAnalysis,
  type PicodashPanelImportChange,
  type PicodashPanelDocumentFormat,
} from './picodash-panel-documents.js'
import { usePicodashPanelStoreApi } from './picodash-panel-context.js'
import {
  modalZIndexForState,
  portalLayerZIndexForState,
  portalLayerZIndexValue,
  usePicodashProviderContext,
} from './picodash-provider.js'
import { picodashGeometryTokens } from './theme.js'
import { usePicodashTheme } from './picodash-theme-context.js'
import type { PicodashConstraintRepair, PicodashFieldOutput } from './picodash-validation.js'
import { cn } from './utils.js'

export function PicodashPanelActions({
  panelId,
  panelTitle,
}: {
  panelId: string
  panelTitle: string
}) {
  const store = usePicodashPanelStoreApi()
  const theme = usePicodashTheme()
  const { portalContainer, store: providerStore } = usePicodashProviderContext()
  const modalZIndex = useStore(providerStore, modalZIndexForState)
  const menuZIndex = useStore(providerStore, (state) => portalLayerZIndexForState(state, 3))
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [importRepair, setImportRepair] = useState<{
    analysis: Extract<PicodashPanelImportAnalysis, { status: 'repair' }>
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

  const copyValues = async (format: PicodashPanelDocumentFormat) => {
    try {
      const serialized = serializePicodashPanelValues(store.getState(), format)
      await navigator.clipboard.writeText(serialized)
      announce(`Copied panel values as ${format.toUpperCase()}.`)
    } catch (error) {
      announce(`Copy failed: ${errorMessage(error)}`)
    }
  }

  const exportValues = (format: PicodashPanelDocumentFormat) => {
    try {
      const serialized = serializePicodashPanelValues(store.getState(), format)
      const url = URL.createObjectURL(
        new Blob([serialized], { type: picodashPanelDocumentMimeType(format) }),
      )
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = picodashPanelDocumentFilename(panelId, format)
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
      const format = picodashPanelDocumentFormatFromFilename(file.name)
      const analysis = preparePicodashPanelImport(store, await file.text(), format)
      if (analysis.status === 'invalid') throw new PicodashPanelImportError(analysis.errors)
      if (analysis.status === 'repair') {
        setImportRepair({ analysis, filename: file.name })
        return
      }
      applyPicodashPanelImport(store, analysis)
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
          className="text-picodash-muted ml-auto size-(--picodash-icon-lg) shrink-0"
          size="icon"
          variant="ghost"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <Ellipsis className="size-(--picodash-icon-sm)" aria-hidden="true" />
        </Button>
        <DropdownMenu
          data-picodash-theme={theme}
          aria-label={`Actions for ${panelTitle}`}
          portalContainer={portalContainer}
          popoverClassName={menuContentClassName}
          popoverProps={{
            containerPadding: picodashGeometryTokens.menuCollisionPadding,
            offset: picodashGeometryTokens.menuSideOffset,
            shouldFlip: true,
          }}
          popoverStyle={{
            zIndex: portalLayerZIndexValue('--picodash-layer-menu', menuZIndex),
          }}
        >
          {groups.length > 0 ? (
            <>
              <MenuItem
                disabled={allExpanded}
                icon={<ChevronsUpDown aria-hidden="true" />}
                label="Expand all"
                onSelect={() => store.getState().setAllCollapsibleGroupsCollapsed(false)}
              />
              <MenuItem
                disabled={allCollapsed}
                icon={<ChevronsDownUp aria-hidden="true" />}
                label="Collapse all"
                onSelect={() => store.getState().setAllCollapsibleGroupsCollapsed(true)}
              />
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
            label="Import…"
            onSelect={() => importInputRef.current?.click()}
          />
          <MenuSeparator />
          <MenuItem
            destructive
            icon={<RotateCcw aria-hidden="true" />}
            label="Reset…"
            onSelect={() => setResetDialogOpen(true)}
          />
        </DropdownMenu>
      </DropdownMenuTrigger>

      <input
        ref={importInputRef}
        data-picodash-panel-import={panelId}
        accept={picodashPanelImportAccept}
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
        data-picodash-theme={theme}
        isOpen={resetDialogOpen}
        onOpenChange={(nextOpen) => {
          setResetDialogOpen(nextOpen)
          if (!nextOpen) requestAnimationFrame(() => triggerRef.current?.focus())
        }}
        portalContainer={portalContainer}
        overlayClassName="pointer-events-auto fixed inset-0 z-(--picodash-layer-dialog) bg-(--picodash-color-overlay) backdrop-blur-(--picodash-blur-overlay)"
        overlayStyle={{
          zIndex: portalLayerZIndexValue('--picodash-layer-dialog', modalZIndex),
        }}
        style={{
          zIndex: portalLayerZIndexValue('--picodash-layer-dialog', modalZIndex),
        }}
        className="rounded-picodash-surface border-picodash-border bg-picodash-surface-raised text-picodash-text shadow-picodash-panel pointer-events-auto fixed top-1/2 left-1/2 z-(--picodash-layer-dialog) grid w-[min(24rem,calc(100dvw-2rem))] -translate-x-1/2 -translate-y-1/2 gap-(--picodash-space-3) border p-(--picodash-space-4) outline-none"
      >
        <div className="grid gap-(--picodash-space-1)">
          <AlertDialogTitle className="text-(length:--picodash-font-size-xl) leading-(--picodash-line-normal) font-(--picodash-font-semibold)">
            Reset {panelTitle}?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-picodash-muted text-(length:--picodash-font-size-lg) leading-(--picodash-line-tight)">
            This restores every registered field to its default value. Panel position, order,
            groups, and metadata stay unchanged.
          </AlertDialogDescription>
        </div>
        <div className="flex justify-end gap-(--picodash-space-2)">
          <AlertDialogCancel className={buttonVariants({ size: 'sm', variant: 'outline' })}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            className={cn(
              buttonVariants({ size: 'sm' }),
              'bg-(--picodash-color-danger) text-(--picodash-color-canvas) hover:bg-(--picodash-color-danger)/90',
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
          applyPicodashPanelImport(store, importRepair.analysis)
          announce(`Imported repaired panel values from ${importRepair.filename}.`)
          setImportRepair(null)
        }}
      />
    </>
  )
}

export function PicodashPanelConstraintRepairDialog({ panelTitle }: { panelTitle: string }) {
  const store = usePicodashPanelStoreApi()
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
  'pointer-events-auto z-(--picodash-layer-menu) min-w-44 overflow-y-auto rounded-picodash-surface border border-picodash-border bg-picodash-surface-raised p-(--picodash-space-1) text-picodash-text shadow-(--picodash-shadow-md) ring-0 outline-none before:hidden'

const menuItemClassName =
  'relative flex h-(--picodash-control-height-md) cursor-default items-center gap-(--picodash-space-2) rounded-picodash-control px-(--picodash-space-2) text-(length:--picodash-font-size-lg) leading-(--picodash-line-tight) outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-(--picodash-opacity-disabled) data-focused:bg-picodash-surface-muted data-focused:text-picodash-text [&>svg]:size-(--picodash-icon-sm) [&>svg]:shrink-0'

function MenuItem({
  destructive = false,
  disabled,
  icon,
  label,
  onSelect,
  ...props
}: Omit<ComponentProps<typeof DropdownMenuItem>, 'children' | 'onAction' | 'textValue'> & {
  destructive?: boolean
  disabled?: boolean
  icon?: ReactNode
  label: string
  onSelect?: () => void
}) {
  return (
    <DropdownMenuItem
      className={cn(menuItemClassName, destructive && 'text-picodash-danger')}
      isDisabled={disabled}
      onAction={onSelect}
      textValue={label}
      {...props}
    >
      {icon}
      <span className="min-w-0 flex-1">{label}</span>
    </DropdownMenuItem>
  )
}

function MenuSeparator() {
  return <DropdownMenuSeparator className="bg-picodash-border my-(--picodash-space-1) h-px" />
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
  const theme = usePicodashTheme()
  const { store } = usePicodashProviderContext()
  const menuZIndex = useStore(store, (state) => portalLayerZIndexForState(state, 3))

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className={menuItemClassName} textValue={label}>
        {icon}
        <span className="min-w-0 flex-1">{label}</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent
        data-picodash-theme={theme}
        popoverClassName={menuContentClassName}
        popoverProps={{
          containerPadding: picodashGeometryTokens.menuCollisionPadding,
          offset: picodashGeometryTokens.menuSubmenuOffset,
          shouldFlip: true,
        }}
        popoverStyle={{
          zIndex: portalLayerZIndexValue('--picodash-layer-menu', menuZIndex),
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
  onSelect: (format: PicodashPanelDocumentFormat) => void | Promise<void>
  verb: string
}) {
  return (
    <>
      <MenuItem
        icon={<FileJson aria-hidden="true" />}
        label={`${verb} JSON`}
        onSelect={() => {
          void onSelect('json')
        }}
      />
      <MenuItem
        icon={<FileText aria-hidden="true" />}
        label={`${verb} YAML`}
        onSelect={() => {
          void onSelect('yaml')
        }}
      />
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
  changes: readonly (PicodashPanelImportChange | PicodashConstraintRepair)[]
  description: string
  onAbort: () => void
  onAccept: () => void
  open: boolean
  returnFocusRef?: RefObject<HTMLElement | null>
  title: string
}) {
  const theme = usePicodashTheme()
  const { portalContainer, store: providerStore } = usePicodashProviderContext()
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
      data-picodash-theme={theme}
      isOpen={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && open) onAbort()
        if (!nextOpen) {
          setAcceptError('')
        }
      }}
      portalContainer={portalContainer}
      overlayClassName="pointer-events-auto fixed inset-0 z-(--picodash-layer-dialog) bg-(--picodash-color-overlay) backdrop-blur-(--picodash-blur-overlay)"
      overlayStyle={{
        zIndex: portalLayerZIndexValue('--picodash-layer-dialog', modalZIndex),
      }}
      style={{
        zIndex: portalLayerZIndexValue('--picodash-layer-dialog', modalZIndex),
      }}
      className="rounded-picodash-surface border-picodash-border bg-picodash-surface-raised text-picodash-text shadow-picodash-panel pointer-events-auto fixed top-1/2 left-1/2 z-(--picodash-layer-dialog) grid max-h-[min(80dvh,36rem)] w-[min(24rem,calc(100dvw-2rem))] -translate-x-1/2 -translate-y-1/2 gap-(--picodash-space-3) overflow-hidden border p-(--picodash-space-4) outline-none"
    >
      <div className="grid gap-(--picodash-space-1)">
        <AlertDialogTitle className="text-(length:--picodash-font-size-xl) leading-(--picodash-line-normal) font-(--picodash-font-semibold)">
          {title}
        </AlertDialogTitle>
        <AlertDialogDescription className="text-picodash-muted text-(length:--picodash-font-size-lg) leading-(--picodash-line-tight)">
          {description}
        </AlertDialogDescription>
      </div>
      <div
        className="grid min-h-0 gap-(--picodash-space-2) overflow-y-auto"
        aria-label="Proposed value changes"
      >
        {changes.map((change) => (
          <section
            key={change.field}
            className="border-picodash-border grid gap-(--picodash-space-1) border p-(--picodash-space-2)"
          >
            <h3 className="text-(length:--picodash-font-size-lg) font-(--picodash-font-semibold)">
              {change.field}
            </h3>
            <dl className="grid grid-cols-[auto_1fr] gap-x-(--picodash-space-2) gap-y-(--picodash-space-1) text-(length:--picodash-font-size-lg)">
              <dt className="text-picodash-muted">{beforeLabel}</dt>
              <dd className="min-w-0 font-mono break-words">{formatFieldOutput(change.before)}</dd>
              <dt className="text-picodash-muted">Proposed</dt>
              <dd className="min-w-0 font-mono break-words">{formatFieldOutput(change.after)}</dd>
            </dl>
            <ul className="list-disc pl-(--picodash-space-4) text-(length:--picodash-font-size-lg) text-(--picodash-color-danger)">
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
          className="text-(length:--picodash-font-size-lg) text-(--picodash-color-danger)"
        >
          {acceptError}
        </p>
      ) : null}
      <div className="flex justify-end gap-(--picodash-space-2)">
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

function formatFieldOutput(output: PicodashFieldOutput) {
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
