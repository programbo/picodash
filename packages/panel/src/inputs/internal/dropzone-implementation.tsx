import { Expand, File, UploadCloud, X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion, type Transition } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import type { FileRejection } from 'react-dropzone'
import { Button } from '../../components/ui/button.js'
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '../../components/ui/dialog.js'
import { picodashMotionTokens } from '../../lib/theme/theme.js'
import { usePicodashProviderContext } from '../../state/provider/picodash-provider.js'
import { usePicodashTheme } from '../../lib/theme/picodash-theme-context.js'
import { cn } from '../../utilities/utils.js'
import {
  normalizePicodashDropzoneValue,
  partitionPicodashFilesByCapacity,
  projectPicodashFileMetadata,
  restoreDropzoneViewerFocus,
  type PicodashDropzoneImplementationProps,
  type PicodashDropzonePreview,
} from '../dropzone.js'

export default function DropzoneImplementation({
  accept,
  className,
  control,
  fallbackValue,
  maxFiles,
  maxSize,
  minSize,
  multiple,
  onFiles,
  showPreviews,
}: PicodashDropzoneImplementationProps) {
  const value = normalizePicodashDropzoneValue(control.value ?? fallbackValue)
  const unavailable = control.disabled || control.readOnly
  const previewUrlsRef = useRef(new Map<string, string>())
  const viewerTriggerRef = useRef<HTMLButtonElement | null>(null)
  const [previewVersion, setPreviewVersion] = useState(0)
  const [capacityRejections, setCapacityRejections] = useState<FileRejection[]>([])
  const [viewerPreview, setViewerPreview] = useState<PicodashDropzonePreview | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)
  const atCapacity = multiple && maxFiles > 0 && value.length >= maxFiles

  const { fileRejections, getInputProps, getRootProps, isDragAccept, isDragActive, isDragReject } =
    useDropzone({
      accept,
      disabled: unavailable,
      maxFiles: 0,
      maxSize,
      minSize,
      multiple,
      noDragEventsBubbling: true,
      onDrop: (acceptedFiles, rejectedFiles) => {
        const partition = partitionPicodashFilesByCapacity(
          acceptedFiles,
          value.length,
          maxFiles,
          multiple,
        )
        const overflowRejections = partition.overflowFiles.map((file) => ({
          errors: [{ code: 'too-many-files', message: capacityErrorMessage(maxFiles) }],
          file,
        }))
        const allRejections = [...rejectedFiles, ...overflowRejections]
        setCapacityRejections(overflowRejections)
        onFiles?.(partition.acceptedFiles, allRejections)
        if (partition.acceptedFiles.length === 0) return

        const nextValue = projectPicodashFileMetadata(
          partition.acceptedFiles,
          multiple ? value : [],
        )

        if (showPreviews && typeof URL !== 'undefined' && URL.createObjectURL) {
          const addedMetadata = nextValue.slice(multiple ? value.length : 0)
          for (const [index, file] of partition.acceptedFiles.entries()) {
            if (!file.type.startsWith('image/')) continue
            const metadata = addedMetadata[index]
            if (!metadata || previewUrlsRef.current.has(metadata.id)) continue
            previewUrlsRef.current.set(metadata.id, URL.createObjectURL(file))
          }
          setPreviewVersion((version) => version + 1)
        }

        control.setInput(nextValue)
      },
    })

  useEffect(() => {
    const retainedIds = new Set(value.map((metadata) => metadata.id))
    let changed = false
    for (const [id, url] of previewUrlsRef.current) {
      if (retainedIds.has(id) || viewerPreview?.id === id) continue
      URL.revokeObjectURL(url)
      previewUrlsRef.current.delete(id)
      changed = true
    }
    if (viewerPreview && !retainedIds.has(viewerPreview.id)) {
      setViewerOpen(false)
      URL.revokeObjectURL(viewerPreview.url)
      previewUrlsRef.current.delete(viewerPreview.id)
      setViewerPreview(null)
      changed = true
    }
    if (changed) setPreviewVersion((version) => version + 1)
  }, [value, viewerPreview])

  useEffect(() => {
    const previewUrls = previewUrlsRef.current
    return () => {
      for (const url of previewUrls.values()) URL.revokeObjectURL(url)
      previewUrls.clear()
    }
  }, [])

  const rejectionMessage = rejectionSummary([...fileRejections, ...capacityRejections])
  void previewVersion

  return (
    <>
      <div className="col-span-full grid gap-(--picodash-space-1-5)">
        <div
          {...getRootProps({
            'aria-label': multiple
              ? 'Choose files or drop them here'
              : 'Choose a file or drop it here',
            className: cn(
              'rounded-picodash-control border-picodash-control text-picodash-muted focus-visible:ring-picodash-focus focus-visible:ring-offset-picodash-canvas box-border flex min-h-(--picodash-field-surface-min-height) cursor-pointer flex-col items-center justify-center gap-(--picodash-space-1) border border-dashed bg-(--_picodash-color-well) px-(--picodash-space-3) py-(--picodash-space-4) text-center text-(length:--picodash-font-size-lg) leading-(--picodash-line-tight) outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
              isDragActive &&
                'border-picodash-focus bg-picodash-surface-muted/60 text-picodash-text',
              isDragAccept && 'border-picodash-success/80 bg-picodash-success-subtle',
              (isDragReject || (isDragActive && atCapacity)) &&
                'border-picodash-danger bg-picodash-danger-subtle text-picodash-danger',
              unavailable && 'cursor-not-allowed opacity-(--picodash-opacity-disabled)',
              className,
            ),
            id: control.inputId,
            role: 'button',
          })}
        >
          <input {...getInputProps()} />
          <UploadCloud className="size-(--picodash-icon-lg)" aria-hidden="true" />
          <span className="text-picodash-text font-(--picodash-font-medium)">
            {isDragActive ? 'Drop files here' : 'Drop files or click to browse'}
          </span>
          <span>
            {multiple && maxFiles > 0
              ? `${value.length} of ${maxFiles} files selected`
              : multiple
                ? 'Select one or more files'
                : 'Select one file'}
          </span>
        </div>

        <div
          className="min-h-4 text-(length:--picodash-font-size-sm) leading-(--picodash-line-tight)"
          aria-live="polite"
        >
          {rejectionMessage ? <p className="text-picodash-danger">{rejectionMessage}</p> : null}
        </div>

        {value.length > 0 ? (
          <ul className="grid gap-(--picodash-space-1)" aria-label="Selected files">
            {value.map((metadata) => {
              const previewUrl = previewUrlsRef.current.get(metadata.id)
              const isViewerOpen = viewerOpen && viewerPreview?.id === metadata.id
              const setViewerOpenForPreview = (nextOpen: boolean) => {
                if (nextOpen && previewUrl) {
                  setViewerPreview({ ...metadata, url: previewUrl })
                  setViewerOpen(true)
                } else {
                  setViewerOpen(false)
                  restoreDropzoneViewerFocusWhenReady(viewerTriggerRef.current)
                }
              }
              return (
                <li
                  key={metadata.id}
                  className="border-picodash-control bg-picodash-canvas/60 rounded-picodash-control grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-(--picodash-space-2) border p-(--picodash-space-1)"
                >
                  {previewUrl ? (
                    <DialogTrigger isOpen={isViewerOpen} onOpenChange={setViewerOpenForPreview}>
                      <Button
                        aria-label={`View ${metadata.name}`}
                        className="group/preview focus-visible:ring-picodash-focus rounded-picodash-control relative size-(--picodash-control-height-md) overflow-hidden p-0 outline-none hover:bg-transparent focus-visible:ring-2"
                        size="icon"
                        variant="ghost"
                        onPress={(event) => {
                          viewerTriggerRef.current = event.target.closest('button')
                        }}
                      >
                        <img
                          alt=""
                          className="size-full object-cover"
                          draggable={false}
                          src={previewUrl}
                        />
                        <span className="absolute inset-0 flex items-center justify-center bg-(--_picodash-viewer-preview-scrim) text-(--picodash-color-text-strong) opacity-0 transition-opacity duration-(--picodash-duration-fast) group-hover/preview:opacity-100 group-focus-visible/preview:opacity-100 motion-reduce:transition-none">
                          <Expand className="size-(--picodash-icon-sm)" aria-hidden="true" />
                        </span>
                      </Button>
                      <DropzoneImageViewer
                        open={isViewerOpen}
                        preview={
                          viewerPreview?.id === metadata.id
                            ? viewerPreview
                            : { ...metadata, url: previewUrl }
                        }
                        onExitComplete={() => setViewerPreview(null)}
                        onOpenChange={setViewerOpenForPreview}
                      />
                    </DialogTrigger>
                  ) : (
                    <span className="bg-picodash-surface-muted rounded-picodash-control flex size-(--picodash-control-height-md) items-center justify-center">
                      <File
                        className="text-picodash-muted size-(--picodash-icon-md)"
                        aria-hidden="true"
                      />
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="text-picodash-text block truncate text-(length:--picodash-font-size-lg)">
                      {metadata.name}
                    </span>
                    <span className="text-picodash-muted block text-(length:--picodash-font-size-sm)">
                      {formatFileSize(metadata.size)}
                    </span>
                  </span>
                  <Button
                    aria-label={`Remove ${metadata.name}`}
                    className="size-(--picodash-control-height-xs)"
                    isDisabled={unavailable}
                    size="icon"
                    variant="ghost"
                    onClick={(event) => {
                      event.stopPropagation()
                      setCapacityRejections([])
                      control.setInput(value.filter((candidate) => candidate.id !== metadata.id))
                    }}
                  >
                    <X className="size-(--picodash-icon-sm)" aria-hidden="true" />
                  </Button>
                </li>
              )
            })}
          </ul>
        ) : null}
      </div>
    </>
  )
}

function restoreDropzoneViewerFocusWhenReady(trigger: HTMLButtonElement | null) {
  if (!trigger?.isConnected) return
  const ownerDocument = trigger.ownerDocument
  let observer: MutationObserver | undefined
  const restore = () => {
    if (!trigger.isConnected) {
      observer?.disconnect()
      return
    }
    if (
      ownerDocument.querySelector('[data-slot="dialog-overlay"]') ||
      trigger.closest('[aria-hidden="true"], [inert]')
    )
      return
    if (restoreDropzoneViewerFocus(trigger)) {
      if (ownerDocument.activeElement === trigger) observer?.disconnect()
    }
  }

  observer = new MutationObserver(restore)
  observer.observe(ownerDocument.body, {
    attributeFilter: ['aria-hidden', 'inert'],
    attributes: true,
    childList: true,
    subtree: true,
  })
  queueMicrotask(restore)
}

function DropzoneImageViewer({
  onExitComplete,
  onOpenChange,
  open,
  preview,
}: {
  onExitComplete: () => void
  onOpenChange: (open: boolean) => void
  open: boolean
  preview: PicodashDropzonePreview | null
}) {
  const prefersReducedMotion = useReducedMotion()
  const { portalContainer } = usePicodashProviderContext()
  const theme = usePicodashTheme()
  const present = open && preview
  const enterTransition: Transition = prefersReducedMotion
    ? { duration: 0 }
    : picodashMotionTokens.viewerEnter

  return (
    <AnimatePresence initial={false} onExitComplete={onExitComplete}>
      {present ? (
        <Dialog
          key="dropzone-image-viewer"
          className="pointer-events-auto z-(--picodash-layer-viewer)! w-[min(92vw,80rem)] max-w-none! gap-0! rounded-none! bg-transparent! p-0! shadow-none! ring-0!"
          data-picodash-theme={theme}
          isOpen
          overlayClassName="pointer-events-auto z-(--picodash-layer-viewer)! bg-(--picodash-color-overlay)! backdrop-blur-(--picodash-blur-overlay)!"
          overlayStyle={{ zIndex: 'var(--picodash-layer-viewer)' }}
          portalContainer={portalContainer ?? undefined}
          showCloseButton={false}
          style={{ zIndex: 'var(--picodash-layer-viewer)' }}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) onOpenChange(false)
          }}
        >
          <motion.figure
            data-picodash-theme={theme}
            className="shadow-picodash-viewer rounded-picodash-surface border-picodash-control m-0 grid w-full gap-0 overflow-hidden border bg-(--_picodash-viewer-background) text-(--picodash-color-text-strong) outline-none"
            initial={prefersReducedMotion ? false : picodashMotionTokens.viewerSurfaceInitial}
            animate={picodashMotionTokens.viewerSurfaceAnimate}
            exit={
              prefersReducedMotion
                ? picodashMotionTokens.viewerSurfaceReducedExit
                : picodashMotionTokens.viewerSurfaceExit
            }
            transition={enterTransition}
          >
            <div className="relative flex max-h-[82vh] min-h-48 items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_35%,var(--_picodash-viewer-spotlight),transparent_65%)] p-(--picodash-space-3) sm:p-(--picodash-space-5)">
              <img
                alt={preview.name}
                className="shadow-picodash-viewer rounded-picodash-control max-h-[74vh] max-w-full object-contain"
                draggable={false}
                src={preview.url}
              />
            </div>
            <figcaption className="border-picodash-border flex min-w-0 items-center justify-between gap-(--picodash-space-3) border-t bg-(--_picodash-viewer-caption-background) px-(--picodash-space-4) py-(--picodash-space-2-5)">
              <span className="min-w-0">
                <DialogTitle className="block truncate text-(length:--picodash-font-size-xl) font-(--picodash-font-medium) text-(--picodash-color-text-strong)">
                  {preview.name}
                </DialogTitle>
                <DialogDescription className="text-(length:--picodash-font-size-md) text-(--picodash-color-text-strong)/55">
                  {formatFileSize(preview.size)}
                </DialogDescription>
              </span>
              <DialogClose
                aria-label="Close image viewer"
                className="size-(--picodash-control-height-md) shrink-0 text-(--picodash-color-text-strong)/70 hover:bg-(--picodash-color-text-strong)/10 hover:text-(--picodash-color-text-strong)"
                size="icon"
                variant="ghost"
              >
                <X className="size-(--picodash-icon-md)" aria-hidden="true" />
              </DialogClose>
            </figcaption>
          </motion.figure>
        </Dialog>
      ) : null}
    </AnimatePresence>
  )
}

function rejectionSummary(rejections: readonly FileRejection[]) {
  if (rejections.length === 0) return undefined
  const errors = [
    ...new Set(rejections.flatMap((rejection) => rejection.errors.map((error) => error.message))),
  ]
  return errors.join(' ')
}

function capacityErrorMessage(maxFiles: number) {
  return maxFiles === 1 ? 'Only 1 file can be selected' : `Only ${maxFiles} files can be selected`
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
