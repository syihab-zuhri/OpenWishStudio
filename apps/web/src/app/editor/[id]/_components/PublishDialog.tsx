'use client'

import { useState, useEffect, useCallback } from 'react'

interface PublishStatus {
  status: 'draft' | 'published' | 'unpublished'
  url: string | null
  versionNo: number | null
  expiresAt: string | null
}

interface PublishResult {
  slug: string
  url: string
  versionNo: number
  expiresAt: string | null
}

interface Props {
  projectId: string
  onClose: () => void
}

const EXPIRY_OPTIONS = [
  { label: 'Tidak ada', value: '' },
  { label: '7 hari', value: '7d' },
  { label: '30 hari', value: '30d' },
  { label: '90 hari', value: '90d' },
  { label: '1 tahun', value: '1y' },
]

function addDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

function expiryValueToISO(value: string): string | undefined {
  if (!value) return undefined
  const map: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 }
  return addDays(map[value])
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function PublishDialog({ projectId, onClose }: Props) {
  const [status, setStatus] = useState<PublishStatus | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [expiry, setExpiry] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [unpublishing, setUnpublishing] = useState(false)
  const [result, setResult] = useState<PublishResult | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch(`/api/v1/projects/${projectId}/publish-status`)
      .then((r) => r.json())
      .then((json) => {
        setStatus(json.data)
      })
      .catch(() => setLoadError(true))
  }, [projectId])

  const handlePublish = useCallback(async () => {
    setPublishing(true)
    setActionError(null)
    try {
      const body: Record<string, string> = {}
      const iso = expiryValueToISO(expiry)
      if (iso) body.expiresAt = iso

      const res = await fetch(`/api/v1/projects/${projectId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) {
        setActionError(json.error ?? 'Gagal mempublikasikan kreasi.')
      } else {
        setResult(json.data as PublishResult)
        setStatus((prev) => ({
          ...prev!,
          status: 'published',
          url: json.data.url,
          versionNo: json.data.versionNo,
          expiresAt: json.data.expiresAt,
        }))
      }
    } catch {
      setActionError('Terjadi kesalahan jaringan.')
    } finally {
      setPublishing(false)
    }
  }, [projectId, expiry])

  const handleUnpublish = useCallback(async () => {
    setUnpublishing(true)
    setActionError(null)
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/unpublish`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        setActionError(json.error ?? 'Gagal menarik publikasi.')
      } else {
        setStatus((prev) => ({ ...prev!, status: 'unpublished', url: null }))
        setResult(null)
      }
    } catch {
      setActionError('Terjadi kesalahan jaringan.')
    } finally {
      setUnpublishing(false)
    }
  }, [projectId])

  const handleCopy = useCallback(() => {
    const url = result?.url ?? status?.url
    if (!url) return
    const fullUrl = `${window.location.origin}${url}`
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [result, status])

  const isPublished = status?.status === 'published'
  const publishedUrl = result?.url ?? (isPublished ? status?.url : null)
  const fullPublishedUrl = publishedUrl ? `${typeof window !== 'undefined' ? window.location.origin : ''}${publishedUrl}` : null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Publikasikan kreasi"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <h2 className="text-base font-semibold text-neutral-900">Publikasikan Kreasi</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Loading */}
          {!status && !loadError && (
            <div className="flex justify-center py-4">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            </div>
          )}

          {loadError && (
            <p className="text-sm text-red-600 text-center">Gagal memuat status publikasi.</p>
          )}

          {status && (
            <>
              {/* Published link result */}
              {publishedUrl && (
                <div className="rounded-xl bg-green-50 border border-green-200 p-4 space-y-2">
                  <p className="text-xs font-medium text-green-700 uppercase tracking-wide">
                    {result ? 'Berhasil dipublikasikan!' : 'Sudah dipublikasikan'}
                    {status.versionNo && !result && (
                      <span className="font-normal normal-case text-green-600 ml-1">
                        · v{status.versionNo}
                      </span>
                    )}
                    {result && (
                      <span className="font-normal normal-case text-green-600 ml-1">
                        · v{result.versionNo}
                      </span>
                    )}
                  </p>
                  <div className="flex items-center gap-2">
                    <a
                      href={publishedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 truncate text-sm text-brand-600 hover:text-brand-700 underline underline-offset-2"
                    >
                      {fullPublishedUrl}
                    </a>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="shrink-0 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 transition-colors"
                    >
                      {copied ? 'Disalin!' : 'Salin'}
                    </button>
                  </div>
                  {(result?.expiresAt ?? status.expiresAt) && (
                    <p className="text-xs text-green-600">
                      Kedaluwarsa: {formatDate((result?.expiresAt ?? status.expiresAt)!)}
                    </p>
                  )}
                </div>
              )}

              {/* Expiry selector — shown when not yet published or to republish */}
              <div className="space-y-1.5">
                {!isPublished && !result && (
                  <p className="text-sm text-neutral-500">
                    {status.status === 'draft'
                      ? 'Kreasi ini belum dipublikasikan. Pilih masa berlaku lalu tekan Publikasikan.'
                      : 'Publikasi sebelumnya sudah ditarik. Publikasikan ulang di bawah.'}
                  </p>
                )}
                {(isPublished || result) && (
                  <p className="text-sm font-medium text-neutral-700">Publikasikan ulang</p>
                )}
                <label className="block text-xs font-medium text-neutral-600">
                  Masa berlaku tautan
                </label>
                <select
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                  className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400"
                >
                  {EXPIRY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Error */}
              {actionError && (
                <p className="text-sm text-red-600">{actionError}</p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {status && (
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-neutral-100 bg-neutral-50">
            <div>
              {isPublished && !result && (
                <button
                  type="button"
                  onClick={handleUnpublish}
                  disabled={unpublishing}
                  className="rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  {unpublishing ? 'Menarik…' : 'Tarik publikasi'}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-neutral-200 px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-100 transition-colors"
              >
                {result ? 'Tutup' : 'Batal'}
              </button>
              <button
                type="button"
                onClick={handlePublish}
                disabled={publishing}
                className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors disabled:opacity-50"
              >
                {publishing
                  ? 'Memproses…'
                  : isPublished && !result
                  ? 'Publikasikan ulang'
                  : 'Publikasikan'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
