import { useCallback, useEffect, useMemo, useReducer, useState, useSyncExternalStore } from 'react'
import { useDashPanel } from '@picodash/dashpanel'
import type { NexusInteractionEvent } from '@picodash/nexus'
import { RESIZE_LAB_SCOPE, type ResizeLabNexus } from './resize-lab-model'
import { ResizeField, ResizeSelect, resizeButtonClass } from './resize-lab-controls'

const format = (value: number) =>
  Number.isFinite(value) ? String(Math.round(value * 10) / 10) : 'unbounded'
const sizeText = (value: { readonly width: number; readonly height: number } | undefined) =>
  value ? `${format(value.width)} × ${format(value.height)}` : 'Measuring…'

function eventLabel(envelope: NexusInteractionEvent): string {
  const event = envelope.event
  if ('phase' in event) return `${event.type}.${event.phase}`
  if (event.type === 'command') return `${event.command}: ${event.outcome}`
  if (event.type === 'layout') return `layout.${event.reason}`
  return `${event.type} ${event.operation}`
}

function logReducer(
  events: readonly NexusInteractionEvent[],
  action: NexusInteractionEvent | 'clear',
) {
  return action === 'clear' ? [] : [...events.slice(-199), action]
}

export function ResizeLabInspection({ nexus }: { readonly nexus: ResizeLabNexus }) {
  const controller = useDashPanel(RESIZE_LAB_SCOPE)
  const scope = useMemo(() => nexus.scope(RESIZE_LAB_SCOPE), [nexus])
  const subscribeScope = useCallback((listener: () => void) => scope.subscribe(listener), [scope])
  const subscribePersistence = useCallback(
    (listener: () => void) => nexus.persistence.subscribe(listener),
    [nexus],
  )
  const persistenceState = useCallback(() => nexus.persistence.getState(), [nexus])
  const metadata = useSyncExternalStore(
    subscribeScope,
    () => scope.getState().scope?.dashPanel,
    () => undefined,
  )
  const persistence = useSyncExternalStore(subscribePersistence, persistenceState, persistenceState)
  const [events, dispatch] = useReducer(logReducer, [])
  const [paused, setPaused] = useState(false)
  const [filter, setFilter] = useState<'all' | 'drag' | 'command' | 'pointer' | 'layout'>('all')
  const [requestedWidth, setRequestedWidth] = useState('480')
  const [requestedHeight, setRequestedHeight] = useState('320')
  const [commandStatus, setCommandStatus] = useState('No custom size command requested.')
  const [latest, setLatest] = useState<NexusInteractionEvent | null>(null)

  useEffect(
    () =>
      nexus.events.subscribe(
        (event) => {
          if (!paused) {
            setLatest(event)
            dispatch(event)
          }
        },
        { scopeIds: [RESIZE_LAB_SCOPE] },
      ),
    [nexus, paused],
  )

  const visibleEvents = events.filter(
    ({ event }) =>
      filter === 'all' ||
      (filter === 'drag' ? event.type.startsWith('drag.') : event.type === filter),
  )
  const latestGeometry = [...events]
    .reverse()
    .find(({ event }) => 'geometry' in event && event.geometry)?.event
  const geometry =
    latestGeometry && 'geometry' in latestGeometry ? latestGeometry.geometry : undefined
  const sizing = controller.availability === 'available' ? controller.sizing : undefined
  const preferredPosition = metadata?.preferredPosition ?? { x: 24, y: 24 }
  const latestDrag = [...events]
    .reverse()
    .find(
      ({ event }) => event.type.startsWith('drag.') && 'geometry' in event && event.geometry,
    )?.event
  const dragGeometry = latestDrag && 'geometry' in latestDrag ? latestDrag.geometry : undefined

  function report(result: ReturnType<typeof controller.setSize>) {
    setCommandStatus(
      result.status === 'not_executed'
        ? `Not executed: ${result.reason}.`
        : result.transaction.ok
          ? 'Size command accepted.'
          : 'Size command rejected by Nexus.',
    )
  }

  return (
    <section
      aria-label="Resize inspection"
      className="grid min-w-0 gap-5 border-t border-(--picodash-color-border) p-4"
    >
      <div>
        <h2 className="mb-3 text-base font-semibold">Size and position</h2>
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <dt className="text-(--picodash-color-text-muted)">Preferred size</dt>
            <dd>
              <output aria-label="Preferred panel size" className="font-mono tabular-nums">
                {sizeText(sizing?.preferred)}
              </output>
            </dd>
          </div>
          <div>
            <dt className="text-(--picodash-color-text-muted)">Manual override</dt>
            <dd>
              <output aria-label="Manual panel size" className="font-mono tabular-nums">
                {metadata?.manualSize
                  ? `${metadata.manualSize.width === undefined ? 'automatic' : format(metadata.manualSize.width)} × ${metadata.manualSize.height === undefined ? 'automatic' : format(metadata.manualSize.height)}`
                  : 'Automatic on both axes'}
              </output>
            </dd>
          </div>
          <div>
            <dt className="text-(--picodash-color-text-muted)">Rendered size</dt>
            <dd>
              <output aria-label="Resolved panel size" className="font-mono tabular-nums">
                {sizeText(sizing?.resolved)}
              </output>
            </dd>
          </div>
          <div>
            <dt className="text-(--picodash-color-text-muted)">Axis source</dt>
            <dd>
              <output aria-label="Panel size source">
                {sizing
                  ? `Width: ${sizing.source.width}; height: ${sizing.source.height}`
                  : 'Measuring…'}
              </output>
            </dd>
          </div>
          <div>
            <dt className="text-(--picodash-color-text-muted)">Natural content size</dt>
            <dd>
              <output aria-label="Natural content size" className="font-mono tabular-nums">
                {sizeText(sizing?.measurements?.content)}
              </output>
            </dd>
          </div>
          <div>
            <dt className="text-(--picodash-color-text-muted)">Preferred position</dt>
            <dd>
              <output aria-label="Preferred panel position" className="font-mono tabular-nums">
                {format(preferredPosition.x)}, {format(preferredPosition.y)}
              </output>
            </dd>
          </div>
          <div>
            <dt className="text-(--picodash-color-text-muted)">Rendered position</dt>
            <dd>
              <output aria-label="Resolved panel position" className="font-mono tabular-nums">
                {geometry
                  ? `${format(geometry.applied.x)}, ${format(geometry.applied.y)}`
                  : 'Waiting for a layout event'}
              </output>
            </dd>
          </div>
          <div>
            <dt className="text-(--picodash-color-text-muted)">Effective minimum</dt>
            <dd>
              <output aria-label="Effective panel minimum" className="font-mono tabular-nums">
                {sizeText(sizing?.minimum)}
              </output>
            </dd>
          </div>
          <div>
            <dt className="text-(--picodash-color-text-muted)">Effective maximum</dt>
            <dd>
              <output aria-label="Effective panel maximum" className="font-mono tabular-nums">
                {sizeText(sizing?.maximum)}
              </output>
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-sm">
          <span className="text-(--picodash-color-text-muted)">Active constraints: </span>
          <output aria-label="Panel constraint reasons">
            {sizing?.constraints.length
              ? sizing.constraints
                  .map(
                    (constraint) =>
                      `${constraint.axis}: ${constraint.code}${constraint.limit === undefined ? '' : ` (${format(constraint.limit)})`}`,
                  )
                  .join('; ')
              : sizing
                ? 'None'
                : 'Waiting for measurements'}
          </output>
        </p>
        <p className="mt-2 text-sm">
          <span className="text-(--picodash-color-text-muted)">Measurement: </span>
          <output aria-label="Resize measurement readiness">
            {sizing?.measurements?.status === 'ready'
              ? 'Ready'
              : sizing?.measurements?.status === 'unavailable'
                ? 'Unavailable'
                : 'Pending'}
          </output>
          <span className="ml-4 text-(--picodash-color-text-muted)">Persistence: </span>
          <output aria-label="Resize persistence status">{persistence.status}</output>
        </p>
        <p className="mt-2 text-sm">
          <span className="text-(--picodash-color-text-muted)">Latest drag diff: </span>
          <output aria-label="Latest resize drag difference" className="font-mono tabular-nums">
            {dragGeometry
              ? `x ${format(dragGeometry.delta.x)}, y ${format(dragGeometry.delta.y)}, width ${format(dragGeometry.delta.width)}, height ${format(dragGeometry.delta.height)}`
              : 'No drag yet'}
          </output>
        </p>
      </div>
      <div>
        <h2 className="mb-3 text-base font-semibold">Custom controls</h2>
        <div className="flex flex-wrap items-end gap-3">
          <ResizeField
            label="Requested manual width"
            value={requestedWidth}
            onChange={setRequestedWidth}
            type="number"
            min={1}
          />
          <ResizeField
            label="Requested manual height"
            value={requestedHeight}
            onChange={setRequestedHeight}
            type="number"
            min={1}
          />
          <button
            className={resizeButtonClass}
            type="button"
            disabled={
              controller.availability === 'unavailable' ||
              !(
                Number(requestedWidth) > 0 &&
                Number.isFinite(Number(requestedWidth)) &&
                Number(requestedHeight) > 0 &&
                Number.isFinite(Number(requestedHeight))
              )
            }
            onClick={() =>
              report(
                controller.setSize({
                  width: Number(requestedWidth),
                  height: Number(requestedHeight),
                }),
              )
            }
          >
            Set manual size
          </button>
          <button
            className={resizeButtonClass}
            type="button"
            disabled={
              controller.availability === 'unavailable' ||
              !(Number(requestedWidth) > 0 && Number.isFinite(Number(requestedWidth)))
            }
            onClick={() => report(controller.setSize({ width: Number(requestedWidth) }))}
          >
            Set width only
          </button>
          <button
            className={resizeButtonClass}
            type="button"
            disabled={controller.availability === 'unavailable'}
            onClick={() => report(controller.restorePreferredSize())}
          >
            Restore preferred size from custom control
          </button>
        </div>
        <output
          aria-label="Custom resize command outcome"
          aria-live="polite"
          className="mt-2 block text-sm text-(--picodash-color-text-muted)"
        >
          {commandStatus}
        </output>
      </div>
      <div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Nexus interaction events</h2>
            <p className="mt-1 text-sm text-(--picodash-color-text-muted)">
              Latest 200 events. Pausing the display does not pause interaction reporting.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <ResizeSelect
              label="Event filter"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'All events' },
                { value: 'drag', label: 'Drag lifecycle' },
                { value: 'pointer', label: 'Pointer' },
                { value: 'command', label: 'Commands' },
                { value: 'layout', label: 'Automatic layout' },
              ]}
            />
            <button
              className={resizeButtonClass}
              type="button"
              aria-pressed={paused}
              onClick={() => setPaused((value) => !value)}
            >
              {paused ? 'Resume event display' : 'Pause event display'}
            </button>
            <button className={resizeButtonClass} type="button" onClick={() => dispatch('clear')}>
              Clear event display
            </button>
          </div>
        </div>
        <output aria-label="Latest Nexus resize event" className="mt-3 block font-mono text-xs">
          {latest
            ? `#${latest.sequence} ${eventLabel(latest)} · ${latest.event.target}`
            : 'Waiting for Panel interactions'}
        </output>
        <details className="mt-2 text-sm">
          <summary className="min-h-11 cursor-pointer py-3 focus-visible:outline-2 focus-visible:outline-(--picodash-color-focus)">
            Latest event payload
          </summary>
          <pre
            aria-label="Latest Nexus event payload"
            className="max-h-64 overflow-auto rounded-md border border-(--picodash-color-border) bg-(--picodash-color-well) p-3 text-xs"
          >
            {latest ? JSON.stringify(latest, null, 2) : 'No event received.'}
          </pre>
        </details>
        <div className="mt-2 max-h-64 overflow-auto rounded-md border border-(--picodash-color-border)">
          <table aria-label="Nexus resize event timeline" className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-(--picodash-color-surface-muted)">
              <tr>
                <th className="px-3 py-2 font-medium">Sequence</th>
                <th className="px-3 py-2 font-medium">Interaction</th>
                <th className="px-3 py-2 font-medium">Target</th>
                <th className="px-3 py-2 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {visibleEvents.length ? (
                [...visibleEvents].reverse().map((envelope) => (
                  <tr key={envelope.sequence} className="border-t border-(--picodash-color-border)">
                    <td className="px-3 py-2 font-mono tabular-nums">{envelope.sequence}</td>
                    <td className="px-3 py-2 font-mono">{eventLabel(envelope)}</td>
                    <td className="px-3 py-2">{envelope.event.target}</td>
                    <td className="px-3 py-2">{envelope.event.input}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-(--picodash-color-text-muted)">
                    No events match this display.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
