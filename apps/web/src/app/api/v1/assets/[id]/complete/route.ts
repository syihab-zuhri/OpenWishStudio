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
    .select('id, status, owner_id')
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

  const { error: updateError } = await serviceClient
    .from('assets')
    .update({
      status: 'ready',
      checksum_sha256: parsed.data.checksum ?? 'verified',
    })
    .eq('id', id)

  if (updateError) {
    console.error('POST /api/v1/assets/[id]/complete:', updateError.message)
    return serverError()
  }

  return ok({ assetId: id, status: 'ready' })
}
