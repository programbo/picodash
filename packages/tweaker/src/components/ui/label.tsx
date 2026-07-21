import { LabelContext, Label as LabelPrimitive, type LabelProps } from 'react-aria-components'

import { cn } from '#lib/utils'

function Label({ className, htmlFor, slot, ...props }: LabelProps) {
  const label = (
    <LabelPrimitive
      data-slot="label"
      className={cn(
        'flex items-center gap-(--tweaker-space-1) text-(length:--tweaker-font-size-lg) leading-(--tweaker-line-tight) font-(--tweaker-font-medium) text-tweaker-text select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-(--tweaker-opacity-disabled) peer-disabled:cursor-not-allowed peer-disabled:opacity-(--tweaker-opacity-disabled) peer-data-disabled:opacity-(--tweaker-opacity-disabled)',
        className,
      )}
      {...props}
      htmlFor={htmlFor}
      slot={slot}
    />
  )

  if (htmlFor && slot === undefined) {
    return <LabelContext.Provider value={null}>{label}</LabelContext.Provider>
  }

  return label
}

export { Label }
