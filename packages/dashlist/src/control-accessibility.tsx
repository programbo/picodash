'use client'

import { useId, useRef, type ReactNode, type RefObject } from 'react'
import { VisuallyHidden } from 'react-aria-components'
import { useDashletPrimaryFocusTarget } from './primary-focus.js'

export function joinDescriptionIds(...ids: readonly (string | undefined)[]): string | undefined {
  const present = ids.filter((id): id is string => Boolean(id))
  return present.length > 0 ? present.join(' ') : undefined
}

export function usePrimaryControlRef<TElement extends HTMLElement>(): RefObject<TElement | null> {
  const ref = useRef<TElement>(null)
  useDashletPrimaryFocusTarget(ref)
  return ref
}

export function useReadOnlyDescription(
  readOnly: boolean | undefined,
  describedBy: string | undefined,
): {
  readonly describedBy: string | undefined
  readonly description: ReactNode
} {
  const id = useId()
  return {
    describedBy: readOnly ? joinDescriptionIds(describedBy, id) : describedBy,
    description: readOnly ? <VisuallyHidden id={id}>Read only.</VisuallyHidden> : null,
  }
}
