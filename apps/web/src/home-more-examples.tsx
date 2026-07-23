'use client'

import { HomeFrame, HomeTextToolbar } from '@/home-frame'
import { MoreExamples } from '@/more-examples'

export function HomeMoreExamples() {
  return (
    <HomeFrame activeTab="more-examples" toolbar={<HomeTextToolbar />}>
      <MoreExamples />
    </HomeFrame>
  )
}
