import { ImageOff } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  TweakerItem,
  useResolvedPanelProp,
  type ReactiveProp,
  type TweakerInputItemProps,
} from '../tweaker-control.js'
import { cn } from '../utils.js'
import type { TweakerParser } from '../tweaker-validation.js'
import {
  canonicalTweakerValue,
  invalidTweakerValue,
  unsetTweakerValue,
} from './built-in-validation.js'

export type TweakerMediaObjectFit = 'contain' | 'cover' | 'fill' | 'none' | 'scale-down'

export interface TweakerMediaPreviewProps extends Omit<
  TweakerInputItemProps<string>,
  'children' | 'onValueChange' | 'parse' | 'readOnly'
> {
  alt: string
  fallback?: ReactNode
  imageClassName?: string
  objectFit?: TweakerMediaObjectFit
  src?: ReactiveProp<string | undefined>
}

export function TweakerMediaPreview({
  alt,
  contentLayout = 'block',
  fallback,
  imageClassName,
  objectFit = 'contain',
  src: srcProp,
  ...controlProps
}: TweakerMediaPreviewProps) {
  const src = useResolvedPanelProp(srcProp)
  const normalizedDefaultValue = normalizeTweakerMediaUrl(controlProps.defaultValue)
  const parse = useMemo<TweakerParser<string>>(
    () => (input, context) => {
      const normalized = normalizeTweakerMediaUrl(input)
      if (normalized !== undefined) {
        return canonicalTweakerValue(
          input,
          normalized,
          'Media URL must be trimmed and use a safe image URL scheme.',
        )
      }
      const error = 'Media URL must be a safe HTTP, HTTPS, blob, or supported image data URL.'
      return context.source === 'import'
        ? invalidTweakerValue(error)
        : unsetTweakerValue(input, error)
    },
    [],
  )

  return (
    <TweakerItem<string>
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
          src={normalizeTweakerMediaUrl(src ?? control.value ?? normalizedDefaultValue)}
        />
      )}
    </TweakerItem>
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
        className="border-tweaker-control text-tweaker-muted rounded-tweaker-control col-span-full flex aspect-video min-h-(--tweaker-field-surface-min-height) items-center justify-center gap-(--tweaker-space-2) border border-dashed bg-(--_tweaker-color-well) px-(--tweaker-space-3) text-center text-(length:--tweaker-font-size-lg)"
        role="status"
      >
        {fallback ?? (
          <>
            <ImageOff className="size-(--tweaker-icon-md) shrink-0" aria-hidden="true" />
            <span>{failed ? 'Preview could not be loaded' : 'No preview available'}</span>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="border-tweaker-control rounded-tweaker-control col-span-full aspect-video min-h-(--tweaker-field-surface-min-height) overflow-hidden border bg-(--_tweaker-color-well)">
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

export function normalizeTweakerMediaUrl(value: unknown) {
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
