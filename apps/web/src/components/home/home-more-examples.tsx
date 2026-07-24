'use client'

import { MoreExamples } from '@/components/docs/more-examples'
import { HomeFrame, HomeTextToolbar } from '@/components/home/home-frame'

export function HomeMoreExamples() {
  return (
    <HomeFrame activeTab="more-examples" toolbar={<HomeTextToolbar />}>
      <MoreExamples />
    </HomeFrame>
  )
}
