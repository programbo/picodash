import { LabelContext, Label as LabelPrimitive, type LabelProps } from 'react-aria-components'

import { cn } from '#lib/utils'

function Label({ className, htmlFor, slot, ...props }: LabelProps) {
  const label = (
    <LabelPrimitive
      data-slot="label"
      className={cn(
        'text-picodash-text flex items-center gap-(--picodash-space-1) text-(length:--picodash-font-size-lg) leading-(--picodash-line-tight) font-(--picodash-font-medium) select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-(--picodash-opacity-disabled) peer-disabled:cursor-not-allowed peer-disabled:opacity-(--picodash-opacity-disabled) peer-data-disabled:opacity-(--picodash-opacity-disabled)',
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
