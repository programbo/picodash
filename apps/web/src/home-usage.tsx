'use client'

import { HomeFrame, HomeTextToolbar } from '@/home-frame'
import { UsageGuide } from '@/usage-guide'

export function HomeUsage() {
  return (
    <HomeFrame activeTab="usage" toolbar={<HomeTextToolbar />}>
      <UsageGuide />
    </HomeFrame>
  )
}
