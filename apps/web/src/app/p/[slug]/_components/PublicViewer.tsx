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

      <footer className="text-text-muted py-6 text-center text-xs">
        Dibuat dengan{' '}
        <Link
          href="/"
          className="text-primary hover:text-primary-hover underline underline-offset-2"
        >
          OpenWish Studio
        </Link>
      </footer>
    </div>
  )
}
