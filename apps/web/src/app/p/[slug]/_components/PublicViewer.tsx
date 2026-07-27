'use client'

import { useState, useCallback, type FormEvent } from 'react'
import Link from 'next/link'
import type { ProjectDocument } from '@openwish/project-schema'
import { SceneStack } from '@/features/viewer/components/SceneStack'
import { SoundtrackPlayer } from '@/features/viewer/components/SoundtrackPlayer'

interface Props {
  slug: string
  document: ProjectDocument
  expiresAt: string | null
}

const REPORT_REASONS = [
  ['harassment', 'Pelecehan atau perundungan'],
  ['sexual_content', 'Konten seksual'],
  ['fraud', 'Penipuan'],
  ['malware_phishing', 'Malware atau phishing'],
  ['copyright', 'Pelanggaran hak cipta'],
  ['privacy', 'Pelanggaran privasi'],
  ['other', 'Lainnya'],
] as const

export function PublicViewer({ slug, document, expiresAt }: Props) {
  const soundtrack = document.project.soundtrack
  const [audioEnabled, setAudioEnabled] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [reportState, setReportState] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [showAudioPrompt, setShowAudioPrompt] = useState(() => Boolean(soundtrack?.src))

  const handleEnableAudio = useCallback(() => {
    setAudioEnabled(true)
    setShowAudioPrompt(false)
  }, [])

  const handleDismissAudio = useCallback(() => {
    setShowAudioPrompt(false)
  }, [])

  const handleToggleAudio = useCallback(() => {
    if (!soundtrack?.src) return
    setShowAudioPrompt(false)
    setAudioEnabled((enabled) => !enabled)
  }, [soundtrack?.src])

  const isExpiringSoon =
    expiresAt !== null && new Date(expiresAt).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setReportState('sending')
    const formData = new FormData(event.currentTarget)
    const response = await fetch(`/api/v1/public/pages/${encodeURIComponent(slug)}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reason: formData.get('reason'),
        details: String(formData.get('details') ?? '').trim() || undefined,
        email: String(formData.get('email') ?? '').trim() || undefined,
      }),
    }).catch(() => null)
    setReportState(response?.ok ? 'success' : 'error')
  }

  return (
    <div className="bg-canvas flex min-h-screen flex-col items-center">
      {showAudioPrompt && !audioEnabled && (
        <div
          role="dialog"
          aria-label="Aktifkan audio"
          className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-8"
          style={{ background: 'rgba(3, 18, 23, 0.7)' }}
        >
          <div className="bg-surface-2 w-full max-w-sm rounded-lg p-6 text-center shadow-xl">
            <div className="mb-3 text-3xl" aria-hidden="true">
              🎵
            </div>
            <h2 className="text-text-primary mb-1 text-base font-semibold">
              Ucapan ini memiliki musik
            </h2>
            <p className="text-text-secondary mb-5 text-sm">
              Aktifkan audio untuk pengalaman terbaik.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDismissAudio}
                className="border-border-strong text-text-secondary hover:bg-surface-hover flex-1 rounded-sm border py-2.5 text-sm"
              >
                Lewati
              </button>
              <button
                onClick={handleEnableAudio}
                className="bg-primary text-text-on-primary hover:bg-primary-hover flex-1 rounded-sm py-2.5 text-sm font-semibold"
              >
                Aktifkan Audio
              </button>
            </div>
          </div>
        </div>
      )}

      {isExpiringSoon && expiresAt && (
        <div
          role="status"
          className="bg-warning-subtle text-warning w-full px-4 py-2 text-center text-xs"
        >
          Ucapan ini akan kedaluwarsa pada{' '}
          <time dateTime={expiresAt}>
            {new Date(expiresAt).toLocaleDateString('id-ID', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </time>
        </div>
      )}

      {showReport && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Laporkan halaman"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 pb-6 sm:items-center sm:pb-0"
        >
          <div className="bg-surface-2 w-full max-w-md rounded-md p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-text-primary text-base font-semibold">Laporkan halaman</h2>
                <p className="text-text-secondary mt-1 text-xs">
                  Laporan akan ditinjau oleh tim moderasi.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowReport(false)}
                className="text-text-muted hover:text-text-primary p-1"
                aria-label="Tutup formulir laporan"
              >
                ×
              </button>
            </div>

            {reportState === 'success' ? (
              <div role="status" className="text-success mt-6 text-sm">
                Terima kasih. Laporan Anda sudah diterima.
              </div>
            ) : (
              <form onSubmit={submitReport} className="mt-5 space-y-4">
                <label className="text-text-secondary block text-xs">
                  Alasan
                  <select
                    name="reason"
                    required
                    defaultValue=""
                    className="border-border bg-surface text-text-primary mt-1.5 w-full rounded-sm border px-3 py-2 text-sm"
                  >
                    <option value="" disabled>
                      Pilih alasan
                    </option>
                    {REPORT_REASONS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-text-secondary block text-xs">
                  Detail (opsional)
                  <textarea
                    name="details"
                    maxLength={2000}
                    rows={4}
                    className="border-border bg-surface text-text-primary mt-1.5 w-full resize-y rounded-sm border px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-text-secondary block text-xs">
                  Email tindak lanjut (opsional)
                  <input
                    name="email"
                    type="email"
                    maxLength={254}
                    className="border-border bg-surface text-text-primary mt-1.5 w-full rounded-sm border px-3 py-2 text-sm"
                  />
                </label>
                {reportState === 'error' && (
                  <p role="alert" className="text-error text-xs">
                    Laporan gagal dikirim. Periksa isian atau coba beberapa saat lagi.
                  </p>
                )}
                <button
                  type="submit"
                  disabled={reportState === 'sending'}
                  className="bg-primary text-text-on-primary hover:bg-primary-hover w-full rounded-sm py-2.5 text-sm font-semibold disabled:opacity-60"
                >
                  {reportState === 'sending' ? 'Mengirim…' : 'Kirim laporan'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      <main className="flex w-full flex-1 flex-col items-center">
        <SceneStack
          scenes={document.scenes}
          audioEnabled={audioEnabled}
          onAudioToggle={soundtrack?.src ? handleToggleAudio : undefined}
        />
      </main>

      {soundtrack?.src && <SoundtrackPlayer soundtrack={soundtrack} enabled={audioEnabled} />}

      <footer className="text-text-muted space-y-1 px-4 py-6 text-center text-xs">
        {soundtrack?.attribution && <p className="text-[10px]">{soundtrack.attribution}</p>}
        <p>
          Dibuat dengan{' '}
          <Link
            href="/"
            className="text-primary hover:text-primary-hover underline underline-offset-2"
          >
            OpenWish Studio
          </Link>
        </p>
        <button
          type="button"
          onClick={() => {
            setReportState('idle')
            setShowReport(true)
          }}
          className="hover:text-text-secondary underline underline-offset-2"
        >
          Laporkan halaman
        </button>
      </footer>
    </div>
  )
}
