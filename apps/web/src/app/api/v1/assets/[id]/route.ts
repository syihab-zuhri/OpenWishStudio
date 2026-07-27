import { type NextRequest } from 'next/server'
import { requireAuth } from '@/lib/api/auth'
import { ok, notFound, serverError } from '@/lib/api/response'
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
    .select('id, status, owner_id, deleted_at, storage_key')
    .eq('id', id)
    .eq('owner_id', user!.id)
    .maybeSingle()

  if (!asset) {
    return notFound('Aset tidak ditemukan.')
  }

  if (asset.deleted_at) {
    return ok({ status: 'deleted' })
  }

  const serviceClient = await createSupabaseServiceClient()

  // Objek ready dapat direferensikan snapshot publik immutable atau salinan
  // proyek. Hanya unggahan pending/rejected yang aman dihapus secara fisik.
  const retainObject = asset.status === 'ready'
  if (!retainObject) {
    const { error: storageError } = await serviceClient.storage
      .from('assets')
      .remove([asset.storage_key])

    if (storageError) {
      console.error('DELETE /api/v1/assets/[id] storage:', storageError.message)
      return serverError('File aset gagal dihapus dari penyimpanan.')
    }
  }

  const { error: updateError } = await serviceClient
    .from('assets')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('owner_id', user!.id)

  if (updateError) {
    console.error('DELETE /api/v1/assets/[id]:', updateError.message)
    return serverError()
  }

  return ok({ status: 'deleted', retainedForSnapshots: retainObject })
}
