import { lazy, Suspense, useMemo } from 'react'
import type { Accept, FileRejection } from 'react-dropzone'
import {
  TweakerItem,
  type TweakerItemContextValue,
  type TweakerInputItemProps,
} from '../tweaker-control.js'
import type { TweakerParser } from '../tweaker-validation.js'
import { canonicalTweakerValue, strictImportShape } from './built-in-validation.js'

export type TweakerDroppedFileMetadata = {
  id: string
  lastModified: number
  name: string
  size: number
  type: string
}
export type TweakerDropzoneValue = TweakerDroppedFileMetadata[]
export type TweakerDropzonePreview = TweakerDroppedFileMetadata & {
  url: string
}

export interface TweakerDropzoneProps extends Omit<
  TweakerInputItemProps<TweakerDropzoneValue>,
  'children' | 'defaultValue' | 'onDrop' | 'parse'
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

export type TweakerDropzoneImplementationProps = {
  accept: Accept | undefined
  className?: string
  control: TweakerItemContextValue<TweakerDropzoneValue>
  fallbackValue: TweakerDropzoneValue
  maxFiles: number
  maxSize: number | undefined
  minSize: number | undefined
  multiple: boolean
  onFiles: TweakerDropzoneProps['onFiles']
  showPreviews: boolean
}

const LazyDropzoneImplementation = lazy(() => import('./dropzone-implementation.js'))

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
  const parse = useMemo<TweakerParser<TweakerDropzoneValue>>(
    () => (input, context) => {
      const error = 'Dropzone value must be an array of canonical serializable file metadata.'
      const shapeError = strictImportShape(context, Array.isArray(input), error)
      if (shapeError) return shapeError
      return canonicalTweakerValue(input, normalizeTweakerDropzoneValue(input), error)
    },
    [],
  )

  return (
    <TweakerItem<TweakerDropzoneValue>
      {...controlProps}
      contentLayout={contentLayout}
      defaultValue={normalizedDefault}
      parse={parse}
    >
      {(control) => (
        <Suspense fallback={<TweakerDropzoneFallback multiple={multiple} />}>
          <LazyDropzoneImplementation
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
        </Suspense>
      )}
    </TweakerItem>
  )
}

function TweakerDropzoneFallback({ multiple }: { multiple: boolean }) {
  return (
    <div className="col-span-full grid gap-(--tweaker-space-1-5)" role="status">
      <div
        aria-label={multiple ? 'Loading file dropzone' : 'Loading single-file dropzone'}
        className="rounded-tweaker-control border-tweaker-control text-tweaker-muted box-border flex min-h-(--tweaker-field-surface-min-height) flex-col items-center justify-center border border-dashed bg-(--_tweaker-color-well) px-(--tweaker-space-3) py-(--tweaker-space-4) text-center text-(length:--tweaker-font-size-lg)"
      >
        <span className="sr-only">
          {multiple ? 'Loading file dropzone' : 'Loading single-file dropzone'}
        </span>
      </div>
      <div className="min-h-4" aria-hidden="true" />
    </div>
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
