import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/api/auth'
import { ok, created, serverError, unprocessable, badRequest } from '@/lib/api/response'
import { createDefaultDocument, ProjectDocumentSchema } from '@openwish/project-schema'

const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024

const CursorSchema = z.object({
  updated_at: z.string().datetime({ offset: true }),
  id: z.string().uuid(),
})

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
    // Values are interpolated into a PostgREST filter expression, so they are
    // shape-checked before use rather than trusted as decoded.
    let decoded: z.infer<typeof CursorSchema>
    try {
      decoded = CursorSchema.parse(JSON.parse(atob(cursor)))
    } catch {
      return badRequest('Cursor tidak valid.')
    }
    query = query.or(
      `updated_at.lt.${decoded.updated_at},and(updated_at.eq.${decoded.updated_at},id.lt.${decoded.id})`,
    )
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

  const contentLength = request.headers.get('content-length')
  if (contentLength && Number(contentLength) > MAX_DOCUMENT_BYTES) {
    return unprocessable('Dokumen terlalu besar.')
  }

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

  // A caller-supplied document used to be stored unvalidated, which let it reach
  // the public renderer via publish with none of the schema's limits applied.
  let document
  if (body.document === undefined) {
    document = JSON.parse(JSON.stringify(createDefaultDocument(name)))
  } else {
    const parsedDocument = ProjectDocumentSchema.safeParse(body.document)
    if (!parsedDocument.success) {
      return unprocessable('Dokumen tidak valid.')
    }
    document = parsedDocument.data
  }

  const { data: project, error: dbError } = await supabase
    .from('projects')
    .insert({
      name,
      owner_id: user!.id,
      created_by: user!.id,
      draft_document: document as never,
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
