import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/api/auth'
import { ok, created, serverError, unprocessable } from '@/lib/api/response'

const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024

const GuestImportSchema = z.object({
  document: z.unknown(),
  localProjectId: z.string().min(1).max(128),
  idempotencyKey: z.string().min(1).max(128),
})

export async function POST(request: NextRequest) {
  const { user, supabase, error } = await requireAuth()
  if (error) return error

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

  const documentStr = JSON.stringify(document)
  if (Buffer.byteLength(documentStr, 'utf8') > MAX_DOCUMENT_BYTES) {
    return unprocessable('Draft ini tidak dapat diimpor. Unduh salinan pemulihan.')
  }

  // Idempotency check via name+owner — projects table has no idempotency_key column
  // Store idempotency key in draft_document metadata to allow dedup
  const { data: existing } = await supabase
    .from('projects')
    .select('id')
    .eq('owner_id', user!.id)
    .is('deleted_at', null)
    .contains('draft_document', { __importIdempotencyKey: idempotencyKey } as never)
    .maybeSingle()

  if (existing) {
    return ok({ projectId: existing.id, imported: false })
  }

  const doc = document as Record<string, unknown>
  const name = (doc?.name?.toString?.()?.trim() || 'Kreasi Impor').slice(0, 120)

  // Embed idempotency key in document metadata for dedup
  const documentWithKey = { ...doc, __importIdempotencyKey: idempotencyKey }

  const { data: project, error: dbError } = await supabase
    .from('projects')
    .insert({
      name,
      owner_id: user!.id,
      created_by: user!.id,
      draft_document: documentWithKey as never,
      schema_version: 1,
    })
    .select('id')
    .single()

  if (dbError || !project) {
    console.error('POST /api/v1/auth/guest-import:', dbError?.message)
    return serverError()
  }

  return created({ projectId: project.id, imported: true })
}
