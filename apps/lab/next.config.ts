import path from 'node:path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(import.meta.dirname, '../..'),
  transpilePackages: ['@picodash/panel'],
  turbopack: {
    root: path.join(import.meta.dirname, '../..'),
  },
}

export default nextConfig
