'use client'

import type { Scene, ElementNode } from '@openwish/project-schema'
import type { CSSProperties } from 'react'

// ─── Safe URL ─────────────────────────────────────────────────────────────────

/**
 * Render-boundary guard. The schema already allow-lists http(s), but documents
 * can predate that validation, so nothing user-authored reaches an `href`,
 * `src` or `url()` without passing through here.
 */
function safeUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
      ? parsed.href
      : undefined
  } catch {
    return undefined
  }
}

// ─── Scene Renderer ───────────────────────────────────────────────────────────

interface SceneRendererProps {
  scene: Scene
  selectedElementId?: string | null
  /** px size of 1 design unit (390 coord → containerWidth px) */
  scale?: number
  interactive?: boolean
  audioEnabled?: boolean
  onElementClick?: (elementId: string) => void
  onElementPointerDown?: (elementId: string, e: React.PointerEvent) => void
  onHandlePointerDown?: (elementId: string, handle: 'nw' | 'ne' | 'sw' | 'se', e: React.PointerEvent) => void
}

export function SceneRenderer({
  scene,
  selectedElementId,
  scale = 1,
  interactive = false,
  audioEnabled = false,
  onElementClick,
  onElementPointerDown,
  onHandlePointerDown,
}: SceneRendererProps) {
  const w = scene.baseWidth * scale
  const h = scene.baseHeight * scale

  return (
    <div
      className="relative overflow-hidden"
      style={{ width: w, height: h, ...sceneBackground(scene) }}
    >
      {[...scene.elements]
        .sort((a, b) => a.zIndex - b.zIndex)
        .map((el) => (
          <ElementRenderer
            key={el.id}
            element={el}
            scale={scale}
            selected={selectedElementId === el.id}
            interactive={interactive}
            audioEnabled={audioEnabled}
            onClick={onElementClick}
            onPointerDown={onElementPointerDown}
            onHandlePointerDown={onHandlePointerDown}
          />
        ))}
    </div>
  )
}

// ─── Background ───────────────────────────────────────────────────────────────

function sceneBackground(scene: Scene): CSSProperties {
  const bg = scene.background
  if (bg.type === 'color') {
    return { backgroundColor: bg.color }
  }
  if (bg.type === 'gradient') {
    const stops = bg.gradient.stops
      .map((s) => `${s.color} ${s.position}%`)
      .join(', ')
    return { background: `linear-gradient(${bg.gradient.direction}deg, ${stops})` }
  }
  if (bg.type === 'image') {
    const src = safeUrl(bg.src)
    return {
      // encodeURI stops a quote or paren in the URL from closing url(...)
      backgroundImage: src ? `url("${encodeURI(src)}")` : 'none',
      backgroundSize: bg.objectFit === 'contain' ? 'contain' : bg.objectFit === 'fill' ? '100% 100%' : 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    }
  }
  return {}
}

// ─── Element Renderer ─────────────────────────────────────────────────────────

interface ElementRendererProps {
  element: ElementNode
  scale: number
  selected: boolean
  interactive: boolean
  audioEnabled: boolean
  onClick?: (elementId: string) => void
  onPointerDown?: (elementId: string, e: React.PointerEvent) => void
  onHandlePointerDown?: (elementId: string, handle: 'nw' | 'ne' | 'sw' | 'se', e: React.PointerEvent) => void
}

function ElementRenderer({
  element,
  scale,
  selected,
  interactive,
  audioEnabled,
  onClick,
  onPointerDown,
  onHandlePointerDown,
}: ElementRendererProps) {
  const style: CSSProperties = {
    position: 'absolute',
    left: element.x * scale,
    top: element.y * scale,
    width: element.width * scale,
    height: element.height * scale,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    zIndex: element.zIndex,
    pointerEvents: interactive && !element.locked ? 'auto' : 'none',
    cursor: interactive && !element.locked ? 'default' : undefined,
    outline: selected ? '2px solid #6D5EF7' : undefined,
    outlineOffset: selected ? '1px' : undefined,
  }

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
    onClick?.(element.id)
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (!interactive || element.locked) return
    e.stopPropagation()
    onPointerDown?.(element.id, e)
  }

  return (
    <div
      data-element-id={element.id}
      style={style}
      onClick={interactive ? handleClick : undefined}
      onPointerDown={interactive ? handlePointerDown : undefined}
    >
      <ElementContent element={element} scale={scale} audioEnabled={audioEnabled} />
      {selected && (
        <SelectionHandles
          elementId={element.id}
          onHandlePointerDown={onHandlePointerDown}
        />
      )}
    </div>
  )
}

// ─── Selection Handles ────────────────────────────────────────────────────────

interface SelectionHandlesProps {
  elementId: string
  onHandlePointerDown?: (elementId: string, handle: 'nw' | 'ne' | 'sw' | 'se', e: React.PointerEvent) => void
}

function SelectionHandles({ elementId, onHandlePointerDown }: SelectionHandlesProps) {
  const baseStyle: CSSProperties = {
    position: 'absolute',
    width: 8,
    height: 8,
    backgroundColor: '#6D5EF7',
    border: '1px solid #fff',
    borderRadius: 2,
    pointerEvents: onHandlePointerDown ? 'auto' : 'none',
  }

  function makeHandler(handle: 'nw' | 'ne' | 'sw' | 'se') {
    return (e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      onHandlePointerDown?.(elementId, handle, e)
    }
  }

  const cursorMap = { nw: 'nw-resize', ne: 'ne-resize', sw: 'sw-resize', se: 'se-resize' } as const

  return (
    <>
      {(['nw', 'ne', 'sw', 'se'] as const).map((handle) => (
        <div
          key={handle}
          style={{
            ...baseStyle,
            cursor: cursorMap[handle],
            top: handle.startsWith('n') ? -4 : undefined,
            bottom: handle.startsWith('s') ? -4 : undefined,
            left: handle.endsWith('w') ? -4 : undefined,
            right: handle.endsWith('e') ? -4 : undefined,
          }}
          onPointerDown={makeHandler(handle)}
        />
      ))}
    </>
  )
}

// ─── Element Content ──────────────────────────────────────────────────────────

function ElementContent({ element, scale, audioEnabled }: { element: ElementNode; scale: number; audioEnabled: boolean }) {
  switch (element.type) {
    case 'text':
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            fontFamily: element.props.fontFamily ?? 'inherit',
            fontSize: (element.props.fontSize ?? 16) * scale,
            fontWeight: element.props.fontWeight ?? 400,
            fontStyle: element.props.fontStyle ?? 'normal',
            color: element.props.color,
            textAlign: element.props.textAlign ?? 'left',
            lineHeight: element.props.lineHeight ?? 1.5,
            letterSpacing: element.props.letterSpacing
              ? `${element.props.letterSpacing * scale}px`
              : undefined,
            overflow: 'hidden',
            wordBreak: 'break-word',
            whiteSpace: 'pre-wrap',
          }}
        >
          {element.props.content}
        </div>
      )

    case 'image':
      return safeUrl(element.props.src) || element.props.assetId ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={safeUrl(element.props.src) ?? ''}
          alt={element.props.decorative ? '' : element.props.alt}
          aria-hidden={element.props.decorative}
          style={{
            width: '100%',
            height: '100%',
            objectFit: element.props.objectFit ?? 'cover',
            display: 'block',
          }}
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center bg-neutral-100"
          aria-label={element.props.alt || 'Gambar'}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            className="h-8 w-8 text-neutral-300"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
        </div>
      )

    case 'shape':
      return <ShapeElement element={element} />

    case 'icon':
      return (
        <div
          className="flex h-full w-full items-center justify-center"
          style={{ color: element.props.color ?? '#000000' }}
          aria-label={element.props.iconName}
        >
          {/* Icon placeholder — real impl would use an icon registry */}
          <span style={{ fontSize: (element.props.size ?? 24) * scale }}>
            {iconFallback(element.props.iconName)}
          </span>
        </div>
      )

    case 'button':
      return (
        <a
          href={safeUrl(element.props.url)}
          target="_blank"
          rel="noopener noreferrer nofollow"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            backgroundColor: element.props.backgroundColor ?? '#6D5EF7',
            color: element.props.textColor ?? '#FFFFFF',
            borderRadius: element.props.borderRadius ?? 999,
            fontSize: 14 * scale,
            fontWeight: 600,
            textDecoration: 'none',
            textAlign: 'center',
            padding: `${4 * scale}px ${12 * scale}px`,
            boxSizing: 'border-box',
          }}
        >
          {element.props.label}
        </a>
      )

    case 'audioControl':
      return (
        <div
          className="flex items-center gap-2 rounded-full bg-white/90 shadow-panel backdrop-blur-sm"
          style={{ padding: `${4 * scale}px ${10 * scale}px` }}
          role="group"
          aria-label={element.props.label ?? 'Audio control'}
        >
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            style={{ width: 16 * scale, height: 16 * scale, color: audioEnabled ? '#6D5EF7' : '#17171C' }}
            aria-hidden="true"
          >
            {audioEnabled ? (
              <path d="M9 4L3 9H1v6h2l6 5V4zm9.07.93a10 10 0 010 14.14M15.54 7.46a5 5 0 010 7.07" />
            ) : (
              <path d="M9 4L3 9H1v6h2l6 5V4zM23 9l-6 6m0-6l6 6" />
            )}
          </svg>
          {!element.props.compact && (
            <span style={{ fontSize: 12 * scale, color: '#17171C', whiteSpace: 'nowrap' }}>
              {audioEnabled ? (element.props.label ?? 'Putar Musik') : 'Audio nonaktif'}
            </span>
          )}
        </div>
      )

    default:
      return null
  }
}

function ShapeElement({ element }: { element: Extract<ElementNode, { type: 'shape' }> }) {
  const { shape, fill, stroke, strokeWidth = 1, borderRadius = 0 } = element.props

  const baseStyle: CSSProperties = {
    width: '100%',
    height: '100%',
    backgroundColor: fill ?? 'transparent',
    border: stroke ? `${strokeWidth}px solid ${stroke}` : 'none',
    boxSizing: 'border-box',
  }

  if (shape === 'rectangle') {
    return <div style={{ ...baseStyle, borderRadius }} />
  }

  if (shape === 'circle') {
    return <div style={{ ...baseStyle, borderRadius: '50%' }} />
  }

  // Triangle, star, heart via SVG viewport
  const viewBoxes: Record<string, string> = {
    triangle: '0 0 100 100',
    star: '0 0 100 100',
    heart: '0 0 100 100',
  }
  const paths: Record<string, string> = {
    triangle: 'M50 5 L95 95 L5 95 Z',
    star: 'M50 5 L61 35 L95 35 L68 57 L79 91 L50 70 L21 91 L32 57 L5 35 L39 35 Z',
    heart: 'M50 85 C50 85 5 55 5 28 C5 14 17 5 30 5 C40 5 50 13 50 13 C50 13 60 5 70 5 C83 5 95 14 95 28 C95 55 50 85 50 85 Z',
  }

  return (
    <svg
      viewBox={viewBoxes[shape] ?? '0 0 100 100'}
      preserveAspectRatio="none"
      style={{ width: '100%', height: '100%' }}
      aria-hidden="true"
    >
      <path
        d={paths[shape] ?? ''}
        fill={fill ?? 'transparent'}
        stroke={stroke ?? 'none'}
        strokeWidth={stroke ? strokeWidth * 2 : 0}
      />
    </svg>
  )
}

function iconFallback(iconName: string): string {
  const map: Record<string, string> = {
    heart: '♥',
    star: '★',
    check: '✓',
    arrow: '→',
    gift: '🎁',
    cake: '🎂',
    confetti: '🎉',
    flower: '🌸',
  }
  return map[iconName.toLowerCase()] ?? '◆'
}
