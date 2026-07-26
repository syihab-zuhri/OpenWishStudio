import { type NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api/auth'
import { fetchOwnedProject } from '@/lib/api/projects'
import { ok, notFound, serverError, unprocessable, conflict } from '@/lib/api/response'
import { ProjectDocumentSchema } from '@openwish/project-schema'

type Params = Promise<{ id: string }>

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

  let body: { document?: unknown; baseRevision?: unknown }
  try {
    body = await request.json()
  } catch {
    return unprocessable('Request body tidak valid.')
  }

  const parseResult = ProjectDocumentSchema.safeParse(body.document)
  if (!parseResult.success) {
    return unprocessable('Ada elemen yang tidak valid.')
  }

  const baseRevision = typeof body.baseRevision === 'number' ? body.baseRevision : null

  const { data: current } = await fetchOwnedProject(supabase, user!.id, id)
  if (!current) return notFound()

  const currentRevision = current.draft_revision ?? 0

  if (baseRevision !== null && baseRevision !== currentRevision) {
    return conflict('Versi di server berubah. Pilih muat ulang atau simpan sebagai salinan.')
  }

  const newRevision = currentRevision + 1

  const { error: dbError } = await supabase
    .from('projects')
    .update({
      draft_document: JSON.parse(JSON.stringify(parseResult.data)),
      draft_revision: newRevision,
    })
    .eq('id', id)
    .eq('owner_id', user!.id)

  if (dbError) {
    console.error('PATCH /api/v1/projects/[id]/draft:', dbError.message)
    return serverError()
  }

  return ok({ revision: newRevision, savedAt: new Date().toISOString() })
}
