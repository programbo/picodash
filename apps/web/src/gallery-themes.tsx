'use client'

import hljs from 'highlight.js/lib/core'
import css from 'highlight.js/lib/languages/css'
import typescript from 'highlight.js/lib/languages/typescript'
import { Check, Copy } from 'lucide-react'
import { useState, useSyncExternalStore, type ReactNode } from 'react'
import { usePicodashTheme } from '@picodash/panel'
import { useDemoContext } from '@/demo-provider'
import { GalleryFrame } from '@/gallery-frame'
import { cn } from '@/lib/utils'

hljs.registerLanguage('css', css)
hljs.registerLanguage('typescript', typescript)

type ThemeFamily = 'builtin' | 'custom'
type ThemeId = 'contrast' | 'dark' | 'light' | 'system' | 'ocean' | 'plum' | 'tron'

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
  {
    family: 'custom',
    id: 'tron',
    label: 'Tron',
    source: `:where([data-picodash-panel][data-picodash-theme='tron']) {
  color-scheme: dark;
  --picodash-theme-font-family: 'Avenir Next', Avenir, 'Century Gothic', Futura, ui-sans-serif, sans-serif;
  --picodash-theme-data-font-family: 'SFMono-Regular', 'Cascadia Code', 'Roboto Mono', ui-monospace, monospace;
  --picodash-font-family: var(--picodash-theme-font-family);
  --picodash-color-canvas: oklch(0.085 0.018 232);
  --picodash-color-surface: oklch(0.115 0.022 228);
  --picodash-color-surface-raised: oklch(0.145 0.03 224);
  --picodash-color-surface-muted: oklch(0.19 0.038 220);
  --picodash-color-text: oklch(0.94 0.02 215);
  --picodash-color-accent: oklch(0.82 0.17 201);
  --picodash-color-text-strong: oklch(0.985 0.008 205);
  --picodash-color-text-muted: oklch(0.72 0.045 215);
  --picodash-opacity-muted: 0.82;
  --picodash-opacity-subtle: 0.5;
  --picodash-color-border: oklch(0.81 0.16 201 / 34%);
  --picodash-color-control: oklch(0.81 0.16 201 / 18%);
  --picodash-color-focus: oklch(0.86 0.18 198);
  --picodash-color-accent-text: oklch(0.085 0.018 232);
  --picodash-color-success: oklch(0.78 0.16 160);
  --picodash-color-info: oklch(0.82 0.17 201);
  --picodash-color-warning: oklch(0.83 0.17 80);
  --picodash-color-alert: oklch(0.76 0.2 55);
  --picodash-color-danger: oklch(0.68 0.22 30);
  --picodash-color-overlay: oklch(0.05 0.018 232 / 94%);
  --picodash-radius-surface: 0;
  --picodash-radius-control: 0;
  --picodash-shadow-panel: 0 0 0 1px oklch(0.82 0.17 201 / 48%), inset 0 1px 0 oklch(0.86 0.18 198 / 72%), 0 0 0.8rem oklch(0.82 0.17 201 / 18%), 0 2rem 5rem oklch(0 0 0 / 78%);
  --picodash-shadow-viewer: 0 2rem 5rem oklch(0 0 0 / 82%);
  --picodash-shadow-inner: inset 0 0 0 1px oklch(0.82 0.17 201 / 10%), inset 0 0 1.5rem oklch(0 0 0 / 55%);
  --picodash-theme-border-shadow: 0 0 0 1px oklch(0.82 0.17 201 / 52%), 0 0 0.5rem oklch(0.82 0.17 201 / 22%);
  --picodash-theme-control-shadow: inset 0 0 0 1px oklch(0.82 0.17 201 / 12%), 0 0 0.35rem oklch(0.82 0.17 201 / 8%);
  --picodash-theme-active-shadow: 0 0 0.25rem oklch(0.86 0.18 198 / 82%), 0 0 0.7rem oklch(0.82 0.17 201 / 36%);
  --picodash-theme-underline-shadow: 0 0.35rem 0.5rem -0.42rem oklch(0.86 0.18 198 / 72%);
  --picodash-theme-heading-shadow: 0 0 0.5rem oklch(0.82 0.17 201 / 42%);
}

:where([data-picodash-panel][data-picodash-theme='tron']) :is(h1, h2, h3, [data-picodash-theme-text]) {
  font-family: var(--picodash-theme-font-family);
  font-weight: 600;
  letter-spacing: 0.11em;
  text-transform: uppercase;
  text-shadow: var(--picodash-theme-heading-shadow);
}

[data-picodash-panel][data-picodash-theme='tron'] {
  background-color: var(--picodash-color-surface) !important;
  backdrop-filter: none !important;
  box-shadow: var(--picodash-shadow-panel);
}

:where([data-picodash-panel][data-picodash-theme='tron']) .border-picodash-control:not(input):not(textarea):not(button) {
  box-shadow: var(--picodash-theme-control-shadow);
}

:where([data-picodash-panel][data-picodash-theme='tron']) :is(input.border-picodash-control, textarea.border-picodash-control, button[data-slot='select-trigger']) {
  box-shadow: var(--picodash-theme-underline-shadow);
}

:where([data-picodash-panel][data-picodash-theme='tron']) [data-slot='slider-thumb']::before {
  box-shadow: var(--picodash-theme-active-shadow), var(--picodash-shadow-sm);
}

:where([data-picodash-panel][data-picodash-theme='tron']) [data-slot='slider-thumb'] {
  box-shadow: none;
}

:where([data-picodash-panel][data-picodash-theme='tron']) :is([data-slot='switch'][data-selected], [data-slot='toggle-group-item'][data-selected], [data-interactive-tabs] [data-selected]) {
  box-shadow: var(--picodash-theme-active-shadow);
}

:where([data-picodash-panel][data-picodash-theme='tron']) [id$=':pad'] > span {
  box-shadow: var(--picodash-theme-active-shadow);
}

:where([data-picodash-panel][data-picodash-theme='tron']) input[type='range']::-webkit-slider-thumb {
  box-shadow: var(--picodash-theme-active-shadow);
}

:where([data-picodash-panel][data-picodash-theme='tron']) input[type='range']::-moz-range-thumb {
  box-shadow: var(--picodash-theme-active-shadow);
}

:where([data-picodash-panel][data-picodash-theme='tron']) [data-item-id] {
  text-shadow: none;
}

:where([data-picodash-panel][data-picodash-theme='tron']) label {
  overflow: visible;
  text-overflow: clip;
}

:where([data-picodash-panel][data-picodash-theme='tron']) [data-item-id='segmented'] [data-slot='toggle-group'] {
  overflow: visible;
}

:where([data-picodash-panel][data-picodash-theme='tron']) .font-mono {
  font-family: var(--picodash-theme-data-font-family);
}

:where([data-picodash-panel][data-picodash-theme='tron']) [data-interactive-tabs] {
  border-color: oklch(0.82 0.17 201 / 30%);
  box-shadow: var(--picodash-theme-control-shadow);
}

:where([data-picodash-panel][data-picodash-theme='tron']) :is(.recharts-cartesian-axis-tick-value, .recharts-polar-angle-axis-tick-value, .recharts-polar-radius-axis-tick-value) {
  fill: var(--picodash-color-text-muted);
}`,
  },
  {
    family: 'custom',
    id: 'contrast',
    label: 'Contrast',
    source: `:where(
  [data-picodash-panel][data-picodash-theme='contrast'],
  [data-picodash-panel][data-picodash-theme='contrast'] [data-picodash-theme='contrast']
) {
  color-scheme: light;
  --picodash-theme-font-family: 'Avenir Next', Avenir, 'Trebuchet MS', sans-serif;
  --picodash-font-family: var(--picodash-theme-font-family);
  --picodash-color-canvas: rgb(255 255 255);
  --picodash-color-surface: rgb(255 255 255);
  --picodash-color-surface-raised: rgb(250 250 250);
  --picodash-color-surface-muted: rgb(238 238 238);
  --picodash-color-text: rgb(0 0 0);
  --picodash-color-text-strong: rgb(0 0 0);
  --picodash-color-text-muted: rgb(54 54 54);
  --picodash-color-border: rgb(0 0 0);
  --picodash-color-control: rgb(0 0 0 / 72%);
  --picodash-color-focus: rgb(0 76 153);
  --picodash-color-accent: rgb(0 0 0);
  --picodash-color-accent-text: rgb(255 255 255);
  --picodash-color-success: rgb(0 104 56);
  --picodash-color-info: rgb(0 76 153);
  --picodash-color-warning: rgb(128 72 0);
  --picodash-color-alert: rgb(142 36 0);
  --picodash-color-danger: rgb(144 0 0);
  --picodash-color-overlay: rgb(255 255 255 / 92%);
  --picodash-radius-surface: 0;
  --picodash-radius-control: 0;
  --picodash-shadow-panel: 6px 6px 0 rgb(0 0 0);
  --picodash-shadow-viewer: 8px 8px 0 rgb(0 0 0);
  --picodash-shadow-inner: inset 0 0 0 1px rgb(0 0 0 / 14%);
  --picodash-theme-border-shadow: 0px 0px 0 rgb(0 0 0 / 82%);
  --picodash-theme-text-shadow: 0px 0px 0 rgb(0 0 0 / 30%);
  --picodash-theme-heading-shadow: 0px 0px 0 rgb(0 0 0 / 28%);
}

:where([data-picodash-panel][data-picodash-theme='contrast']) :is(h1, h2, h3, [data-picodash-theme-text]) {
  font-family: var(--picodash-theme-font-family);
  font-weight: 900;
  letter-spacing: -0.02em;
  text-shadow: var(--picodash-theme-heading-shadow);
}

:where([data-picodash-panel][data-picodash-theme='contrast']) :is(.text-picodash-text, .text-picodash-strong) {
  font-weight: 700;
  text-shadow: var(--picodash-theme-text-shadow);
}

:where([data-picodash-panel][data-picodash-theme='contrast']) .font-mono {
  font-family: var(--picodash-theme-font-family);
  font-weight: 700;
}

:where([data-picodash-panel][data-picodash-theme='contrast']) .border-picodash-border {
  box-shadow: var(--picodash-theme-border-shadow);
}

:where([data-picodash-panel][data-picodash-theme='contrast']) [data-interactive-tabs] {
  border-color: rgb(0 0 0);
  box-shadow: var(--picodash-theme-border-shadow);
}`,
  },
]

const colorFunctionPattern = /(?:oklch|rgb)\([^)]*\)/g
const highlightedCodeClasses = [
  '[&_.hljs-attr]:text-sky-200 [&_.hljs-built_in]:text-cyan-200',
  '[&_.hljs-class_]:text-cyan-200 [&_.hljs-comment]:text-zinc-500',
  '[&_.hljs-keyword]:text-violet-300 [&_.hljs-literal]:text-rose-300',
  '[&_.hljs-meta]:text-violet-200 [&_.hljs-number]:text-rose-200',
  '[&_.hljs-string]:text-amber-200 [&_.hljs-title.function]:text-cyan-200',
  '[&_.hljs-type]:text-cyan-200',
].join(' ')

export function GalleryThemes() {
  const { setProviderTheme, themes } = useDemoContext()
  const resolvedProviderTheme = usePicodashTheme()
  const systemTheme =
    themeDefinitionFor(useSystemColorScheme()) ??
    themeDefinitions.find((theme) => theme.id === 'dark')!
  const currentTheme = themeDefinitionFor(resolvedProviderTheme) ?? themeDefinitions[0]
  const selectedThemeId = (themes.provider ?? 'dark') as ThemeId
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
            <ThemeSetupGuide />

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

function ThemeSetupGuide() {
  const cssLines = [
    '/* app.css */',
    '/* after @picodash/panel/style.css */',
    ":where([data-picodash-theme='brand']) {",
    '  --picodash-color-accent:',
    '    oklch(0.72 0.14 190);',
    '}',
  ]
  const providerLines = [
    '// provider.tsx — add the custom name',
    "type AppTheme = 'brand'",
    '',
    '<PicodashProvider<AppTheme> theme="brand">',
    '  {children}',
    '</PicodashProvider>',
  ]

  return (
    <header className="border-b border-white/10 pb-8" data-theme-guide>
      <p className="max-w-2xl text-sm leading-6 text-zinc-300">
        Put your semantic token recipe in the app stylesheet after the Picodash stylesheet. Add the
        custom name to the provider’s TypeScript union, then pass it to the <code>theme</code> prop.
      </p>
      <div className="mt-5 grid gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-2">
        <div className="min-w-0 bg-black/25 p-3 sm:p-4">
          <p className="mb-2 font-mono text-[10px] tracking-[0.16em] text-emerald-200 uppercase">
            CSS · app stylesheet
          </p>
          <pre className="min-w-0 overflow-x-auto font-mono text-[11px] leading-5 text-zinc-300">
            <code className={cn('block min-w-max', highlightedCodeClasses)}>
              {cssLines.map((line, index) => (
                <span key={`${line}-${index}`} className="block min-h-5">
                  {renderHighlightedLine(line)}
                </span>
              ))}
            </code>
          </pre>
        </div>
        <div className="min-w-0 bg-black/25 p-3 sm:p-4">
          <p className="mb-2 font-mono text-[10px] tracking-[0.16em] text-emerald-200 uppercase">
            TypeScript · provider
          </p>
          <pre className="min-w-0 overflow-x-auto font-mono text-[11px] leading-5 text-zinc-300">
            <code className={cn('block min-w-max', highlightedCodeClasses)}>
              {providerLines.map((line, index) => (
                <span key={`${line}-${index}`} className="block min-h-5">
                  {line ? renderHighlightedLine(line, 'typescript') : '\u00a0'}
                </span>
              ))}
            </code>
          </pre>
        </div>
      </div>
    </header>
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
      <code className={cn('block min-w-max', highlightedCodeClasses)}>
        {sourceLines.map((line, index) => (
          <span key={`${line}-${index}`} className="block min-h-6">
            {renderHighlightedLine(line)}
          </span>
        ))}
      </code>
    </pre>
  )
}

function renderHighlightedLine(line: string, language = 'css') {
  const fragments: ReactNode[] = []
  let cursor = 0
  let colorIndex = 0

  for (const match of language === 'css' ? line.matchAll(colorFunctionPattern) : []) {
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
          dangerouslySetInnerHTML={{ __html: hljs.highlight(prefix, { language }).value }}
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
        dangerouslySetInnerHTML={{ __html: hljs.highlight(color, { language }).value }}
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
        dangerouslySetInnerHTML={{ __html: hljs.highlight(remainder, { language }).value }}
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

function colorSwatchesForSource(source: string) {
  return source.match(colorFunctionPattern) ?? []
}
