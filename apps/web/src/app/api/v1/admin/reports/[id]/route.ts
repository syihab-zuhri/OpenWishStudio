import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/api/auth'
import { ok, notFound, serverError, unprocessable } from '@/lib/api/response'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

async function requireModerator(
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

const VALID_STATUSES = ['open', 'reviewing', 'actioned', 'rejected'] as const

const UpdateReportSchema = z.object({
  status: z.enum(VALID_STATUSES),
  resolutionNote: z.string().max(2000).optional(),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { user, error } = await requireAuth()
  if (error) return error

  const serviceClient = await createSupabaseServiceClient()

  const isMod = await requireModerator(user!.id, serviceClient)
  if (!isMod) {
    return ok({ error: 'Akses moderator diperlukan.' }, 403)
  }

  const { data, error: dbError } = await serviceClient
    .from('reports')
    .select(
      'id, published_page_id, reason, details, status, resolution_note, reviewed_by, reviewed_at, created_at',
    )
    .eq('id', id)
    .single()

  if (dbError || !data) {
    if (dbError?.code === 'PGRST116') return notFound('Laporan tidak ditemukan.')
    console.error('GET /api/v1/admin/reports/[id]:', dbError?.message)
    return serverError()
  }

  return ok({ report: data })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { user, error } = await requireAuth()
  if (error) return error

  const serviceClient = await createSupabaseServiceClient()

  const isMod = await requireModerator(user!.id, serviceClient)
  if (!isMod) {
    return ok({ error: 'Akses moderator diperlukan.' }, 403)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return unprocessable('Request tidak valid.')
  }

  const parsed = UpdateReportSchema.safeParse(body)
  if (!parsed.success) {
    return unprocessable('Parameter tidak valid.')
  }

  const { data: report, error: updateError } = await serviceClient
    .from('reports')
    .update({
      status: parsed.data.status,
      resolution_note: parsed.data.resolutionNote ?? null,
      reviewed_by: user!.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id, published_page_id, reason, status, resolution_note, created_at')
    .single()

  if (updateError || !report) {
    if (updateError?.code === 'PGRST116') return notFound('Laporan tidak ditemukan.')
    console.error('PATCH /api/v1/admin/reports/[id]:', updateError?.message)
    return serverError()
  }

  await serviceClient.from('audit_logs').insert({
    actor_id: user!.id,
    created_by: user!.id,
    action: 'report.update',
    target_type: 'report',
    target_id: id,
    metadata: { status: parsed.data.status },
  })

  return ok({ report })
}
