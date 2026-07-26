import { type NextRequest } from 'next/server'
import { requireAuth } from '@/lib/api/auth'
import { ok, serverError, notFound } from '@/lib/api/response'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const serviceClient = await createSupabaseServiceClient()

  const { data: project } = await supabase
    .from('projects')
    .select('id')
    .eq('id', id)
    .eq('owner_id', user!.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!project) {
    return notFound('Kreasi tidak ditemukan.')
  }

  const { data: page } = await serviceClient
    .from('published_pages')
    .select('id, status')
    .eq('project_id', id)
    .maybeSingle()

  if (!page) {
    return notFound('Halaman tidak ditemukan.')
  }

  if (page.status === 'unpublished') {
    return ok({ status: 'unpublished' })
  }

  const { error: updateError } = await serviceClient
    .from('published_pages')
    .update({ status: 'unpublished' })
    .eq('id', page.id)

  if (updateError) {
    console.error('POST /api/v1/projects/[id]/unpublish:', updateError.message)
    return serverError()
  }

  await serviceClient.from('audit_logs').insert({
    actor_id: user!.id,
    created_by: user!.id,
    action: 'project.unpublish',
    target_type: 'project',
    target_id: id,
    metadata: {},
  })

  await serviceClient.from('projects').update({ status: 'draft' }).eq('id', id)

  return ok({ status: 'unpublished' })
}
