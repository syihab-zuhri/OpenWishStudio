import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { ok, created, serverError, unprocessable, notFound } from '@/lib/api/response'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

const VALID_REASONS = [
  'harassment',
  'sexual_content',
  'fraud',
  'malware_phishing',
  'copyright',
  'privacy',
  'other',
] as const

const ReportSchema = z.object({
  reason: z.enum(VALID_REASONS),
  details: z.string().max(2000).optional(),
  email: z.string().email().max(254).optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const supabase = await createSupabaseServerClient()

  const { data: page } = await supabase
    .from('published_pages')
    .select('id, status')
    .eq('slug', slug)
    .maybeSingle()

  if (!page || page.status !== 'published') {
    return notFound('Halaman tidak tersedia.')
  }

  // Attribute the report when the reporter happens to be signed in; anonymous
  // reports stay anonymous.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return unprocessable('Pilih alasan laporan.')
  }

  const parsed = ReportSchema.safeParse(body)
  if (!parsed.success) {
    return unprocessable('Pilih alasan laporan.')
  }

  const { reason, details, email } = parsed.data

  const xForwardedFor = request.headers.get('x-forwarded-for') ?? ''
  const userAgent = request.headers.get('user-agent') ?? ''
  const rawFingerprint = `${xForwardedFor}|${userAgent}|${slug}`
  const fingerprintBytes = new TextEncoder().encode(rawFingerprint)
  const hashBuffer = await crypto.subtle.digest('SHA-256', fingerprintBytes)
  const fingerprint = btoa(String.fromCharCode(...new Uint8Array(hashBuffer))).slice(0, 32)

  const serviceClient = await createSupabaseServiceClient()

  const { data: report, error: insertError } = await serviceClient
    .from('reports')
    .insert({
      published_page_id: page.id,
      reason,
      details: details ?? null,
      reporter_email: email ?? null,
      reporter_user_id: user?.id ?? null,
      fingerprint_hash: fingerprint,
      status: 'open' as never,
      // created_by has a FK to auth.users; the previous sentinel (the page id)
      // failed that constraint, so every report insert returned 23503.
      created_by: user?.id ?? null,
    })
    .select('id')
    .single()

  if (insertError) {
    if (insertError.code === '23505') {
      return ok({ reportId: null, duplicate: true })
    }
    console.error('POST /api/v1/public/pages/[slug]/reports:', insertError.message)
    return serverError()
  }

  return created({ reportId: report.id })
}
