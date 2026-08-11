import { act, type ReactNode } from 'react'

interface ReactRoot {
  render(children: ReactNode): void
}

export async function renderReactRoot(root: ReactRoot, element: ReactNode) {
  await act(async () => {
    root.render(element)
  })
}

export async function clickElement(element: HTMLElement) {
  await act(async () => {
    element.click()
  })
}

export async function dispatchElement(element: HTMLElement, event: Event) {
  await act(async () => {
    element.dispatchEvent(event)
  })
}
