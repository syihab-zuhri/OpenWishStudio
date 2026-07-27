import { type NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api/auth'
import { fetchOwnedProject } from '@/lib/api/projects'
import { ok, notFound, serverError, unprocessable, conflict } from '@/lib/api/response'
import { ProjectDocumentSchema } from '@openwish/project-schema'
import { z } from 'zod'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

type Params = Promise<{ id: string }>

const SaveDraftSchema = z.object({
  document: ProjectDocumentSchema,
  baseRevision: z.number().int().nonnegative(),
  name: z.string().trim().min(1).max(120),
})

export async function GET(_request: NextRequest, { params }: { params: Params }) {
  const { id } = await params
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { data: project } = await fetchOwnedProject(supabase, user!.id, id)
  if (!project) return notFound()

  return ok({
    document: project.draft_document,
    revision: project.draft_revision ?? 0,
  })
}

export async function PATCH(request: NextRequest, { params }: { params: Params }) {
  const { id } = await params
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const contentLength = request.headers.get('content-length')
  if (contentLength && parseInt(contentLength, 10) > 5 * 1024 * 1024) {
    return new NextResponse(
      JSON.stringify({ error: 'Kreasi terlalu besar. Hapus beberapa elemen/aset.' }),
      { status: 413, headers: { 'Content-Type': 'application/json' } },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return unprocessable('Request body tidak valid.')
  }

  if (Buffer.byteLength(JSON.stringify(body), 'utf8') > 5 * 1024 * 1024) {
    return new NextResponse(
      JSON.stringify({ error: 'Kreasi terlalu besar. Hapus beberapa elemen/aset.' }),
      { status: 413, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const parseResult = SaveDraftSchema.safeParse(body)
  if (!parseResult.success) {
    return unprocessable('Ada elemen yang tidak valid.')
  }

  const { data: current } = await fetchOwnedProject(supabase, user!.id, id)
  if (!current) return notFound()

  const { document, baseRevision, name } = parseResult.data
  const normalizedDocument = {
    ...document,
    project: { ...document.project, title: name },
  }
  const newRevision = baseRevision + 1
  const service = await createSupabaseServiceClient()
  const { data: saved, error: dbError } = await service
    .from('projects')
    .update({
      name,
      draft_document: JSON.parse(JSON.stringify(normalizedDocument)),
      draft_revision: newRevision,
      last_saved_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('owner_id', user!.id)
    .is('deleted_at', null)
    .eq('draft_revision', baseRevision)
    .select('draft_revision, last_saved_at')
    .maybeSingle()

  if (dbError) {
    console.error('PATCH /api/v1/projects/[id]/draft:', dbError.message)
    return serverError()
  }

  if (!saved) {
    return conflict('Versi di server berubah. Muat ulang sebelum menyimpan perubahan Anda.')
  }

  return ok({ revision: saved.draft_revision, savedAt: saved.last_saved_at })
}
