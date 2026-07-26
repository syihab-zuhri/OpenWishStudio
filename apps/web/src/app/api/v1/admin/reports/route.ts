import { type NextRequest } from 'next/server'
import { requireAuth } from '@/lib/api/auth'
import { ok, serverError, badRequest } from '@/lib/api/response'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

async function requireModerator(
  userId: string,
  serviceClient: Awaited<ReturnType<typeof createSupabaseServiceClient>>,
) {
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  return profile?.role === 'moderator' || profile?.role === 'admin'
}

export async function GET(request: NextRequest) {
  const { user, error } = await requireAuth()
  if (error) return error

  const serviceClient = await createSupabaseServiceClient()

  const isMod = await requireModerator(user!.id, serviceClient)
  if (!isMod) {
    return ok({ error: 'Akses moderator diperlukan.' }, 403)
  }

  const { searchParams } = new URL(request.url)
  const cursor = searchParams.get('cursor')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50)
  const status = (searchParams.get('status') ?? 'open') as
    | 'open'
    | 'reviewing'
    | 'actioned'
    | 'rejected'

  let query = serviceClient
    .from('reports')
    .select('id, published_page_id, reason, details, status, resolution_note, created_at')
    .eq('status', status)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(limit + 1)

  if (cursor) {
    try {
      const { created_at, id } = JSON.parse(atob(cursor)) as { created_at: string; id: string }
      query = query.or(`created_at.gt.${created_at},and(created_at.eq.${created_at},id.gt.${id})`)
    } catch {
      return badRequest('Cursor tidak valid.')
    }
  }

  const { data, error: dbError } = await query

  if (dbError) {
    console.error('GET /api/v1/admin/reports:', dbError.message)
    return serverError()
  }

  const hasMore = data.length > limit
  const items = hasMore ? data.slice(0, limit) : data

  let nextCursor: string | null = null
  if (hasMore) {
    const last = items[items.length - 1]
    nextCursor = btoa(JSON.stringify({ created_at: last.created_at, id: last.id }))
  }

  return ok({ items, cursor: nextCursor })
}
