'use client'

import { useContext, useLayoutEffect, useRef, type ReactElement } from 'react'
import { DashListAnnouncementContext } from './bindings.js'

type PresentationWarningContext = Readonly<{
  readonly binding: Readonly<{ readonly controlId: string }>
}>

export function presentationWarningId(controlId: string): string {
  return `${controlId}-presentation-warning`
}

function currentActiveElement(ownerDocument: Document): Element | null {
  let activeElement = ownerDocument.activeElement
  const HTMLElementConstructor = ownerDocument.defaultView?.HTMLElement
  while (
    HTMLElementConstructor &&
    activeElement instanceof HTMLElementConstructor &&
    activeElement.shadowRoot?.activeElement
  )
    activeElement = activeElement.shadowRoot.activeElement
  return activeElement
}

function isLogicallyWithinDashlet(owner: HTMLElement, target: EventTarget | null): boolean {
  const NodeConstructor = owner.ownerDocument.defaultView?.Node
  if (!NodeConstructor || !(target instanceof NodeConstructor)) return false
  if (owner.contains(target as Node)) return true

  for (const controller of owner.querySelectorAll<HTMLElement>('[aria-controls]')) {
    for (const controlledId of (controller.getAttribute('aria-controls') ?? '').split(/\s+/)) {
      if (!controlledId) continue
      const controlled = owner.ownerDocument.getElementById(controlledId)
      if (controlled?.contains(target as Node)) return true
    }
  }
  return false
}

export function PresentationWarning({
  context,
  incompatible,
  message,
}: {
  readonly context: PresentationWarningContext
  readonly incompatible: boolean
  readonly message: string
}): ReactElement {
  const markerRef = useRef<HTMLDivElement>(null)
  const focusedWithin = useRef(false)
  const previousIncompatible = useRef(incompatible)
  const effectMounted = useRef(false)
  const publishAnnouncement = useContext(DashListAnnouncementContext)

  useLayoutEffect(() => {
    const owner = markerRef.current?.closest<HTMLElement>('[data-picodash-dashlet]')
    if (!owner) return
    const ownerDocument = owner.ownerDocument
    const syncCurrentFocus = () => {
      focusedWithin.current = isLogicallyWithinDashlet(owner, currentActiveElement(ownerDocument))
    }
    const handleFocusIn = (event: FocusEvent) => {
      const target = event.composedPath()[0] ?? event.target
      focusedWithin.current = isLogicallyWithinDashlet(owner, target)
    }
    const handleFocusOut = () => {
      // Preserve focus ownership through the commit that replaces an incompatible control. A
      // normal blur settles before a later render, while removal during this commit settles after
      // the transition announcement has observed the prior logical focus.
      queueMicrotask(syncCurrentFocus)
    }
    const handleWindowBlur = () => {
      focusedWithin.current = false
    }

    syncCurrentFocus()
    ownerDocument.addEventListener('focusin', handleFocusIn, true)
    ownerDocument.addEventListener('focusout', handleFocusOut, true)
    ownerDocument.defaultView?.addEventListener('blur', handleWindowBlur)
    return () => {
      ownerDocument.removeEventListener('focusin', handleFocusIn, true)
      ownerDocument.removeEventListener('focusout', handleFocusOut, true)
      ownerDocument.defaultView?.removeEventListener('blur', handleWindowBlur)
    }
  }, [])

  useLayoutEffect(() => {
    if (!effectMounted.current) {
      effectMounted.current = true
      previousIncompatible.current = incompatible
      return
    }

    const introduced = !previousIncompatible.current && incompatible
    previousIncompatible.current = incompatible
    if (introduced && focusedWithin.current) publishAnnouncement(message)
  }, [incompatible, message, publishAnnouncement])

  return (
    <div
      ref={markerRef}
      hidden={!incompatible}
      id={incompatible ? presentationWarningId(context.binding.controlId) : undefined}
      data-picodash-dashlet-presentation-warning={incompatible || undefined}
      data-code={incompatible ? 'presentation_incompatible' : undefined}
      role={incompatible ? 'note' : undefined}
    >
      {incompatible ? message : null}
    </div>
  )
}
