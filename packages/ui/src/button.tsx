import {
  Button as ReactAriaButton,
  type ButtonProps as ReactAriaButtonProps,
} from 'react-aria-components'
import { forwardRef, type RefAttributes } from 'react'

/** The visual treatment applied to a shared UI button. */
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive'

/** The named geometry scale applied to a shared UI button. */
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg'

/** Props for the product-neutral shared UI button. */
export type ButtonProps = ReactAriaButtonProps &
  RefAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant
    size?: ButtonSize
    iconOnly?: boolean
  }

const buttonClassName = 'picodash-button'

function composeClassName(className: ReactAriaButtonProps['className']) {
  if (typeof className === 'function') {
    return (renderProps: Parameters<typeof className>[0]) => {
      const callerClassName = className(renderProps)
      return callerClassName ? `${buttonClassName} ${callerClassName}` : buttonClassName
    }
  }

  return className ? `${buttonClassName} ${className}` : buttonClassName
}

/** A semantic, accessible action button built on React Aria Components. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', iconOnly = false, className, type, ...props },
  ref,
) {
  return (
    <ReactAriaButton
      {...props}
      ref={ref}
      type={type ?? 'button'}
      className={composeClassName(className)}
      data-slot="button"
      data-variant={variant}
      data-size={size}
      data-icon-only={iconOnly || undefined}
    />
  )
})
