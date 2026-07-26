'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import type { ProjectDocument } from '@openwish/project-schema'
import { SceneRenderer } from '@/features/editor/components/SceneRenderer'

interface Props {
  projectId: string
  projectName: string
  document: ProjectDocument
}

const BASE_WIDTH = 390
const VIEWER_MAX_WIDTH = 480

export function DraftPreview({ projectId, projectName, document }: Props) {
  const [audioEnabled, setAudioEnabled] = useState(false)
  const [showAudioPrompt, setShowAudioPrompt] = useState(() =>
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
    <div className="flex min-h-screen flex-col items-center bg-neutral-950">
      {/* Draft Banner */}
      <div className="flex w-full items-center justify-between gap-4 bg-violet-600 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Link
            href={`/editor/${projectId}`}
            className="flex items-center gap-1.5 text-sm text-violet-100 transition-colors hover:text-white"
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
          <span className="text-xs text-violet-300">|</span>
          <span className="max-w-48 truncate text-sm font-medium text-white">{projectName}</span>
        </div>
        <span className="shrink-0 rounded-full border border-violet-400/50 bg-violet-500/60 px-2.5 py-0.5 text-xs font-medium text-violet-100">
          Draft Preview
        </span>
      </div>

      {/* Audio Prompt */}
      {showAudioPrompt && !audioEnabled && (
        <div
          role="dialog"
          aria-label="Aktifkan audio"
          className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-8"
          style={{ background: 'rgba(0,0,0,0.6)' }}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
            <div className="mb-3 text-3xl" aria-hidden="true">
              🎵
            </div>
            <h2 className="mb-1 text-base font-semibold text-neutral-900">
              Ucapan ini memiliki musik
            </h2>
            <p className="mb-5 text-sm text-neutral-500">
              Aktifkan audio untuk pengalaman terbaik.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDismissAudio}
                className="flex-1 rounded-xl border border-neutral-200 py-2.5 text-sm text-neutral-600 hover:bg-neutral-50"
              >
                Lewati
              </button>
              <button
                onClick={handleEnableAudio}
                className="flex-1 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
              >
                Aktifkan Audio
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scenes */}
      <main
        className="flex w-full flex-col items-center gap-0 py-0"
        style={{ maxWidth: VIEWER_MAX_WIDTH }}
      >
        {document.scenes.map((scene) => {
          const scale = VIEWER_MAX_WIDTH / BASE_WIDTH

          return (
            <section
              key={scene.id}
              aria-label={scene.name}
              style={{
                width: VIEWER_MAX_WIDTH,
                aspectRatio: `${BASE_WIDTH} / ${scene.baseHeight}`,
              }}
            >
              <SceneRenderer
                scene={scene}
                scale={scale}
                interactive={false}
                audioEnabled={audioEnabled}
              />
            </section>
          )
        })}
      </main>

      <footer className="py-6 text-center text-xs text-neutral-600">
        Dibuat dengan{' '}
        <Link
          href="/"
          className="text-violet-400 underline underline-offset-2 hover:text-violet-300"
        >
          OpenWish Studio
        </Link>
      </footer>
    </div>
  )
}
