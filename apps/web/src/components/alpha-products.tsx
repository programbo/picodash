'use client'

import { useState } from 'react'
import { createPicodashNexus } from '@picodash/nexus'
import { DashHeader } from '@picodash/ui'
import { DashPanel, DashPanelProvider } from '@picodash/dashpanel'
import { DashGroup, Dashlet, DashList } from '@picodash/dashlist'

export function AlphaProducts() {
  const [panelNexus] = useState(() => createPicodashNexus({ valueOwner: 'nexus', fields: {} }))
  const [listNexus] = useState(() => createPicodashNexus({ valueOwner: 'nexus', fields: {} }))
  const [panelPortalContainer, setPanelPortalContainer] = useState<HTMLDivElement | null>(null)

  return (
    <div className="alpha-product-grid">
      <article className="alpha-product-card" data-alpha-product="dashpanel">
        <div ref={setPanelPortalContainer} className="alpha-product-demo alpha-panel-demo">
          {panelPortalContainer ? (
            <DashPanelProvider
              nexus={panelNexus}
              providerId="alpha-panel"
              boundary={panelPortalContainer}
              portalContainer={panelPortalContainer}
              theme="dark"
            >
              <DashPanel id="alpha-panel" title="DashPanel">
                <DashHeader slots={{ title: <span>Panel content</span> }} />
                <p>Arbitrary React content renders inside this Panel.</p>
              </DashPanel>
            </DashPanelProvider>
          ) : null}
        </div>
      </article>

      <article className="alpha-product-card" data-alpha-product="dashlist">
        <div className="alpha-product-demo alpha-list-demo">
          <DashList nexus={listNexus} id="alpha-list" title="DashList" headingLevel={2}>
            <DashGroup id="alpha-group" label="First group">
              <Dashlet id="alpha-dashlet" label="Named Dashlet">
                <p>Dashlet content is composed directly in the List.</p>
              </Dashlet>
            </DashGroup>
          </DashList>
        </div>
      </article>
    </div>
  )
}
