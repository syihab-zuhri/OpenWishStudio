'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { SceneSchema } from '@openwish/project-schema'
import { SceneRenderer } from '@/features/editor/components/SceneRenderer'

interface Props {
  /** Scene mentah dari database — divalidasi dulu sebelum dirender. */
  scene: unknown
}

/**
 * Thumbnail kartu dashboard: bagian atas scene pertama, diskalakan mengikuti
 * lebar kartu. Scene yang tidak lolos schema jatuh ke placeholder emoji.
 */
export function SceneThumbnail({ scene }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState<number | null>(null)

  const parsed = useMemo(() => SceneSchema.safeParse(scene), [scene])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setWidth(el.clientWidth)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={containerRef} className="bg-canvas h-40 w-full overflow-hidden rounded-t-md">
      {parsed.success && width !== null ? (
        <SceneRenderer scene={parsed.data} scale={width / parsed.data.baseWidth} />
      ) : (
        <div className="flex h-full items-center justify-center">
          <span className="text-3xl opacity-30">🎨</span>
        </div>
      )}
    </div>
  )
}
