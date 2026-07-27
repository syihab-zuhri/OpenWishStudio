'use client'

import { useState } from 'react'

type ReportStatus = 'open' | 'reviewing' | 'actioned' | 'rejected'
type PageStatus = 'published' | 'expired' | 'unpublished' | 'disabled'

export interface ModerationReport {
  id: string
  publishedPageId: string
  reason: string
  details: string | null
  reporterEmail: string | null
  status: ReportStatus
  resolutionNote: string | null
  createdAt: string
  pageSlug: string | null
  pageStatus: PageStatus | null
}

export function ReportQueue({ initialReports }: { initialReports: ModerationReport[] }) {
  const [reports, setReports] = useState(initialReports)

  function patchReport(id: string, patch: Partial<ModerationReport>) {
    setReports((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  if (reports.length === 0) {
    return (
      <div className="bg-surface text-text-secondary rounded-md p-10 text-center">
        Belum ada laporan.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {reports.map((report) => (
        <ReportCard key={report.id} report={report} onPatch={patchReport} />
      ))}
    </div>
  )
}

function ReportCard({
  report,
  onPatch,
}: {
  report: ModerationReport
  onPatch: (id: string, patch: Partial<ModerationReport>) => void
}) {
  const [note, setNote] = useState(report.resolutionNote ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function updateStatus(status: ReportStatus) {
    setBusy(true)
    setError(null)
    const response = await fetch(`/api/v1/admin/reports/${report.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, resolutionNote: note.trim() || undefined }),
    }).catch(() => null)
    setBusy(false)
    if (!response?.ok) return setError('Status laporan gagal diperbarui.')
    onPatch(report.id, { status, resolutionNote: note.trim() || null })
  }

  async function moderatePage(action: 'disable' | 'restore') {
    setBusy(true)
    setError(null)
    const reason = note.trim() || `Tindak lanjut laporan ${report.id}`
    const response = await fetch(`/api/v1/admin/pages/${report.publishedPageId}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    }).catch(() => null)
    setBusy(false)
    if (!response?.ok) return setError(`Halaman gagal di-${action}.`)
    const body = (await response.json()) as { status: PageStatus }
    onPatch(report.id, { pageStatus: body.status })
  }

  return (
    <article className="bg-surface border-border rounded-md border p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-text-muted text-[10px] uppercase tracking-[0.1em]">
            {new Date(report.createdAt).toLocaleString('id-ID')}
          </p>
          <h2 className="text-text-primary mt-1 font-semibold">{report.reason}</h2>
          {report.pageSlug && (
            <a
              href={`/p/${report.pageSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary mt-1 inline-block text-xs underline underline-offset-2"
            >
              /p/{report.pageSlug}
            </a>
          )}
        </div>
        <div className="flex gap-2 text-[10px] uppercase tracking-[0.08em]">
          <span className="bg-surface-hover text-text-secondary rounded-full px-2 py-1">
            {report.status}
          </span>
          <span className="bg-surface-hover text-text-secondary rounded-full px-2 py-1">
            page: {report.pageStatus ?? 'unknown'}
          </span>
        </div>
      </div>

      {report.details && (
        <p className="text-text-secondary mt-4 whitespace-pre-wrap text-sm">{report.details}</p>
      )}
      {report.reporterEmail && (
        <p className="text-text-muted mt-2 text-xs">Kontak: {report.reporterEmail}</p>
      )}

      <label className="text-text-secondary mt-4 block text-xs">
        Catatan resolusi
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={2000}
          rows={3}
          className="border-border bg-background text-text-primary mt-1.5 w-full rounded-sm border px-3 py-2 text-sm"
        />
      </label>

      {error && (
        <p role="alert" className="text-error mt-2 text-xs">
          {error}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {(['reviewing', 'actioned', 'rejected'] as const).map((status) => (
          <button
            key={status}
            type="button"
            disabled={busy}
            onClick={() => void updateStatus(status)}
            className="border-border text-text-secondary hover:bg-surface-hover rounded-sm border px-3 py-2 text-xs disabled:opacity-50"
          >
            {status}
          </button>
        ))}
        {report.pageStatus === 'disabled' ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void moderatePage('restore')}
            className="bg-success-subtle text-success ml-auto rounded-sm px-3 py-2 text-xs disabled:opacity-50"
          >
            Pulihkan halaman
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => void moderatePage('disable')}
            className="bg-error-subtle text-error ml-auto rounded-sm px-3 py-2 text-xs disabled:opacity-50"
          >
            Nonaktifkan halaman
          </button>
        )}
      </div>
    </article>
  )
}
