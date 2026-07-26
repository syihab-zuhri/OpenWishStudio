import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/api/auth'
import { ok, serverError, badRequest } from '@/lib/api/response'
import { storagePublicUrl } from '@/lib/storage-url'

const CursorSchema = z.object({
  created_at: z.string().datetime({ offset: true }),
  id: z.string().uuid(),
})

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
    .select(
      'id, original_name, size_bytes, mime_type, kind, status, storage_key, project_id, created_at',
    )
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
    // Interpolated into a PostgREST filter expression, so shape-check first.
    let decoded: z.infer<typeof CursorSchema>
    try {
      decoded = CursorSchema.parse(JSON.parse(atob(cursor)))
    } catch {
      return badRequest('Cursor tidak valid.')
    }
    query = query.or(
      `created_at.lt.${decoded.created_at},and(created_at.eq.${decoded.created_at},id.lt.${decoded.id})`,
    )
  }

  const { data, error: dbError } = await query

  if (dbError) {
    console.error('GET /api/v1/assets:', dbError.message)
    return serverError()
  }

  const hasMore = data.length > limit
  const page = hasMore ? data.slice(0, limit) : data

  const items = page.map((asset) => ({
    ...asset,
    url: storagePublicUrl('assets', asset.storage_key),
  }))

  let nextCursor: string | null = null
  if (hasMore) {
    const last = items[items.length - 1]
    nextCursor = btoa(JSON.stringify({ created_at: last.created_at, id: last.id }))
  }

  return ok({ items, cursor: nextCursor })
}
