import {
  SliderFill,
  Slider as SliderPrimitive,
  SliderThumb,
  SliderTrack,
  type SliderProps as SliderPrimitiveProps,
} from 'react-aria-components'

import { cn } from '#lib/utils'

type SliderValue = number | number[]
type SliderProps<T extends SliderValue = SliderValue> = Omit<
  SliderPrimitiveProps<T>,
  'className'
> & {
  className?: string
}

function Slider<T extends SliderValue = SliderValue>({ className, ...props }: SliderProps<T>) {
  return (
    <SliderPrimitive
      className={cn(
        'group relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col',
        className,
      )}
      data-slot="slider"
      {...props}
    >
      {({ state }) => {
        return (
          <>
            <SliderTrack
              data-slot="slider-track"
              className="bg-tweaker-control/90 relative grow overflow-hidden rounded-2xl select-none data-horizontal:h-1 data-horizontal:w-full data-vertical:h-full data-vertical:w-1"
            >
              <SliderFill
                data-slot="slider-range"
                className="bg-tweaker-accent absolute select-none data-horizontal:h-full data-vertical:w-full"
              />
            </SliderTrack>
            {state.values.map((_, index) => (
              <SliderThumb
                data-slot="slider-thumb"
                key={index}
                index={index}
                className="hover:ring-tweaker-focus/30 focus-visible:ring-tweaker-focus/30 block size-4 shrink-0 rounded-2xl bg-white shadow-md ring-1 ring-black/10 transition-[color,box-shadow] duration-200 select-none not-dark:bg-clip-padding group-data-horizontal:top-[50%] group-data-vertical:left-[50%] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"
              />
            ))}
          </>
        )
      }}
    </SliderPrimitive>
  )
}

export { Slider }
