'use client'

import { useEffect, useCallback, useRef, useState } from 'react'
import type { ProjectDocument } from '@openwish/project-schema'
import { initEditorStore, useEditorStore, type SaveStatus } from '@/features/editor/store/editorStore'
import { SceneRenderer } from '@/features/editor/components/SceneRenderer'
import { useDrag } from '@/features/editor/hooks/useDrag'
import { useAutosave } from '@/features/editor/hooks/useAutosave'
import { PublishDialog } from './PublishDialog'

interface Props {
  projectId: string
  initialName: string
  initialDocument: unknown
  initialRevision: number
}

export default function EditorShell({
  projectId,
  initialName,
  initialDocument,
}: Props) {
  // Bootstrap store once on mount
  useEffect(() => {
    initEditorStore(
      projectId,
      initialName,
      initialDocument as ProjectDocument,
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  return <EditorLayout />
}

// ─── Main layout (reads from store) ──────────────────────────────────────────

function EditorLayout() {
  const projectName = useEditorStore((s) => s.projectName)
  const projectId = useEditorStore((s) => s.projectId)
  const saveStatus = useEditorStore((s) => s.saveStatus)
  const undo = useEditorStore((s) => s.undo)
  const redo = useEditorStore((s) => s.redo)
  const [showPublish, setShowPublish] = useState(false)

  useAutosave()

  // Keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const mac = navigator.platform.startsWith('Mac')
      const ctrl = mac ? e.metaKey : e.ctrlKey
      if (!ctrl) return
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      if ((e.key === 'z' && e.shiftKey) || e.key === 'y') { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undo, redo])

  return (
    <div className="flex h-screen flex-col bg-neutral-50">
      {/* Topbar */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-4">
        <div className="flex items-center gap-3">
          <a
            href="/dashboard"
            className="rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="Kembali ke dashboard"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </a>
          <ProjectNameField />
        </div>

        <div className="flex items-center gap-2">
          <SaveStatusBadge status={saveStatus} />
          <a
            href={`/editor/${projectId}/preview`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-50"
          >
            Preview
          </a>
          <button
            type="button"
            onClick={() => setShowPublish(true)}
            className="rounded-md bg-brand-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-600"
          >
            Publish
          </button>
        </div>
      </header>

      {showPublish && (
        <PublishDialog projectId={projectId} onClose={() => setShowPublish(false)} />
      )}

      {/* Editor body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left toolbar */}
        <aside className="flex w-16 flex-col items-center gap-4 border-r border-neutral-200 bg-white py-4">
          <SidebarIcon label="Elemen" icon="✦" />
          <SidebarIcon label="Template" icon="⊞" />
          <SidebarIcon label="Aset" icon="📁" />
          <SidebarIcon label="Musik" icon="♪" />
        </aside>

        {/* Scene navigator */}
        <SceneNavigator />

        {/* Canvas workspace */}
        <CanvasWorkspace />

        {/* Right inspector */}
        <InspectorPanel />
      </div>
    </div>
  )
}

// ─── Project name (inline edit) ───────────────────────────────────────────────

function ProjectNameField() {
  const projectName = useEditorStore((s) => s.projectName)
  const setProjectName = useEditorStore((s) => s.setProjectName)
  const ref = useRef<HTMLSpanElement>(null)

  function handleBlur() {
    const val = ref.current?.textContent?.trim() ?? ''
    if (val && val !== projectName) setProjectName(val)
    else if (ref.current) ref.current.textContent = projectName
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); ref.current?.blur() }
    if (e.key === 'Escape') { if (ref.current) ref.current.textContent = projectName; ref.current?.blur() }
  }

  return (
    <span
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label="Nama kreasi"
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className="max-w-[220px] truncate rounded px-1 text-sm font-medium text-neutral-900 outline-none focus:bg-neutral-50 focus:ring-1 focus:ring-brand-500"
    >
      {projectName}
    </span>
  )
}

// ─── Save status badge ────────────────────────────────────────────────────────

const statusMap: Record<SaveStatus, { label: string; className: string }> = {
  saved:   { label: 'Tersimpan',   className: 'text-success-700' },
  saving:  { label: 'Menyimpan…',  className: 'text-neutral-400' },
  unsaved: { label: 'Belum tersimpan', className: 'text-warning-600' },
  error:   { label: 'Gagal simpan', className: 'text-danger-600' },
  offline: { label: 'Offline',     className: 'text-neutral-400' },
}

function SaveStatusBadge({ status }: { status: SaveStatus }) {
  const { label, className } = statusMap[status]
  return <span className={`text-xs ${className}`}>{label}</span>
}

// ─── Scene navigator ──────────────────────────────────────────────────────────

function SceneNavigator() {
  const scenes = useEditorStore((s) => s.document.scenes)
  const selectedSceneId = useEditorStore((s) => s.selectedSceneId)
  const selectScene = useEditorStore((s) => s.selectScene)
  const addScene = useEditorStore((s) => s.addScene)
  const deleteScene = useEditorStore((s) => s.deleteScene)
  const duplicateScene = useEditorStore((s) => s.duplicateScene)
  const zoom = useEditorStore((s) => s.zoom)

  const sorted = [...scenes].sort((a, b) => a.order - b.order)
  const THUMB_SCALE = 0.18

  return (
    <div className="flex w-44 shrink-0 flex-col border-r border-neutral-200 bg-white">
      <div className="flex items-center justify-between border-b border-neutral-100 px-3 py-2">
        <span className="text-xs font-medium text-neutral-500">Scene</span>
        <span className="text-xs text-neutral-400">{scenes.length}</span>
      </div>
      <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
        {sorted.map((scene, index) => {
          const isSelected = scene.id === selectedSceneId
          return (
            <div key={scene.id} className="group relative">
              <button
                type="button"
                onClick={() => selectScene(scene.id)}
                className={`w-full rounded-md border text-left transition-colors ${
                  isSelected
                    ? 'border-brand-500 bg-brand-500/5'
                    : 'border-neutral-100 bg-neutral-50 hover:border-neutral-200'
                }`}
              >
                {/* Thumbnail */}
                <div
                  className="overflow-hidden rounded-t-md"
                  style={{
                    width: '100%',
                    height: scene.baseHeight * THUMB_SCALE * (152 / scene.baseWidth),
                  }}
                >
                  <div style={{ transform: `scale(${THUMB_SCALE * (152 / scene.baseWidth)})`, transformOrigin: 'top left' }}>
                    <SceneRenderer scene={scene} scale={1} />
                  </div>
                </div>
                <div className="px-2 py-1">
                  <p className={`truncate text-xs font-medium ${isSelected ? 'text-brand-500' : 'text-neutral-700'}`}>
                    {scene.name}
                  </p>
                  <p className="text-[10px] text-neutral-400">#{index + 1}</p>
                </div>
              </button>
              {/* Context actions on hover */}
              <div className="absolute right-1 top-1 hidden gap-0.5 group-hover:flex">
                <IconAction
                  label="Duplikasi scene"
                  onClick={() => duplicateScene(scene.id)}
                >
                  <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                    <rect x="3" y="5" width="8" height="8" rx="1.5" />
                    <path d="M6 3V2a1 1 0 011-1h6a1 1 0 011 1v7a1 1 0 01-1 1h-1" />
                  </svg>
                </IconAction>
                {scenes.length > 1 && (
                  <IconAction
                    label="Hapus scene"
                    onClick={() => deleteScene(scene.id)}
                    danger
                  >
                    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                      <path d="M6.5 1h3a.5.5 0 010 1h-3a.5.5 0 010-1zM2 3.5A.5.5 0 012.5 3h11a.5.5 0 010 1h-.5v9a1 1 0 01-1 1h-7a1 1 0 01-1-1V4H2.5a.5.5 0 01-.5-.5z" />
                    </svg>
                  </IconAction>
                )}
              </div>
            </div>
          )
        })}
        <button
          type="button"
          onClick={addScene}
          className="mt-1 rounded-md border border-dashed border-neutral-200 px-2 py-2 text-xs text-neutral-400 transition-colors hover:border-brand-500 hover:text-brand-500"
        >
          + Tambah Scene
        </button>
      </div>
    </div>
  )
}

function IconAction({
  label,
  onClick,
  danger,
  children,
}: {
  label: string
  onClick: () => void
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      className={`rounded p-0.5 transition-colors ${
        danger
          ? 'bg-white text-danger-600 hover:bg-danger-600 hover:text-white'
          : 'bg-white text-neutral-500 hover:bg-neutral-100'
      }`}
    >
      {children}
    </button>
  )
}

// ─── Canvas workspace ─────────────────────────────────────────────────────────

function CanvasWorkspace() {
  const scene = useEditorStore((s) => {
    const id = s.selectedSceneId
    return s.document.scenes.find((sc) => sc.id === id) ?? s.document.scenes[0]
  })
  const zoom = useEditorStore((s) => s.zoom)
  const setZoom = useEditorStore((s) => s.setZoom)
  const selectedElementId = useEditorStore((s) => s.selectedElementId)
  const selectElement = useEditorStore((s) => s.selectElement)
  const selectedSceneId = useEditorStore((s) => s.selectedSceneId)
  const updateElement = useEditorStore((s) => s.updateElement)
  const commitElementDrag = useEditorStore((s) => s.commitElementDrag)

  const { startDrag, onPointerMove, onPointerUp, isDragging } = useDrag({
    zoom,
    onCommit: useCallback(
      (elementId, patch) => {
        if (selectedSceneId) commitElementDrag(selectedSceneId, elementId, patch)
      },
      [selectedSceneId, commitElementDrag],
    ),
  })

  const liveUpdate = useCallback(
    (elementId: string, patch: { x?: number; y?: number; width?: number; height?: number }) => {
      if (selectedSceneId) updateElement(selectedSceneId, elementId, patch)
    },
    [selectedSceneId, updateElement],
  )

  const canvasRef = useRef<HTMLDivElement>(null)

  const zoomPct = Math.round(zoom * 100)

  return (
    <main
      ref={canvasRef}
      className="relative flex flex-1 flex-col items-center overflow-auto bg-neutral-100"
      onClick={() => { if (!isDragging()) selectElement(null) }}
      onPointerMove={(e) => onPointerMove(e, liveUpdate)}
      onPointerUp={(e) => onPointerUp(e, liveUpdate)}
    >
      {/* Zoom toolbar */}
      <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full border border-neutral-200 bg-white px-2 py-1 shadow-panel">
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => setZoom(zoom - 0.1)}
          disabled={zoom <= 0.25}
          className="flex h-6 w-6 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 disabled:opacity-30"
        >
          −
        </button>
        <span className="min-w-[36px] text-center text-xs text-neutral-600">{zoomPct}%</span>
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => setZoom(zoom + 0.1)}
          disabled={zoom >= 2}
          className="flex h-6 w-6 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 disabled:opacity-30"
        >
          +
        </button>
        <span className="mx-1 h-3 w-px bg-neutral-200" />
        <button
          type="button"
          onClick={() => setZoom(1)}
          className="text-xs text-neutral-500 transition-colors hover:text-neutral-900"
        >
          Reset
        </button>
      </div>

      {/* Canvas */}
      <div className="flex flex-1 items-center justify-center p-8">
        {scene ? (
          <div
            className="rounded-lg shadow-toolbar"
            style={{
              width: scene.baseWidth * zoom,
              height: scene.baseHeight * zoom,
            }}
          >
            <SceneRenderer
              scene={scene}
              scale={zoom}
              selectedElementId={selectedElementId}
              interactive
              onElementClick={(id) => selectElement(id)}
              onElementPointerDown={(elementId, e) => {
                const el = scene.elements.find((el) => el.id === elementId)
                if (!el) return
                startDrag(e, {
                  elementId,
                  handle: 'move',
                  startX: el.x,
                  startY: el.y,
                  startW: el.width,
                  startH: el.height,
                })
              }}
              onHandlePointerDown={(elementId, handle, e) => {
                const el = scene.elements.find((el) => el.id === elementId)
                if (!el) return
                startDrag(e, {
                  elementId,
                  handle,
                  startX: el.x,
                  startY: el.y,
                  startW: el.width,
                  startH: el.height,
                })
              }}
            />
          </div>
        ) : (
          <div className="flex h-[844px] w-[390px] items-center justify-center rounded-lg bg-white shadow-toolbar">
            <p className="text-sm text-neutral-400">Tambah scene pertama</p>
          </div>
        )}
      </div>
    </main>
  )
}

// ─── Inspector panel ──────────────────────────────────────────────────────────

function InspectorPanel() {
  const selectedElementId = useEditorStore((s) => s.selectedElementId)
  const selectedSceneId = useEditorStore((s) => s.selectedSceneId)
  const scene = useEditorStore((s) => {
    const id = s.selectedSceneId
    return s.document.scenes.find((sc) => sc.id === id)
  })
  const element = scene?.elements.find((el) => el.id === selectedElementId)
  const updateElement = useEditorStore((s) => s.updateElement)
  const updateElementProps = useEditorStore((s) => s.updateElementProps)
  const deleteElement = useEditorStore((s) => s.deleteElement)
  const reorderElementZ = useEditorStore((s) => s.reorderElementZ)
  const updateSceneBackground = useEditorStore((s) => s.updateSceneBackground)

  return (
    <aside className="w-72 shrink-0 overflow-y-auto border-l border-neutral-200 bg-white">
      <div className="border-b border-neutral-100 px-4 py-3">
        <span className="text-xs font-medium text-neutral-500">
          {element ? 'Elemen' : scene ? 'Scene' : 'Inspector'}
        </span>
      </div>

      {element && selectedSceneId ? (
        <ElementInspector
          key={element.id}
          element={element}
          sceneId={selectedSceneId}
          onUpdate={(patch) => updateElement(selectedSceneId, element.id, patch)}
          onUpdateProps={(props) => updateElementProps(selectedSceneId, element.id, props)}
          onDelete={() => deleteElement(selectedSceneId, element.id)}
          onReorderZ={(dir) => reorderElementZ(selectedSceneId, element.id, dir)}
        />
      ) : scene && selectedSceneId ? (
        <SceneInspector
          scene={scene}
          onUpdateBackground={(bg) => updateSceneBackground(selectedSceneId, bg)}
        />
      ) : (
        <div className="p-4">
          <div className="rounded-md bg-neutral-50 p-3 text-xs text-neutral-400">
            Pilih elemen untuk mengedit properti.
          </div>
        </div>
      )}
    </aside>
  )
}

// ─── Element inspector ────────────────────────────────────────────────────────

import type { ElementNode, Scene } from '@openwish/project-schema'

function ElementInspector({
  element,
  sceneId,
  onUpdate,
  onUpdateProps,
  onDelete,
  onReorderZ,
}: {
  element: ElementNode
  sceneId: string
  onUpdate: (patch: Partial<Pick<ElementNode, 'x' | 'y' | 'width' | 'height' | 'rotation' | 'zIndex' | 'locked'>>) => void
  onUpdateProps: (props: Record<string, unknown>) => void
  onDelete: () => void
  onReorderZ: (dir: 'up' | 'down' | 'front' | 'back') => void
}) {
  return (
    <div className="divide-y divide-neutral-100">
      {/* Type badge */}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium capitalize text-neutral-600">
          {element.type}
        </span>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Hapus elemen"
          className="rounded-md p-1 text-danger-600 transition-colors hover:bg-red-50"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
            <path d="M6.5 1h3a.5.5 0 010 1h-3a.5.5 0 010-1zM2 3.5A.5.5 0 012.5 3h11a.5.5 0 010 1h-.5v9a1 1 0 01-1 1h-7a1 1 0 01-1-1V4H2.5a.5.5 0 01-.5-.5z" />
          </svg>
        </button>
      </div>

      {/* Position & size */}
      <InspectorSection title="Posisi & Ukuran">
        <div className="grid grid-cols-2 gap-2">
          <NumInput label="X" value={element.x} onChange={(v) => onUpdate({ x: v })} />
          <NumInput label="Y" value={element.y} onChange={(v) => onUpdate({ y: v })} />
          <NumInput label="W" value={element.width} onChange={(v) => onUpdate({ width: Math.max(1, v) })} />
          <NumInput label="H" value={element.height} onChange={(v) => onUpdate({ height: Math.max(1, v) })} />
          <NumInput label="Rotasi" value={element.rotation} onChange={(v) => onUpdate({ rotation: v })} step={1} />
          <div className="flex items-center gap-2">
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-neutral-600">
              <input
                type="checkbox"
                checked={element.locked}
                onChange={(e) => onUpdate({ locked: e.target.checked })}
                className="rounded"
              />
              Kunci
            </label>
          </div>
        </div>
      </InspectorSection>

      {/* Z-order */}
      <InspectorSection title="Urutan Lapisan">
        <div className="flex gap-1">
          {(['back', 'down', 'up', 'front'] as const).map((dir) => (
            <button
              key={dir}
              type="button"
              onClick={() => onReorderZ(dir)}
              className="flex-1 rounded-md border border-neutral-200 py-1 text-xs text-neutral-600 transition-colors hover:border-brand-500 hover:text-brand-500"
            >
              {dir === 'back' ? '⤓' : dir === 'down' ? '↓' : dir === 'up' ? '↑' : '⤒'}
            </button>
          ))}
        </div>
      </InspectorSection>

      {/* Type-specific props */}
      <ElementPropsInspector element={element} onUpdateProps={onUpdateProps} />
    </div>
  )
}

function ElementPropsInspector({
  element,
  onUpdateProps,
}: {
  element: ElementNode
  onUpdateProps: (props: Record<string, unknown>) => void
}) {
  if (element.type === 'text') {
    const p = element.props
    return (
      <>
        <InspectorSection title="Teks">
          <textarea
            value={p.content}
            onChange={(e) => onUpdateProps({ content: e.target.value })}
            rows={3}
            className="w-full resize-none rounded-md border border-neutral-200 px-2 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
        </InspectorSection>
        <InspectorSection title="Tipografi">
          <div className="grid grid-cols-2 gap-2">
            <NumInput label="Ukuran" value={p.fontSize ?? 16} onChange={(v) => onUpdateProps({ fontSize: v })} min={1} />
            <NumInput label="Berat" value={p.fontWeight ?? 400} onChange={(v) => onUpdateProps({ fontWeight: v })} step={100} min={100} max={900} />
            <NumInput label="Tinggi baris" value={p.lineHeight ?? 1.5} onChange={(v) => onUpdateProps({ lineHeight: v })} step={0.1} />
          </div>
          <ColorInput label="Warna teks" value={p.color} onChange={(v) => onUpdateProps({ color: v })} />
        </InspectorSection>
      </>
    )
  }

  if (element.type === 'image') {
    const p = element.props
    return (
      <InspectorSection title="Gambar">
        <label className="block text-xs text-neutral-500">URL gambar</label>
        <input
          type="url"
          value={p.src ?? ''}
          onChange={(e) => onUpdateProps({ src: e.target.value })}
          placeholder="https://…"
          className="mt-1 w-full rounded-md border border-neutral-200 px-2 py-1.5 text-xs outline-none focus:border-brand-500"
        />
        <label className="mt-2 block text-xs text-neutral-500">Alt text</label>
        <input
          type="text"
          value={p.alt ?? ''}
          onChange={(e) => onUpdateProps({ alt: e.target.value })}
          className="mt-1 w-full rounded-md border border-neutral-200 px-2 py-1.5 text-xs outline-none focus:border-brand-500"
        />
      </InspectorSection>
    )
  }

  if (element.type === 'shape') {
    const p = element.props
    return (
      <InspectorSection title="Bentuk">
        <ColorInput label="Isi" value={p.fill ?? '#000000'} onChange={(v) => onUpdateProps({ fill: v })} />
        <ColorInput label="Garis tepi" value={p.stroke ?? ''} onChange={(v) => onUpdateProps({ stroke: v || undefined })} />
        {p.stroke && (
          <NumInput label="Tebal garis" value={p.strokeWidth ?? 1} onChange={(v) => onUpdateProps({ strokeWidth: v })} min={0} />
        )}
        {(p.shape === 'rectangle') && (
          <NumInput label="Sudut bulat" value={p.borderRadius ?? 0} onChange={(v) => onUpdateProps({ borderRadius: v })} min={0} />
        )}
      </InspectorSection>
    )
  }

  if (element.type === 'button') {
    const p = element.props
    return (
      <InspectorSection title="Tombol">
        <label className="block text-xs text-neutral-500">Label</label>
        <input
          type="text"
          value={p.label}
          onChange={(e) => onUpdateProps({ label: e.target.value })}
          className="mt-1 w-full rounded-md border border-neutral-200 px-2 py-1.5 text-xs outline-none focus:border-brand-500"
        />
        <label className="mt-2 block text-xs text-neutral-500">URL tujuan</label>
        <input
          type="url"
          value={p.url}
          onChange={(e) => onUpdateProps({ url: e.target.value })}
          placeholder="https://…"
          className="mt-1 w-full rounded-md border border-neutral-200 px-2 py-1.5 text-xs outline-none focus:border-brand-500"
        />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <ColorInput label="Warna tombol" value={p.backgroundColor ?? '#6D5EF7'} onChange={(v) => onUpdateProps({ backgroundColor: v })} />
          <ColorInput label="Warna teks" value={p.textColor ?? '#FFFFFF'} onChange={(v) => onUpdateProps({ textColor: v })} />
        </div>
      </InspectorSection>
    )
  }

  return null
}

// ─── Scene inspector ──────────────────────────────────────────────────────────

function SceneInspector({
  scene,
  onUpdateBackground,
}: {
  scene: Scene
  onUpdateBackground: (bg: Scene['background']) => void
}) {
  const bg = scene.background
  return (
    <div className="divide-y divide-neutral-100">
      <InspectorSection title="Latar Belakang">
        <label className="block text-xs text-neutral-500">Tipe</label>
        <select
          value={bg.type}
          onChange={(e) => {
            const type = e.target.value as Scene['background']['type']
            if (type === 'color') onUpdateBackground({ type: 'color', color: '#FFFFFF' })
            else if (type === 'gradient') onUpdateBackground({ type: 'gradient', gradient: { direction: 135, stops: [{ color: '#6D5EF7', position: 0 }, { color: '#FF7AA2', position: 100 }] } })
            else onUpdateBackground({ type: 'image', src: '', objectFit: 'cover' })
          }}
          className="mt-1 w-full rounded-md border border-neutral-200 px-2 py-1.5 text-xs outline-none focus:border-brand-500"
        >
          <option value="color">Warna solid</option>
          <option value="gradient">Gradien</option>
          <option value="image">Gambar</option>
        </select>

        {bg.type === 'color' && (
          <ColorInput
            label="Warna"
            value={bg.color}
            onChange={(v) => onUpdateBackground({ type: 'color', color: v })}
          />
        )}
        {bg.type === 'gradient' && (
          <>
            <NumInput
              label="Arah (deg)"
              value={bg.gradient.direction}
              onChange={(v) => onUpdateBackground({ ...bg, gradient: { ...bg.gradient, direction: v } })}
              min={0}
              max={360}
            />
            <ColorInput
              label="Warna awal"
              value={bg.gradient.stops[0]?.color ?? '#000000'}
              onChange={(v) => {
                const stops = [...bg.gradient.stops]
                stops[0] = { ...stops[0], color: v }
                onUpdateBackground({ ...bg, gradient: { ...bg.gradient, stops } })
              }}
            />
            <ColorInput
              label="Warna akhir"
              value={bg.gradient.stops[bg.gradient.stops.length - 1]?.color ?? '#FFFFFF'}
              onChange={(v) => {
                const stops = [...bg.gradient.stops]
                stops[stops.length - 1] = { ...stops[stops.length - 1], color: v }
                onUpdateBackground({ ...bg, gradient: { ...bg.gradient, stops } })
              }}
            />
          </>
        )}
        {bg.type === 'image' && (
          <>
            <label className="mt-2 block text-xs text-neutral-500">URL gambar</label>
            <input
              type="url"
              value={bg.src ?? ''}
              onChange={(e) => onUpdateBackground({ ...bg, src: e.target.value })}
              placeholder="https://…"
              className="mt-1 w-full rounded-md border border-neutral-200 px-2 py-1.5 text-xs outline-none focus:border-brand-500"
            />
          </>
        )}
      </InspectorSection>

      <InspectorSection title="Ukuran">
        <NumInput
          label="Tinggi (px)"
          value={scene.baseHeight}
          onChange={() => {}}
          disabled
        />
        <p className="mt-1 text-[10px] text-neutral-400">Lebar selalu 390px</p>
      </InspectorSection>
    </div>
  )
}

// ─── Inspector helpers ────────────────────────────────────────────────────────

function InspectorSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">{title}</p>
      {children}
    </div>
  )
}

function NumInput({
  label,
  value,
  onChange,
  step = 1,
  min,
  max,
  disabled,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
  max?: number
  disabled?: boolean
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10px] text-neutral-400">{label}</span>
      <input
        type="number"
        value={value}
        step={step}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-md border border-neutral-200 px-2 py-1 text-xs outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
      />
    </label>
  )
}

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="mt-2 flex items-center justify-between">
      <span className="text-xs text-neutral-500">{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          value={value || '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="h-6 w-8 cursor-pointer rounded border border-neutral-200 p-0"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={9}
          className="w-20 rounded-md border border-neutral-200 px-1.5 py-0.5 text-xs outline-none focus:border-brand-500"
        />
      </div>
    </label>
  )
}

// ─── Sidebar icon ─────────────────────────────────────────────────────────────

function SidebarIcon({ label, icon }: { label: string; icon: string }) {
  return (
    <button
      type="button"
      title={label}
      className="flex h-10 w-10 flex-col items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
    >
      <span className="text-base leading-none">{icon}</span>
      <span className="mt-0.5 text-[9px] leading-none">{label}</span>
    </button>
  )
}
