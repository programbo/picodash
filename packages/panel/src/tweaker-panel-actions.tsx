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
import { useMemo, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import { useStore } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { collapsibleGroupsForState } from './tweaker-panel-action-state.js'
import {
  importTweakerPanelDocument,
  serializeTweakerPanelValues,
  tweakerPanelDocumentFilename,
  tweakerPanelDocumentFormatFromFilename,
  tweakerPanelDocumentMimeType,
  tweakerPanelImportAccept,
  type TweakerPanelDocumentFormat,
} from './tweaker-panel-documents.js'
import { useTweakerPanelStoreApi } from './tweaker-panel-context.js'
import { tweakerGeometryTokens } from './theme.js'
import { useTweakerTheme } from './tweaker-theme-context.js'
import { Button, buttonVariants } from './ui.js'
import { cn } from './utils.js'

export function TweakerPanelActions({
  panelId,
  panelTitle,
}: {
  panelId: string
  panelTitle: string
}) {
  const theme = useTweakerTheme()
  const store = useTweakerPanelStoreApi()
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
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
      importTweakerPanelDocument(store, await file.text(), format)
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
              'ml-auto size-(--tweaker-icon-lg) shrink-0 text-tweaker-muted',
            )}
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <Ellipsis className="size-(--tweaker-icon-sm)" aria-hidden="true" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            data-tweaker-theme={theme}
            aria-label={`Actions for ${panelTitle}`}
            avoidCollisions
            className={menuContentClassName}
            collisionPadding={tweakerGeometryTokens.menuCollisionPadding}
            sideOffset={tweakerGeometryTokens.menuSideOffset}
            sticky="always"
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
        <AlertDialog.Portal>
          <AlertDialog.Overlay
            data-tweaker-theme={theme}
            className="pointer-events-auto fixed inset-0 z-(--tweaker-layer-dialog) bg-(--tweaker-color-overlay) backdrop-blur-(--tweaker-blur-overlay)"
          />
          <AlertDialog.Content
            data-tweaker-theme={theme}
            className="rounded-tweaker-surface border-tweaker-border bg-tweaker-surface-raised text-tweaker-text shadow-tweaker-panel pointer-events-auto fixed top-1/2 left-1/2 z-(--tweaker-layer-dialog) grid w-[min(24rem,calc(100dvw-2rem))] -translate-x-1/2 -translate-y-1/2 gap-(--tweaker-space-3) border p-(--tweaker-space-4) outline-none"
            onCloseAutoFocus={(event) => {
              event.preventDefault()
              triggerRef.current?.focus()
            }}
          >
            <div className="grid gap-(--tweaker-space-1)">
              <AlertDialog.Title className="text-(length:--tweaker-font-size-xl) leading-(--tweaker-line-normal) font-(--tweaker-font-semibold)">
                Reset {panelTitle}?
              </AlertDialog.Title>
              <AlertDialog.Description className="text-tweaker-muted text-(length:--tweaker-font-size-lg) leading-(--tweaker-line-tight)">
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
                    store.getState().resetRegisteredFields()
                    announce('Reset all registered panel values.')
                  }}
                >
                  Reset values
                </Button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  )
}

const menuContentClassName =
  'z-(--tweaker-layer-menu) max-h-(--radix-dropdown-menu-content-available-height) min-w-44 overflow-y-auto rounded-tweaker-surface border border-tweaker-border bg-tweaker-surface-raised p-(--tweaker-space-1) text-tweaker-text shadow-(--tweaker-shadow-md) outline-none'

const menuItemClassName =
  'relative flex h-(--tweaker-control-height-md) cursor-default items-center gap-(--tweaker-space-2) rounded-tweaker-control px-(--tweaker-space-2) text-(length:--tweaker-font-size-lg) leading-(--tweaker-line-tight) outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-(--tweaker-opacity-disabled) data-[highlighted]:bg-tweaker-surface-muted data-[highlighted]:text-tweaker-text [&>svg]:size-(--tweaker-icon-sm) [&>svg]:shrink-0'

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
      className={cn(menuItemClassName, destructive && 'text-tweaker-danger')}
      {...props}
    >
      {icon}
      <span className="min-w-0 flex-1">{children}</span>
    </DropdownMenu.Item>
  )
}

function MenuSeparator() {
  return (
    <DropdownMenu.Separator className="my-(--tweaker-space-1) h-px bg-(--_tweaker-color-border-muted)" />
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
  const theme = useTweakerTheme()

  return (
    <DropdownMenu.Sub>
      <DropdownMenu.SubTrigger className={menuItemClassName}>
        {icon}
        <span className="min-w-0 flex-1">{label}</span>
        <ChevronRight className="size-(--tweaker-icon-sm) shrink-0" aria-hidden="true" />
      </DropdownMenu.SubTrigger>
      <DropdownMenu.Portal>
        <DropdownMenu.SubContent
          data-tweaker-theme={theme}
          avoidCollisions
          className={menuContentClassName}
          collisionPadding={tweakerGeometryTokens.menuCollisionPadding}
          sideOffset={tweakerGeometryTokens.menuSubmenuOffset}
          sticky="always"
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
