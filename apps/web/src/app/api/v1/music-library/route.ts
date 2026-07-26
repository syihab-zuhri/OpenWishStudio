import { type NextRequest } from 'next/server'
import { ok, serverError, badRequest } from '@/lib/api/response'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient()

  const { searchParams } = new URL(request.url)
  const cursor = searchParams.get('cursor')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '24', 10), 50)
  const q = searchParams.get('q')?.trim()

  let query = supabase
    .from('music_library_items')
    .select('id, title, artist, duration_ms, license_code, license_url, attribution_text, created_at')
    .eq('status', 'active')
    .order('id', { ascending: true })
    .limit(limit + 1)

  if (q) {
    // `q` is interpolated into PostgREST's filter DSL, where a comma or paren
    // would let the caller append filters to the OR group.
    const safeQ = q.replace(/[,.()\\%_*]/g, '').slice(0, 100)
    if (safeQ) {
      query = query.or(`title.ilike.%${safeQ}%,artist.ilike.%${safeQ}%`)
    }
  }

  if (cursor) {
    try {
      const { id } = JSON.parse(atob(cursor)) as { id: string }
      if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) {
        return badRequest('Cursor tidak valid.')
      }
      query = query.gt('id', id)
    } catch {
      return badRequest('Cursor tidak valid.')
    }
  }

  const { data, error } = await query

  if (error) {
    console.error('GET /api/v1/music-library:', error.message)
    return serverError()
  }

  const hasMore = data.length > limit
  const items = hasMore ? data.slice(0, limit) : data

  let nextCursor: string | null = null
  if (hasMore) {
    const last = items[items.length - 1]
    nextCursor = btoa(JSON.stringify({ id: last.id }))
  }

  return ok({ items, cursor: nextCursor })
}
