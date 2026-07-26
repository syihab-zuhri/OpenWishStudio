import type { NextConfig } from 'next'

// Derive the exact storage host instead of trusting every *.supabase.co project.
// A wildcard there lets anyone with a free Supabase project push arbitrary bytes
// through this app's image optimizer and cache them under our domain.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseHost = supabaseUrl ? new URL(supabaseUrl).hostname : undefined

const csp = [
  "default-src 'self'",
  // TODO: Next.js inlines its bootstrap/hydration scripts. Tightening this to
  // 'nonce-<value>' requires generating a per-request nonce in middleware.
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${supabaseHost ? ` https://${supabaseHost}` : ''}`,
  `media-src 'self' blob:${supabaseHost ? ` https://${supabaseHost}` : ''}`,
  "font-src 'self' data:",
  `connect-src 'self'${supabaseHost ? ` https://${supabaseHost} wss://${supabaseHost}` : ''}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  'upgrade-insecure-requests',
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
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
    remotePatterns: supabaseHost
      ? [
          {
            protocol: 'https',
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
