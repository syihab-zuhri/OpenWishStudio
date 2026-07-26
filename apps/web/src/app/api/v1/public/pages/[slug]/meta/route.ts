import { ok, notFound, serverError } from '@/lib/api/response'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const supabase = await createSupabaseServerClient()

  const { data: page, error } = await supabase
    .from('published_pages')
    .select('id, slug, status, expires_at')
    .eq('slug', slug)
    .maybeSingle()

  if (error) {
    console.error('GET /api/v1/public/pages/[slug]/meta:', error.message)
    return serverError()
  }

  if (!page || page.status !== 'published') {
    return notFound('Halaman tidak tersedia.')
  }

  if (page.expires_at && new Date(page.expires_at) <= new Date()) {
    return notFound('Halaman sudah tidak tersedia.')
  }

  return ok({
    slug: page.slug,
    url: `/p/${page.slug}`,
    expiresAt: page.expires_at,
  })
}
