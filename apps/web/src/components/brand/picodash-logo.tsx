import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/utils'

type PicodashLogoProps = Omit<ComponentPropsWithoutRef<'svg'>, 'children'> & {
  label?: string
}

export function PicodashLogo({ className, label, ...props }: PicodashLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      className={cn('h-auto max-w-full fill-current', className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M193.101 0c39.094 0 68.713 35.234 61.927 73.668l-11.46 64.913c-5.298 30.004-31.412 51.878-61.931 51.876H82.603c-7.63 0-14.157 5.468-15.482 12.969l-6.711 37.985C58.92 249.848 51.576 256 42.994 256H17.689C6.694 256-1.635 246.09.273 235.281l32.38-183.4C37.948 21.878 64.06.003 94.578.003zM74.469 78.373a6.33 6.33 0 0 0-6.222 5.226l-3.678 20.819c-.684 3.878 2.31 7.43 6.254 7.42l131.008-.276a6.33 6.33 0 0 0 6.223-5.226l3.678-20.818c.685-3.877-2.31-7.43-6.254-7.42z"
      />
    </svg>
  )
}
