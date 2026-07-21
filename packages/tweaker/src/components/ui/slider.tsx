import {
  composeRenderProps,
  SliderFill as SliderFillPrimitive,
  Slider as SliderPrimitive,
  SliderThumb as SliderThumbPrimitive,
  SliderTrack as SliderTrackPrimitive,
  type SliderFillProps,
  type SliderProps as SliderPrimitiveProps,
  type SliderThumbProps,
  type SliderTrackProps,
} from 'react-aria-components'

import { cn } from '#lib/utils'

type SliderValue = number | number[]
type SliderProps<T extends SliderValue = SliderValue> = Omit<
  SliderPrimitiveProps<T>,
  'className'
> & {
  className?: string
}

function Slider<T extends SliderValue = SliderValue>({
  children,
  className,
  ...props
}: SliderProps<T>) {
  return (
    <SliderPrimitive
      className={cn(
        'group relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col',
        className,
      )}
      data-slot="slider"
      {...props}
    >
      {children ??
        (({ state }) => {
          return (
            <>
              <SliderTrack className="bg-tweaker-control relative grow overflow-hidden rounded-full select-none data-horizontal:h-(--_tweaker-slider-track-height) data-horizontal:w-full data-vertical:h-full data-vertical:w-(--_tweaker-slider-track-height)">
                <SliderFill className="bg-tweaker-accent absolute select-none data-horizontal:h-full data-vertical:w-full" />
              </SliderTrack>
              {state.values.map((_, index) => (
                <SliderThumb
                  data-slot="slider-thumb"
                  key={index}
                  index={index}
                  className="border-tweaker-accent shadow-tweaker-sm data-focus-visible:ring-tweaker-focus data-focus-visible:ring-offset-tweaker-canvas block size-(--_tweaker-slider-thumb-size) shrink-0 rounded-full border bg-(--_tweaker-slider-thumb) transition-[box-shadow,scale] duration-(--tweaker-duration-fast) outline-none select-none group-data-horizontal:top-1/2 group-data-vertical:left-1/2 data-disabled:pointer-events-none data-focus-visible:ring-2 data-focus-visible:ring-offset-1 data-hovered:scale-110"
                />
              ))}
            </>
          )
        })}
    </SliderPrimitive>
  )
}

function SliderTrack({ className, ...props }: SliderTrackProps) {
  return (
    <SliderTrackPrimitive
      data-slot="slider-track"
      className={composeRenderProps(className, (className) => cn('relative', className))}
      {...props}
    />
  )
}

function SliderFill({ className, ...props }: SliderFillProps) {
  return (
    <SliderFillPrimitive
      data-slot="slider-range"
      className={composeRenderProps(className, (className) => cn('absolute', className))}
      {...props}
    />
  )
}

function SliderThumb({ className, ...props }: SliderThumbProps) {
  return (
    <SliderThumbPrimitive
      data-slot="slider-thumb"
      className={composeRenderProps(className, (className) => cn('block', className))}
      {...props}
    />
  )
}

export { Slider, SliderFill, SliderThumb, SliderTrack }
