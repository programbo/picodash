import { ImageOff } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import {
  PicodashItem,
  useResolvedPanelProp,
  type ReactiveProp,
  type PicodashInputItemProps,
} from '../components/panel/PicodashItem.js'
import { EmptyState } from '../components/dashlet/states.js'
import { Surface } from '../components/dashlet/visualization.js'
import { cn } from '../utilities/utils.js'
import { picodashMediaPresentation } from './internal/presentation-contracts.js'

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
  return (
    <PicodashItem<string>
      {...controlProps}
      contentLayout={contentLayout}
      presentation={picodashMediaPresentation}
      readOnly
      valueMode="display"
    >
      {(control) => (
        <MediaPreviewSurface
          alt={alt}
          className={imageClassName}
          fallback={fallback}
          objectFit={objectFit}
          src={normalizePicodashMediaUrl(src ?? control.value)}
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
      <EmptyState className="col-span-full aspect-video" role="status">
        {fallback ?? (
          <>
            <ImageOff className="size-(--picodash-icon-md) shrink-0" aria-hidden="true" />
            <span>{failed ? 'Preview could not be loaded' : 'No preview available'}</span>
          </>
        )}
      </EmptyState>
    )
  }

  return (
    <Surface className="col-span-full aspect-video" size="field">
      <img
        alt={alt}
        className={cn('size-full', objectFitClassName(objectFit), className)}
        draggable={false}
        loading="lazy"
        src={src}
        onError={() => setFailed(true)}
      />
    </Surface>
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
