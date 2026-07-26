import { type NextRequest } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import { tooManyRequests } from './response'

/**
 * Best-effort client IP.
 *
 * `x-forwarded-for` is client-controlled up to the point a trusted proxy
 * appends to it, so the leftmost entry is spoofable. On Vercel,
 * `x-vercel-forwarded-for` and `x-real-ip` are set by the platform and cannot
 * be forged by the client; those are preferred. The fallback takes the
 * *rightmost* XFF entry, which is the one nearest our infrastructure.
 */
export function clientIp(request: NextRequest): string {
  const vercelForwarded = request.headers.get('x-vercel-forwarded-for')
  if (vercelForwarded) return vercelForwarded.split(',')[0]!.trim()

  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp.trim()

  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const parts = forwarded
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
    if (parts.length > 0) return parts[parts.length - 1]!
  }

  return 'unknown'
}

export interface RateLimitRule {
  /** Stable name for the endpoint, e.g. 'reports'. */
  name: string
  /** Requests allowed per window. */
  max: number
  /** Window length in seconds. */
  windowSeconds: number
}

/**
 * Applies `rule` to `identity` and returns a 429 response when the budget is
 * spent, or null when the caller may proceed.
 *
 * Fails **open**: if the counter cannot be reached the request is allowed
 * through. A rate limiter that takes the whole site down when the database
 * hiccups is worse than one that occasionally lets a burst past — the endpoints
 * behind it all have their own authentication and validation.
 */
export async function enforceRateLimit(
  rule: RateLimitRule,
  identity: string,
): Promise<Response | null> {
  const bucket = `${rule.name}:${identity}`

  try {
    const serviceClient = await createSupabaseServiceClient()
    const { data, error } = await serviceClient.rpc('check_rate_limit', {
      p_bucket: bucket,
      p_max: rule.max,
      p_window_seconds: rule.windowSeconds,
    })

    if (error) {
      console.error('enforceRateLimit:', error.message)
      return null
    }

    if (data === false) {
      return tooManyRequests(rule.windowSeconds)
    }

    return null
  } catch (err) {
    console.error('enforceRateLimit:', err)
    return null
  }
}

/** Rate limits by authenticated user id. */
export function byUser(userId: string): string {
  return `user:${userId}`
}

/** Rate limits by client IP, for endpoints reachable without a session. */
export function byIp(request: NextRequest): string {
  return `ip:${clientIp(request)}`
}
