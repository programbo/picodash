'use client'
import { DashPanel, DashStack, DashGroup, Dashlet, PicodashProvider } from '@picodash/picodash'
import { createSettings } from './Shortcuts.js'

export function ContextualControls({ nexus }: { nexus: ReturnType<typeof createSettings> }) {
  return (
    <PicodashProvider nexus={nexus}>
      {['Geometry', 'Output'].map((name) => (
        <DashPanel
          key={name}
          id={name}
          title={name}
          collapsible={false}
          showCloseButton
          recordableHotkey
        >
          <DashStack id={`${name}-stack`}>
            <DashGroup id="tools" label={`${name} tools`} detachable recordableHotkey>
              <Dashlet id="draft" label="Draft">
                <input aria-label={`${name} draft`} defaultValue="Example" />
              </Dashlet>
            </DashGroup>
          </DashStack>
        </DashPanel>
      ))}
    </PicodashProvider>
  )
}
