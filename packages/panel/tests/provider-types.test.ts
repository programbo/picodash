import { createElement } from 'react'
import { expect, test } from 'vite-plus/test'
import type {
  PicodashProviderProps,
  PicodashTheme,
  PicodashThemeOption,
} from '../src/state/provider/picodash-provider.tsx'
import { PicodashProvider } from '../src/state/provider/picodash-provider.tsx'

type AppTheme = 'brand' | 'contrast'

const builtinTheme: PicodashTheme = 'dark'
const builtinOptions: PicodashThemeOption = 'system'
const customTheme: PicodashThemeOption<AppTheme> = 'brand'
const customBuiltinTheme: PicodashThemeOption<AppTheme> = 'light'
const customProviderProps: PicodashProviderProps<AppTheme> = {
  children: null,
  theme: 'contrast',
}
const customProvider = createElement(PicodashProvider<AppTheme>, {
  children: null,
  theme: 'brand',
})

void builtinTheme
void builtinOptions
void customTheme
void customBuiltinTheme
void customProviderProps
void customProvider

// @ts-expect-error Undeclared custom theme names are rejected by the default provider type.
const invalidBuiltinTheme: PicodashThemeOption = 'brand'

const invalidCustomTheme: PicodashProviderProps<AppTheme> = {
  children: null,
  // @ts-expect-error Only names supplied through the provider generic are accepted.
  theme: 'ocean',
}

void invalidBuiltinTheme
void invalidCustomTheme

test('keeps provider theme type assertions in the test compilation', () => {
  expect(true).toBe(true)
})
