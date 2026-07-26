import { type NextRequest } from 'next/server'
import { requireAuth } from '@/lib/api/auth'
import { ok, notFound, serverError, conflict } from '@/lib/api/response'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { data: asset } = await supabase
    .from('assets')
    .select('id, status, owner_id, deleted_at')
    .eq('id', id)
    .eq('owner_id', user!.id)
    .maybeSingle()

  if (!asset) {
    return notFound('Aset tidak ditemukan.')
  }

  if (asset.deleted_at) {
    return ok({ status: 'deleted' })
  }

  if (asset.status === 'pending') {
    return conflict('Aset sedang dalam proses upload. Selesaikan atau batalkan terlebih dahulu.')
  }

  const serviceClient = await createSupabaseServiceClient()

  const { error: updateError } = await serviceClient
    .from('assets')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (updateError) {
    console.error('DELETE /api/v1/assets/[id]:', updateError.message)
    return serverError()
  }

  return ok({ status: 'deleted' })
}
