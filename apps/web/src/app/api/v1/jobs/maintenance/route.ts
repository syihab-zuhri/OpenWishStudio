import { type NextRequest } from 'next/server'
import { ok, serverError, unauthorized } from '@/lib/api/response'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return serverError('Maintenance job belum dikonfigurasi.')
  if (request.headers.get('authorization') !== `Bearer ${secret}`) return unauthorized()

  const service = await createSupabaseServiceClient()
  const { data: staleAssets, error: cleanupError } = await service.rpc(
    'cleanup_stale_pending_assets',
    { p_older_than_seconds: 86_400 },
  )
  if (cleanupError) {
    console.error('GET /api/v1/jobs/maintenance asset cleanup:', cleanupError.message)
    return serverError()
  }

  const keys = staleAssets.map((asset) => asset.object_key)
  const [storageResult, expiryResult, rateLimitResult] = await Promise.all([
    keys.length > 0
      ? service.storage.from('assets').remove(keys)
      : Promise.resolve({ data: [], error: null }),
    service.rpc('expire_publications', { p_owner_id: null }),
    service.rpc('prune_rate_limits', { p_older_than_seconds: 86_400 }),
  ])

  if (storageResult.error || expiryResult.error || rateLimitResult.error) {
    console.error(
      'GET /api/v1/jobs/maintenance:',
      storageResult.error?.message ?? expiryResult.error?.message ?? rateLimitResult.error?.message,
    )
    return serverError()
  }

  return ok({
    staleAssetsRemoved: keys.length,
    publicationsExpired: expiryResult.data,
    rateLimitsPruned: rateLimitResult.data,
  })
}
