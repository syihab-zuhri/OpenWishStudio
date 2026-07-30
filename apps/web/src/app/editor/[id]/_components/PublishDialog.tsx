'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { DEFAULT_THEME, type ProjectDocument } from '@openwish/project-schema'
import { runPublishPreflight } from '@/features/editor/utils/preflight'
import dynamic from 'next/dynamic'

const ShareCenter = dynamic(() => import('./ShareCenter').then((module) => module.ShareCenter))

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
  document: ProjectDocument
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

export function PublishDialog({ projectId, document, onClose }: Props) {
  const [status, setStatus] = useState<PublishStatus | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [expiry, setExpiry] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [unpublishing, setUnpublishing] = useState(false)
  const [result, setResult] = useState<PublishResult | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const preflight = useMemo(() => runPublishPreflight(document), [document])
  const preflightErrors = preflight.filter((item) => item.severity === 'error')

  useEffect(() => {
    fetch(`/api/v1/projects/${projectId}/publish-status`, {
      signal: AbortSignal.timeout(30_000),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error('publish-status failed')
        // Respons API tidak dibungkus {data} — payload langsung di level atas
        return (await r.json()) as PublishStatus
      })
      .then((data) => setStatus(data))
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
        signal: AbortSignal.timeout(30_000),
      })
      const json = (await res.json()) as PublishResult & { error?: string }
      if (!res.ok) {
        setActionError(json.error ?? 'Gagal mempublikasikan kreasi.')
      } else {
        setResult(json)
        setStatus((prev) => ({
          ...prev!,
          status: 'published',
          url: json.url,
          versionNo: json.versionNo,
          expiresAt: json.expiresAt,
        }))
      }
    } catch (err) {
      const timedOut = err instanceof DOMException && err.name === 'TimeoutError'
      setActionError(
        timedOut
          ? 'Server tidak merespons dalam 30 detik. Coba lagi sebentar lagi.'
          : 'Terjadi kesalahan jaringan.',
      )
    } finally {
      setPublishing(false)
    }
  }, [projectId, expiry])

  const handleUnpublish = useCallback(async () => {
    setUnpublishing(true)
    setActionError(null)
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/unpublish`, {
        method: 'POST',
        signal: AbortSignal.timeout(30_000),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        setActionError(json.error ?? 'Gagal menarik publikasi.')
      } else {
        setStatus((prev) => ({ ...prev!, status: 'unpublished', url: null }))
        setResult(null)
      }
    } catch (err) {
      const timedOut = err instanceof DOMException && err.name === 'TimeoutError'
      setActionError(
        timedOut
          ? 'Server tidak merespons dalam 30 detik. Coba lagi sebentar lagi.'
          : 'Terjadi kesalahan jaringan.',
      )
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
  const fullPublishedUrl = publishedUrl
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}${publishedUrl}`
    : null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Publikasikan kreasi"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(3, 18, 23, 0.6)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-surface-2 flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-lg shadow-xl">
        {/* Header */}
        <div className="border-border flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-text-primary text-base font-semibold">Publikasikan Kreasi</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="text-text-muted hover:bg-surface-hover hover:text-text-primary rounded-sm p-1.5 transition-colors"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto px-6 py-5">
          {/* Loading */}
          {!status && !loadError && (
            <div className="flex justify-center py-4">
              <div className="border-primary h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" />
            </div>
          )}

          {loadError && (
            <p className="text-error text-center text-sm">Gagal memuat status publikasi.</p>
          )}

          {status && (
            <>
              <div
                className={`rounded-md border p-3 ${
                  preflightErrors.length
                    ? 'border-error/35 bg-error-subtle'
                    : 'border-border bg-background'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-text-primary text-xs font-semibold">
                    Pemeriksaan sebelum publish
                  </p>
                  <span className="text-text-muted text-[10px] tabular-nums">
                    {preflight.length === 0 ? 'Siap' : `${preflight.length} catatan`}
                  </span>
                </div>
                {preflight.length === 0 ? (
                  <p className="text-success mt-1 text-xs">Tidak ada masalah yang ditemukan.</p>
                ) : (
                  <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto">
                    {preflight.map((item) => (
                      <li
                        key={item.id}
                        className={`text-[11px] ${
                          item.severity === 'error' ? 'text-error' : 'text-warning'
                        }`}
                      >
                        <span className="font-medium">{item.sceneName}:</span> {item.message}
                      </li>
                    ))}
                  </ul>
                )}
                {preflightErrors.length > 0 && (
                  <p className="text-error mt-2 text-[10px]">
                    Perbaiki masalah berwarna merah sebelum melanjutkan.
                  </p>
                )}
              </div>

              {/* Published link result */}
              {publishedUrl && (
                <div className="border-success/25 bg-success-subtle space-y-2 rounded-md border p-4">
                  <p className="text-success text-xs font-medium uppercase tracking-[0.08em]">
                    {result ? 'Berhasil dipublikasikan!' : 'Sudah dipublikasikan'}
                    {status.versionNo && !result && (
                      <span className="text-success/80 ml-1 font-normal normal-case">
                        · v{status.versionNo}
                      </span>
                    )}
                    {result && (
                      <span className="text-success/80 ml-1 font-normal normal-case">
                        · v{result.versionNo}
                      </span>
                    )}
                  </p>
                  <div className="flex items-center gap-2">
                    <a
                      href={publishedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary-hover flex-1 truncate text-sm underline underline-offset-2"
                    >
                      {fullPublishedUrl}
                    </a>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="border-border-strong text-text-secondary hover:bg-surface-hover shrink-0 rounded-sm border px-3 py-1.5 text-xs font-medium transition-colors"
                    >
                      {copied ? 'Disalin!' : 'Salin'}
                    </button>
                  </div>
                  {(result?.expiresAt ?? status.expiresAt) && (
                    <p className="text-success/80 text-xs">
                      Kedaluwarsa: {formatDate((result?.expiresAt ?? status.expiresAt)!)}
                    </p>
                  )}
                </div>
              )}

              {fullPublishedUrl && (
                <ShareCenter
                  title={document.project.title}
                  url={fullPublishedUrl}
                  theme={document.project.theme ?? DEFAULT_THEME}
                />
              )}

              {/* Expiry selector — shown when not yet published or to republish */}
              <div className="space-y-1.5">
                {!isPublished && !result && (
                  <p className="text-text-secondary text-sm">
                    {status.status === 'draft'
                      ? 'Kreasi ini belum dipublikasikan. Pilih masa berlaku lalu tekan Publikasikan.'
                      : 'Publikasi sebelumnya sudah ditarik. Publikasikan ulang di bawah.'}
                  </p>
                )}
                {(isPublished || result) && (
                  <p className="text-text-secondary text-sm font-medium">Publikasikan ulang</p>
                )}
                <label className="text-text-secondary block text-xs font-medium">
                  Masa berlaku tautan
                </label>
                <select
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                  className="border-border-strong bg-background text-text-primary focus:border-primary focus:ring-primary/35 w-full rounded-sm border px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
                >
                  {EXPIRY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Error */}
              {actionError && <p className="text-error text-sm">{actionError}</p>}
            </>
          )}
        </div>

        {/* Footer */}
        {status && (
          <div className="border-border flex shrink-0 items-center justify-between gap-3 border-t px-6 py-4">
            <div>
              {isPublished && !result && (
                <button
                  type="button"
                  onClick={handleUnpublish}
                  disabled={unpublishing}
                  className="text-error hover:bg-error-subtle rounded-sm px-3 py-2 text-sm transition-colors disabled:opacity-50"
                >
                  {unpublishing ? 'Menarik…' : 'Tarik publikasi'}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="border-border-strong text-text-secondary hover:bg-surface-hover rounded-sm border px-4 py-2 text-sm transition-colors"
              >
                {result ? 'Tutup' : 'Batal'}
              </button>
              <button
                type="button"
                onClick={handlePublish}
                disabled={publishing || preflightErrors.length > 0}
                className="bg-primary text-text-on-primary hover:bg-primary-hover rounded-sm px-4 py-2 text-xs font-semibold uppercase tracking-[0.06em] transition-colors disabled:opacity-50"
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
