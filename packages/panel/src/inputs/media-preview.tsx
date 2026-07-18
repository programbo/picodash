import { ImageOff } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import {
  TweakerControl,
  type TweakerControlContextValue,
  useResolvedPanelProp,
  type ReactiveProp,
  type TweakerControlProps,
} from '../tweaker-control.js'
import { synchronizeOptionalTweakerFieldValue } from '../tweaker-control-value.js'
import { useTweakerPanelStoreApi } from '../tweaker-panel.js'
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
  contentLayout = 'block',
  fallback,
  imageClassName,
  objectFit = 'contain',
  src: srcProp,
  ...controlProps
}: TweakerMediaPreviewProps) {
  const src = useResolvedPanelProp(srcProp)
  const normalizedDefaultValue = normalizeTweakerMediaUrl(controlProps.defaultValue)

  return (
    <TweakerControl<string>
      {...controlProps}
      contentLayout={contentLayout}
      defaultValue={normalizedDefaultValue}
      readOnly
    >
      {(control) => (
        <>
          <TweakerMediaPreviewValueSynchronizer control={control} />
          <MediaPreviewSurface
            alt={alt}
            className={imageClassName}
            fallback={fallback}
            objectFit={objectFit}
            src={normalizeTweakerMediaUrl(src ?? control.value ?? normalizedDefaultValue)}
          />
        </>
      )}
    </TweakerControl>
  )
}

function TweakerMediaPreviewValueSynchronizer({
  control,
}: {
  control: TweakerControlContextValue<string>
}) {
  const store = useTweakerPanelStoreApi()

  useEffect(() => {
    synchronizeOptionalTweakerFieldValue(
      control,
      normalizeTweakerMediaUrl,
      (currentValue, normalizedValue) => currentValue === normalizedValue,
      store,
    )
  }, [control, store])

  return null
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
