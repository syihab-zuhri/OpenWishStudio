'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import type { ProjectDocument } from '@openwish/project-schema'
import { SceneStack } from '@/features/viewer/components/SceneStack'
import { SoundtrackPlayer } from '@/features/viewer/components/SoundtrackPlayer'

interface Props {
  document: ProjectDocument
}

export function PublicViewer({ document }: Props) {
  const soundtrack = document.project.soundtrack
  const theme = document.project.theme
  const [audioEnabled, setAudioEnabled] = useState(false)
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

  return (
    <div
      className="flex min-h-dvh flex-col items-center overflow-x-hidden"
      style={{ backgroundColor: theme?.surface ?? '#FFFFFF' }}
    >
      {showAudioPrompt && !audioEnabled ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Aktifkan audio"
          className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-[max(2rem,env(safe-area-inset-bottom))] sm:items-center sm:pb-0"
          style={{ background: 'rgba(3, 18, 23, 0.72)' }}
        >
          <div className="bg-surface-2 w-full max-w-sm rounded-lg p-6 text-center shadow-xl">
            <span
              className="bg-primary-subtle text-primary mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full"
              aria-hidden="true"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 18V5l11-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="17" cy="16" r="3" />
              </svg>
            </span>
            <h2 className="text-text-primary text-base font-semibold">Ucapan ini memiliki musik</h2>
            <p className="text-text-secondary mt-1 text-sm">
              Aktifkan audio untuk pengalaman terbaik.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={handleDismissAudio}
                className="border-border-strong text-text-secondary hover:bg-surface-hover min-h-11 flex-1 rounded-sm border px-4 text-sm transition-colors"
              >
                Lewati
              </button>
              <button
                type="button"
                onClick={handleEnableAudio}
                className="bg-primary text-text-on-primary hover:bg-primary-hover min-h-11 flex-1 rounded-sm px-4 text-sm font-semibold transition-colors"
              >
                Aktifkan Audio
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <main className="flex w-full flex-1 flex-col items-center">
        <SceneStack
          scenes={document.scenes}
          theme={theme}
          audioEnabled={audioEnabled}
          onAudioToggle={soundtrack?.src ? handleToggleAudio : undefined}
          maxWidth={768}
        />
      </main>

      {soundtrack?.src ? <SoundtrackPlayer soundtrack={soundtrack} enabled={audioEnabled} /> : null}

      <footer className="w-full bg-[#071f27] px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 text-center text-[#b8c8cc]">
        {soundtrack?.attribution ? (
          <p className="mx-auto mb-2 max-w-xl text-[10px] leading-relaxed opacity-75">
            {soundtrack.attribution}
          </p>
        ) : null}
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-xs font-medium tracking-[0.04em] transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          aria-label="Dibuat dengan OpenWish Studio"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 3l2.2 5.1L20 10l-5.8 1.9L12 17l-2.2-5.1L4 10l5.8-1.9L12 3z"
            />
          </svg>
          <span>Dibuat dengan OpenWish Studio</span>
        </Link>
      </footer>
    </div>
  )
}
