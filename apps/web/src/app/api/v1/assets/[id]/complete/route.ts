import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/api/auth'
import { ok, notFound, serverError, unprocessable, conflict } from '@/lib/api/response'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

const CompleteSchema = z.object({
  checksum: z.string().min(1).max(128).optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  let body: unknown
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const parsed = CompleteSchema.safeParse(body)
  if (!parsed.success) {
    return unprocessable('Parameter tidak valid.')
  }

  const { data: asset } = await supabase
    .from('assets')
    .select('id, status, owner_id, storage_key, mime_type, size_bytes')
    .eq('id', id)
    .eq('owner_id', user!.id)
    .maybeSingle()

  if (!asset) {
    return notFound('Aset tidak ditemukan.')
  }

  if (asset.status === 'ready') {
    return ok({ assetId: asset.id, status: 'ready' })
  }

  if (asset.status !== 'pending') {
    return conflict('Aset tidak dalam status yang dapat diselesaikan.')
  }

  const serviceClient = await createSupabaseServiceClient()

  // The MIME type and size recorded at intent time are client claims, and a
  // signed upload URL cannot pin either. Reconcile against the stored object
  // before marking the asset usable — otherwise "complete" can be called with
  // no upload at all, or after uploading something other than what was declared.
  const slashIndex = asset.storage_key.lastIndexOf('/')
  const folder = asset.storage_key.slice(0, slashIndex)
  const objectName = asset.storage_key.slice(slashIndex + 1)

  const { data: objects, error: listError } = await serviceClient.storage
    .from('assets')
    .list(folder, { search: objectName, limit: 1 })

  if (listError) {
    console.error('POST /api/v1/assets/[id]/complete list:', listError.message)
    return serverError()
  }

  const object = objects?.find((o) => o.name === objectName)
  if (!object) {
    return conflict('File belum terunggah.')
  }

  const actualSize = object.metadata?.size as number | undefined
  const actualMime = object.metadata?.mimetype as string | undefined

  if (actualMime && actualMime !== asset.mime_type) {
    await serviceClient.storage.from('assets').remove([asset.storage_key])
    return unprocessable('Tipe file tidak sesuai dengan yang didaftarkan.')
  }

  if (actualSize !== undefined && actualSize !== asset.size_bytes) {
    await serviceClient.storage.from('assets').remove([asset.storage_key])
    return unprocessable('Ukuran file tidak sesuai dengan yang didaftarkan.')
  }

  const { error: updateError } = await serviceClient
    .from('assets')
    .update({
      status: 'ready',
      checksum_sha256: parsed.data.checksum ?? 'verified',
    })
    .eq('id', id)
    .eq('owner_id', user!.id)

  if (updateError) {
    console.error('POST /api/v1/assets/[id]/complete:', updateError.message)
    return serverError()
  }

  return ok({ assetId: id, status: 'ready' })
}
