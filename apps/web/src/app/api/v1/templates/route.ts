import { type NextRequest } from 'next/server'
import { ok, serverError, badRequest } from '@/lib/api/response'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient()

  const { searchParams } = new URL(request.url)
  const cursor = searchParams.get('cursor')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50)
  const category = searchParams.get('category')?.trim()
  const q = searchParams.get('q')?.trim()

  let query = supabase
    .from('templates')
    .select('id, slug, name, category, thumbnail_url, schema_version, updated_at')
    .eq('status', 'published' as never)
    .order('id', { ascending: true })
    .limit(limit + 1)

  if (category) {
    query = query.eq('category', category)
  }

  if (q) {
    query = query.ilike('name', `%${q}%`)
  }

  if (cursor) {
    try {
      const { id } = JSON.parse(atob(cursor)) as { id: string }
      query = query.gt('id', id)
    } catch {
      return badRequest('Cursor tidak valid.')
    }
  }

  const { data, error } = await query

  if (error) {
    console.error('GET /api/v1/templates:', error.message)
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
