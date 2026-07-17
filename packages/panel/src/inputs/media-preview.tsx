import { ImageOff } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import {
  TweakerControl,
  useResolvedPanelProp,
  type ReactiveProp,
  type TweakerControlProps,
} from '../tweaker-control.js'
import { cn } from '../utils.js'

export type TweakerMediaObjectFit = 'contain' | 'cover' | 'fill' | 'none' | 'scale-down'

export interface TweakerMediaPreviewProps extends Omit<
  TweakerControlProps<string>,
  'children' | 'onValueChange' | 'readOnly'
> {
  alt: string
  fallback?: ReactNode
  imageClassName?: string
  objectFit?: TweakerMediaObjectFit
  src?: ReactiveProp<string | undefined>
}

export function TweakerMediaPreview({
  alt,
  contentLayout = 'full',
  fallback,
  imageClassName,
  objectFit = 'contain',
  src: srcProp,
  ...controlProps
}: TweakerMediaPreviewProps) {
  const src = useResolvedPanelProp(srcProp)

  return (
    <TweakerControl<string> {...controlProps} contentLayout={contentLayout} readOnly>
      {(control) => (
        <MediaPreviewSurface
          alt={alt}
          className={imageClassName}
          fallback={fallback}
          objectFit={objectFit}
          src={normalizeTweakerMediaUrl(src ?? control.value ?? controlProps.defaultValue)}
        />
      )}
    </TweakerControl>
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
  objectFit: TweakerMediaObjectFit
  src: string | undefined
}) {
  const [failed, setFailed] = useState(false)

  useEffect(() => setFailed(false), [src])

  if (!src || failed) {
    return (
      <div
        className="text-muted-foreground border-input bg-muted/30 col-span-full flex aspect-video min-h-24 items-center justify-center gap-2 rounded-md border border-dashed px-3 text-center text-xs"
        role="status"
      >
        {fallback ?? (
          <>
            <ImageOff className="size-4 shrink-0" aria-hidden="true" />
            <span>{failed ? 'Preview could not be loaded' : 'No preview available'}</span>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="border-input bg-muted/30 col-span-full aspect-video min-h-24 overflow-hidden rounded-md border">
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

export function normalizeTweakerMediaUrl(value: string | undefined) {
  if (typeof value !== 'string') return undefined
  const candidate = value.trim()
  if (!candidate) return undefined
  if (candidate.includes('<') || candidate.includes('>')) return undefined

  if (/^data:image\/(?:avif|gif|jpeg|png|svg\+xml|webp)(?:;|,)/i.test(candidate)) {
    return candidate
  }
  if (/^blob:/i.test(candidate)) return candidate

  try {
    const url = new URL(candidate, 'https://tweaker.invalid')
    return url.protocol === 'http:' || url.protocol === 'https:' ? candidate : undefined
  } catch {
    return undefined
  }
}

export function objectFitClassName(objectFit: TweakerMediaObjectFit) {
  if (objectFit === 'cover') return 'object-cover'
  if (objectFit === 'fill') return 'object-fill'
  if (objectFit === 'none') return 'object-none'
  if (objectFit === 'scale-down') return 'object-scale-down'
  return 'object-contain'
}
