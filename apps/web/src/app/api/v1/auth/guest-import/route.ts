import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { ProjectDocumentSchema } from '@openwish/project-schema'
import { requireAuth } from '@/lib/api/auth'
import { ok, created, serverError, unprocessable } from '@/lib/api/response'
import { byUser, enforceRateLimit } from '@/lib/api/rate-limit'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024

const RATE_LIMIT = { name: 'guest-import', max: 10, windowSeconds: 3600 }

const GuestImportSchema = z.object({
  // Was z.unknown(): unvalidated JSON stored here reached the public renderer
  // through publish, bypassing every limit the schema defines.
  document: ProjectDocumentSchema,
  localProjectId: z.string().min(1).max(128),
  idempotencyKey: z.string().min(1).max(128),
})

export async function POST(request: NextRequest) {
  const { user, error } = await requireAuth()
  if (error) return error

  const limited = await enforceRateLimit(RATE_LIMIT, byUser(user!.id))
  if (limited) return limited

  const contentLength = request.headers.get('content-length')
  if (contentLength && Number(contentLength) > MAX_DOCUMENT_BYTES) {
    return unprocessable('Draft ini tidak dapat diimpor. Unduh salinan pemulihan.')
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return unprocessable('Draft ini tidak dapat diimpor. Unduh salinan pemulihan.')
  }

  const parsed = GuestImportSchema.safeParse(body)
  if (!parsed.success) {
    return unprocessable('Draft ini tidak dapat diimpor. Unduh salinan pemulihan.')
  }

  const { document, idempotencyKey } = parsed.data

  if (Buffer.byteLength(JSON.stringify(document), 'utf8') > MAX_DOCUMENT_BYTES) {
    return unprocessable('Draft ini tidak dapat diimpor. Unduh salinan pemulihan.')
  }

  // The unique owner/key index closes the race between concurrent imports.
  const service = await createSupabaseServiceClient()
  const { data: existing } = await service
    .from('projects')
    .select('id')
    .eq('owner_id', user!.id)
    .eq('import_idempotency_key', idempotencyKey)
    .is('deleted_at', null)
    .maybeSingle()

  if (existing) {
    return ok({ projectId: existing.id, imported: false })
  }

  const name = (document.project.title.trim() || 'Kreasi Impor').slice(0, 120)

  const { data: project, error: dbError } = await service
    .from('projects')
    .insert({
      name,
      owner_id: user!.id,
      created_by: user!.id,
      draft_document: document as never,
      schema_version: 1,
      import_idempotency_key: idempotencyKey,
    })
    .select('id')
    .single()

  if (dbError?.code === '23505') {
    const { data: racedProject } = await service
      .from('projects')
      .select('id')
      .eq('owner_id', user!.id)
      .eq('import_idempotency_key', idempotencyKey)
      .is('deleted_at', null)
      .single()
    if (racedProject) return ok({ projectId: racedProject.id, imported: false })
  }

  if (dbError || !project) {
    console.error('POST /api/v1/auth/guest-import:', dbError?.message)
    return serverError()
  }

  return created({ projectId: project.id, imported: true })
}
