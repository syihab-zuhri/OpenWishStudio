import { ok, notFound, serverError } from '@/lib/api/response'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const supabase = await createSupabaseServerClient()

  const { data: page, error: pageError } = await supabase
    .from('published_pages')
    .select('id, status, expires_at, current_version_id')
    .eq('slug', slug)
    .maybeSingle()

  if (pageError) {
    console.error('GET /api/v1/public/pages/[slug]:', pageError.message)
    return serverError()
  }

  if (!page || page.status !== 'published') {
    return notFound('Ucapan ini tidak tersedia.')
  }

  if (page.expires_at && new Date(page.expires_at) <= new Date()) {
    return notFound('Ucapan ini sudah tidak tersedia.')
  }

  const { data: version, error: verError } = await supabase
    .from('project_versions')
    .select('id, document_snapshot, schema_version, created_at')
    .eq('id', page.current_version_id)
    .single()

  if (verError || !version) {
    console.error('GET /api/v1/public/pages/[slug] version:', verError?.message)
    return serverError()
  }

  return ok({
    versionId: version.id,
    document: version.document_snapshot,
    expiresAt: page.expires_at,
  })
}
