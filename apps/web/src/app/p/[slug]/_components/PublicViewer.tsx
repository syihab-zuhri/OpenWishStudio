'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import type { ProjectDocument } from '@openwish/project-schema'
import { SceneRenderer } from '@/features/editor/components/SceneRenderer'

interface Props {
  document: ProjectDocument
  expiresAt: string | null
}

const BASE_WIDTH = 390
const VIEWER_MAX_WIDTH = 480

export function PublicViewer({ document, expiresAt }: Props) {
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

  const isExpiringSoon =
    expiresAt !== null && new Date(expiresAt).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000

  return (
    <div className="flex min-h-screen flex-col items-center bg-neutral-950">
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

      {isExpiringSoon && expiresAt && (
        <div
          role="status"
          className="w-full border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-700"
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
