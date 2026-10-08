import type { ReactNode } from 'react'

export function ChoiceOptionContent({
  icon,
  label,
}: {
  readonly icon?: ReactNode
  readonly label: ReactNode
}) {
  return (
    <>
      <span aria-hidden="true" data-picodash-dashstack-option-marker />
      {icon}
      {label}
    </>
  )
}
