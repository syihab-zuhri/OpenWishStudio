'use client'

import { useEffect, useRef } from 'react'
import type { Soundtrack } from '@openwish/project-schema'

interface Props {
  soundtrack: Soundtrack
  enabled: boolean
}

/**
 * Pemutar musik latar halaman ucapan. Autoplay dilarang browser sebelum ada
 * gestur user, jadi play hanya dipanggil setelah `enabled` (dari prompt audio).
 */
export function SoundtrackPlayer({ soundtrack, enabled }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    el.volume = soundtrack.volume ?? 1
    if (enabled) {
      void el.play().catch(() => {
        // Ditolak browser (mis. tab belum pernah di-interaksi) — biarkan senyap.
      })
    } else {
      el.pause()
    }
  }, [enabled, soundtrack.volume])

  if (!soundtrack.src) return null

  return (
    <audio
      ref={audioRef}
      src={soundtrack.src}
      loop={soundtrack.loop ?? true}
      preload="none"
      aria-hidden="true"
    />
  )
}
