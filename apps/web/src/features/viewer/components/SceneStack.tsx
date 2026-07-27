'use client'

import { useEffect, useRef, useState } from 'react'
import type { Scene, Theme } from '@openwish/project-schema'
import { SceneRenderer } from '@/features/editor/components/SceneRenderer'

const BASE_WIDTH = 390
const DEFAULT_MAX_WIDTH = 480

interface Props {
  scenes: Scene[]
  theme?: Theme
  audioEnabled: boolean
  onAudioToggle?: () => void
  maxWidth?: number
}

/**
 * Tumpukan scene untuk viewer publik dan draft preview. Skala dihitung dari
 * lebar container yang terukur (bukan konstanta) supaya scene tidak overflow
 * pada layar yang lebih sempit dari 480px.
 */
export function SceneStack({
  scenes,
  theme,
  audioEnabled,
  onAudioToggle,
  maxWidth = DEFAULT_MAX_WIDTH,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState<number | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setWidth(el.clientWidth)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const scale = (width ?? BASE_WIDTH) / BASE_WIDTH
  const sorted = [...scenes].sort((a, b) => a.order - b.order)

  return (
    <div ref={containerRef} className="w-full" style={{ maxWidth }}>
      {sorted.map((scene) => (
        <section
          key={scene.id}
          aria-label={scene.name}
          className="overflow-hidden"
          style={{
            aspectRatio: `${BASE_WIDTH} / ${scene.baseHeight}`,
            contentVisibility: 'auto',
            containIntrinsicSize: `${maxWidth}px ${(scene.baseHeight * maxWidth) / BASE_WIDTH}px`,
          }}
        >
          {/* Render menunggu lebar terukur agar tidak flash pada ukuran salah */}
          {width !== null && (
            <SceneRenderer
              scene={scene}
              theme={theme}
              scale={scale}
              interactive={false}
              audioEnabled={audioEnabled}
              onAudioToggle={onAudioToggle}
            />
          )}
        </section>
      ))}
    </div>
  )
}
