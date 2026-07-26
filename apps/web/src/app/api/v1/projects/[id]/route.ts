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

  // Soft delete lewat service client: WITH CHECK kebijakan update di database
  // menolak baris yang deleted_at-nya terisi, sehingga update via klien user
  // selalu gagal RLS. Kepemilikan sudah diverifikasi fetchOwnedProject di atas.
  const serviceClient = await createSupabaseServiceClient()
  const { error: dbError } = await serviceClient
    .from('projects')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('owner_id', user!.id)

  if (dbError) {
    console.error('DELETE /api/v1/projects/[id]:', dbError.message)
    return serverError()
  }

  return noContent()
}
