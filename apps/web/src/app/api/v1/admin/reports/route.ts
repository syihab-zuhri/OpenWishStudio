import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireModerator } from '@/lib/api/auth'
import { ok, serverError, badRequest } from '@/lib/api/response'

const CursorSchema = z.object({
  created_at: z.string().datetime({ offset: true }),
  id: z.string().uuid(),
})

export async function GET(request: NextRequest) {
  const { serviceClient, error } = await requireModerator()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const cursor = searchParams.get('cursor')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50)
  const status = (searchParams.get('status') ?? 'open') as
    | 'open'
    | 'reviewing'
    | 'actioned'
    | 'rejected'

  let query = serviceClient!
    .from('reports')
    .select('id, published_page_id, reason, details, status, resolution_note, created_at')
    .eq('status', status)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(limit + 1)

  if (cursor) {
    // Interpolated into a PostgREST filter expression, so shape-check first.
    let decoded: z.infer<typeof CursorSchema>
    try {
      decoded = CursorSchema.parse(JSON.parse(atob(cursor)))
    } catch {
      return badRequest('Cursor tidak valid.')
    }
    query = query.or(
      `created_at.gt.${decoded.created_at},and(created_at.eq.${decoded.created_at},id.gt.${decoded.id})`,
    )
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
