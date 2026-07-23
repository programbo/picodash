'use client'

import { useSearchParams } from 'next/navigation'
import type { ReactNode } from 'react'
import { DemoProvider, type DemoThemes } from '@/demo-provider'

export function GalleryProvider({ children }: Readonly<{ children: ReactNode }>) {
  const searchParams = useSearchParams()

  return (
    <DemoProvider initialThemes={themesFromSearchParams(searchParams)}>{children}</DemoProvider>
  )
}

function themesFromSearchParams(searchParams: ReturnType<typeof useSearchParams>) {
  return {
    custom: searchParams.get('customTheme') ?? undefined,
    provider: searchParams.get('providerTheme') ?? undefined,
    scene: searchParams.get('sceneTheme') ?? undefined,
  } satisfies DemoThemes
}
