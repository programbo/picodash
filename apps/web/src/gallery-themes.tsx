'use client'

import hljs from 'highlight.js/lib/core'
import css from 'highlight.js/lib/languages/css'
import { Check, Copy } from 'lucide-react'
import { useState, useSyncExternalStore, type ReactNode } from 'react'
import { usePicodashTheme } from '@picodash/panel'
import { useDemoContext } from '@/demo-provider'
import { GalleryFrame } from '@/gallery-frame'
import { cn } from '@/lib/utils'

hljs.registerLanguage('css', css)

type ThemeFamily = 'builtin' | 'custom'
type ThemeId = 'dark' | 'light' | 'system' | 'ocean' | 'plum'

type ThemeDefinition = {
  family: ThemeFamily
  id: ThemeId
  label: string
  source: string
}

const themeDefinitions: readonly ThemeDefinition[] = [
  {
    family: 'builtin',
    id: 'system',
    label: 'System',
    source: '',
  },
  {
    family: 'builtin',
    id: 'dark',
    label: 'Dark',
    source: `:where([data-picodash-theme='dark']) {
  color-scheme: dark;
  --picodash-color-canvas: oklch(0.148 0.004 228.8);
  --picodash-color-surface: oklch(0.218 0.008 223.9);
  --picodash-color-surface-raised: oklch(0.218 0.008 223.9);
  --picodash-color-surface-muted: oklch(0.275 0.011 216.9);
  --picodash-color-text: oklch(0.987 0.002 197.1);
  --picodash-color-text-strong: oklch(1 0 0);
  --picodash-color-text-muted: oklch(0.723 0.014 214.4);
  --picodash-color-border: oklch(1 0 0 / 10%);
  --picodash-color-control: oklch(1 0 0 / 15%);
  --picodash-color-focus: oklch(0.56 0.021 213.5);
  --picodash-color-accent: oklch(0.925 0.005 214.3);
  --picodash-color-accent-text: oklch(0.218 0.008 223.9);
  --picodash-color-success: oklch(0.765 0.177 163.223);
  --picodash-color-info: oklch(0.746 0.16 232.661);
  --picodash-color-warning: oklch(0.828 0.189 84.429);
  --picodash-color-alert: oklch(0.75 0.183 55.934);
  --picodash-color-danger: oklch(0.704 0.191 22.216);
  --picodash-color-overlay: oklch(0 0 0 / 85%);
  --picodash-radius-surface: 0;
  --picodash-radius-control: 0;
  --picodash-shadow-panel: 0 25px 50px -12px rgb(0 0 0 / 0.3);
  --picodash-shadow-viewer: 0 25px 50px -12px rgb(0 0 0 / 0.7);
  --picodash-shadow-inner: inset 0 2px 4px rgb(0 0 0 / 0.25);
}`,
  },
  {
    family: 'builtin',
    id: 'light',
    label: 'Light',
    source: `:where([data-picodash-theme='light']) {
  color-scheme: light;
  --picodash-color-canvas: oklch(0.963 0.002 197.1);
  --picodash-color-surface: oklch(1 0 0);
  --picodash-color-surface-raised: oklch(0.987 0.002 197.1);
  --picodash-color-surface-muted: oklch(0.925 0.005 214.3);
  --picodash-color-text: oklch(0.218 0.008 223.9);
  --picodash-color-text-strong: oklch(0.148 0.004 228.8);
  --picodash-color-text-muted: oklch(0.473 0.014 214.4);
  --picodash-color-border: oklch(0.148 0.004 228.8 / 14%);
  --picodash-color-control: oklch(0.148 0.004 228.8 / 20%);
  --picodash-color-focus: oklch(0.56 0.12 221);
  --picodash-color-accent: oklch(0.218 0.008 223.9);
  --picodash-color-accent-text: oklch(0.987 0.002 197.1);
  --picodash-color-success: oklch(0.49 0.14 163.223);
  --picodash-color-info: oklch(0.5 0.15 232.661);
  --picodash-color-warning: oklch(0.58 0.16 84.429);
  --picodash-color-alert: oklch(0.55 0.17 55.934);
  --picodash-color-danger: oklch(0.55 0.19 22.216);
  --picodash-color-overlay: oklch(0.148 0.004 228.8 / 55%);
  --picodash-radius-surface: 0;
  --picodash-radius-control: 0;
  --picodash-shadow-panel: 0 25px 50px -12px rgb(15 23 42 / 0.22);
  --picodash-shadow-viewer: 0 25px 50px -12px rgb(15 23 42 / 0.35);
  --picodash-shadow-inner: inset 0 2px 4px rgb(15 23 42 / 0.12);
}`,
  },
  {
    family: 'custom',
    id: 'ocean',
    label: 'Ocean',
    source: `:where([data-picodash-theme='ocean']) {
  --picodash-color-canvas: rgb(2 18 28);
  --picodash-color-surface: rgb(7 38 52);
  --picodash-color-surface-raised: rgb(11 55 72);
  --picodash-color-surface-muted: rgb(17 78 96);
  --picodash-color-text: rgb(220 248 255);
  --picodash-color-text-strong: rgb(255 255 255);
  --picodash-color-text-muted: rgb(139 195 207);
  --picodash-color-border: rgb(75 138 151);
  --picodash-color-control: rgb(91 158 171);
  --picodash-color-focus: rgb(89 214 239);
  --picodash-color-accent: rgb(61 214 230);
  --picodash-color-accent-text: rgb(2 18 28);
  --picodash-color-success: rgb(75 255 185);
  --picodash-color-info: rgb(112 200 255);
  --picodash-color-warning: rgb(255 214 102);
  --picodash-color-alert: rgb(255 183 77);
  --picodash-color-danger: rgb(255 112 112);
  --picodash-color-overlay: rgb(0 36 60 / 85%);
  --picodash-radius-surface: 8px;
  --picodash-radius-control: 6px;
}`,
  },
  {
    family: 'custom',
    id: 'plum',
    label: 'Plum',
    source: `:where([data-picodash-theme='plum']) {
  --picodash-color-canvas: rgb(29 9 34);
  --picodash-color-surface: rgb(54 19 62);
  --picodash-color-surface-raised: rgb(75 27 85);
  --picodash-color-surface-muted: rgb(101 43 112);
  --picodash-color-text: rgb(253 236 255);
  --picodash-color-text-strong: rgb(255 255 255);
  --picodash-color-text-muted: rgb(207 156 213);
  --picodash-color-border: rgb(139 73 148);
  --picodash-color-control: rgb(157 91 166);
  --picodash-color-focus: rgb(238 139 247);
  --picodash-color-accent: rgb(241 159 248);
  --picodash-color-accent-text: rgb(29 9 34);
  --picodash-color-success: rgb(128 230 168);
  --picodash-color-info: rgb(131 199 253);
  --picodash-color-warning: rgb(248 205 118);
  --picodash-color-alert: rgb(255 196 106);
  --picodash-color-danger: rgb(255 126 110);
  --picodash-color-overlay: rgb(38 12 48 / 88%);
  --picodash-radius-surface: 12px;
  --picodash-radius-control: 9px;
}`,
  },
]

const colorFunctionPattern = /(?:oklch|rgb)\([^)]*\)/g

export function GalleryThemes() {
  const { setProviderTheme, themes } = useDemoContext()
  const resolvedProviderTheme = usePicodashTheme()
  const systemTheme =
    themeDefinitionFor(useSystemColorScheme()) ??
    themeDefinitions.find((theme) => theme.id === 'dark')!
  const currentTheme = themeDefinitionFor(resolvedProviderTheme) ?? themeDefinitions[0]
  const selectedThemeId = (themes.provider ?? 'dark') as ThemeId
  const family = themeFamilyFor(selectedThemeId)
  const [copyStatus, setCopyStatus] = useState<'copied' | 'error' | 'idle'>('idle')

  const selectTheme = (theme: ThemeDefinition) => {
    setProviderTheme(theme.id)
    setCopyStatus('idle')
  }

  const copySource = async () => {
    try {
      await navigator.clipboard.writeText(currentTheme.source)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('error')
    }
    window.setTimeout(() => setCopyStatus('idle'), 1600)
  }

  return (
    <GalleryFrame
      activeTab="themes"
      toolbar={
        <span className="self-end font-mono text-[11px] text-zinc-500 sm:self-auto">
          CSS / semantic tokens
        </span>
      }
    >
      <div
        className="max-h-[calc(100svh-9rem)] min-h-[calc(100svh-12rem)] min-w-0 overflow-y-auto overscroll-contain scroll-smooth motion-reduce:scroll-auto"
        data-themes-guide
      >
        <div className="mx-auto grid max-w-5xl gap-8 p-4 sm:p-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10 lg:p-8">
          <aside className="lg:sticky lg:top-8 lg:self-start">
            <nav aria-label="Themes" className="grid gap-6">
              <ThemeNavList
                label="Built-in themes"
                selectedThemeId={selectedThemeId}
                systemTheme={systemTheme}
                themes={themeDefinitions.filter((theme) => theme.family === 'builtin')}
                onSelect={selectTheme}
              />
              <ThemeNavList
                label="Example themes"
                selectedThemeId={selectedThemeId}
                systemTheme={systemTheme}
                themes={themeDefinitions.filter((theme) => theme.family === 'custom')}
                onSelect={selectTheme}
              />
            </nav>
          </aside>

          <article className="min-w-0">
            <header className="border-b border-white/10 pb-8">
              <p className="font-mono text-[11px] tracking-[0.18em] text-emerald-200 uppercase">
                {family === 'builtin' ? 'Package recipes' : 'Consumer recipes'}
              </p>
              <h1 className="mt-3 text-2xl font-medium tracking-tight text-zinc-50 sm:text-3xl">
                Themes you can read and reuse
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
                Every swatch is a real value from the CSS below. Choose a surface, then copy the
                semantic token recipe into your own stylesheet.
              </p>
            </header>

            <section className="relative mt-8 min-w-0" data-theme-code>
              <button
                aria-label={`Copy ${currentTheme.label} theme CSS`}
                className="absolute top-3 right-3 z-10 flex h-7 items-center gap-1.5 border border-white/12 bg-white/5 px-2 font-mono text-[11px] text-zinc-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:outline-none sm:top-4 sm:right-4"
                type="button"
                onClick={copySource}
              >
                {copyStatus === 'copied' ? (
                  <Check aria-hidden="true" className="size-3 text-emerald-200" />
                ) : (
                  <Copy
                    aria-hidden="true"
                    className={cn('size-3', copyStatus === 'error' && 'text-red-300')}
                  />
                )}
                <span aria-live="polite">
                  {copyStatus === 'copied'
                    ? 'Copied'
                    : copyStatus === 'error'
                      ? 'Copy failed'
                      : 'Copy CSS'}
                </span>
              </button>
              <ThemeCodeBlock source={currentTheme.source} />
            </section>
          </article>
        </div>
      </div>
    </GalleryFrame>
  )
}

function ThemeNavList({
  label,
  selectedThemeId,
  systemTheme,
  themes,
  onSelect,
}: {
  label: string
  selectedThemeId: ThemeId
  systemTheme: ThemeDefinition
  themes: readonly ThemeDefinition[]
  onSelect: (theme: ThemeDefinition) => void
}) {
  return (
    <section>
      <h2 className="font-mono text-[11px] tracking-widest text-emerald-200 uppercase">{label}</h2>
      <div className="mt-2 grid gap-px border border-white/10 bg-white/10">
        {themes.map((theme) => {
          const isSelected = selectedThemeId === theme.id
          const source = theme.id === 'system' ? systemTheme.source : theme.source
          return (
            <button
              key={theme.id}
              aria-current={isSelected ? 'page' : undefined}
              className={cn(
                'group flex items-center justify-between gap-3 bg-zinc-950 px-3 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:outline-none',
                isSelected
                  ? 'bg-emerald-200/10 text-zinc-50'
                  : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100',
              )}
              data-theme-choice={theme.id}
              type="button"
              onClick={() => onSelect(theme)}
            >
              <span className="text-xs font-medium">{theme.label}</span>
              <span className="flex gap-1" aria-hidden="true">
                {colorSwatchesForSource(source)
                  .slice(0, 6)
                  .map((color, index) => (
                    <span
                      key={`${theme.id}-${color}-${index}`}
                      className="size-3 rounded-full border border-white/20"
                      data-theme-nav-swatch={theme.id}
                      style={{ backgroundColor: color }}
                    />
                  ))}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function ThemeCodeBlock({ source }: { source: string }) {
  const sourceLines = source.split('\n')

  return (
    <pre className="min-w-0 overflow-x-auto border border-white/10 bg-black/25 p-3 font-mono text-xs leading-6 text-zinc-300 sm:p-4">
      <code
        className={cn(
          'block min-w-max',
          '[&_.hljs-attr]:text-sky-200 [&_.hljs-built_in]:text-cyan-200',
          '[&_.hljs-comment]:text-zinc-600 [&_.hljs-keyword]:text-violet-300',
          '[&_.hljs-literal]:text-rose-300 [&_.hljs-number]:text-rose-200',
          '[&_.hljs-string]:text-amber-200 [&_.hljs-title.function]:text-cyan-200',
          '[&_.hljs-type]:text-cyan-200',
        )}
      >
        {sourceLines.map((line, index) => (
          <span key={`${line}-${index}`} className="block min-h-6">
            {renderHighlightedLine(line)}
          </span>
        ))}
      </code>
    </pre>
  )
}

function renderHighlightedLine(line: string) {
  const fragments: ReactNode[] = []
  let cursor = 0
  let colorIndex = 0

  for (const match of line.matchAll(colorFunctionPattern)) {
    const color = match[0]
    const start = match.index ?? cursor
    const before = line.slice(cursor, start)
    const trailingWhitespace = before.match(/\s+$/)?.[0] ?? ''
    const prefix =
      colorIndex === 0 ? before.slice(0, before.length - trailingWhitespace.length) : before

    if (prefix) {
      fragments.push(
        <span
          key={`prefix-${start}`}
          dangerouslySetInnerHTML={{ __html: hljs.highlight(prefix, { language: 'css' }).value }}
        />,
      )
    }
    if (colorIndex === 0 && trailingWhitespace) {
      fragments.push(<span key={`space-${start}`}>{trailingWhitespace}</span>)
    }
    fragments.push(
      <span
        key={`swatch-${start}`}
        className="mx-1 inline-block size-2.5 translate-y-px rounded-full border border-white/25 align-middle shadow-sm shadow-black/40"
        data-theme-swatch
        style={{ backgroundColor: color }}
      />,
      <span
        key={`color-${start}`}
        dangerouslySetInnerHTML={{ __html: hljs.highlight(color, { language: 'css' }).value }}
      />,
    )
    cursor = start + color.length
    colorIndex += 1
  }

  const remainder = line.slice(cursor)
  if (remainder || fragments.length === 0) {
    fragments.push(
      <span
        key="remainder"
        dangerouslySetInnerHTML={{ __html: hljs.highlight(remainder, { language: 'css' }).value }}
      />,
    )
  }

  return fragments
}

function useSystemColorScheme(): 'dark' | 'light' {
  return useSyncExternalStore(
    subscribeToSystemColorScheme,
    readSystemColorScheme,
    serverSystemColorScheme,
  )
}

function subscribeToSystemColorScheme(onStoreChange: () => void) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}

  const query = window.matchMedia('(prefers-color-scheme: dark)')
  query.addEventListener('change', onStoreChange)
  return () => query.removeEventListener('change', onStoreChange)
}

function readSystemColorScheme(): 'dark' | 'light' {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function serverSystemColorScheme(): 'dark' {
  return 'dark'
}

function themeDefinitionFor(theme: string) {
  return themeDefinitions.find((definition) => definition.id === theme)
}

function themeFamilyFor(theme: ThemeId): ThemeFamily {
  return themeDefinitions.find((definition) => definition.id === theme)?.family ?? 'builtin'
}

function colorSwatchesForSource(source: string) {
  return source.match(colorFunctionPattern) ?? []
}
