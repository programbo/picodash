import { lazy, Suspense, useMemo } from 'react'
import type { Accept, FileRejection } from 'react-dropzone'
import {
  PicodashItem,
  type PicodashItemContextValue,
  type PicodashInputItemProps,
} from '../picodash-control.js'
import type { PicodashParser } from '../picodash-validation.js'
import { canonicalPicodashValue, strictImportShape } from './built-in-validation.js'

export type PicodashDroppedFileMetadata = {
  id: string
  lastModified: number
  name: string
  size: number
  type: string
}
export type PicodashDropzoneValue = PicodashDroppedFileMetadata[]
export type PicodashDropzonePreview = PicodashDroppedFileMetadata & {
  url: string
}

export interface PicodashDropzoneProps extends Omit<
  PicodashInputItemProps<PicodashDropzoneValue>,
  'children' | 'defaultValue' | 'onDrop' | 'parse'
> {
  accept?: Accept
  defaultValue?: PicodashDropzoneValue
  dropzoneClassName?: string
  maxFiles?: number
  maxSize?: number
  minSize?: number
  multiple?: boolean
  onFiles?: (acceptedFiles: File[], rejectedFiles: FileRejection[]) => void
  showPreviews?: boolean
}

export type PicodashDropzoneImplementationProps = {
  accept: Accept | undefined
  className?: string
  control: PicodashItemContextValue<PicodashDropzoneValue>
  fallbackValue: PicodashDropzoneValue
  maxFiles: number
  maxSize: number | undefined
  minSize: number | undefined
  multiple: boolean
  onFiles: PicodashDropzoneProps['onFiles']
  showPreviews: boolean
}

const LazyDropzoneImplementation = lazy(() => import('./dropzone-implementation.js'))

export function PicodashDropzone({
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
}: PicodashDropzoneProps) {
  const normalizedDefault = useMemo(
    () => normalizePicodashDropzoneValue(defaultValue),
    [defaultValue],
  )
  const parse = useMemo<PicodashParser<PicodashDropzoneValue>>(
    () => (input, context) => {
      const error = 'Dropzone value must be an array of canonical serializable file metadata.'
      const shapeError = strictImportShape(context, Array.isArray(input), error)
      if (shapeError) return shapeError
      return canonicalPicodashValue(input, normalizePicodashDropzoneValue(input), error)
    },
    [],
  )

  return (
    <PicodashItem<PicodashDropzoneValue>
      {...controlProps}
      contentLayout={contentLayout}
      defaultValue={normalizedDefault}
      parse={parse}
    >
      {(control) => (
        <Suspense fallback={<PicodashDropzoneFallback multiple={multiple} />}>
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
    </PicodashItem>
  )
}

function PicodashDropzoneFallback({ multiple }: { multiple: boolean }) {
  return (
    <div className="col-span-full grid gap-(--picodash-space-1-5)" role="status">
      <div
        aria-label={multiple ? 'Loading file dropzone' : 'Loading single-file dropzone'}
        className="rounded-picodash-control border-picodash-control text-picodash-muted box-border flex min-h-(--picodash-field-surface-min-height) flex-col items-center justify-center border border-dashed bg-(--_picodash-color-well) px-(--picodash-space-3) py-(--picodash-space-4) text-center text-(length:--picodash-font-size-lg)"
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

export function projectPicodashFileMetadata(
  files: readonly Pick<File, 'lastModified' | 'name' | 'size' | 'type'>[],
  existing: PicodashDropzoneValue = [],
): PicodashDropzoneValue {
  const result = normalizePicodashDropzoneValue(existing)
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

export function normalizePicodashDropzoneValue(value: unknown): PicodashDropzoneValue {
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

export function partitionPicodashFilesByCapacity<T>(
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
  if (typeof value !== 'string') return ''

  let result = ''
  let hasSeparator = false
  for (const character of value.trim().toLowerCase()) {
    const code = character.charCodeAt(0)
    const isAllowed =
      (code >= 48 && code <= 57) ||
      (code >= 97 && code <= 122) ||
      character === '_' ||
      character === '-'
    if (isAllowed) {
      result += character
      hasSeparator = false
    } else if (result && !hasSeparator) {
      result += '-'
      hasSeparator = true
    }
  }

  let start = 0
  let end = result.length
  while (result.charCodeAt(start) === 45) start += 1
  while (result.charCodeAt(end - 1) === 45) end -= 1
  return result.slice(start, end)
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
