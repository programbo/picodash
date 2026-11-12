import { createPicodashNexus } from '@picodash/nexus'
import { DashPanel, DashPanelProvider, type DashPanelProps } from '@picodash/dashpanel'
import {
  PicodashProvider,
  DashPanel as IntegratedPanel,
  DashList,
  Dashlet,
} from '@picodash/picodash'

export const nexus = createPicodashNexus({ valueOwner: 'nexus', fields: {} })
const panelProps = {
  id: 'standalone',
  title: 'Local standalone Panel',
  showSizeConstraintIndicator: true,
  minHeight: 200,
} satisfies DashPanelProps

export function ConsumerApp() {
  return (
    <>
      <DashPanelProvider nexus={nexus} providerId="standalone">
        <DashPanel
          {...panelProps}
          className="resize-edges-external resize-edges-parallel resize-corners-external"
        >
          <p>Standalone package content</p>
        </DashPanel>
      </DashPanelProvider>
      <PicodashProvider nexus={nexus} providerId="integrated">
        <IntegratedPanel
          id="integrated"
          title="Local integrated Panel"
          showSizeConstraintIndicator={false}
          minHeight={200}
        >
          <DashList>
            <Dashlet id="summary" label="Summary">
              <p>Integrated package content</p>
            </Dashlet>
          </DashList>
        </IntegratedPanel>
      </PicodashProvider>
    </>
  )
}
