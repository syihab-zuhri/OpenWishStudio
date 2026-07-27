import { type NextRequest } from 'next/server'
import { requireAuth } from '@/lib/api/auth'
import { fetchOwnedProject } from '@/lib/api/projects'
import { ok, noContent, notFound, serverError, unprocessable } from '@/lib/api/response'
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

  const { data: project, error: dbError } = await supabase
    .from('projects')
    .update({ name })
    .eq('id', id)
    .eq('owner_id', user!.id)
    .select('id, name, status, updated_at, created_at')
    .single()

  if (dbError || !project) {
    console.error('PATCH /api/v1/projects/[id]:', dbError?.message)
    return serverError()
  }

  return ok({ project })
}

export async function DELETE(_request: NextRequest, { params }: { params: Params }) {
  const { id } = await params
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { data: existing } = await fetchOwnedProject(supabase, user!.id, id)
  if (!existing) return notFound()

  // Soft delete lewat service client, bukan klien user: kebijakan SELECT
  // (deleted_at IS NULL) ditegakkan Postgres terhadap baris HASIL update,
  // sehingga baris yang baru di-soft-delete "tak terlihat" dan update-nya
  // ditolak RLS (diverifikasi empiris via impersonasi SQL — bahkan tanpa
  // RETURNING). Kepemilikan sudah diverifikasi fetchOwnedProject di atas.
  const serviceClient = await createSupabaseServiceClient()

  // Matikan halaman publik lebih dulu — tanpa ini, tautan yang sudah dibagikan
  // tetap hidup sebagai halaman yatim setelah kreasinya dihapus.
  const { error: unpubError } = await serviceClient
    .from('published_pages')
    .update({ status: 'unpublished' })
    .eq('project_id', id)
    .eq('status', 'published')

  if (unpubError) {
    console.error('DELETE /api/v1/projects/[id] unpublish:', unpubError.message)
    return serverError()
  }

  const { error: dbError } = await serviceClient
    .from('projects')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('owner_id', user!.id)

  if (dbError) {
    console.error('DELETE /api/v1/projects/[id]:', dbError.message)
    return serverError()
  }

  await serviceClient.from('audit_logs').insert({
    actor_id: user!.id,
    created_by: user!.id,
    action: 'project.delete',
    target_type: 'project',
    target_id: id,
    metadata: { hadPublishedPage: existing.status === 'published' },
  })

  return noContent()
}
