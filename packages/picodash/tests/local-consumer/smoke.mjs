import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { act, createElement } from 'react'

const dom = new JSDOM('<div id="root"></div>', {
  url: 'https://consumer.example/',
  pretendToBeVisual: true,
})
const { window } = dom
for (const name of [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'Element',
  'Node',
  'NodeFilter',
  'Document',
  'SVGElement',
  'MutationObserver',
  'Event',
  'EventTarget',
  'CustomEvent',
  'KeyboardEvent',
  'MouseEvent',
  'DOMRect',
  'AbortController',
  'AbortSignal',
]) {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    value: name === 'window' ? window : window[name],
  })
}
Object.assign(globalThis, {
  IS_REACT_ACT_ENVIRONMENT: true,
  getComputedStyle: window.getComputedStyle.bind(window),
  requestAnimationFrame: window.requestAnimationFrame.bind(window),
  cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
  CSS: { escape: (value) => value },
})
Object.defineProperty(window, 'matchMedia', {
  value: (media) => ({
    media,
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }),
})
const { createRoot } = await import('react-dom/client')
const { ConsumerApp, nexus } = await import('./app.tsx')
const host = window.document.getElementById('root')
if (!host) throw new Error('Missing consumer host.')
const root = createRoot(host)
try {
  await act(async () => {
    root.render(createElement(ConsumerApp))
  })
  const panels = Array.from(window.document.querySelectorAll('[data-picodash-panel]'))
  assert.equal(panels.length, 2)
  const standalone = panels.find((panel) =>
    panel.textContent?.includes('Standalone package content'),
  )
  const indicator = standalone?.querySelector('[data-picodash-panel-size-limit]')
  assert.ok(indicator, 'The opted-in packaged Panel should show its active constraint.')
  assert.equal(
    standalone?.querySelector('[aria-label="Actions for Local standalone Panel"]')
      ?.previousElementSibling,
    indicator,
  )
  assert.equal(window.document.querySelectorAll('[data-picodash-panel-size-limit]').length, 1)
  assert.ok(window.document.body.textContent?.includes('Standalone package content'))
  assert.ok(window.document.body.textContent?.includes('Integrated package content'))
  const owner = await import('@picodash/dashpanel')
  const facade = await import('@picodash/picodash')
  assert.equal(facade.DashPanel, owner.DashPanel)
  console.log('Installed standalone and integrated package compositions mounted successfully.')
} finally {
  await act(async () => {
    root.unmount()
  })
  nexus.destroy()
  window.close()
}
