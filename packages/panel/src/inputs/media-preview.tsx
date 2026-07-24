import { ImageOff } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  PicodashItem,
  useResolvedPanelProp,
  type ReactiveProp,
  type PicodashInputItemProps,
} from '../components/panel/PicodashItem.js'
import { cn } from '../utilities/utils.js'
import type { PicodashParser } from '../validation/picodash-validation.js'
import {
  canonicalPicodashValue,
  invalidPicodashValue,
  unsetPicodashValue,
} from './internal/built-in-validation.js'

export type PicodashMediaObjectFit = 'contain' | 'cover' | 'fill' | 'none' | 'scale-down'

export interface PicodashMediaPreviewProps extends Omit<
  PicodashInputItemProps<string>,
  'children' | 'onValueChange' | 'parse' | 'readOnly'
> {
  alt: string
  fallback?: ReactNode
  imageClassName?: string
  objectFit?: PicodashMediaObjectFit
  src?: ReactiveProp<string | undefined>
}

export function PicodashMediaPreview({
  alt,
  contentLayout = 'block',
  fallback,
  imageClassName,
  objectFit = 'contain',
  src: srcProp,
  ...controlProps
}: PicodashMediaPreviewProps) {
  const src = useResolvedPanelProp(srcProp)
  const normalizedDefaultValue = normalizePicodashMediaUrl(controlProps.defaultValue)
  const parse = useMemo<PicodashParser<string>>(
    () => (input, context) => {
      const normalized = normalizePicodashMediaUrl(input)
      if (normalized !== undefined) {
        return canonicalPicodashValue(
          input,
          normalized,
          'Media URL must be trimmed and use a safe image URL scheme.',
        )
      }
      const error = 'Media URL must be a safe HTTP, HTTPS, blob, or supported image data URL.'
      return context.source === 'import'
        ? invalidPicodashValue(error)
        : unsetPicodashValue(input, error)
    },
    [],
  )

  return (
    <PicodashItem<string>
      {...controlProps}
      contentLayout={contentLayout}
      defaultValue={normalizedDefaultValue}
      parse={parse}
      readOnly
    >
      {(control) => (
        <MediaPreviewSurface
          alt={alt}
          className={imageClassName}
          fallback={fallback}
          objectFit={objectFit}
          src={normalizePicodashMediaUrl(src ?? control.value ?? normalizedDefaultValue)}
        />
      )}
    </PicodashItem>
  )
}

function MediaPreviewSurface({
  alt,
  className,
  fallback,
  objectFit,
  src,
}: {
  alt: string
  className?: string
  fallback?: ReactNode
  objectFit: PicodashMediaObjectFit
  src: string | undefined
}) {
  const [failed, setFailed] = useState(false)

  useEffect(() => setFailed(false), [src])

  if (!src || failed) {
    return (
      <div
        className="border-picodash-control text-picodash-muted rounded-picodash-control col-span-full flex aspect-video min-h-(--picodash-field-surface-min-height) items-center justify-center gap-(--picodash-space-2) border border-dashed bg-(--_picodash-color-well) px-(--picodash-space-3) text-center text-(length:--picodash-font-size-lg)"
        role="status"
      >
        {fallback ?? (
          <>
            <ImageOff className="size-(--picodash-icon-md) shrink-0" aria-hidden="true" />
            <span>{failed ? 'Preview could not be loaded' : 'No preview available'}</span>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="border-picodash-control rounded-picodash-control col-span-full aspect-video min-h-(--picodash-field-surface-min-height) overflow-hidden border bg-(--_picodash-color-well)">
      <img
        alt={alt}
        className={cn('size-full', objectFitClassName(objectFit), className)}
        draggable={false}
        loading="lazy"
        src={src}
        onError={() => setFailed(true)}
      />
    </div>
  )
}

export function normalizePicodashMediaUrl(value: unknown) {
  if (typeof value !== 'string') return undefined
  const candidate = value.trim()
  if (!candidate) return undefined
  if (candidate.includes('<') || candidate.includes('>')) return undefined

  if (/^data:image\/(?:avif|gif|jpeg|png|svg\+xml|webp)(?:;|,)/i.test(candidate)) {
    return candidate
  }
  if (/^blob:/i.test(candidate)) return candidate

  try {
    const url = new URL(candidate, 'https://picodash.invalid')
    return url.protocol === 'http:' || url.protocol === 'https:' ? candidate : undefined
  } catch {
    return undefined
  }
}

export function objectFitClassName(objectFit: PicodashMediaObjectFit) {
  if (objectFit === 'cover') return 'object-cover'
  if (objectFit === 'fill') return 'object-fill'
  if (objectFit === 'none') return 'object-none'
  if (objectFit === 'scale-down') return 'object-scale-down'
  return 'object-contain'
}
