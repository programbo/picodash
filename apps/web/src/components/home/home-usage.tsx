'use client'

import { UsageGuide } from '@/components/docs/usage-guide'
import { HomeFrame, HomeTextToolbar } from '@/components/home/home-frame'

export function HomeUsage() {
  return (
    <HomeFrame activeTab="usage" toolbar={<HomeTextToolbar />}>
      <UsageGuide />
    </HomeFrame>
  )
}
