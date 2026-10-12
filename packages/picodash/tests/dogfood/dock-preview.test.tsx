// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it } from 'vite-plus/test'
import { DockPreviewReadout } from './DockPreview.js'
import { createPicodashNexus } from '@picodash/nexus'
import { DashPanel, DashPanelProvider } from '@picodash/dashpanel'

it('consumes typed dock observations without replacing committed placement', () => {
  const nexus = createPicodashNexus({ valueOwner: 'nexus', fields: { count: { defaultValue: 0 } } })
  function App() {
    const [mounted, setMounted] = useState(true)
    return (
      <DashPanelProvider nexus={nexus}>
        <DockPreviewReadout panelId="tools" />
        <button onClick={() => setMounted(!mounted)}>Toggle tools</button>
        {mounted ? (
          <DashPanel
            id="tools"
            title="Tools"
            defaultLayout={{ placement: { mode: 'hybrid', disposition: { kind: 'free' } } }}
          >
            <p>Application content</p>
          </DashPanel>
        ) : null}
      </DashPanelProvider>
    )
  }
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  try {
    act(() => root.render(<App />))
    const readout = () => host.querySelector('output')?.textContent
    expect(readout()).toBe('available')
    expect(host.querySelector('output')?.getAttribute('data-drag-state')).toBe('idle')
    expect(nexus.getState().scopes.get('tools')?.dashPanel).toBeUndefined()
    act(() => host.querySelector('button')!.click())
    expect(readout()).toBe('unavailable')
    act(() => host.querySelector('button')!.click())
    expect(readout()).toBe('available')
    expect(host.querySelector('output')?.getAttribute('data-drag-state')).toBe('idle')
    expect(nexus.getState().scopes.get('tools')?.dashPanel).toBeUndefined()
  } finally {
    act(() => root.unmount())
    host.remove()
    nexus.destroy()
  }
})
