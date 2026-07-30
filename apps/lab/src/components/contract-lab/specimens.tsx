'use client'

import { useState, type ReactNode } from 'react'
import type { ContractLabPresetId } from '@lab/lib/contract-lab'

export function ContractLabSpecimen({ preset }: { readonly preset: ContractLabPresetId }) {
  switch (preset) {
    case 'placement':
      return <PlacementSpecimen />
    case 'interaction':
      return <InteractionSpecimen />
    case 'composition':
      return <CompositionSpecimen />
    case 'overlays':
      return <OverlaySpecimen />
    case 'documents':
      return <DocumentSpecimen />
    case 'themes':
      return <ThemeSpecimen />
  }
}

function PlacementSpecimen() {
  const [mode, setMode] = useState<'floating' | 'fixed' | 'hybrid'>('hybrid')

  return (
    <SpecimenSection
      description="Boundary-relative positioning, attachment intent, persistence, and release resistance."
      eyebrow="Geometry matrix"
      title="Placement"
    >
      <SegmentedControl
        label="Placement mode"
        options={['floating', 'fixed', 'hybrid']}
        value={mode}
        onChange={(value) => setMode(value as typeof mode)}
      />
      <div className="border-border bg-background/60 relative mt-4 min-h-56 overflow-hidden rounded-lg border">
        <span className="text-muted-foreground absolute top-3 left-3 font-mono text-[0.625rem] uppercase">
          boundary · 640 × 360
        </span>
        <div className="border-border bg-card absolute right-3 bottom-3 w-36 rounded-md border p-3 shadow-xl">
          <p className="text-xs font-semibold capitalize">{mode} panel</p>
          <p className="text-muted-foreground mt-1 text-[0.6875rem]">
            {mode === 'fixed' ? 'Docked · bottom-right' : 'Snapped · bottom-right'}
          </p>
        </div>
      </div>
      <ContractList
        items={['Snaps + docks', 'Custom boundary', 'Persist + restore', 'Detach resistance']}
      />
    </SpecimenSection>
  )
}

function InteractionSpecimen() {
  const [items, setItems] = useState([
    'Pinned input',
    'Exposure',
    'Frame health',
    'Recovery action',
  ])

  function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= items.length) return
    const next = [...items]
    ;[next[index], next[target]] = [next[target], next[index]]
    setItems(next)
  }

  return (
    <SpecimenSection
      description="A keyboard-operable ordering surface with focus, lifecycle, and pin-band signals."
      eyebrow="Input parity"
      title="Interaction"
    >
      <ol className="mt-4 grid gap-2" aria-label="Reorderable Dashlets">
        {items.map((item, index) => (
          <li
            key={item}
            className="border-border bg-background/60 grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg border p-3"
          >
            <span className="text-sm">{item}</span>
            <span className="flex gap-1">
              <MiniButton
                disabled={index === 0}
                label={`Move ${item} up`}
                onClick={() => move(index, -1)}
              >
                ↑
              </MiniButton>
              <MiniButton
                disabled={index === items.length - 1}
                label={`Move ${item} down`}
                onClick={() => move(index, 1)}
              >
                ↓
              </MiniButton>
            </span>
          </li>
        ))}
      </ol>
      <ContractList
        items={['Pointer + keyboard', 'Pin bands', 'Collapse + focus', 'Close + reopen']}
      />
    </SpecimenSection>
  )
}

function CompositionSpecimen() {
  const [quality, setQuality] = useState('balanced')
  const [recovered, setRecovered] = useState(false)

  return (
    <SpecimenSection
      description="Built-in, custom, compound, grouped, streaming, action, and state anatomy."
      eyebrow="Dashlet anatomy"
      title="Composition"
    >
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <SpecimenCard label="Performance health" status="Live">
          <p className="text-3xl font-semibold tabular-nums">59.8 FPS</p>
          <div className="mt-3 flex h-8 items-end gap-1" aria-label="Stable frame-time trend">
            {[45, 56, 42, 68, 60, 73, 64, 79, 70, 84, 76, 88].map((height, index) => (
              <span
                key={index}
                aria-hidden="true"
                className="min-w-1 flex-1 rounded-t-sm bg-emerald-400/70"
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
        </SpecimenCard>
        <SpecimenCard label="Render profile" status="Compound">
          <label className="grid gap-1 text-xs">
            Quality
            <select
              className="border-border bg-background min-h-10 rounded-md border px-2"
              value={quality}
              onChange={(event) => setQuality(event.target.value)}
            >
              <option value="draft">Draft</option>
              <option value="balanced">Balanced</option>
              <option value="final">Final</option>
            </select>
          </label>
          <p className="text-muted-foreground mt-3 text-xs">Display mode · budget 16.7 ms</p>
        </SpecimenCard>
        <SpecimenCard label="Media transport" status="Loading">
          <progress className="w-full accent-emerald-400" max="100" value="63">
            63%
          </progress>
          <div className="mt-3 flex gap-2">
            <MiniButton label="Play media">▶</MiniButton>
            <MiniButton label="Stop media">■</MiniButton>
          </div>
        </SpecimenCard>
        <SpecimenCard label="Deployment status" status={recovered ? 'Recovered' : 'Disconnected'}>
          <p className="text-muted-foreground text-xs">
            {recovered
              ? 'Connection restored. No queued changes.'
              : 'Telemetry has not updated for 14 s.'}
          </p>
          <button
            className="border-border mt-3 min-h-10 rounded-md border px-3 text-xs font-medium"
            type="button"
            onClick={() => setRecovered(true)}
          >
            Retry connection
          </button>
        </SpecimenCard>
      </div>
    </SpecimenSection>
  )
}

function OverlaySpecimen() {
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <SpecimenSection
      description="Portaled layers remain inspectable for stacking, dismissal, containment, and inherited theme."
      eyebrow="Layer stack"
      title="Overlays"
    >
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <details className="border-border bg-background/60 rounded-lg border p-3">
          <summary className="min-h-10 cursor-pointer text-sm font-medium">
            Action menu + submenu
          </summary>
          <div className="border-border mt-2 grid rounded-md border p-1 text-xs">
            <button className="hover:bg-accent min-h-9 rounded px-2 text-left" type="button">
              Copy document
            </button>
            <button className="hover:bg-accent min-h-9 rounded px-2 text-left" type="button">
              Export ▸
            </button>
          </div>
        </details>
        <div className="border-border bg-background/60 rounded-lg border p-3">
          <label className="grid gap-1 text-xs">
            Portaled select
            <select className="border-border bg-background min-h-10 rounded-md border px-2">
              <option>Nearest theme</option>
              <option>Panel override</option>
            </select>
          </label>
        </div>
      </div>
      <button
        className="border-border bg-background hover:bg-accent mt-3 min-h-10 rounded-md border px-3 text-xs font-medium"
        type="button"
        onClick={() => setDialogOpen(true)}
      >
        Open confirmation dialog
      </button>
      {dialogOpen ? (
        <div
          aria-labelledby="contract-dialog-title"
          aria-modal="true"
          className="bg-background/80 fixed inset-0 z-2000 grid place-items-center p-4 backdrop-blur-sm"
          role="dialog"
        >
          <div className="border-border bg-card w-full max-w-sm rounded-xl border p-5 shadow-2xl">
            <h3 id="contract-dialog-title" className="font-semibold">
              Overlay contract
            </h3>
            <p className="text-muted-foreground mt-2 text-sm">
              Focus, dismissal, stacking, and theme inheritance remain observable.
            </p>
            <button
              className="border-border mt-5 min-h-10 rounded-md border px-3 text-xs font-medium"
              type="button"
              onClick={() => setDialogOpen(false)}
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}
    </SpecimenSection>
  )
}

function DocumentSpecimen() {
  const validDocument = '{\n  "exposure": 1.2,\n  "quality": "balanced"\n}'
  const [draft, setDraft] = useState(validDocument)
  const [result, setResult] = useState<'idle' | 'applied' | 'invalid'>('idle')

  function validate() {
    try {
      JSON.parse(draft)
      setResult('applied')
    } catch {
      setResult('invalid')
    }
  }

  return (
    <SpecimenSection
      description="Canonical documents, atomic drafts, repair review, adapters, persistence, and isolation."
      eyebrow="State boundary"
      title="Documents"
    >
      <label className="mt-4 grid gap-2 text-xs font-medium">
        Panel document
        <textarea
          className="border-border bg-background min-h-44 resize-y rounded-lg border p-3 font-mono text-xs leading-5"
          spellCheck={false}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value)
            setResult('idle')
          }}
        />
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          className="border-border bg-background min-h-10 rounded-md border px-3 text-xs font-medium"
          type="button"
          onClick={validate}
        >
          Validate + apply
        </button>
        <button
          className="border-border min-h-10 rounded-md border px-3 text-xs font-medium"
          type="button"
          onClick={() => {
            setDraft('{ "exposure": "invalid"')
            setResult('idle')
          }}
        >
          Load invalid draft
        </button>
        <output
          aria-live="polite"
          className={
            result === 'invalid' ? 'text-destructive text-xs' : 'text-muted-foreground text-xs'
          }
        >
          {result === 'applied'
            ? 'Applied atomically'
            : result === 'invalid'
              ? 'PICODASH_DOCUMENT_INVALID · host preserved'
              : 'Awaiting operation'}
        </output>
      </div>
      <ContractList
        items={['Import + export', 'Repair review', 'External adapter', 'Panel isolation']}
      />
    </SpecimenSection>
  )
}

function ThemeSpecimen() {
  const [theme, setTheme] = useState('dark')

  return (
    <SpecimenSection
      description="Semantic roles across recipes, overrides, contrast, zoom, reduced motion, and portal carriers."
      eyebrow="Token probe"
      title="Themes"
    >
      <SegmentedControl
        label="Theme recipe"
        options={['dark', 'light', 'system', 'contrast']}
        value={theme}
        onChange={setTheme}
      />
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4" data-theme-probe={theme}>
        {[
          ['Surface', 'bg-card'],
          ['Accent', 'bg-primary'],
          ['Success', 'bg-emerald-400'],
          ['Danger', 'bg-destructive'],
        ].map(([label, color]) => (
          <div key={label} className="border-border bg-background/60 rounded-lg border p-3">
            <span className={`${color} block h-12 rounded-md`} />
            <span className="mt-2 block text-xs font-medium">{label}</span>
          </div>
        ))}
      </div>
      <ContractList
        items={['Provider inheritance', 'Panel override', 'Reduced motion', 'Portal carrier']}
      />
    </SpecimenSection>
  )
}

function SpecimenSection({
  children,
  description,
  eyebrow,
  title,
}: {
  children: ReactNode
  description: string
  eyebrow: string
  title: string
}) {
  return (
    <section>
      <p className="text-muted-foreground font-mono text-[0.625rem] tracking-[0.16em] uppercase">
        {eyebrow}
      </p>
      <h2 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">{description}</p>
      {children}
    </section>
  )
}

function SegmentedControl({
  label,
  onChange,
  options,
  value,
}: {
  label: string
  onChange: (value: string) => void
  options: readonly string[]
  value: string
}) {
  return (
    <fieldset className="mt-4">
      <legend className="text-muted-foreground mb-2 text-xs">{label}</legend>
      <div className="border-border bg-background/60 inline-flex max-w-full flex-wrap rounded-lg border p-1">
        {options.map((option) => (
          <button
            key={option}
            aria-pressed={value === option}
            className="hover:bg-accent aria-pressed:bg-accent min-h-9 rounded-md px-3 text-xs font-medium capitalize"
            type="button"
            onClick={() => onChange(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

function SpecimenCard({
  children,
  label,
  status,
}: {
  children: ReactNode
  label: string
  status: string
}) {
  return (
    <article className="border-border bg-background/60 rounded-lg border p-3">
      <header className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold">{label}</h3>
        <span className="text-muted-foreground font-mono text-[0.625rem] uppercase">{status}</span>
      </header>
      {children}
    </article>
  )
}

function ContractList({ items }: { items: readonly string[] }) {
  return (
    <ul className="text-muted-foreground mt-4 flex flex-wrap gap-x-4 gap-y-2 font-mono text-[0.625rem] uppercase">
      {items.map((item) => (
        <li key={item} className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-1 rounded-full bg-emerald-400" />
          {item}
        </li>
      ))}
    </ul>
  )
}

function MiniButton({
  children,
  disabled,
  label,
  onClick,
}: {
  children: ReactNode
  disabled?: boolean
  label: string
  onClick?: () => void
}) {
  return (
    <button
      aria-label={label}
      className="border-border hover:bg-accent min-h-9 min-w-9 rounded-md border px-2 text-xs disabled:opacity-40"
      disabled={disabled}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  )
}
