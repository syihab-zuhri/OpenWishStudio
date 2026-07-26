import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/api/auth'
import { ok, notFound, serverError, unprocessable } from '@/lib/api/response'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

async function requireModeratorOrAdmin(
  userId: string,
  serviceClient: Awaited<ReturnType<typeof createSupabaseServiceClient>>,
) {
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  return profile?.role === 'moderator' || profile?.role === 'admin'
}

const RestoreSchema = z.object({
  reason: z.string().min(1).max(2000),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { user, error } = await requireAuth()
  if (error) return error

  const serviceClient = await createSupabaseServiceClient()

  const isMod = await requireModeratorOrAdmin(user!.id, serviceClient)
  if (!isMod) {
    return ok({ error: 'Akses moderator diperlukan.' }, 403)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return unprocessable('Request tidak valid.')
  }

  const parsed = RestoreSchema.safeParse(body)
  if (!parsed.success) {
    return unprocessable('Alasan diperlukan.')
  }

  const { data: page } = await serviceClient
    .from('published_pages')
    .select('id, status')
    .eq('id', id)
    .maybeSingle()

  if (!page) {
    return notFound('Halaman tidak ditemukan.')
  }

  if (page.status === 'published') {
    return ok({ status: 'published' })
  }

  const { error: updateError } = await serviceClient
    .from('published_pages')
    .update({ status: 'published' })
    .eq('id', id)

  if (updateError) {
    console.error('POST /api/v1/admin/pages/[id]/restore:', updateError.message)
    return serverError()
  }

  await serviceClient.from('audit_logs').insert({
    actor_id: user!.id,
    created_by: user!.id,
    action: 'page.restore',
    target_type: 'published_page',
    target_id: id,
    metadata: { reason: parsed.data.reason },
  })

  return ok({ status: 'published' })
}
