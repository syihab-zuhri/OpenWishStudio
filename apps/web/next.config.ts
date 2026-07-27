import type { NextConfig } from 'next'

// Derive the exact storage host instead of trusting every *.supabase.co project.
// A wildcard there lets anyone with a free Supabase project push arbitrary bytes
// through this app's image optimizer and cache them under our domain.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : undefined
const supabaseHost = supabaseUrl ? new URL(supabaseUrl).hostname : undefined
const supabaseProtocol = supabaseUrl
  ? (new URL(supabaseUrl).protocol.slice(0, -1) as 'http' | 'https')
  : undefined
const supabaseSocketOrigin = supabaseOrigin?.replace(/^http/, 'ws')
const isProduction = process.env.NODE_ENV === 'production'
const externalMediaSources = isProduction ? 'https:' : 'https: http:'

const csp = [
  "default-src 'self'",
  // TODO: Next.js inlines its bootstrap/hydration scripts. Tightening this to
  // 'nonce-<value>' requires generating a per-request nonce in middleware.
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${externalMediaSources}`,
  `media-src 'self' blob: ${externalMediaSources}`,
  "font-src 'self' data:",
  `connect-src 'self'${supabaseOrigin ? ` ${supabaseOrigin} ${supabaseSocketOrigin}` : ''}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  ...(isProduction ? ['upgrade-insecure-requests'] : []),
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  ...(isProduction
    ? [
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=63072000; includeSubDomains; preload',
        },
      ]
    : []),
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
]

const nextConfig: NextConfig = {
  typedRoutes: true,
  poweredByHeader: false,
  images: {
    remotePatterns:
      supabaseHost && supabaseProtocol
        ? [
            {
              protocol: supabaseProtocol,
              hostname: supabaseHost,
              pathname: '/storage/v1/object/public/**',
            },
          ]
        : [],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
