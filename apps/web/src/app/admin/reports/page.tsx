import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server'
import { ReportQueue, type ModerationReport } from './_components/ReportQueue'

export default async function AdminReportsPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login?next=/admin/reports')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'moderator' && profile?.role !== 'admin') notFound()

  const service = await createSupabaseServiceClient()
  const { data, error } = await service
    .from('reports')
    .select(
      'id, published_page_id, reason, details, reporter_email, status, resolution_note, created_at, published_pages(slug, status)',
    )
    .order('created_at', { ascending: true })
    .limit(100)

  if (error) console.error('Failed to load moderation reports:', error.message)
  const reports: ModerationReport[] = (data ?? []).map((report) => ({
    id: report.id,
    publishedPageId: report.published_page_id,
    reason: report.reason,
    details: report.details,
    reporterEmail: report.reporter_email,
    status: report.status,
    resolutionNote: report.resolution_note,
    createdAt: report.created_at,
    pageSlug: report.published_pages?.slug ?? null,
    pageStatus: report.published_pages?.status ?? null,
  }))

  return (
    <main className="bg-background min-h-screen px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-text-muted text-xs uppercase tracking-[0.1em]">Moderasi</p>
            <h1 className="font-display text-text-primary text-4xl uppercase">Laporan publik</h1>
          </div>
          <Link href="/dashboard" className="text-primary text-sm underline underline-offset-4">
            Kembali ke dashboard
          </Link>
        </div>
        <ReportQueue initialReports={reports} />
      </div>
    </main>
  )
}
