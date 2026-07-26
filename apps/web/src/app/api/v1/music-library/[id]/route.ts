import { ok, notFound, serverError } from '@/lib/api/response'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from('music_library_items')
    .select('id, title, artist, duration_ms, mime_type, license_code, license_url, attribution_text, created_at')
    .eq('id', id)
    .eq('status', 'active')
    .single()

  if (error || !data) {
    if (error?.code === 'PGRST116') return notFound('Track tidak ditemukan.')
    console.error('GET /api/v1/music-library/[id]:', error?.message)
    return serverError()
  }

  return ok({ track: data })
}
