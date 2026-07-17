import { Expand, File, UploadCloud, X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion, type Transition } from 'motion/react'
import { Dialog } from 'radix-ui'
import { useDropzone, type Accept, type FileRejection } from 'react-dropzone'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  TweakerControl,
  type TweakerControlContextValue,
  type TweakerControlProps,
} from '../tweaker-control.js'
import { Button } from '../ui.js'
import { cn } from '../utils.js'

export type TweakerDroppedFileMetadata = {
  id: string
  lastModified: number
  name: string
  size: number
  type: string
}
export type TweakerDropzoneValue = TweakerDroppedFileMetadata[]

type TweakerDropzonePreview = TweakerDroppedFileMetadata & {
  url: string
}

export interface TweakerDropzoneProps extends Omit<
  TweakerControlProps<TweakerDropzoneValue>,
  'children' | 'defaultValue' | 'onDrop'
> {
  accept?: Accept
  defaultValue?: TweakerDropzoneValue
  dropzoneClassName?: string
  maxFiles?: number
  maxSize?: number
  minSize?: number
  multiple?: boolean
  onFiles?: (acceptedFiles: File[], rejectedFiles: FileRejection[]) => void
  showPreviews?: boolean
}

export function TweakerDropzone({
  accept,
  contentLayout = 'block',
  defaultValue,
  dropzoneClassName,
  maxFiles = 0,
  maxSize,
  minSize,
  multiple = true,
  onFiles,
  showPreviews = false,
  ...controlProps
}: TweakerDropzoneProps) {
  const normalizedDefault = useMemo(
    () => normalizeTweakerDropzoneValue(defaultValue),
    [defaultValue],
  )

  return (
    <TweakerControl<TweakerDropzoneValue>
      {...controlProps}
      contentLayout={contentLayout}
      defaultValue={normalizedDefault}
    >
      {(control) => (
        <DropzoneSurface
          accept={accept}
          className={dropzoneClassName}
          control={control}
          fallbackValue={normalizedDefault}
          maxFiles={maxFiles}
          maxSize={maxSize}
          minSize={minSize}
          multiple={multiple}
          showPreviews={showPreviews}
          onFiles={onFiles}
        />
      )}
    </TweakerControl>
  )
}

function DropzoneSurface({
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
}: {
  accept: Accept | undefined
  className?: string
  control: TweakerControlContextValue<TweakerDropzoneValue>
  fallbackValue: TweakerDropzoneValue
  maxFiles: number
  maxSize: number | undefined
  minSize: number | undefined
  multiple: boolean
  onFiles: TweakerDropzoneProps['onFiles']
  showPreviews: boolean
}) {
  const value = normalizeTweakerDropzoneValue(control.value ?? fallbackValue)
  const unavailable = control.disabled || control.readOnly
  const previewUrlsRef = useRef(new Map<string, string>())
  const viewerTriggerRef = useRef<HTMLButtonElement | null>(null)
  const valueRef = useRef(value)
  valueRef.current = value
  const [previewVersion, setPreviewVersion] = useState(0)
  const [capacityRejections, setCapacityRejections] = useState<FileRejection[]>([])
  const [viewerPreview, setViewerPreview] = useState<TweakerDropzonePreview | null>(null)
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
        const partition = partitionTweakerFilesByCapacity(
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

        const nextValue = projectTweakerFileMetadata(partition.acceptedFiles, multiple ? value : [])

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

        control.setValue(nextValue)
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
    if (viewerPreview && !retainedIds.has(viewerPreview.id)) setViewerOpen(false)
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
      <div className="col-span-full grid gap-1.5">
        <div
          {...getRootProps({
            'aria-label': multiple
              ? 'Choose files or drop them here'
              : 'Choose a file or drop it here',
            className: cn(
              'focus-visible:ring-ring flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-input bg-muted/30 px-3 py-4 text-center text-xs text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-background',
              isDragActive && 'border-ring bg-accent/60 text-foreground',
              isDragAccept && 'border-emerald-500/80 bg-emerald-500/10',
              (isDragReject || (isDragActive && atCapacity)) &&
                'border-destructive bg-destructive/10 text-destructive',
              unavailable && 'cursor-not-allowed opacity-50',
              className,
            ),
            id: control.inputId,
            role: 'button',
          })}
        >
          <input {...getInputProps()} />
          <UploadCloud className="size-5" aria-hidden="true" />
          <span className="text-foreground font-medium">
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

        <div className="min-h-4 text-[10px] leading-4" aria-live="polite">
          {rejectionMessage ? <p className="text-destructive">{rejectionMessage}</p> : null}
        </div>

        {value.length > 0 ? (
          <ul className="grid gap-1" aria-label="Selected files">
            {value.map((metadata) => {
              const previewUrl = previewUrlsRef.current.get(metadata.id)
              return (
                <li
                  key={metadata.id}
                  className="border-input bg-background/60 grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded border p-1"
                >
                  {previewUrl ? (
                    <button
                      aria-label={`View ${metadata.name}`}
                      className="focus-visible:ring-ring group/preview relative size-8 overflow-hidden rounded outline-none focus-visible:ring-2"
                      type="button"
                      onClick={(event) => {
                        viewerTriggerRef.current = event.currentTarget
                        setViewerPreview({ ...metadata, url: previewUrl })
                        setViewerOpen(true)
                      }}
                    >
                      <img
                        alt=""
                        className="size-full object-cover"
                        draggable={false}
                        src={previewUrl}
                      />
                      <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-white opacity-0 transition-opacity group-hover/preview:opacity-100 group-focus-visible/preview:opacity-100 motion-reduce:transition-none">
                        <Expand className="size-3.5" aria-hidden="true" />
                      </span>
                    </button>
                  ) : (
                    <span className="bg-muted flex size-8 items-center justify-center rounded">
                      <File className="text-muted-foreground size-4" aria-hidden="true" />
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="text-foreground block truncate text-xs">{metadata.name}</span>
                    <span className="text-muted-foreground block text-[10px]">
                      {formatFileSize(metadata.size)}
                    </span>
                  </span>
                  <Button
                    aria-label={`Remove ${metadata.name}`}
                    className="size-6"
                    disabled={unavailable}
                    size="icon"
                    variant="ghost"
                    onClick={(event) => {
                      event.stopPropagation()
                      setCapacityRejections([])
                      control.setValue(value.filter((candidate) => candidate.id !== metadata.id))
                    }}
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </Button>
                </li>
              )
            })}
          </ul>
        ) : null}
      </div>

      <DropzoneImageViewer
        open={viewerOpen}
        preview={viewerPreview}
        onExitComplete={() => {
          const preview = viewerPreview
          if (preview && !valueRef.current.some((metadata) => metadata.id === preview.id)) {
            URL.revokeObjectURL(preview.url)
            previewUrlsRef.current.delete(preview.id)
            setPreviewVersion((version) => version + 1)
          }
          setViewerPreview(null)
        }}
        onOpenChange={setViewerOpen}
        onRestoreFocus={() => {
          restoreDropzoneViewerFocus(viewerTriggerRef.current)
        }}
      />
    </>
  )
}

function DropzoneImageViewer({
  onExitComplete,
  onOpenChange,
  onRestoreFocus,
  open,
  preview,
}: {
  onExitComplete: () => void
  onOpenChange: (open: boolean) => void
  onRestoreFocus: () => void
  open: boolean
  preview: TweakerDropzonePreview | null
}) {
  const prefersReducedMotion = useReducedMotion()
  const present = open && preview
  const enterTransition: Transition = prefersReducedMotion
    ? { duration: 0 }
    : { bounce: 0.12, duration: 0.42, type: 'spring' }
  const fadeTransition: Transition = {
    duration: prefersReducedMotion ? 0 : 0.2,
    ease: [0.16, 1, 0.3, 1],
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen)
      }}
    >
      <Dialog.Portal forceMount>
        <AnimatePresence initial={false} onExitComplete={onExitComplete}>
          {present ? (
            <motion.div
              key="dropzone-image-viewer"
              className="pointer-events-none fixed inset-0 z-[2147483647]"
            >
              <Dialog.Overlay forceMount asChild>
                <motion.div
                  className="pointer-events-auto absolute inset-0 bg-black/85 backdrop-blur-sm"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={fadeTransition}
                />
              </Dialog.Overlay>
              <Dialog.Content
                forceMount
                asChild
                onCloseAutoFocus={(event) => {
                  event.preventDefault()
                  onRestoreFocus()
                }}
              >
                <motion.figure
                  className="pointer-events-auto fixed top-1/2 left-1/2 m-0 grid w-[min(92vw,80rem)] max-w-none gap-0 overflow-hidden rounded-xl border border-white/15 bg-black/75 text-white shadow-2xl shadow-black/70 outline-none"
                  initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={
                    prefersReducedMotion
                      ? { opacity: 0 }
                      : {
                          opacity: 0,
                          scale: 0.97,
                          transition: { duration: 0.16, ease: [0.4, 0, 1, 1] },
                        }
                  }
                  style={{ x: '-50%', y: '-50%' }}
                  transition={enterTransition}
                >
                  <div className="relative flex max-h-[82vh] min-h-48 items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.12),transparent_65%)] p-3 sm:p-5">
                    <img
                      alt={preview.name}
                      className="max-h-[74vh] max-w-full rounded-md object-contain shadow-2xl shadow-black/60"
                      draggable={false}
                      src={preview.url}
                    />
                  </div>
                  <figcaption className="flex min-w-0 items-center justify-between gap-3 border-t border-white/10 bg-black/70 px-4 py-2.5">
                    <span className="min-w-0">
                      <Dialog.Title className="block truncate text-sm font-medium text-white">
                        {preview.name}
                      </Dialog.Title>
                      <Dialog.Description className="text-[11px] text-white/55">
                        {formatFileSize(preview.size)}
                      </Dialog.Description>
                    </span>
                    <Dialog.Close asChild>
                      <Button
                        aria-label="Close image viewer"
                        className="size-8 shrink-0 text-white/70 hover:bg-white/10 hover:text-white"
                        size="icon"
                        variant="ghost"
                      >
                        <X className="size-4" aria-hidden="true" />
                      </Button>
                    </Dialog.Close>
                  </figcaption>
                </motion.figure>
              </Dialog.Content>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function restoreDropzoneViewerFocus(
  trigger: Pick<HTMLButtonElement, 'focus' | 'isConnected'> | null,
) {
  if (!trigger?.isConnected) return false
  trigger.focus({ preventScroll: true })
  return true
}

export function projectTweakerFileMetadata(
  files: readonly Pick<File, 'lastModified' | 'name' | 'size' | 'type'>[],
  existing: TweakerDropzoneValue = [],
): TweakerDropzoneValue {
  const result = normalizeTweakerDropzoneValue(existing)
  const usedIds = new Set(result.map((metadata) => metadata.id))
  for (const file of files) {
    const baseId = fileId(file)
    let id = baseId
    let suffix = 2
    while (usedIds.has(id)) id = `${baseId}-${suffix++}`
    usedIds.add(id)
    result.push({
      id,
      lastModified: nonNegativeFinite(file.lastModified),
      name: file.name || 'Unnamed file',
      size: nonNegativeFinite(file.size),
      type: file.type || 'application/octet-stream',
    })
  }
  return result
}

export function normalizeTweakerDropzoneValue(value: unknown): TweakerDropzoneValue {
  if (!Array.isArray(value)) return []
  const usedIds = new Set<string>()
  return value.flatMap((metadata, index) => {
    if (!isUnknownRecord(metadata)) return []
    const fallbackId = `file-${index + 1}`
    const baseId = cleanId(typeof metadata.id === 'string' ? metadata.id : undefined) || fallbackId
    let id = baseId
    let suffix = 2
    while (usedIds.has(id)) id = `${baseId}-${suffix++}`
    usedIds.add(id)
    return [
      {
        id,
        lastModified: nonNegativeFinite(metadata.lastModified),
        name:
          typeof metadata.name === 'string' && metadata.name.trim()
            ? metadata.name.trim()
            : 'Unnamed file',
        size: nonNegativeFinite(metadata.size),
        type:
          typeof metadata.type === 'string' && metadata.type.trim()
            ? metadata.type.trim()
            : 'application/octet-stream',
      },
    ]
  })
}

export function partitionTweakerFilesByCapacity<T>(
  files: readonly T[],
  existingCount: number,
  maxFiles: number,
  multiple: boolean,
) {
  const capacity = multiple
    ? maxFiles > 0
      ? Math.max(0, Math.floor(maxFiles) - nonNegativeInteger(existingCount))
      : files.length
    : 1

  return {
    acceptedFiles: files.slice(0, capacity),
    overflowFiles: files.slice(capacity),
  }
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

function fileId(file: Pick<File, 'lastModified' | 'name' | 'size'>) {
  return cleanId(`${file.name}-${file.size}-${file.lastModified}`) || 'file'
}

function cleanId(value: string | undefined) {
  return typeof value === 'string'
    ? value
        .trim()
        .toLowerCase()
        .replaceAll(/[^a-z0-9_-]+/g, '-')
        .replaceAll(/^-+|-+$/g, '')
    : ''
}

function nonNegativeFinite(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0
}

function nonNegativeInteger(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
}

function isUnknownRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
