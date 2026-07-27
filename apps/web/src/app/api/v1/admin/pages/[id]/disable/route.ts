import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireModerator } from '@/lib/api/auth'
import { ok, notFound, serverError, unprocessable } from '@/lib/api/response'

const DisableSchema = z.object({
  reason: z.string().trim().min(1).max(2000),
})

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, serviceClient, error } = await requireModerator()
  if (error) return error

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return unprocessable('Request tidak valid.')
  }

  const parsed = DisableSchema.safeParse(body)
  if (!parsed.success) return unprocessable('Alasan diperlukan.')

  const { data: status, error: disableError } = await serviceClient!.rpc('disable_page_atomic', {
    p_page_id: id,
    p_actor_id: user!.id,
    p_reason: parsed.data.reason,
  })

  if (disableError) {
    if (disableError.code === 'P0002') return notFound('Halaman tidak ditemukan.')
    console.error('POST /api/v1/admin/pages/[id]/disable:', disableError.message)
    return serverError()
  }

  return ok({ status })
}
