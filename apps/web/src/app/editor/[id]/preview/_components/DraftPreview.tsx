'use client'

import { useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import type { ProjectDocument } from '@openwish/project-schema'
import { SceneStack } from '@/features/viewer/components/SceneStack'
import { SoundtrackPlayer } from '@/features/viewer/components/SoundtrackPlayer'
import { runPublishPreflight } from '@/features/editor/utils/preflight'

interface Props {
  projectId: string
  projectName: string
  document: ProjectDocument
  /** Tujuan tombol kembali; default ke editor cloud milik project. */
  backHref?: Route
}

const PREVIEW_DEVICES = [
  { label: 'Ponsel', width: 375 },
  { label: 'Ponsel besar', width: 430 },
  { label: 'Tablet', width: 768 },
] as const

type PreviewWidth = (typeof PREVIEW_DEVICES)[number]['width']

export function DraftPreview({ projectId, projectName, document, backHref }: Props) {
  const soundtrack = document.project.soundtrack
  const [audioEnabled, setAudioEnabled] = useState(false)
  const [showAudioPrompt, setShowAudioPrompt] = useState(() => Boolean(soundtrack?.src))
  const [previewWidth, setPreviewWidth] = useState<PreviewWidth>(430)
  const qualityIssues = useMemo(() => runPublishPreflight(document), [document])
  const qualityErrors = qualityIssues.filter((issue) => issue.severity === 'error')

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

  return (
    <div className="bg-canvas flex min-h-screen flex-col items-center">
      {/* Draft Banner */}
      <div className="bg-surface-2 flex w-full items-center justify-between gap-4 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Link
            href={backHref ?? (`/editor/${projectId}` as Route)}
            className="text-text-secondary hover:text-text-primary flex items-center gap-1.5 text-sm transition-colors"
            aria-label="Kembali ke editor"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Editor
          </Link>
          <span className="text-text-muted text-xs">|</span>
          <span className="text-text-primary max-w-28 truncate text-sm font-medium sm:max-w-48">
            {projectName}
          </span>
        </div>
        <span className="border-border-strong bg-surface-hover text-text-secondary shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em]">
          Draft Preview
        </span>
      </div>

      <div className="border-border bg-surface flex w-full flex-col items-center justify-between gap-2 border-b px-3 py-2 sm:flex-row sm:px-4">
        <div className="border-border-strong bg-background grid w-full grid-cols-3 rounded-md border p-1 sm:w-auto">
          {PREVIEW_DEVICES.map((device) => (
            <button
              key={device.width}
              type="button"
              onClick={() => setPreviewWidth(device.width)}
              aria-pressed={previewWidth === device.width}
              className={`min-h-10 rounded-sm px-3 text-[11px] font-semibold transition-colors ${
                previewWidth === device.width
                  ? 'bg-primary text-text-on-primary'
                  : 'text-text-muted hover:bg-surface-hover hover:text-text-primary'
              }`}
            >
              {device.label}
              <span className="ml-1 hidden font-normal opacity-70 md:inline">{device.width}px</span>
            </button>
          ))}
        </div>

        <details className="border-border-strong bg-background group w-full rounded-md border sm:w-auto sm:min-w-64">
          <summary className="focus-visible:ring-primary flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 [&::-webkit-details-marker]:hidden">
            <span
              className={
                qualityErrors.length
                  ? 'text-error'
                  : qualityIssues.length
                    ? 'text-warning'
                    : 'text-success'
              }
            >
              Quality:{' '}
              {qualityIssues.length === 0 ? 'Siap publish' : `${qualityIssues.length} catatan`}
            </span>
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              className="text-text-muted h-4 w-4 transition-transform group-open:rotate-180"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeWidth="1.8" d="M5 7.5l5 5 5-5" />
            </svg>
          </summary>
          <div className="border-border border-t px-3 py-2">
            {qualityIssues.length === 0 ? (
              <p className="text-success text-xs">Semua pemeriksaan utama lolos.</p>
            ) : (
              <ul className="max-h-36 space-y-1 overflow-y-auto">
                {qualityIssues.map((issue) => (
                  <li key={issue.id} className="text-text-secondary text-[11px] leading-snug">
                    <span
                      className={issue.severity === 'error' ? 'text-error' : 'text-warning'}
                      aria-hidden="true"
                    >
                      {issue.severity === 'error' ? '●' : '▲'}
                    </span>{' '}
                    <span className="font-semibold">{issue.sceneName}:</span> {issue.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </details>
      </div>

      {/* Audio Prompt */}
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

      {/* Scenes */}
      <main className="flex w-full flex-1 flex-col items-center">
        <SceneStack
          scenes={document.scenes}
          theme={document.project.theme}
          maxWidth={previewWidth}
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
      </footer>
    </div>
  )
}
