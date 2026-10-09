import { useEffect, type RefObject } from 'react'
import { classifyNodeId } from './node-registration.js'
import type { PicodashFieldDefinitions, ScopedNexus } from '@picodash/nexus'

/** Each mounted shell owns one source; profile sources never overwrite these flags. */
export function useItemAttention(
  scope: ScopedNexus<PicodashFieldDefinitions> | null | undefined,
  id: string,
  ref: RefObject<HTMLElement | null>,
  visible: boolean,
) {
  useEffect(() => {
    const node = ref.current
    // The declaration registry owns invalid-ID diagnostics. Do not mask its error.
    if (!scope || !node || !visible || classifyNodeId(id)) return
    const source = scope.createItemInteractionSource(id)
    const enter = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') source.set({ hovered: true })
    }
    const leave = () => source.set({ hovered: false })
    const focus = () => source.set({ focused: true })
    const blur = (event: FocusEvent) => {
      if (!node.contains(event.relatedTarget as Node | null))
        source.set({ focused: false, active: false })
    }
    const down = (event: PointerEvent) => {
      if (event.button === 0) source.set({ active: true })
    }
    const up = () => source.set({ active: false })
    const keydown = (event: KeyboardEvent) => {
      if (
        [
          'ArrowLeft',
          'ArrowRight',
          'ArrowUp',
          'ArrowDown',
          'Home',
          'End',
          'PageUp',
          'PageDown',
          'Enter',
          ' ',
        ].includes(event.key)
      )
        source.set({ active: true })
    }
    node.addEventListener('pointerenter', enter)
    node.addEventListener('pointerleave', leave)
    node.addEventListener('focusin', focus)
    node.addEventListener('focusout', blur)
    node.addEventListener('pointerdown', down)
    node.addEventListener('keydown', keydown)
    node.addEventListener('keyup', up)
    node.ownerDocument.addEventListener('pointerup', up)
    node.ownerDocument.addEventListener('pointercancel', up)
    return () => {
      node.removeEventListener('pointerenter', enter)
      node.removeEventListener('pointerleave', leave)
      node.removeEventListener('focusin', focus)
      node.removeEventListener('focusout', blur)
      node.removeEventListener('pointerdown', down)
      node.removeEventListener('keydown', keydown)
      node.removeEventListener('keyup', up)
      node.ownerDocument.removeEventListener('pointerup', up)
      node.ownerDocument.removeEventListener('pointercancel', up)
      source.release()
    }
  }, [scope, id, ref, visible])
}
