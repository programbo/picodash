import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import '@picodash/ui/style.css'
import '@picodash/dashpanel/style.css'
import '@picodash/dashlist/style.css'
import '../style.css'

export const metadata: Metadata = {
  title: {
    default: 'Picodash alpha',
    template: '%s · Picodash',
  },
  description:
    'Picodash provides a typed Nexus plus standalone DashPanel and DashList packages for React applications.',
  icons: {
    icon: '/favicon.svg',
  },
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
