import { requireAuth } from '@/lib/api/auth'
import { ok, serverError, notFound } from '@/lib/api/response'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, supabase, error } = await requireAuth()
  if (error) return error

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

  const serviceClient = await createSupabaseServiceClient()
  const { error: expiryError } = await serviceClient.rpc('expire_publications', {
    p_owner_id: user!.id,
  })
  if (expiryError) {
    console.error('GET /api/v1/projects/[id]/publish-status expiry:', expiryError.message)
    return serverError()
  }

  const { data: page, error: pageError } = await serviceClient
    .from('published_pages')
    .select('slug, status, current_version_id, expires_at')
    .eq('project_id', id)
    .maybeSingle()

  if (pageError) {
    console.error('GET /api/v1/projects/[id]/publish-status:', pageError.message)
    return serverError()
  }

  if (!page) {
    return ok({ status: 'draft', url: null, versionNo: null, expiresAt: null })
  }

  const { data: ver } = await serviceClient
    .from('project_versions')
    .select('version_no')
    .eq('id', page.current_version_id)
    .maybeSingle()

  return ok({
    status: page.status,
    url: `/p/${page.slug}`,
    versionNo: ver?.version_no ?? null,
    expiresAt: page.expires_at,
  })
}
