/** Combine the package's structural class with optional application classes. */
export function cn(...classes: readonly (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(' ')
}
