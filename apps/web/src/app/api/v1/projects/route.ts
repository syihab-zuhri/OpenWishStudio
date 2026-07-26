import { type NextRequest } from 'next/server'
import { requireAuth } from '@/lib/api/auth'
import { ok, created, serverError, unprocessable, badRequest } from '@/lib/api/response'
import { createDefaultDocument } from '@openwish/project-schema'

export async function GET(request: NextRequest) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const cursor = searchParams.get('cursor')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '24', 10), 50)
  const search = searchParams.get('q')?.trim() ?? ''

  let query = supabase
    .from('projects')
    .select('id, name, status, draft_document, updated_at, created_at')
    .eq('owner_id', user!.id)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1)

  if (search) {
    query = query.ilike('name', `%${search}%`)
  }

  if (cursor) {
    // cursor = base64(JSON.stringify({ updated_at, id }))
    try {
      const { updated_at, id } = JSON.parse(atob(cursor)) as { updated_at: string; id: string }
      query = query.or(
        `updated_at.lt.${updated_at},and(updated_at.eq.${updated_at},id.lt.${id})`,
      )
    } catch {
      return badRequest('Cursor tidak valid.')
    }
  }

  const { data, error: dbError } = await query

  if (dbError) {
    console.error('GET /api/v1/projects:', dbError.message)
    return serverError()
  }

  const hasMore = data.length > limit
  const items = hasMore ? data.slice(0, limit) : data

  let nextCursor: string | null = null
  if (hasMore) {
    const last = items[items.length - 1]
    nextCursor = btoa(JSON.stringify({ updated_at: last.updated_at, id: last.id }))
  }

  return ok({ items, cursor: nextCursor })
}

export async function POST(request: NextRequest) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  let body: { name?: string; document?: unknown }
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const name = (body.name as string | undefined)?.trim() || 'Kreasi Baru'
  if (name.length > 120) {
    return unprocessable('Nama kreasi terlalu panjang (maks. 120 karakter).')
  }

  const rawDocument = body.document ?? JSON.parse(JSON.stringify(createDefaultDocument(name)))

  const { data: project, error: dbError } = await supabase
    .from('projects')
    .insert({
      name,
      owner_id: user!.id,
      created_by: user!.id,
      draft_document: rawDocument as never,
      schema_version: 1,
    })
    .select('id, name, status, updated_at, created_at')
    .single()

  if (dbError || !project) {
    console.error('POST /api/v1/projects:', dbError?.message)
    return serverError()
  }

  return created({ project })
}
