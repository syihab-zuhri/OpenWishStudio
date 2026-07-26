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
  const [showAudioPrompt, setShowAudioPrompt] = useState(
    () => document.scenes.some((sc) => sc.elements.some((el) => el.type === 'audioControl')),
  )

  const handleEnableAudio = useCallback(() => {
    setAudioEnabled(true)
    setShowAudioPrompt(false)
  }, [])

  const handleDismissAudio = useCallback(() => {
    setShowAudioPrompt(false)
  }, [])

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center">
      {/* Draft Banner */}
      <div className="w-full bg-violet-600 px-4 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/editor/${projectId}`}
            className="flex items-center gap-1.5 text-sm text-violet-100 hover:text-white transition-colors"
            aria-label="Kembali ke editor"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Editor
          </Link>
          <span className="text-violet-300 text-xs">|</span>
          <span className="text-sm font-medium text-white truncate max-w-48">{projectName}</span>
        </div>
        <span className="shrink-0 rounded-full bg-violet-500/60 border border-violet-400/50 px-2.5 py-0.5 text-xs font-medium text-violet-100">
          Draft Preview
        </span>
      </div>

      {/* Audio Prompt */}
      {showAudioPrompt && !audioEnabled && (
        <div
          role="dialog"
          aria-label="Aktifkan audio"
          className="fixed inset-0 z-50 flex items-end justify-center pb-8 px-4"
          style={{ background: 'rgba(0,0,0,0.6)' }}
        >
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm text-center">
            <div className="text-3xl mb-3" aria-hidden="true">
              🎵
            </div>
            <h2 className="text-base font-semibold text-neutral-900 mb-1">
              Ucapan ini memiliki musik
            </h2>
            <p className="text-sm text-neutral-500 mb-5">
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
      <main className="w-full flex flex-col items-center gap-0 py-0" style={{ maxWidth: VIEWER_MAX_WIDTH }}>
        {document.scenes.map((scene) => {
          const scale = VIEWER_MAX_WIDTH / BASE_WIDTH

          return (
            <section
              key={scene.id}
              aria-label={scene.name}
              style={{ width: VIEWER_MAX_WIDTH, aspectRatio: `${BASE_WIDTH} / ${scene.baseHeight}` }}
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
        <a
          href="/"
          className="text-violet-400 hover:text-violet-300 underline underline-offset-2"
        >
          OpenWish Studio
        </a>
      </footer>
    </div>
  )
}
