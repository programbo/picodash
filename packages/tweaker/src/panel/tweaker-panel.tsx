import { DragDropProvider, type DragEndEvent, type DragStartEvent } from '@dnd-kit/react'
import { clsx } from 'clsx'
import { ChevronDown, ChevronRight } from 'lucide-react'
import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Button } from 'react-aria-components'
import { normalizePanelAppearance, normalizePanelId } from '../control.js'
import { useTweakerSelector } from '../react/context.js'
import type { DockState, PanelAppearance, PanelTheme, Placement } from '../types.js'
import { orderControls } from './order.js'
import { PanelEffectProvider, type PanelEffectStyle } from './panel-effects-context.js'
import {
  clampPosition,
  dockToPosition,
  nearestDock,
  type PanelPosition,
  placementToPosition,
} from './position.js'
import { TweakerSection } from './tweaker-section.js'
import { PanelMenu } from './panel-menu.js'

const emptyOrder: Record<string, string[]> = {}
const emptySectionOrder: string[] = []
const emptyHiddenSections: Record<string, boolean> = {}

export interface TweakerPanelProps {
  id?: string
  className?: string
  defaultPlacement?: Placement
  placement?: Placement
  theme?: PanelTheme
  title?: string
  width?: number | string
  appearance?: PanelAppearance
}

type PanelStyle = CSSProperties &
  Partial<
    Record<
      | '--tw-panel-color-opacity'
      | '--tw-panel-hover-color-opacity'
      | '--tw-panel-background-blur'
      | '--tw-panel-hover-background-blur'
      | '--tw-panel-width',
      string
    >
  >

function applyAppearance(style: PanelStyle, appearance: PanelAppearance) {
  const normalized = normalizePanelAppearance(appearance)
  if (normalized.surfaceOpacity !== undefined) {
    style['--tw-panel-color-opacity'] = String(normalized.surfaceOpacity)
  }
  if (normalized.activeSurfaceOpacity !== undefined) {
    style['--tw-panel-hover-color-opacity'] = String(normalized.activeSurfaceOpacity)
  }
  if (normalized.backdropBlur !== undefined) {
    style['--tw-panel-background-blur'] = `${normalized.backdropBlur}px`
  }
  if (normalized.activeBackdropBlur !== undefined) {
    style['--tw-panel-hover-background-blur'] = `${normalized.activeBackdropBlur}px`
  }
}

function trySetPointerCapture(element: Element, pointerId: number) {
  try {
    element.setPointerCapture(pointerId)
  } catch {
    return
  }
}

function tryReleasePointerCapture(element: Element, pointerId: number) {
  try {
    if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId)
  } catch {
    return
  }
}

export function TweakerPanel({
  id,
  className,
  defaultPlacement,
  placement,
  theme = 'dark',
  title = 'Tweaker',
  width,
  appearance,
}: TweakerPanelProps) {
  const panelId = normalizePanelId(id)
  const resolvedPlacement = defaultPlacement ?? placement ?? 'top-right'
  const allControls = useTweakerSelector((state) => state.controls)
  const controls = useMemo(
    () => allControls.filter((control) => control.panelId === panelId),
    [allControls, panelId],
  )
  const dock = useTweakerSelector((state) => state.panels[panelId]?.dock ?? null)
  const collapsed = useTweakerSelector((state) => state.panels[panelId]?.collapsed ?? false)
  const order = useTweakerSelector((state) => state.order[panelId] ?? emptyOrder)
  const sectionOrder = useTweakerSelector(
    (state) => state.sectionOrder[panelId] ?? emptySectionOrder,
  )
  const hiddenSections = useTweakerSelector(
    (state) => state.hiddenSections[panelId] ?? emptyHiddenSections,
  )
  const liveSectionIds = useMemo(
    () => new Set(controls.map((control) => control.sectionId)),
    [controls],
  )
  const legacyAppearance = useTweakerSelector((state) => state.panelAppearances[panelId])
  const resetOrder = useTweakerSelector((state) => state.resetOrder)
  const resetValues = useTweakerSelector((state) => state.resetValues)
  const setCollapsed = useTweakerSelector((state) => state.setPanelCollapsed)
  const setDock = useTweakerSelector((state) => state.setPanelDock)
  const setAllSectionsCollapsed = useTweakerSelector((state) => state.setAllSectionsCollapsed)
  const valuesById = useTweakerSelector((state) => state.values)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{
    startX: number
    startY: number
    origin: PanelPosition
  } | null>(null)
  const rowDragInteractionIdRef = useRef<string | null>(null)
  const rowDragInteractionTokenRef = useRef(0)
  const rowDragSettleTimeoutRef = useRef<number | null>(null)
  const viewportSize = useViewportSize()
  const panelWidthStyle = panelWidthToCss(width)
  const fallbackPanelWidth = panelWidthToPixels(width)
  const [freePosition, setFreePosition] = useState<PanelPosition | null>(null)
  const [activeInteractionIds, setActiveInteractionIds] = useState<Set<string>>(() => new Set())
  const setInteractionActive = useCallback((interactionId: string, active: boolean) => {
    setActiveInteractionIds((ids) => {
      if (ids.has(interactionId) === active) return ids

      const next = new Set(ids)
      if (active) {
        next.add(interactionId)
      } else {
        next.delete(interactionId)
      }
      return next
    })
  }, [])

  const position = useMemo(() => {
    if (typeof window === 'undefined') return { x: 16, y: 16 }
    if (freePosition) return clampPosition(freePosition, panelRef.current, fallbackPanelWidth)
    if (dock) {
      return clampPosition(
        dockToPosition(dock, window.innerWidth, window.innerHeight, fallbackPanelWidth),
        panelRef.current,
        fallbackPanelWidth,
      )
    }
    return clampPosition(
      placementToPosition(
        resolvedPlacement,
        viewportSize.width,
        viewportSize.height,
        fallbackPanelWidth,
      ),
      panelRef.current,
      fallbackPanelWidth,
    )
  }, [dock, fallbackPanelWidth, freePosition, resolvedPlacement, viewportSize])

  useEffect(() => {
    return () => {
      if (rowDragSettleTimeoutRef.current !== null) {
        window.clearTimeout(rowDragSettleTimeoutRef.current)
      }
    }
  }, [])

  function handlePanelPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    // Never start a panel drag from a press on an interactive control inside
    // the header (collapse toggle, menu trigger) or from portaled overlays
    // (menu items). This guards against any propagation path that could arm
    // the drag from a click meant for a control.
    const target = event.target as HTMLElement | null
    if (target?.closest('button, [role="menuitem"], input, select, [data-no-drag]')) return
    const element = panelRef.current
    if (!element) return
    trySetPointerCapture(event.currentTarget, event.pointerId)
    const rect = element.getBoundingClientRect()
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      origin: {
        x: rect.left,
        y: rect.top,
      },
    }
    setInteractionActive('panel-drag', true)
  }

  function handlePanelPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag) return
    const next = clampPosition(
      {
        x: drag.origin.x + event.clientX - drag.startX,
        y: drag.origin.y + event.clientY - drag.startY,
      },
      panelRef.current,
      fallbackPanelWidth,
    )
    setFreePosition(next)
  }

  function handlePanelPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    const element = panelRef.current
    dragRef.current = null
    setInteractionActive('panel-drag', false)
    tryReleasePointerCapture(event.currentTarget, event.pointerId)
    if (!drag || !element) return

    // Pass the user's intended (unclamped) drop position to nearestDock. With a
    // tall panel the clamped position can sit at an edge purely from clamping,
    // which would otherwise read as dock intent; the intended position reflects
    // where the user actually aimed.
    const intendedPosition = {
      x: drag.origin.x + event.clientX - drag.startX,
      y: drag.origin.y + event.clientY - drag.startY,
    }
    const nextPosition = clampPosition(intendedPosition, element, fallbackPanelWidth)
    const nextDock = nearestDock(intendedPosition, element)
    setDock(panelId, nextDock)
    if (nextDock) {
      setFreePosition(null)
    } else {
      setFreePosition(nextPosition)
    }
  }

  function handlePanelPointerCancel(event: ReactPointerEvent<HTMLDivElement>) {
    dragRef.current = null
    setInteractionActive('panel-drag', false)
    tryReleasePointerCapture(event.currentTarget, event.pointerId)
  }

  function handlePanelLostPointerCapture() {
    if (!dragRef.current) return
    dragRef.current = null
    setInteractionActive('panel-drag', false)
  }

  function clearRowDragInteraction() {
    if (rowDragSettleTimeoutRef.current !== null) {
      window.clearTimeout(rowDragSettleTimeoutRef.current)
      rowDragSettleTimeoutRef.current = null
    }
    const interactionId = rowDragInteractionIdRef.current
    if (!interactionId) return
    rowDragInteractionIdRef.current = null
    setInteractionActive(interactionId, false)
  }

  function settleRowDragInteraction() {
    const token = rowDragInteractionTokenRef.current
    if (rowDragSettleTimeoutRef.current !== null) {
      window.clearTimeout(rowDragSettleTimeoutRef.current)
    }
    rowDragSettleTimeoutRef.current = window.setTimeout(() => {
      if (rowDragInteractionTokenRef.current === token) {
        clearRowDragInteraction()
      }
    }, 180)
  }

  function handleDragStart(event: DragStartEvent) {
    const source = event.operation.source
    if (!source || source.data.panelId !== panelId) return

    if (rowDragSettleTimeoutRef.current !== null) {
      window.clearTimeout(rowDragSettleTimeoutRef.current)
      rowDragSettleTimeoutRef.current = null
    }
    rowDragInteractionTokenRef.current += 1
    const interactionId = `dnd:${String(source.id)}`
    rowDragInteractionIdRef.current = interactionId
    setInteractionActive(interactionId, true)
  }

  function handleDragEnd(event: DragEndEvent) {
    const source = event.operation.source
    if (!source || source.data.panelId !== panelId) {
      clearRowDragInteraction()
      return
    }
    settleRowDragInteraction()
  }

  const effectStyle: PanelEffectStyle = {}
  const style = freePosition || !dock ? positionToStyle(position) : dockToStyle(dock)
  if (panelWidthStyle) style['--tw-panel-width'] = panelWidthStyle
  const resolvedAppearance = { ...legacyAppearance, ...appearance }
  applyAppearance(style, resolvedAppearance)
  applyAppearance(effectStyle, resolvedAppearance)

  return (
    <aside
      ref={panelRef}
      className={clsx('tw-panel', collapsed && 'is-collapsed', className)}
      style={style}
      data-active={activeInteractionIds.size > 0 ? 'true' : undefined}
      data-panel-id={panelId}
      data-theme={theme}
      data-testid={panelId === 'default' ? 'tweaker-panel' : `tweaker-panel-${panelId}`}
    >
      <div
        className="tw-panel__header"
        onPointerDown={handlePanelPointerDown}
        onPointerMove={handlePanelPointerMove}
        onPointerUp={handlePanelPointerUp}
        onPointerCancel={handlePanelPointerCancel}
        onLostPointerCapture={handlePanelLostPointerCapture}
      >
        <Button
          className="tw-icon-button"
          type="button"
          aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
          onPointerDown={(event) => event.stopPropagation()}
          onPress={() => setCollapsed(panelId, !collapsed)}
        >
          {collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
        </Button>
        <strong>{title}</strong>
        <PanelMenu
          panelId={panelId}
          panelRef={panelRef}
          title={title}
          dock={dock}
          valuesById={valuesById}
          resetValues={resetValues}
          resetOrder={resetOrder}
          setDock={setDock}
          setAllSectionsCollapsed={setAllSectionsCollapsed}
          onOpenChange={setInteractionActive}
        />
      </div>

      {!collapsed && (
        <DragDropProvider onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <PanelEffectProvider value={{ style: effectStyle, theme, setInteractionActive }}>
            <div className="tw-panel__body">
              {sectionOrder
                .filter((sectionId) => liveSectionIds.has(sectionId) && !hiddenSections[sectionId])
                .map((sectionId) => {
                  const sectionControls = orderControls(controls, sectionId, order)
                  const sectionLabel = sectionControls[0]?.sectionLabel ?? sectionId
                  return (
                    <TweakerSection
                      key={sectionId}
                      panelId={panelId}
                      sectionId={sectionId}
                      title={sectionLabel}
                      controls={sectionControls}
                    />
                  )
                })}
            </div>
          </PanelEffectProvider>
        </DragDropProvider>
      )}
    </aside>
  )
}

function useViewportSize() {
  const [viewportSize, setViewportSize] = useState(() => {
    if (typeof window === 'undefined') return { width: 0, height: 0 }
    return { width: window.innerWidth, height: window.innerHeight }
  })

  useEffect(() => {
    function handleResize() {
      setViewportSize({ width: window.innerWidth, height: window.innerHeight })
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return viewportSize
}

function positionToStyle(position: PanelPosition): PanelStyle {
  return {
    left: `${position.x}px`,
    top: `${position.y}px`,
  }
}

function panelWidthToCss(width: number | string | undefined) {
  if (typeof width === 'number') {
    return Number.isFinite(width) && width > 0 ? `${width}px` : undefined
  }
  const value = width?.trim()
  return value ? value : undefined
}

function panelWidthToPixels(width: number | string | undefined) {
  if (typeof width === 'number') return Number.isFinite(width) && width > 0 ? width : undefined
  const match = width?.trim().match(/^(\d+(?:\.\d+)?)px$/)
  return match ? Number(match[1]) : undefined
}

function dockToStyle(dock: DockState): PanelStyle {
  const style: PanelStyle = {}
  if (dock.edge === 'left') {
    style.left = 0
    style.top = `${dock.offset}px`
  } else if (dock.edge === 'right') {
    style.right = 0
    style.top = `${dock.offset}px`
  } else if (dock.edge === 'bottom') {
    style.left = `${dock.offset}px`
    style.bottom = 0
  } else {
    style.left = `${dock.offset}px`
    style.top = 0
  }

  if (dock.secondaryEdge === 'top') {
    delete style.bottom
    style.top = 0
  }
  if (dock.secondaryEdge === 'bottom') {
    delete style.top
    style.bottom = 0
  }
  if (dock.secondaryEdge === 'left') {
    delete style.right
    style.left = 0
  }
  if (dock.secondaryEdge === 'right') {
    delete style.left
    style.right = 0
  }

  return style
}
