'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { DEFAULT_THEME, type Scene, type ElementNode, type Theme } from '@openwish/project-schema'

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
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : undefined
  } catch {
    return undefined
  }
}

// ─── Scene Renderer ───────────────────────────────────────────────────────────

interface SceneRendererProps {
  scene: Scene
  selectedElementId?: string | null
  selectedElementIds?: string[]
  editingElementId?: string | null
  theme?: Theme
  /** px size of 1 design unit (390 coord → containerWidth px) */
  scale?: number
  interactive?: boolean
  audioEnabled?: boolean
  onAudioToggle?: () => void
  onElementClick?: (elementId: string, event: React.MouseEvent) => void
  onElementDoubleClick?: (elementId: string) => void
  onTextCommit?: (elementId: string, content: string) => void
  onElementPointerDown?: (elementId: string, e: React.PointerEvent) => void
  onHandlePointerDown?: (
    elementId: string,
    handle: 'move' | 'nw' | 'ne' | 'sw' | 'se',
    e: React.PointerEvent,
  ) => void
}

export function SceneRenderer({
  scene,
  selectedElementId,
  selectedElementIds = [],
  editingElementId,
  theme = DEFAULT_THEME,
  scale = 1,
  interactive = false,
  audioEnabled = false,
  onAudioToggle,
  onElementClick,
  onElementDoubleClick,
  onTextCommit,
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
        .filter((element) => element.visible !== false)
        .sort((a, b) => a.zIndex - b.zIndex)
        .map((el) => (
          <ElementRenderer
            key={el.id}
            element={el}
            scale={scale}
            selected={selectedElementId === el.id || selectedElementIds.includes(el.id)}
            primarySelected={selectedElementId === el.id}
            editing={editingElementId === el.id}
            theme={theme}
            interactive={interactive}
            audioEnabled={audioEnabled}
            onAudioToggle={onAudioToggle}
            onClick={onElementClick}
            onDoubleClick={onElementDoubleClick}
            onTextCommit={onTextCommit}
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
    const stops = bg.gradient.stops.map((s) => `${s.color} ${s.position}%`).join(', ')
    return { background: `linear-gradient(${bg.gradient.direction}deg, ${stops})` }
  }
  if (bg.type === 'image') {
    const src = safeUrl(bg.src)
    return {
      // encodeURI stops a quote or paren in the URL from closing url(...)
      backgroundImage: src ? `url("${encodeURI(src)}")` : 'none',
      backgroundSize:
        bg.objectFit === 'contain' ? 'contain' : bg.objectFit === 'fill' ? '100% 100%' : 'cover',
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
  primarySelected: boolean
  editing: boolean
  theme: Theme
  interactive: boolean
  audioEnabled: boolean
  onAudioToggle?: () => void
  onClick?: (elementId: string, event: React.MouseEvent) => void
  onDoubleClick?: (elementId: string) => void
  onTextCommit?: (elementId: string, content: string) => void
  onPointerDown?: (elementId: string, e: React.PointerEvent) => void
  onHandlePointerDown?: (
    elementId: string,
    handle: 'move' | 'nw' | 'ne' | 'sw' | 'se',
    e: React.PointerEvent,
  ) => void
}

function ElementRenderer({
  element,
  scale,
  selected,
  primarySelected,
  editing,
  theme,
  interactive,
  audioEnabled,
  onAudioToggle,
  onClick,
  onDoubleClick,
  onTextCommit,
  onPointerDown,
  onHandlePointerDown,
}: ElementRendererProps) {
  const style: CSSProperties = {
    position: 'absolute',
    left: element.x * scale,
    top: element.y * scale,
    width: element.width * scale,
    height: element.height * scale,
    transform:
      [
        element.rotation ? `rotate(${element.rotation}deg)` : '',
        element.flipX ? 'scaleX(-1)' : '',
        element.flipY ? 'scaleY(-1)' : '',
      ]
        .filter(Boolean)
        .join(' ') || undefined,
    opacity: element.opacity ?? 1,
    boxShadow: element.shadow
      ? `${element.shadow.x * scale}px ${element.shadow.y * scale}px ${element.shadow.blur * scale}px ${element.shadow.spread * scale}px ${element.shadow.color}`
      : undefined,
    zIndex: element.zIndex,
    pointerEvents: interactive ? (!element.locked ? 'auto' : 'none') : 'auto',
    cursor: interactive && !element.locked ? 'grab' : undefined,
    // Permukaan elemen tetap bisa dipakai untuk menggeser kanvas pada layar sentuh.
    // Drag sentuh dimulai melalui move handle yang memiliki touch-action none.
    touchAction: interactive && !element.locked ? 'pan-x pan-y' : undefined,
    userSelect: interactive ? 'none' : undefined,
    WebkitUserSelect: interactive ? 'none' : undefined,
    // Selection affordance = editor chrome — ikut token design system (cream), bukan konten scene
    outline: selected ? '2px solid var(--color-primary)' : undefined,
    outlineOffset: selected ? '1px' : undefined,
  }

  const animationStyle: CSSProperties = {
    animationDuration:
      element.animation && element.animation.type !== 'none'
        ? `${element.animation.duration}ms`
        : undefined,
    animationDelay:
      element.animation && element.animation.type !== 'none'
        ? `${element.animation.delay}ms`
        : undefined,
    animationFillMode: element.animation && element.animation.type !== 'none' ? 'both' : undefined,
  }

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
    onClick?.(element.id, e)
  }

  function handleDoubleClick(e: React.MouseEvent) {
    if (!interactive) return
    e.preventDefault()
    e.stopPropagation()
    onDoubleClick?.(element.id)
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (!interactive || element.locked) return
    if ((e.target as HTMLElement).isContentEditable) return
    if (e.pointerType === 'touch') return
    e.stopPropagation()
    onPointerDown?.(element.id, e)
  }

  return (
    <div
      data-element-id={element.id}
      style={style}
      onClick={interactive ? handleClick : undefined}
      onPointerDown={interactive ? handlePointerDown : undefined}
      onDoubleClick={interactive ? handleDoubleClick : undefined}
      data-editor-element={interactive ? 'true' : undefined}
    >
      <div
        className="h-full w-full"
        data-animation={element.animation?.type ?? 'none'}
        style={animationStyle}
      >
        <ElementContent
          element={element}
          scale={scale}
          theme={theme}
          editing={editing}
          audioEnabled={audioEnabled}
          interactive={interactive}
          onAudioToggle={onAudioToggle}
          onTextCommit={onTextCommit}
        />
      </div>
      {primarySelected && (
        <SelectionHandles
          elementId={element.id}
          moveHandleInside={element.y < 56}
          onHandlePointerDown={onHandlePointerDown}
        />
      )}
    </div>
  )
}

// ─── Selection Handles ────────────────────────────────────────────────────────

interface SelectionHandlesProps {
  elementId: string
  moveHandleInside: boolean
  onHandlePointerDown?: (
    elementId: string,
    handle: 'move' | 'nw' | 'ne' | 'sw' | 'se',
    e: React.PointerEvent,
  ) => void
}

function SelectionHandles({
  elementId,
  moveHandleInside,
  onHandlePointerDown,
}: SelectionHandlesProps) {
  const baseStyle: CSSProperties = {
    position: 'absolute',
    width: 8,
    height: 8,
    backgroundColor: 'var(--color-primary)',
    border: '1.5px solid var(--color-text-on-primary)',
    borderRadius: 2,
    pointerEvents: onHandlePointerDown ? 'auto' : 'none',
    touchAction: 'none',
  }

  function makeHandler(handle: 'move' | 'nw' | 'ne' | 'sw' | 'se') {
    return (e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      onHandlePointerDown?.(elementId, handle, e)
    }
  }

  const cursorMap = { nw: 'nw-resize', ne: 'ne-resize', sw: 'sw-resize', se: 'se-resize' } as const

  return (
    <>
      {onHandlePointerDown && (
        <button
          type="button"
          aria-label="Pindahkan elemen"
          data-editor-move-handle
          onClick={(event) => event.stopPropagation()}
          onPointerDown={makeHandler('move')}
          className="border-text-on-primary bg-primary text-text-on-primary absolute left-1/2 z-[10001] flex h-11 w-11 -translate-x-1/2 cursor-grab touch-none items-center justify-center rounded-full border shadow-md active:cursor-grabbing lg:hidden"
          style={{ top: moveHandleInside ? 4 : -52 }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            className="h-5 w-5"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
              d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"
            />
          </svg>
        </button>
      )}
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

function ElementContent({
  element,
  scale,
  theme,
  editing,
  audioEnabled,
  interactive,
  onAudioToggle,
  onTextCommit,
}: {
  element: ElementNode
  scale: number
  theme: Theme
  editing: boolean
  audioEnabled: boolean
  interactive: boolean
  onAudioToggle?: () => void
  onTextCommit?: (elementId: string, content: string) => void
}) {
  switch (element.type) {
    case 'text':
      return (
        <div
          contentEditable={editing}
          suppressContentEditableWarning
          role={editing ? 'textbox' : undefined}
          aria-multiline={editing || undefined}
          onBlur={(event) => {
            if (editing) onTextCommit?.(element.id, event.currentTarget.innerText)
          }}
          onKeyDown={(event) => {
            if (!editing) return
            if (
              event.key === 'Escape' ||
              (event.key === 'Enter' && (event.ctrlKey || event.metaKey))
            ) {
              event.preventDefault()
              event.currentTarget.blur()
            }
          }}
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent:
              element.props.verticalAlign === 'bottom'
                ? 'flex-end'
                : element.props.verticalAlign === 'middle'
                  ? 'center'
                  : 'flex-start',
            fontFamily: element.props.fontFamily ?? theme.bodyFont,
            fontSize: (element.props.fontSize ?? 16) * scale,
            fontWeight: element.props.fontWeight ?? 400,
            fontStyle: element.props.fontStyle ?? 'normal',
            color: element.props.color,
            textAlign: element.props.textAlign ?? 'left',
            textDecoration: element.props.textDecoration ?? 'none',
            lineHeight: element.props.lineHeight ?? 1.5,
            letterSpacing: element.props.letterSpacing
              ? `${element.props.letterSpacing * scale}px`
              : undefined,
            overflow: 'hidden',
            wordBreak: 'break-word',
            whiteSpace: 'pre-wrap',
            boxSizing: 'border-box',
            padding: (element.props.padding ?? 0) * scale,
            borderRadius: (element.props.borderRadius ?? 0) * scale,
            backgroundColor: element.props.backgroundColor,
            textShadow: element.props.textShadow
              ? `${element.props.textShadow.x * scale}px ${element.props.textShadow.y * scale}px ${element.props.textShadow.blur * scale}px ${element.props.textShadow.color}`
              : undefined,
            cursor: editing ? 'text' : undefined,
            userSelect: editing ? 'text' : undefined,
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
            objectPosition: `${element.props.objectPositionX ?? 50}% ${element.props.objectPositionY ?? 50}%`,
            borderRadius: (element.props.borderRadius ?? 0) * scale,
            border:
              element.props.borderColor && (element.props.borderWidth ?? 0) > 0
                ? `${(element.props.borderWidth ?? 0) * scale}px solid ${element.props.borderColor}`
                : undefined,
            boxSizing: 'border-box',
            filter: `brightness(${element.props.brightness ?? 1}) contrast(${element.props.contrast ?? 1}) saturate(${element.props.saturation ?? 1})`,
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
          style={{
            color: element.props.color ?? theme.primary,
            backgroundColor: element.props.backgroundColor,
            borderRadius: (element.props.borderRadius ?? 0) * scale,
          }}
          aria-label={element.props.accessibleLabel ?? element.props.iconName}
        >
          <IconGlyph
            name={element.props.iconName}
            size={(element.props.size ?? 24) * scale}
            strokeWidth={element.props.strokeWidth ?? 2}
          />
        </div>
      )

    case 'button':
      return (
        <a
          href={safeUrl(element.props.url)}
          target="_blank"
          rel="noopener noreferrer nofollow"
          onClick={interactive ? (event) => event.preventDefault() : undefined}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            backgroundColor: element.props.backgroundColor ?? theme.primary,
            color: element.props.textColor ?? theme.surface,
            borderRadius: element.props.borderRadius ?? 999,
            border:
              element.props.borderColor && (element.props.borderWidth ?? 0) > 0
                ? `${(element.props.borderWidth ?? 0) * scale}px solid ${element.props.borderColor}`
                : undefined,
            fontFamily: element.props.fontFamily ?? theme.bodyFont,
            fontSize: (element.props.fontSize ?? 14) * scale,
            fontWeight: element.props.fontWeight ?? 600,
            textDecoration: 'none',
            textAlign: 'center',
            padding: `${4 * scale}px ${12 * scale}px`,
            boxSizing: 'border-box',
          }}
        >
          {element.props.iconName && element.props.iconPosition !== 'right' ? (
            <IconGlyph name={element.props.iconName} size={16 * scale} strokeWidth={2} />
          ) : null}
          <span style={{ marginInline: element.props.iconName ? 4 * scale : 0 }}>
            {element.props.label}
          </span>
          {element.props.iconName && element.props.iconPosition === 'right' ? (
            <IconGlyph name={element.props.iconName} size={16 * scale} strokeWidth={2} />
          ) : null}
        </a>
      )

    case 'audioControl':
      return (
        <div
          className="flex items-center gap-2 rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.12)] backdrop-blur-sm"
          style={{
            padding: `${4 * scale}px ${10 * scale}px`,
            backgroundColor: element.props.backgroundColor ?? '#FFFFFFE6',
            color: element.props.color ?? theme.text,
          }}
          role={onAudioToggle ? 'button' : 'group'}
          tabIndex={onAudioToggle ? 0 : undefined}
          aria-pressed={onAudioToggle ? audioEnabled : undefined}
          onClick={onAudioToggle}
          onKeyDown={
            onAudioToggle
              ? (event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onAudioToggle()
                  }
                }
              : undefined
          }
          aria-label={element.props.label ?? 'Audio control'}
        >
          <IconGlyph
            name={audioEnabled ? 'volume' : 'volume-off'}
            size={16 * scale}
            strokeWidth={2}
          />
          {!element.props.compact && (
            <span
              style={{
                fontSize: 12 * scale,
                color: element.props.color ?? theme.text,
                whiteSpace: 'nowrap',
              }}
            >
              {audioEnabled ? (element.props.label ?? 'Putar Musik') : 'Audio nonaktif'}
            </span>
          )}
        </div>
      )

    case 'countdown':
      return <CountdownContent element={element} scale={scale} theme={theme} />

    case 'location':
      return (
        <LocationContent element={element} scale={scale} theme={theme} interactive={interactive} />
      )

    case 'saveDate':
      return (
        <SaveDateContent element={element} scale={scale} theme={theme} interactive={interactive} />
      )

    default:
      return null
  }
}

function CountdownContent({
  element,
  scale,
  theme,
}: {
  element: Extract<ElementNode, { type: 'countdown' }>
  scale: number
  theme: Theme
}) {
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const target = new Date(element.props.target).getTime()
  const distance = now === null || Number.isNaN(target) ? null : Math.max(0, target - now)
  const expired = distance === 0
  const values =
    distance === null
      ? ['--', '--', '--', '--']
      : [
          Math.floor(distance / 86_400_000),
          Math.floor((distance / 3_600_000) % 24),
          Math.floor((distance / 60_000) % 60),
          Math.floor((distance / 1000) % 60),
        ].map((value) => String(value).padStart(2, '0'))
  const labels = ['Hari', 'Jam', 'Menit', 'Detik']

  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center"
      style={{ color: element.props.color ?? theme.text, fontFamily: theme.bodyFont }}
      aria-label={expired ? element.props.expiredLabel : element.props.label}
    >
      <p style={{ fontSize: 11 * scale, marginBottom: 8 * scale }}>
        {expired ? element.props.expiredLabel : element.props.label}
      </p>
      {!expired ? (
        <div className="flex items-start justify-center" style={{ gap: 8 * scale }}>
          {values.map((value, index) => (
            <div key={labels[index]} className="text-center">
              <strong
                className="block tabular-nums"
                style={{
                  color: element.props.accentColor ?? theme.primary,
                  fontSize: 24 * scale,
                }}
              >
                {value}
              </strong>
              {element.props.showLabels ? (
                <span style={{ fontSize: 8 * scale, opacity: 0.72 }}>{labels[index]}</span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function LocationContent({
  element,
  scale,
  theme,
  interactive,
}: {
  element: Extract<ElementNode, { type: 'location' }>
  scale: number
  theme: Theme
  interactive: boolean
}) {
  return (
    <div
      className="flex h-full w-full flex-col justify-center"
      style={{
        border: `1px solid ${theme.primary}33`,
        borderRadius: 16 * scale,
        backgroundColor: theme.surface,
        color: theme.text,
        padding: 16 * scale,
        fontFamily: theme.bodyFont,
      }}
    >
      <div className="flex items-center" style={{ gap: 8 * scale }}>
        <IconGlyph name="map-pin" size={20 * scale} strokeWidth={2} />
        <strong style={{ fontFamily: theme.headingFont, fontSize: 16 * scale }}>
          {element.props.name}
        </strong>
      </div>
      <p style={{ marginTop: 6 * scale, fontSize: 11 * scale, lineHeight: 1.45, opacity: 0.75 }}>
        {element.props.address}
      </p>
      {element.props.showMap ? (
        element.props.mapEmbedUrl ? (
          <a
            href={safeUrl(element.props.mapEmbedUrl)}
            target="_blank"
            rel="noopener noreferrer nofollow"
            onClick={interactive ? (event) => event.preventDefault() : undefined}
            className="flex items-center justify-center"
            style={{
              minHeight: 48 * scale,
              marginTop: 8 * scale,
              borderRadius: 8 * scale,
              backgroundColor: `${theme.primary}12`,
              color: theme.primary,
              fontSize: 10 * scale,
              textDecoration: 'none',
            }}
          >
            <IconGlyph name="map-pin" size={14 * scale} strokeWidth={2} />
            <span style={{ marginLeft: 5 * scale }}>Lihat peta</span>
          </a>
        ) : (
          <div
            className="flex items-center justify-center"
            style={{
              minHeight: 40 * scale,
              marginTop: 8 * scale,
              borderRadius: 8 * scale,
              backgroundColor: `${theme.text}08`,
              fontSize: 9 * scale,
              opacity: 0.55,
            }}
          >
            Tambahkan URL peta
          </div>
        )
      ) : null}
      {element.props.directionsUrl ? (
        <a
          href={safeUrl(element.props.directionsUrl)}
          target="_blank"
          rel="noopener noreferrer nofollow"
          onClick={interactive ? (event) => event.preventDefault() : undefined}
          style={{
            marginTop: 10 * scale,
            color: theme.primary,
            fontSize: 11 * scale,
            fontWeight: 700,
          }}
        >
          {element.props.buttonLabel} →
        </a>
      ) : null}
    </div>
  )
}

function calendarUrl(element: Extract<ElementNode, { type: 'saveDate' }>): string {
  const utc = (value: string) =>
    new Date(value)
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}Z$/, 'Z')
  const endAt =
    element.props.endAt ??
    new Date(new Date(element.props.startAt).getTime() + 3_600_000).toISOString()
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: element.props.title,
    dates: `${utc(element.props.startAt)}/${utc(endAt)}`,
  })
  if (element.props.location) params.set('location', element.props.location)
  if (element.props.description) params.set('details', element.props.description)
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

function SaveDateContent({
  element,
  scale,
  theme,
  interactive,
}: {
  element: Extract<ElementNode, { type: 'saveDate' }>
  scale: number
  theme: Theme
  interactive: boolean
}) {
  const date = new Date(element.props.startAt)
  return (
    <a
      href={calendarUrl(element)}
      target="_blank"
      rel="noopener noreferrer nofollow"
      onClick={interactive ? (event) => event.preventDefault() : undefined}
      className="flex h-full w-full items-center justify-center"
      style={{
        gap: 10 * scale,
        borderRadius: 999,
        backgroundColor: theme.primary,
        color: theme.surface,
        fontFamily: theme.bodyFont,
        fontSize: 12 * scale,
        fontWeight: 700,
        textDecoration: 'none',
      }}
    >
      <IconGlyph name="calendar" size={18 * scale} strokeWidth={2} />
      <span>
        {element.props.buttonLabel} ·{' '}
        {date.toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })}
      </span>
    </a>
  )
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
    heart:
      'M50 85 C50 85 5 55 5 28 C5 14 17 5 30 5 C40 5 50 13 50 13 C50 13 60 5 70 5 C83 5 95 14 95 28 C95 55 50 85 50 85 Z',
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

function IconGlyph({
  name,
  size,
  strokeWidth,
}: {
  name: string
  size: number
  strokeWidth: number
}) {
  const paths: Record<string, string[]> = {
    heart: [
      'M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 00-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 000-7.8z',
    ],
    star: ['M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2L5.8 21 7 14.2 2 9.3l6.9-1L12 2z'],
    check: ['M20 6L9 17l-5-5'],
    arrow: ['M5 12h14', 'M13 6l6 6-6 6'],
    gift: [
      'M20 12v10H4V12',
      'M2 7h20v5H2z',
      'M12 7v15',
      'M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7zm0 0h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z',
    ],
    cake: ['M4 12h16v9H4z', 'M4 16c2 2 4-2 6 0s4 2 6 0 4 2 4 2', 'M8 12V8m4 4V7m4 5V8'],
    confetti: ['M4 20l4-12 8 8-12 4z', 'M14 4l1-2', 'M18 8l3-1', 'M17 3l2-2'],
    flower: [
      'M12 12c-5-1-5-7-1-8 3 0 5 3 4 6 3-1 6 1 6 4-1 3-7 3-8-1-1 5-7 5-8 1-3-2-1-5 2-6-1-3 1-6 4-6z',
      'M12 12v10',
    ],
    image: [
      'M3 5a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5z',
      'M8.5 9a1.5 1.5 0 100-3 1.5 1.5 0 000 3z',
      'M21 15l-5-5L5 21',
    ],
    'map-pin': ['M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1116 0z', 'M12 13a3 3 0 100-6 3 3 0 000 6z'],
    calendar: ['M3 5h18v16H3z', 'M16 3v4M8 3v4M3 10h18'],
    volume: ['M11 5L6 9H2v6h4l5 4V5z', 'M15 9a4 4 0 010 6', 'M18 6a8 8 0 010 12'],
    'volume-off': ['M11 5L6 9H2v6h4l5 4V5z', 'M17 9l5 5m0-5l-5 5'],
  }
  const selected = paths[name.toLowerCase()] ?? paths.star
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {selected.map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  )
}
