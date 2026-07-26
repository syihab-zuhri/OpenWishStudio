import { ok, notFound, serverError } from '@/lib/api/response'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from('templates')
    .select('id, slug, name, category, thumbnail_url, scene_document, license_metadata, schema_version, updated_at')
    .eq('slug', slug)
    .eq('status', 'published' as never)
    .single()

  if (error || !data) {
    if (error?.code === 'PGRST116') return notFound('Templat tidak ditemukan.')
    console.error('GET /api/v1/templates/[slug]:', error?.message)
    return serverError()
  }

  return ok({ template: data })
}
