import { type NextRequest } from 'next/server'
import { requireAuth } from '@/lib/api/auth'
import { ok, serverError, badRequest } from '@/lib/api/response'

export async function GET(request: NextRequest) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const cursor = searchParams.get('cursor')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '24', 10), 50)
  const projectId = searchParams.get('projectId')
  const kind = searchParams.get('kind') as 'image' | 'audio' | null

  let query = supabase
    .from('assets')
    .select('id, original_name, size_bytes, mime_type, kind, status, storage_key, project_id, created_at')
    .eq('owner_id', user!.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1)

  if (projectId) {
    query = query.eq('project_id', projectId)
  }

  if (kind === 'image' || kind === 'audio') {
    query = query.eq('kind', kind)
  }

  if (cursor) {
    try {
      const { created_at, id } = JSON.parse(atob(cursor)) as { created_at: string; id: string }
      query = query.or(`created_at.lt.${created_at},and(created_at.eq.${created_at},id.lt.${id})`)
    } catch {
      return badRequest('Cursor tidak valid.')
    }
  }

  const { data, error: dbError } = await query

  if (dbError) {
    console.error('GET /api/v1/assets:', dbError.message)
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
