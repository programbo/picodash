'use client'
import { useEffect, useLayoutEffect, useReducer, useRef, useState, useId } from 'react'
import { createPortal } from 'react-dom'
import { AppWindowMac, PictureInPicture, PictureInPicture2 } from 'lucide-react'
import { createGroupTransferMotion } from './group-transfer-motion.js'
import { createPicodashNexus, type DashPanelLayoutRecord } from '@picodash/nexus'
import { DashPanel, useDashPanel, type DashPanelDefaultLayout } from '@picodash/dashpanel'
import {
  DashPanelTransferBoundary,
  useDashPanelHostId,
  type DashPanelTransfer,
  type DashPanelTransferDriver,
  type DashPanelTransferPoint,
} from '@picodash/dashpanel/integration'
import type { DashGroupHostProps } from '@picodash/dashstack/integration'
import {
  transitionGroup,
  isDetaching,
  isReturnPreview,
  type DetachableEvent,
} from './detachable-state.js'

const desktopQuery = '(min-width: 768px) and (any-pointer: fine)'
const focusable =
  'input:not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled]),[tabindex="0"]'
type Pickup = {
  pointerId: number
  x: number
  y: number
  rect: DOMRect
  header: HTMLElement
  reordering: boolean
}

/** One stable portal target carries the original React tree between two empty host slots. */
export function DetachableGroup(props: DashGroupHostProps) {
  const { homeRef, groupRef, actionsRef, contentRef, id, name, mode, children } = props
  const hostId = `picodash-detached-${useId()}`
  const sourceId = useDashPanelHostId()
  const source = useDashPanel(sourceId ?? '')
  const panel = useDashPanel(hostId)
  const [layoutRoot] = useState(() => createPicodashNexus({ valueOwner: 'nexus', fields: {} }))
  const layoutNexus = layoutRoot.scope('layout')
  const [state, dispatch] = useReducer(transitionGroup, 'inline')
  const stateRef = useRef(state)
  stateRef.current = state
  const send = (event: DetachableEvent) => {
    stateRef.current = transitionGroup(stateRef.current, event)
    dispatch(event)
  }
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const [desktop, setDesktop] = useState(false)
  const panelSlot = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const driver = useRef<DashPanelTransferDriver | null>(null)
  const pickup = useRef<Pickup | null>(null)
  const pending = useRef<{ left: number; top: number; point?: DashPanelTransferPoint } | null>(null)
  const lastLayout = useRef<DashPanelLayoutRecord | undefined>(undefined)
  const height = useRef(0)
  const returnRect = useRef<DOMRect | null>(null)
  const motion = useRef<ReturnType<typeof createGroupTransferMotion> | null>(null)
  const focusOnOpen = useRef(false)
  const [initialLayout, setInitialLayout] = useState<DashPanelDefaultLayout>({
    placement: { mode, disposition: { kind: 'free' } },
    preferredPosition: { x: 0, y: 0 },
  })
  const latest = useRef({ props, panel, source, desktop })
  latest.current = { props, panel, source, desktop }
  const detached = state !== 'inline'

  const focusContent = () => {
    const content = contentRef.current
    const element =
      content?.querySelector<HTMLElement>(
        'input:not([disabled]),textarea:not([disabled]),select:not([disabled])',
      ) ?? content?.querySelector<HTMLElement>(focusable)
    if (element && !element.closest('[hidden],[inert]')) element.focus({ preventScroll: true })
  }
  const show = () => {
    const p = latest.current.panel
    p.show()
    p.expand()
    p.activate()
    requestAnimationFrame(focusContent)
  }
  const returnHome = (motion = true) => {
    if (stateRef.current === 'inline') return
    const current = layoutNexus.getState().scope?.dashPanel
    if (current) lastLayout.current = current
    returnRect.current = motion ? (panelRef.current?.getBoundingClientRect() ?? null) : null
    pending.current = null
    pickup.current = null
    const s = latest.current.source
    s.show()
    s.expand()
    s.activate()
    groupRef.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
    send('return')
  }
  const detach = (point?: DashPanelTransferPoint, rect?: DOMRect, origin?: Pickup) => {
    if (!latest.current.desktop || stateRef.current !== 'inline') return
    const home = groupRef.current
    if (!home) return
    const box = rect ?? home.getBoundingClientRect()
    height.current = contentRef.current?.getBoundingClientRect().height ?? 0
    motion.current?.inline(null)
    latest.current.props.reorder.cancel()
    if (!point && lastLayout.current) {
      setInitialLayout(lastLayout.current)
      layoutNexus.setDashPanelLayout(lastLayout.current)
    } else {
      layoutNexus.resetDashPanelLayout()
      setInitialLayout({
        placement: { mode, disposition: { kind: 'free' } },
        preferredPosition: { x: 0, y: 0 },
      })
      const width = Math.max(box.width, 280)
      const left =
        point && origin
          ? box.left + point.clientX - origin.x
          : box.right + width + 12 <= home.ownerDocument.documentElement.clientWidth
            ? box.right + 12
            : box.left - width - 12
      const top = point && origin ? box.top + point.clientY - origin.y : box.top
      pending.current = { left, top, ...(point ? { point } : {}) }
    }
    focusOnOpen.current = !point
    send(point ? 'pull' : 'detach')
  }
  const callbacks = useRef({ returnHome, detach, show })
  callbacks.current = { returnHome, detach, show }

  useLayoutEffect(() => {
    const home = homeRef.current
    if (!home) return
    const target = home.ownerDocument.createElement('div')
    target.setAttribute('data-picodash-group-surface', '')
    home.append(target)
    setContainer(target)
    return () => {
      target.remove()
    }
  }, [homeRef])
  useLayoutEffect(() => {
    if (!container || !homeRef.current || !groupRef.current) return
    const feedback = createGroupTransferMotion(homeRef.current, groupRef.current)
    motion.current = feedback
    return () => feedback.dispose()
  }, [container, homeRef, groupRef])
  useEffect(() => {
    const media = homeRef.current?.ownerDocument.defaultView?.matchMedia(desktopQuery)
    if (!media) return
    const update = () => {
      setDesktop(media.matches)
      if (!media.matches) callbacks.current.returnHome(false)
    }
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [homeRef])
  // Defer destruction across React Strict Mode's effect replay.
  const lifetime = useRef(0)
  useEffect(() => {
    const generation = ++lifetime.current
    return () => {
      queueMicrotask(() => {
        if (generation === lifetime.current) layoutRoot.destroy({ discardUnpersisted: true })
      })
    }
  }, [layoutRoot])
  useLayoutEffect(() => {
    if (!container) return
    const destination = detached ? panelSlot.current : homeRef.current
    if (!destination || container.parentElement === destination) return
    const active = container.ownerDocument.activeElement
    const restore = active instanceof HTMLElement && container.contains(active) ? active : null
    destination.append(container)
    restore?.focus({ preventScroll: true })
    if (!detached) {
      const button =
        groupRef.current?.querySelector<HTMLElement>('[data-picodash-group-disclosure]') ??
        actionsRef.current?.querySelector<HTMLElement>('button')
      requestAnimationFrame(() => button?.focus({ preventScroll: true }))
      const from = returnRect.current
      returnRect.current = null
      motion.current?.inline(from)
    } else {
      motion.current?.gap(height.current, 0)
    }
  }, [container, detached, homeRef, groupRef, actionsRef])
  useLayoutEffect(() => {
    const visible =
      panel.availability === 'available' ? panel.visible && !panel.collapsed : detached
    props.present(detached ? { location: 'panel', hostId, visible } : { location: 'inline' })
  }, [
    detached,
    hostId,
    panel.availability === 'available' && panel.visible,
    panel.availability === 'available' && panel.collapsed,
    props.present,
  ])
  useEffect(() => props.registerReveal(() => callbacks.current.show()), [props.registerReveal])
  useLayoutEffect(() => {
    const home = homeRef.current
    const stack = groupRef.current?.closest<HTMLElement>('[data-picodash-dashstack]')
    const preview = isReturnPreview(state)
    const from = home?.getBoundingClientRect().height ?? 0
    const wasPreview = home?.hasAttribute('data-return-preview')
    home?.toggleAttribute('data-return-preview', preview)
    if (state !== 'inline' && (preview || wasPreview))
      motion.current?.gap(from, preview ? Math.max(height.current, 80) : 0)
    stack?.toggleAttribute('data-picodash-return-target', preview)
    groupRef.current?.toggleAttribute('data-picodash-return-home', preview)
    return () => {
      stack?.removeAttribute('data-picodash-return-target')
      groupRef.current?.removeAttribute('data-picodash-return-home')
    }
  }, [state, homeRef, groupRef])

  useEffect(() => {
    const group = groupRef.current
    const header = group?.querySelector<HTMLElement>(
      ':scope > [role="group"] > [data-slot="dash-header"]',
    )
    if (!group || !header) return
    const win = group.ownerDocument.defaultView
    const down = (event: PointerEvent) => {
      if (event.button !== 0 || !latest.current.desktop || stateRef.current !== 'inline') return
      const target = event.target
      if (
        !(target instanceof Element) ||
        (target.closest('button,a,input,select,textarea') &&
          !target.closest('[data-picodash-reorder-handle]'))
      )
        return
      event.preventDefault()
      event.stopPropagation()
      pickup.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        rect: group.getBoundingClientRect(),
        header,
        reordering: false,
      }
      header.setPointerCapture?.(event.pointerId)
    }
    const move = (event: PointerEvent) => {
      const p = pickup.current
      if (!p || p.pointerId !== event.pointerId || stateRef.current !== 'inline') return
      if (Math.abs(event.clientX - p.x) >= 48) {
        header.releasePointerCapture?.(event.pointerId)
        header.style.removeProperty('translate')
        callbacks.current.detach(event, p.rect, p)
        return
      }
      if (!p.reordering && Math.abs(event.clientY - p.y) >= 4) {
        p.reordering = true
        latest.current.props.reorder.begin(event, header)
      }
      if (p.reordering) latest.current.props.reorder.move(event)
      header.style.translate = `${(event.clientX - p.x) * 0.18}px 0`
    }
    const finish = (event: PointerEvent) => {
      const p = pickup.current
      if (!p || p.pointerId !== event.pointerId) return
      header.style.removeProperty('translate')
      if (stateRef.current === 'inline' && p.reordering) latest.current.props.reorder.end(event)
      pickup.current = null
    }
    const cancel = () => {
      if (!pickup.current) return
      latest.current.props.reorder.cancel()
      pickup.current = null
      header.style.removeProperty('translate')
      if (isDetaching(stateRef.current)) callbacks.current.returnHome(false)
    }
    const lost = () => {
      if (stateRef.current === 'inline') cancel()
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancel()
    }
    header.addEventListener('pointerdown', down, true)
    header.addEventListener('lostpointercapture', lost)
    win?.addEventListener('pointermove', move)
    win?.addEventListener('pointerup', finish)
    win?.addEventListener('pointercancel', cancel)
    win?.addEventListener('keydown', escape)
    return () => {
      header.removeEventListener('pointerdown', down, true)
      header.removeEventListener('lostpointercapture', lost)
      win?.removeEventListener('pointermove', move)
      win?.removeEventListener('pointerup', finish)
      win?.removeEventListener('pointercancel', cancel)
      win?.removeEventListener('keydown', escape)
      header.style.removeProperty('translate')
    }
  }, [groupRef])

  const transfer: DashPanelTransfer = {
    layoutNexus,
    returnLabel: `Return ${name} to stack`,
    returnIcon: <PictureInPicture aria-hidden="true" data-picodash-detach-icon />,
    returnHome: () => returnHome(),
    register(next) {
      driver.current = next
      const opening = pending.current
      if (opening) {
        pending.current = null
        next.place(opening.left, opening.top)
        if (opening.point)
          requestAnimationFrame(() => {
            if (stateRef.current !== 'detaching') return
            if (pickup.current) driver.current?.begin(opening.point!)
            else send('settle')
          })
      }
      if (focusOnOpen.current) {
        focusOnOpen.current = false
        requestAnimationFrame(show)
      }
      return () => {
        if (driver.current === next) driver.current = null
      }
    },
    pointer(phase, point) {
      if (phase === 'cancel') {
        if (isDetaching(stateRef.current)) returnHome(false)
        else send('cancel')
        return false
      }
      const stack = groupRef.current?.closest<HTMLElement>('[data-picodash-dashstack]')
      const rect = stack?.getBoundingClientRect()
      const margin = isReturnPreview(stateRef.current) ? 8 : 0
      const inside =
        !!rect &&
        !!rect.width &&
        !!rect.height &&
        point.clientX >= rect.left - margin &&
        point.clientX <= rect.right + margin &&
        point.clientY >= rect.top - margin &&
        point.clientY <= rect.bottom + margin &&
        !stack?.closest('[hidden],[inert]')
      // A pull begins inside its home. Arm return only after leaving it, so the
      // handoff does not immediately preview a return beneath the new Panel.
      const acceptsReturn = inside && stateRef.current !== 'detaching'
      if (phase === 'drop') {
        if (acceptsReturn) returnHome()
        else if (isDetaching(stateRef.current)) send('settle')
        else send('leave-home')
      } else send(inside ? 'enter-home' : 'leave-home')
      return acceptsReturn
    },
  }
  return (
    <>
      {container ? createPortal(children, container) : null}
      {actionsRef.current
        ? createPortal(
            <button
              type="button"
              disabled={!desktop && !detached}
              aria-label={detached ? `Show panel ${name}` : `Detach group ${name}`}
              onClick={() => (detached ? show() : detach())}
            >
              {detached ? (
                <AppWindowMac aria-hidden="true" data-picodash-detach-icon />
              ) : (
                <PictureInPicture2 aria-hidden="true" data-picodash-detach-icon />
              )}
            </button>,
            actionsRef.current,
          )
        : null}
      {detached ? (
        <DashPanelTransferBoundary transfer={transfer}>
          <DashPanel
            ref={panelRef}
            id={hostId}
            title={props.label}
            aria-label={name}
            width={Math.max(groupRef.current?.getBoundingClientRect().width ?? 320, 280)}
            defaultLayout={initialLayout}
            actionMenu={false}
          >
            <div ref={panelSlot} data-picodash-detached-group={id} />
          </DashPanel>
        </DashPanelTransferBoundary>
      ) : null}
    </>
  )
}
