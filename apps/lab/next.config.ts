import path from 'node:path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  agentRules: false,
  outputFileTracingRoot: path.join(import.meta.dirname, '../..'),
  transpilePackages: [
    '@picodash/dashlist',
    '@picodash/dashpanel',
    '@picodash/picodash',
    '@picodash/store',
    '@picodash/theme',
  ],
  turbopack: {
    root: path.join(import.meta.dirname, '../..'),
  },
}

export default nextConfig
