import { describe, it, expect } from 'vitest'
import type { NextRequest } from 'next/server'
import { clientIp } from './rate-limit'

function req(headers: Record<string, string>): NextRequest {
  return {
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
  } as unknown as NextRequest
}

describe('clientIp', () => {
  it('prefers the platform header a client cannot forge', () => {
    const r = req({
      'x-vercel-forwarded-for': '203.0.113.9',
      // A client can put anything here; it must not win.
      'x-forwarded-for': '10.0.0.1, 198.51.100.7',
      'x-real-ip': '198.51.100.7',
    })
    expect(clientIp(r)).toBe('203.0.113.9')
  })

  it('falls back to x-real-ip when the platform header is absent', () => {
    expect(clientIp(req({ 'x-real-ip': '198.51.100.7' }))).toBe('198.51.100.7')
  })

  it('takes the rightmost x-forwarded-for entry, not the spoofable leftmost', () => {
    // An attacker sends "x-forwarded-for: 1.2.3.4"; the proxy appends the real
    // peer, so the trustworthy value is the last one.
    const r = req({ 'x-forwarded-for': '1.2.3.4, 203.0.113.9' })
    expect(clientIp(r)).toBe('203.0.113.9')
  })

  it('handles a single-entry x-forwarded-for', () => {
    expect(clientIp(req({ 'x-forwarded-for': '203.0.113.9' }))).toBe('203.0.113.9')
  })

  it('tolerates whitespace and empty segments', () => {
    expect(clientIp(req({ 'x-forwarded-for': ' 1.2.3.4 ,  , 203.0.113.9 ' }))).toBe('203.0.113.9')
  })

  it('degrades to a constant when no header identifies the caller', () => {
    // Everyone shares one bucket here, which is deliberately conservative.
    expect(clientIp(req({}))).toBe('unknown')
  })
})
