import { useContext, useEffect, useRef, type RefObject } from 'react'
import type { ValueGesture, ValueGestureOptions, PicodashJsonValue } from '@picodash/nexus'
import { DashGroupAncestryContext } from './structure.js'

export type ValueGestureFactory<Value extends PicodashJsonValue> = (
  options?: ValueGestureOptions,
) => Omit<ValueGesture, 'update'> & { update(value: Value): ReturnType<ValueGesture['update']> }
export type NumericGestureFactory = ValueGestureFactory<number>
const editKeys = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'PageUp',
  'PageDown',
])

/** Pointer and held-key gestures share one owner; visual animation never enters this path. */
export function useValueControlGesture<Value extends PicodashJsonValue>({
  ref,
  createGesture,
  onChange,
  configuration,
  disabled,
}: {
  ref: RefObject<HTMLElement | null>
  createGesture: ValueGestureFactory<Value> | undefined
  onChange: (value: Value) => void
  configuration: string
  disabled: boolean
}) {
  const { visible } = useContext(DashGroupAncestryContext)
  const latest = useRef({ createGesture, onChange, disabled })
  latest.current = { createGesture, onChange, disabled }
  const state = useRef<{
    gesture?: ReturnType<ValueGestureFactory<Value>>
    held: boolean
    blocked: boolean
    ending: boolean
  }>({ held: false, blocked: false, ending: false })
  function begin(held: boolean) {
    const current = state.current
    if (latest.current.disabled || current.blocked) return
    current.held ||= held
    if (current.gesture?.active || !latest.current.createGesture) return
    current.gesture?.release()
    current.gesture = latest.current.createGesture({
      onEnd(event) {
        if (event.outcome === 'cancelled' && state.current.held) state.current.blocked = true
      },
    })
    current.gesture.begin()
  }
  function end() {
    const current = state.current
    current.ending = true
    queueMicrotask(() => {
      if (current.gesture?.active) current.gesture.commit()
      current.gesture?.release()
      current.gesture = undefined
      current.held = false
      current.blocked = false
      current.ending = false
    })
  }
  function cancel(reason: 'escape' | 'capture-lost' | 'hidden' | 'scale-changed' | 'removed') {
    const current = state.current
    if (current.gesture?.active) current.gesture.cancel(reason)
    current.gesture?.release()
    current.gesture = undefined
    current.blocked = current.held
  }
  useEffect(() => {
    if (!visible || disabled) cancel('hidden')
  }, [visible, disabled])
  useEffect(() => () => cancel('scale-changed'), [configuration])
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const document = element.ownerDocument
    const pointerDown = (event: PointerEvent) => {
      if (event.button === 0) {
        state.current.blocked = false
        begin(true)
      }
    }
    const keyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && state.current.gesture?.active) {
        event.preventDefault()
        event.stopPropagation()
        cancel('escape')
      } else if (editKeys.has(event.key)) {
        if (!event.repeat) state.current.blocked = false
        begin(true)
      }
    }
    const keyUp = (event: KeyboardEvent) => {
      if (editKeys.has(event.key)) end()
    }
    const pointerUp = () => {
      if (state.current.held) end()
    }
    const lost = () => {
      if (state.current.held && !state.current.ending) cancel('capture-lost')
    }
    const blur = (event: FocusEvent) => {
      if (!element.contains(event.relatedTarget as Node | null)) end()
    }
    element.addEventListener('pointerdown', pointerDown, true)
    element.addEventListener('keydown', keyDown, true)
    element.addEventListener('keyup', keyUp, true)
    element.addEventListener('focusout', blur)
    element.addEventListener('lostpointercapture', lost)
    document.addEventListener('pointerup', pointerUp, true)
    document.addEventListener('pointercancel', lost, true)
    return () => {
      element.removeEventListener('pointerdown', pointerDown, true)
      element.removeEventListener('keydown', keyDown, true)
      element.removeEventListener('keyup', keyUp, true)
      element.removeEventListener('focusout', blur)
      element.removeEventListener('lostpointercapture', lost)
      document.removeEventListener('pointerup', pointerUp, true)
      document.removeEventListener('pointercancel', lost, true)
      cancel('removed')
    }
  }, [ref])
  return (value: Value) => {
    const current = state.current
    if (latest.current.disabled || current.blocked) return
    // An external write synchronously revokes ownership before its queued onEnd callback.
    if (current.held && current.gesture && !current.gesture.active) {
      current.blocked = true
      return
    }
    begin(false)
    if (current.gesture) current.gesture.update(value)
    else latest.current.onChange(value)
    if (!current.held) end()
  }
}

export const useNumericControlGesture = useValueControlGesture
