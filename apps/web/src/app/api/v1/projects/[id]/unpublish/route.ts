import { type NextRequest } from 'next/server'
import { requireAuth } from '@/lib/api/auth'
import { ok, serverError, notFound, conflict } from '@/lib/api/response'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, error } = await requireAuth()
  if (error) return error

  const service = await createSupabaseServiceClient()
  const { data: status, error: unpublishError } = await service.rpc('unpublish_project_atomic', {
    p_project_id: id,
    p_actor_id: user!.id,
  })

  if (unpublishError) {
    if (unpublishError.code === 'P0002') return notFound('Halaman tidak ditemukan.')
    if (unpublishError.code === '42501') {
      return conflict('Halaman yang dinonaktifkan moderator tidak dapat diubah oleh pemilik.')
    }
    console.error('POST /api/v1/projects/[id]/unpublish:', unpublishError.message)
    return serverError()
  }

  return ok({ status })
}
