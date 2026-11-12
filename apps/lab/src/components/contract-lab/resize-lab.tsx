'use client'

import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { DashPanel, DashPanelProvider, DashPanelTrigger, useDashPanel } from '@picodash/dashpanel'
import { cn } from '@lab/lib/utils'
import { ContractLabDevBridgeConnector } from './dev-bridge-connector'
import { useContractLabDiagnosticCount } from './nexus-diagnostics'
import { ResizeLabContent } from './resize-lab-content'
import { ResizeLabControls, resizeButtonClass } from './resize-lab-controls'
import { ResizeLabInspection } from './resize-lab-inspection'
import {
  RESIZE_LAB_CONFIGURATION,
  RESIZE_LAB_SCOPE,
  createResizeLabNexus,
  defaultResizeConfiguration,
  parseResizeConfiguration,
  readResizeConfiguration,
  resizePlacement,
  resizeRecipes,
  type ResizeLabConfiguration,
  type ResizeLabNexus,
  type ResizeRecipeId,
} from './resize-lab-model'

const resizeDisclosure = {
  valueFields: [],
  scopeIds: [RESIZE_LAB_SCOPE],
  diagnostics: true,
  eventScopeIds: [RESIZE_LAB_SCOPE],
  eventTypes: [
    'hover',
    'focus',
    'pointer',
    'drag.start',
    'drag.update',
    'drag.end',
    'drag.cancel',
    'command',
    'layout',
  ],
} as const
const resizePermissions = { writableFields: [] } as const
const contractionStorageKey = 'picodash:contract-lab:resize-contracted'

type ResizeNexusState =
  | { readonly status: 'loading' }
  | {
      readonly status: 'ready'
      readonly nexus: ResizeLabNexus
      readonly configuration: ResizeLabConfiguration
      readonly contracted: boolean
    }
  | { readonly status: 'unavailable' }

export interface ResizeLabProps {
  readonly onReady: () => void
  readonly onDiagnosticCountChange: (count: number) => void
  readonly onCollapsedChange: (collapsed: boolean) => void
}

export function ResizeLab({ onReady, onDiagnosticCountChange, onCollapsedChange }: ResizeLabProps) {
  const [state, setState] = useState<ResizeNexusState>({ status: 'loading' })
  const sources = useMemo(() => (state.status === 'ready' ? [state.nexus] : []), [state])
  const diagnostics = useContractLabDiagnosticCount(sources)

  useEffect(() => {
    let active = true
    let nexus: ResizeLabNexus | undefined
    queueMicrotask(() => {
      if (!active) return
      try {
        nexus = createResizeLabNexus()
        setState({
          status: 'ready',
          nexus,
          configuration: readResizeConfiguration(),
          contracted: window.sessionStorage.getItem(contractionStorageKey) === 'true',
        })
      } catch {
        setState({ status: 'unavailable' })
      }
    })
    return () => {
      active = false
      const ownedNexus = nexus
      if (ownedNexus) queueMicrotask(() => ownedNexus.destroy({ discardUnpersisted: true }))
    }
  }, [])

  useEffect(() => {
    if (state.status !== 'loading') onReady()
  }, [onReady, state.status])

  useEffect(() => {
    onDiagnosticCountChange(diagnostics)
    return () => onDiagnosticCountChange(0)
  }, [diagnostics, onDiagnosticCountChange])

  if (state.status !== 'ready')
    return (
      <section aria-label="Resize Lab availability" className="p-5 text-sm">
        {state.status === 'loading'
          ? 'Loading Resize Lab…'
          : 'Resize Lab could not open its local persistence. The Console remains available.'}
      </section>
    )
  return (
    <ResizeLabWorkspace
      nexus={state.nexus}
      initialConfiguration={state.configuration}
      initiallyContracted={state.contracted}
      onCollapsedChange={onCollapsedChange}
    />
  )
}

function ResizeLabWorkspace({
  nexus,
  initialConfiguration,
  initiallyContracted,
  onCollapsedChange,
}: {
  readonly nexus: ResizeLabNexus
  readonly initialConfiguration: ResizeLabConfiguration
  readonly initiallyContracted: boolean
  readonly onCollapsedChange: (collapsed: boolean) => void
}) {
  const [configuration, setConfiguration] = useState(initialConfiguration)
  const [draft, setDraft] = useState(initialConfiguration)
  const [error, setError] = useState<string | null>(null)
  const [contracted, setContracted] = useState(initiallyContracted)
  const [portal, setPortal] = useState<HTMLDivElement | null>(null)
  const [probe, setProbe] = useState(false)
  const [recipe, setRecipe] = useState<ResizeRecipeId | 'custom'>('custom')
  const boundary = useRef<HTMLDivElement>(null)
  const parsed = parseResizeConfiguration(configuration)

  useEffect(() => {
    try {
      window.sessionStorage.setItem(RESIZE_LAB_CONFIGURATION, JSON.stringify(configuration))
    } catch {
      /* Nexus independently reports unavailable persistence. */
    }
  }, [configuration])
  useEffect(() => {
    try {
      window.sessionStorage.setItem(contractionStorageKey, String(contracted))
    } catch {
      /* The current boundary remains usable. */
    }
  }, [contracted])

  if (!parsed.ok)
    return (
      <p role="alert" className="p-4">
        {parsed.message}
      </p>
    )

  const boundaryWidth = contracted
    ? Math.min(300, configuration.boundaryWidth)
    : configuration.boundaryWidth
  const boundaryHeight = contracted
    ? Math.min(260, configuration.boundaryHeight)
    : configuration.boundaryHeight

  function edit<Key extends keyof ResizeLabConfiguration>(
    key: Key,
    value: ResizeLabConfiguration[Key],
  ) {
    setDraft((previous) => ({ ...previous, [key]: value }))
  }

  function updateItems(
    update: (items: ResizeLabConfiguration['items']) => ResizeLabConfiguration['items'],
  ) {
    setConfiguration((previous) => ({ ...previous, items: update(previous.items) }))
    setDraft((previous) => ({ ...previous, items: update(previous.items) }))
  }

  return (
    <DashPanelProvider
      nexus={nexus}
      providerId="contract-lab-resize-provider"
      boundary={configuration.boundary === 'element' ? boundary : null}
      boundaryInset={configuration.boundaryInset}
      portalContainer={portal}
      theme={configuration.theme}
      density={configuration.density}
    >
      <ContractLabDevBridgeConnector
        nexus={nexus}
        registrationId="contract-lab-resize"
        label="Contract Lab Resize Lab"
        disclosure={resizeDisclosure}
        permissions={resizePermissions}
      />
      <section
        aria-label="Resize Lab"
        className="m-4 min-w-0 rounded-lg border border-(--picodash-color-border) bg-(--picodash-color-canvas) text-(--picodash-color-text)"
      >
        <div className="border-b border-(--picodash-color-border) p-4">
          <h2 className="text-lg font-semibold">Resize lab</h2>
          <p className="mt-1 max-w-prose text-sm leading-6 text-(--picodash-color-text-muted)">
            Resize any available edge or corner. Manual size survives a smaller container; restore
            preferred size to follow content again. The configuration and event display stay outside
            the test Panel.
          </p>
        </div>
        <div className="grid items-start xl:grid-cols-[minmax(15rem,18rem)_minmax(0,1fr)]">
          <ResizeControlsWithController
            recipe={recipe}
            configuration={configuration}
            draft={draft}
            error={error}
            onEdit={edit}
            onHandleAppearanceChange={(appearance) => {
              setConfiguration((previous) => ({ ...previous, ...appearance }))
              setDraft((previous) => ({ ...previous, ...appearance }))
              setRecipe('custom')
            }}
            onApply={() => {
              const result = parseResizeConfiguration(draft)
              if (!result.ok) {
                setError(result.message)
                return false
              }
              setError(null)
              setConfiguration(draft)
              setRecipe('custom')
              return true
            }}
            onRecipe={(id) => {
              const next = resizeRecipes[id].configuration
              setConfiguration(next)
              setDraft(next)
              setError(null)
              setContracted(false)
              setProbe(false)
              setRecipe(id)
            }}
            onReset={() => {
              setConfiguration(defaultResizeConfiguration)
              setDraft(defaultResizeConfiguration)
              setError(null)
              setContracted(false)
              setProbe(false)
              setRecipe('free')
            }}
            onAddItem={(paragraphs) =>
              updateItems((items) => [
                ...items,
                { id: Math.max(0, ...items.map((item) => item.id)) + 1, paragraphs, open: true },
              ])
            }
            onRemoveItem={() => updateItems((items) => items.slice(0, -1))}
            onSetAllItems={(open) =>
              updateItems((items) => items.map((item) => ({ ...item, open })))
            }
            onInvalidProbe={() => setProbe(true)}
          />
          <div className="min-w-0 xl:sticky xl:top-4">
            {probe ? (
              <div className="m-4 border border-(--picodash-color-warning) p-3 text-sm">
                <InvalidResizeBoundary>
                  <DashPanel
                    id="contract-lab-resize-invalid-probe"
                    title="Invalid resize probe"
                    minWidth={900}
                    maxWidth={200}
                  />
                </InvalidResizeBoundary>
                <button type="button" className={resizeButtonClass} onClick={() => setProbe(false)}>
                  Dismiss invalid configuration probe
                </button>
              </div>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4">
              <p className="text-sm text-(--picodash-color-text-muted)">
                {configuration.boundary === 'element' ? 'Container boundary' : 'Viewport boundary'}{' '}
                ·{' '}
                <output aria-label="Resize container dimensions" className="font-mono tabular-nums">
                  {boundaryWidth} × {boundaryHeight}
                </output>
                {contracted ? ' · temporarily contracted' : ''}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  className={resizeButtonClass}
                  onClick={() => setContracted((value) => !value)}
                  type="button"
                  aria-pressed={contracted}
                >
                  {contracted ? 'Restore container' : 'Shrink container'}
                </button>
                <DashPanelTrigger panelId={RESIZE_LAB_SCOPE}>Reopen Resize Panel</DashPanelTrigger>
              </div>
            </div>
            <div className="overflow-auto p-4">
              <div
                ref={boundary}
                role="region"
                aria-label="Resize Panel boundary"
                className="relative max-w-full overflow-hidden rounded-md border border-dashed border-(--picodash-color-control-border) bg-(--picodash-color-well)"
                style={{ width: boundaryWidth, height: boundaryHeight }}
                data-resize-lab-boundary
                data-contracted={contracted}
              >
                <div
                  ref={setPortal}
                  className="pointer-events-none absolute inset-0 z-10"
                  data-resize-lab-portal
                />
                <p className="pointer-events-none absolute inset-x-4 bottom-3 text-xs text-(--picodash-color-text-muted)">
                  Header moves. Edges and corners resize. Limits preserve the saved preference.
                </p>
              </div>
            </div>
          </div>
        </div>
        <ResizeLabInspection nexus={nexus} />
      </section>
      <DashPanel
        id={RESIZE_LAB_SCOPE}
        title="Resize Panel"
        defaultLayout={{
          placement: resizePlacement(configuration.placement),
          preferredPosition: { x: 24, y: 24 },
        }}
        {...parsed.props}
        resize={
          configuration.enabled
            ? { handles: configuration.handles, targets: configuration.targets }
            : false
        }
        moveHandle={configuration.moveHandle}
        contentConstraints={{
          minWidth: configuration.contentMinWidth,
          maxWidth: configuration.contentMaxWidth,
          minHeight: configuration.contentMinHeight,
          maxHeight: configuration.contentMaxHeight,
        }}
        className={cn('pointer-events-auto', {
          'resize-edges-parallel':
            configuration.edgeHandles === 'parallel' ||
            configuration.edgeHandles === 'external-parallel',
          'resize-edges-external':
            configuration.edgeHandles === 'external-single' ||
            configuration.edgeHandles === 'external-parallel',
          'resize-corners-external': configuration.cornerHandles === 'external',
          'resize-corners-internal': configuration.cornerHandles === 'internal',
        })}
        onCollapsedChange={onCollapsedChange}
        data-resize-lab-panel
      >
        <ResizeLabContent
          configuration={configuration}
          onToggleItem={(id) =>
            updateItems((items) =>
              items.map((item) => (item.id === id ? { ...item, open: !item.open } : item)),
            )
          }
        />
      </DashPanel>
    </DashPanelProvider>
  )
}

function ResizeControlsWithController({
  configuration,
  onApply,
  onRecipe,
  onReset,
  ...props
}: Omit<Parameters<typeof ResizeLabControls>[0], 'onApply' | 'onRecipe' | 'onReset'> & {
  readonly configuration: ResizeLabConfiguration
  readonly onApply: () => boolean
  readonly onRecipe: (id: ResizeRecipeId) => void
  readonly onReset: () => void
}) {
  const controller = useDashPanel(RESIZE_LAB_SCOPE)
  return (
    <ResizeLabControls
      {...props}
      onApply={() => {
        if (onApply() && props.draft.placement !== configuration.placement)
          controller.setPlacement(resizePlacement(props.draft.placement))
      }}
      onRecipe={(id) => {
        controller.resetLayout()
        onRecipe(id)
        if (id === 'scroll') controller.setSize({ height: 260 })
      }}
      onReset={() => {
        controller.resetLayout()
        onReset()
      }}
    />
  )
}

class InvalidResizeBoundary extends Component<
  { readonly children: ReactNode },
  { readonly error: string | null }
> {
  state: { readonly error: string | null } = { error: null }
  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error.message : 'Invalid configuration was rejected.' }
  }
  render() {
    return this.state.error ? (
      <p role="status" className="mb-3">
        Rejected invalid configuration: {this.state.error}
      </p>
    ) : (
      this.props.children
    )
  }
}
