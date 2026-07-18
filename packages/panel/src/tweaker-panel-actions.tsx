import {
  ChevronRight,
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
import { AlertDialog, DropdownMenu } from 'radix-ui'
import {
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
  type RefObject,
} from 'react'
import { useStore } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
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
import type { TweakerConstraintRepair, TweakerFieldOutput } from './tweaker-validation.js'
import { Button, buttonVariants } from './ui.js'
import { cn } from './utils.js'

export function TweakerPanelActions({
  panelId,
  panelTitle,
}: {
  panelId: string
  panelTitle: string
}) {
  const store = useTweakerPanelStoreApi()
  const { portalContainer, store: providerStore, theme } = useTweakerProviderContext()
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
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            ref={triggerRef}
            aria-label={`Open actions for ${panelTitle}`}
            className={cn(
              buttonVariants({ size: 'icon', variant: 'ghost' }),
              'ml-auto size-(--tweaker-chrome-action-size) shrink-0 text-tweaker-muted',
            )}
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <Ellipsis className="size-(--tweaker-chrome-icon-size)" aria-hidden="true" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal container={portalContainer}>
          <DropdownMenu.Content
            data-tweaker-theme={theme}
            aria-label={`Actions for ${panelTitle}`}
            avoidCollisions
            className={menuContentClassName}
            collisionPadding={tweakerGeometryTokens.menuCollisionPadding}
            sideOffset={tweakerGeometryTokens.menuSideOffset}
            sticky="always"
            style={{
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
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

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

      <AlertDialog.Root open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialog.Portal container={portalContainer}>
          <AlertDialog.Overlay
            data-tweaker-theme={theme}
            style={{
              zIndex: portalLayerZIndexValue('--tweaker-layer-dialog', modalZIndex),
            }}
            className="pointer-events-auto fixed inset-0 z-(--tweaker-layer-dialog) bg-(--tweaker-dialog-overlay) backdrop-blur-(--tweaker-blur-overlay)"
          />
          <AlertDialog.Content
            data-tweaker-theme={theme}
            style={{
              zIndex: portalLayerZIndexValue('--tweaker-layer-dialog', modalZIndex),
            }}
            className="pointer-events-auto fixed top-1/2 left-1/2 z-(--tweaker-layer-dialog) grid w-(--tweaker-dialog-width) -translate-x-1/2 -translate-y-1/2 gap-(--tweaker-dialog-gap) rounded-(--tweaker-dialog-radius) border border-(--tweaker-dialog-border) bg-(--tweaker-dialog-background) p-(--tweaker-dialog-padding) text-(--tweaker-dialog-foreground) shadow-(--tweaker-dialog-shadow) outline-none"
            onCloseAutoFocus={(event) => {
              event.preventDefault()
              triggerRef.current?.focus()
            }}
          >
            <div className="grid gap-(--tweaker-space-1)">
              <AlertDialog.Title className="text-(length:--tweaker-font-size-xl) leading-(--tweaker-line-normal) font-(--tweaker-font-semibold)">
                Reset {panelTitle}?
              </AlertDialog.Title>
              <AlertDialog.Description className="text-(length:--tweaker-font-size-lg) leading-(--tweaker-line-tight) text-(--tweaker-dialog-muted)">
                This restores every registered field to its default value. Panel position, order,
                groups, and metadata stay unchanged.
              </AlertDialog.Description>
            </div>
            <div className="flex justify-end gap-(--tweaker-space-2)">
              <AlertDialog.Cancel asChild>
                <Button size="sm" variant="outline">
                  Cancel
                </Button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <Button
                  className="bg-(--tweaker-color-danger) text-(--tweaker-color-canvas) hover:bg-(--tweaker-color-danger)/90"
                  size="sm"
                  onClick={() => {
                    const result = store.getState().resetRegisteredFields()
                    announce(
                      result.success
                        ? 'Reset all registered panel values.'
                        : `Reset failed: ${formatFieldErrors(result.errors)}`,
                    )
                  }}
                >
                  Reset values
                </Button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>

      <RepairReviewDialog
        beforeLabel="Imported"
        changes={importRepair?.analysis.changes ?? []}
        description="Some imported values need to be changed before they satisfy the current panel constraints. Review every change before applying the import."
        open={importRepair !== null}
        panelTitle={panelTitle}
        returnFocusRef={triggerRef}
        title={`Review import for ${panelTitle}`}
        onAbort={() => {
          setImportRepair(null)
          announce('Import aborted. Panel values were not changed.')
        }}
        onAccept={() => {
          if (!importRepair) return
          try {
            applyTweakerPanelImport(store, importRepair.analysis)
            announce(`Imported repaired panel values from ${importRepair.filename}.`)
            setImportRepair(null)
          } catch (error) {
            announce(`Import failed: ${errorMessage(error)}`)
          }
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
      panelTitle={panelTitle}
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
  'z-(--tweaker-layer-menu) max-h-(--radix-dropdown-menu-content-available-height) min-w-(--tweaker-menu-min-width) overflow-y-auto rounded-(--tweaker-menu-radius) border border-(--tweaker-menu-border) bg-(--tweaker-menu-background) p-(--tweaker-menu-padding) text-(--tweaker-menu-foreground) shadow-(--tweaker-menu-shadow) outline-none'

const menuItemClassName =
  'relative flex h-(--tweaker-menu-item-height) cursor-default items-center gap-(--tweaker-menu-item-gap) rounded-(--tweaker-menu-item-radius) px-(--tweaker-menu-item-padding-inline) text-(length:--tweaker-font-size-lg) leading-(--tweaker-line-tight) outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-(--tweaker-opacity-disabled) data-[highlighted]:bg-(--tweaker-menu-item-highlight-background) data-[highlighted]:text-(--tweaker-menu-item-highlight-foreground) [&>svg]:size-(--tweaker-menu-icon-size) [&>svg]:shrink-0'

function MenuItem({
  children,
  destructive = false,
  icon,
  ...props
}: ComponentProps<typeof DropdownMenu.Item> & {
  destructive?: boolean
  icon?: ReactNode
}) {
  return (
    <DropdownMenu.Item
      className={cn(menuItemClassName, destructive && 'text-(--tweaker-menu-item-danger)')}
      {...props}
    >
      {icon}
      <span className="min-w-0 flex-1">{children}</span>
    </DropdownMenu.Item>
  )
}

function MenuSeparator() {
  return (
    <DropdownMenu.Separator className="my-(--tweaker-menu-separator-margin-block) h-px bg-(--tweaker-menu-separator)" />
  )
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
  const { portalContainer, store, theme } = useTweakerProviderContext()
  const menuZIndex = useStore(store, (state) => portalLayerZIndexForState(state, 3))

  return (
    <DropdownMenu.Sub>
      <DropdownMenu.SubTrigger className={menuItemClassName}>
        {icon}
        <span className="min-w-0 flex-1">{label}</span>
        <ChevronRight className="size-(--tweaker-menu-icon-size) shrink-0" aria-hidden="true" />
      </DropdownMenu.SubTrigger>
      <DropdownMenu.Portal container={portalContainer}>
        <DropdownMenu.SubContent
          data-tweaker-theme={theme}
          avoidCollisions
          className={menuContentClassName}
          collisionPadding={tweakerGeometryTokens.menuCollisionPadding}
          sideOffset={tweakerGeometryTokens.menuSubmenuOffset}
          sticky="always"
          style={{
            zIndex: portalLayerZIndexValue('--tweaker-layer-menu', menuZIndex),
          }}
        >
          {children}
        </DropdownMenu.SubContent>
      </DropdownMenu.Portal>
    </DropdownMenu.Sub>
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
  panelTitle,
  returnFocusRef,
  title,
}: {
  beforeLabel: string
  changes: readonly (TweakerPanelImportChange | TweakerConstraintRepair)[]
  description: string
  onAbort: () => void
  onAccept: () => void
  open: boolean
  panelTitle: string
  returnFocusRef?: RefObject<HTMLElement | null>
  title: string
}) {
  const { portalContainer, store: providerStore, theme } = useTweakerProviderContext()
  const modalZIndex = useStore(providerStore, modalZIndexForState)
  const [acceptError, setAcceptError] = useState('')
  const acceptedRef = useRef(false)

  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && open && !acceptedRef.current) onAbort()
        if (!nextOpen) {
          acceptedRef.current = false
          setAcceptError('')
        }
      }}
    >
      <AlertDialog.Portal container={portalContainer}>
        <AlertDialog.Overlay
          data-tweaker-theme={theme}
          style={{
            zIndex: portalLayerZIndexValue('--tweaker-layer-dialog', modalZIndex),
          }}
          className="pointer-events-auto fixed inset-0 z-(--tweaker-layer-dialog) bg-(--tweaker-dialog-overlay) backdrop-blur-(--tweaker-blur-overlay)"
        />
        <AlertDialog.Content
          data-tweaker-theme={theme}
          aria-label={`Repair values for ${panelTitle}`}
          style={{
            zIndex: portalLayerZIndexValue('--tweaker-layer-dialog', modalZIndex),
          }}
          className="pointer-events-auto fixed top-1/2 left-1/2 z-(--tweaker-layer-dialog) grid max-h-[min(80dvh,36rem)] w-(--tweaker-dialog-width) -translate-x-1/2 -translate-y-1/2 gap-(--tweaker-dialog-gap) overflow-hidden rounded-(--tweaker-dialog-radius) border border-(--tweaker-dialog-border) bg-(--tweaker-dialog-background) p-(--tweaker-dialog-padding) text-(--tweaker-dialog-foreground) shadow-(--tweaker-dialog-shadow) outline-none"
          onCloseAutoFocus={(event) => {
            if (!returnFocusRef) return
            event.preventDefault()
            returnFocusRef.current?.focus()
          }}
        >
          <div className="grid gap-(--tweaker-space-1)">
            <AlertDialog.Title className="text-(length:--tweaker-font-size-xl) leading-(--tweaker-line-normal) font-(--tweaker-font-semibold)">
              {title}
            </AlertDialog.Title>
            <AlertDialog.Description className="text-(length:--tweaker-font-size-lg) leading-(--tweaker-line-tight) text-(--tweaker-dialog-muted)">
              {description}
            </AlertDialog.Description>
          </div>
          <div
            className="grid min-h-0 gap-(--tweaker-space-2) overflow-y-auto"
            aria-label="Proposed value changes"
          >
            {changes.map((change) => (
              <section
                key={change.field}
                className="grid gap-(--tweaker-space-1) border border-(--tweaker-dialog-border) p-(--tweaker-space-2)"
              >
                <h3 className="text-(length:--tweaker-font-size-lg) font-(--tweaker-font-semibold)">
                  {change.field}
                </h3>
                <dl className="grid grid-cols-[auto_1fr] gap-x-(--tweaker-space-2) gap-y-(--tweaker-space-1) text-(length:--tweaker-font-size-lg)">
                  <dt className="text-(--tweaker-dialog-muted)">{beforeLabel}</dt>
                  <dd className="min-w-0 font-mono break-words">
                    {formatFieldOutput(change.before)}
                  </dd>
                  <dt className="text-(--tweaker-dialog-muted)">Proposed</dt>
                  <dd className="min-w-0 font-mono break-words">
                    {formatFieldOutput(change.after)}
                  </dd>
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
            <AlertDialog.Cancel asChild>
              <Button size="sm" variant="outline">
                Abort
              </Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button
                size="sm"
                onClick={(event) => {
                  try {
                    onAccept()
                    acceptedRef.current = true
                    setAcceptError('')
                  } catch (error) {
                    acceptedRef.current = false
                    event.preventDefault()
                    setAcceptError(errorMessage(error))
                  }
                }}
              >
                Accept changes
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
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
