import { type NextRequest } from 'next/server'
import { ProjectDocumentSchema } from '@openwish/project-schema'
import { requireAuth } from '@/lib/api/auth'
import { fetchOwnedProject } from '@/lib/api/projects'
import { ok, noContent, notFound, serverError, unprocessable, conflict } from '@/lib/api/response'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

type Params = Promise<{ id: string }>

export async function GET(_request: NextRequest, { params }: { params: Params }) {
  const { id } = await params
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { data: project } = await fetchOwnedProject(supabase, user!.id, id)
  if (!project) return notFound()
  return ok({ project })
}

export async function PATCH(request: NextRequest, { params }: { params: Params }) {
  const { id } = await params
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  let body: { name?: string }
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const name = body.name?.trim()
  if (!name) return unprocessable('Nama kreasi wajib diisi.')
  if (name.length > 120) return unprocessable('Nama kreasi terlalu panjang (maks. 120 karakter).')

  const { data: existing } = await fetchOwnedProject(supabase, user!.id, id)
  if (!existing) return notFound()

  const parsed = ProjectDocumentSchema.safeParse(existing.draft_document)
  if (!parsed.success) {
    return unprocessable('Dokumen tidak valid. Buka editor dan simpan ulang terlebih dahulu.')
  }

  const nextRevision = (existing.draft_revision ?? 0) + 1
  const document = { ...parsed.data, project: { ...parsed.data.project, title: name } }
  const service = await createSupabaseServiceClient()
  const { data: project, error: updateError } = await service
    .from('projects')
    .update({
      name,
      draft_document: JSON.parse(JSON.stringify(document)),
      draft_revision: nextRevision,
      last_saved_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('owner_id', user!.id)
    .eq('draft_revision', existing.draft_revision ?? 0)
    .select('id, name, status, updated_at, created_at')
    .maybeSingle()

  if (updateError) {
    console.error('PATCH /api/v1/projects/[id]:', updateError.message)
    return serverError()
  }
  if (!project) return conflict('Versi proyek berubah. Muat ulang dashboard lalu coba lagi.')
  return ok({ project })
}

export async function DELETE(_request: NextRequest, { params }: { params: Params }) {
  const { id } = await params
  const { user, error } = await requireAuth()
  if (error) return error

  const service = await createSupabaseServiceClient()
  const { error: deleteError } = await service.rpc('soft_delete_project_atomic', {
    p_project_id: id,
    p_actor_id: user!.id,
  })

  if (deleteError) {
    if (deleteError.code === 'P0002') return notFound()
    console.error('DELETE /api/v1/projects/[id]:', deleteError.message)
    return serverError()
  }
  return noContent()
}
