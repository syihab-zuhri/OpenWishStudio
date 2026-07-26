'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import type { ProjectDocument } from '@openwish/project-schema'
import { SceneStack } from '@/features/viewer/components/SceneStack'
import { SoundtrackPlayer } from '@/features/viewer/components/SoundtrackPlayer'

interface Props {
  projectId: string
  projectName: string
  document: ProjectDocument
  /** Tujuan tombol kembali; default ke editor cloud milik project. */
  backHref?: Route
}

export function DraftPreview({ projectId, projectName, document, backHref }: Props) {
  const soundtrack = document.project.soundtrack
  const [audioEnabled, setAudioEnabled] = useState(false)
  const [showAudioPrompt, setShowAudioPrompt] = useState(
    () =>
      Boolean(soundtrack?.src) ||
      document.scenes.some((sc) => sc.elements.some((el) => el.type === 'audioControl')),
  )

  const handleEnableAudio = useCallback(() => {
    setAudioEnabled(true)
    setShowAudioPrompt(false)
  }, [])

  const handleDismissAudio = useCallback(() => {
    setShowAudioPrompt(false)
  }, [])

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
        <SceneStack scenes={document.scenes} audioEnabled={audioEnabled} />
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
