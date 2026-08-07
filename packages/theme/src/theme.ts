export const picodashThemeAttribute = 'data-picodash-theme'
export const picodashDefaultTheme = 'dark'

/** Built-in theme preferences. `system` resolves to light or dark at runtime. */
export type PicodashTheme = 'dark' | 'light' | 'system'

/** Built-in preferences plus an application-declared custom theme name. */
export type PicodashThemeOption<CustomTheme extends string = never> = PicodashTheme | CustomTheme

/** A theme name after `system` has been resolved. */
export type PicodashResolvedTheme = string

export function readPicodashSystemTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function resolvePicodashTheme<CustomTheme extends string>(
  theme: PicodashThemeOption<CustomTheme> | undefined,
): PicodashResolvedTheme {
  const preference = theme ?? picodashDefaultTheme
  return preference === 'system' ? readPicodashSystemTheme() : preference
}
