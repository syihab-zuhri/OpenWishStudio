'use client'

import { useEffect, useCallback, useRef, useState } from 'react'
import type { ProjectDocument, ElementNode, Scene } from '@openwish/project-schema'
import {
  initEditorStore,
  useEditorStore,
  type SaveStatus,
} from '@/features/editor/store/editorStore'
import { SceneRenderer } from '@/features/editor/components/SceneRenderer'
import { useDrag } from '@/features/editor/hooks/useDrag'
import { computeSnap } from '@/features/editor/utils/snapping'
import { useAutosave } from '@/features/editor/hooks/useAutosave'
import { PublishDialog } from './PublishDialog'
import { TemplatePanel, AsetPanel, MusikPanel } from './EditorPanels'

type SidebarPanel = 'elemen' | 'template' | 'aset' | 'musik' | null

interface Props {
  projectId: string
  initialName: string
  initialDocument: unknown
  initialRevision: number
  /** 'guest' = draft disimpan di perangkat, tanpa akun. */
  mode?: 'cloud' | 'guest'
}

export default function EditorShell({
  projectId,
  initialName,
  initialDocument,
  initialRevision,
  mode = 'cloud',
}: Props) {
  // Bootstrap store once on mount
  useEffect(() => {
    initEditorStore(projectId, initialName, initialDocument as ProjectDocument, {
      revision: initialRevision ?? 0,
      isGuest: mode === 'guest',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  return <EditorLayout />
}

// ─── Main layout (reads from store) ──────────────────────────────────────────

function EditorLayout() {
  const projectId = useEditorStore((s) => s.projectId)
  const isGuest = useEditorStore((s) => s.isGuest)
  const saveStatus = useEditorStore((s) => s.saveStatus)
  const requestSaveNow = useEditorStore((s) => s.requestSaveNow)
  const manualSaveState = useEditorStore((s) => s.manualSaveState)
  const setManualSaveState = useEditorStore((s) => s.setManualSaveState)
  const lastSaveError = useEditorStore((s) => s.lastSaveError)
  const undo = useEditorStore((s) => s.undo)
  const redo = useEditorStore((s) => s.redo)
  const canUndo = useEditorStore((s) => s.past.length > 0)
  const canRedo = useEditorStore((s) => s.future.length > 0)
  const hasSelectedElement = useEditorStore((s) => s.selectedElementId !== null)
  const [showPublish, setShowPublish] = useState(false)
  const [activePanel, setActivePanel] = useState<SidebarPanel>(null)
  const [showInspectorSheet, setShowInspectorSheet] = useState(false)

  useAutosave()

  // Keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const mac = navigator.platform.startsWith('Mac')
      const ctrl = mac ? e.metaKey : e.ctrlKey
      if (!ctrl) return
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      }
      if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undo, redo])

  // Toast hasil simpan manual hilang sendiri: sukses 2,5 dtk, gagal 5 dtk
  useEffect(() => {
    if (manualSaveState !== 'success' && manualSaveState !== 'error') return
    const t = setTimeout(
      () => setManualSaveState('idle'),
      manualSaveState === 'success' ? 2500 : 5000,
    )
    return () => clearTimeout(t)
  }, [manualSaveState, setManualSaveState])

  function togglePanel(panel: SidebarPanel) {
    setShowInspectorSheet(false)
    setActivePanel((prev) => (prev === panel ? null : panel))
  }

  function toggleInspectorSheet() {
    setActivePanel(null)
    setShowInspectorSheet((v) => !v)
  }

  return (
    <div className="bg-background flex h-dvh flex-col">
      {/* Topbar */}
      <header className="bg-surface shadow-xs z-10 flex h-12 shrink-0 items-center justify-between px-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-3">
          <a
            href={isGuest ? '/' : '/dashboard'}
            className="text-text-muted hover:bg-surface-hover hover:text-text-primary shrink-0 rounded-sm p-1.5 transition-colors"
            aria-label={isGuest ? 'Kembali ke beranda' : 'Kembali ke dashboard'}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </a>
          <ProjectNameField />
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={undo}
              disabled={!canUndo}
              aria-label="Urungkan"
              className="text-text-muted hover:bg-surface-hover hover:text-text-primary rounded-sm p-1.5 transition-colors disabled:pointer-events-none disabled:opacity-30"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 14L4 9l5-5" />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 9h10.5a5.5 5.5 0 010 11H11"
                />
              </svg>
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={!canRedo}
              aria-label="Ulangi"
              className="text-text-muted hover:bg-surface-hover hover:text-text-primary rounded-sm p-1.5 transition-colors disabled:pointer-events-none disabled:opacity-30"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 14l5-5-5-5" />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M20 9H9.5a5.5 5.5 0 000 11H13"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <SaveStatusBadge status={saveStatus} detail={lastSaveError} />
          <button
            type="button"
            onClick={requestSaveNow}
            disabled={saveStatus === 'saving'}
            aria-label="Simpan sekarang"
            className="border-border-strong text-text-secondary hover:bg-surface-hover hover:text-text-primary flex items-center gap-1.5 rounded-sm border px-2 py-1.5 text-xs font-medium uppercase tracking-[0.06em] transition-colors disabled:opacity-50 sm:px-3"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-8H7v8" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 3v5h8" />
            </svg>
            <span className="hidden sm:inline">
              {saveStatus === 'saving' ? 'Menyimpan…' : 'Simpan'}
            </span>
          </button>
          <a
            href={isGuest ? '/editor/guest/preview' : `/editor/${projectId}/preview`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Buka preview"
            className="border-border-strong text-text-secondary hover:bg-surface-hover hover:text-text-primary flex items-center gap-1.5 rounded-sm border px-2 py-1.5 text-xs font-medium uppercase tracking-[0.06em] transition-colors sm:px-3"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span className="hidden sm:inline">Preview</span>
          </a>
          {isGuest ? (
            <a
              href="/auth/login?next=/dashboard"
              className="bg-primary text-text-on-primary hover:bg-primary-hover rounded-sm px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.06em] transition-colors"
            >
              Masuk &amp; Simpan
            </a>
          ) : (
            <button
              type="button"
              onClick={() => setShowPublish(true)}
              className="bg-primary text-text-on-primary hover:bg-primary-hover rounded-sm px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.06em] transition-colors"
            >
              Publish
            </button>
          )}
        </div>
      </header>

      {showPublish && <PublishDialog projectId={projectId} onClose={() => setShowPublish(false)} />}

      {/* Toast hasil simpan manual */}
      {manualSaveState === 'success' && (
        <SaveToast kind="success" text="Perubahan berhasil disimpan." />
      )}
      {manualSaveState === 'error' && (
        <SaveToast kind="error" text={lastSaveError ?? 'Gagal menyimpan. Coba lagi.'} />
      )}

      {/* Editor body */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left toolbar — desktop */}
        <aside className="border-border bg-surface hidden w-16 shrink-0 flex-col items-center gap-4 border-r py-4 lg:flex">
          <SidebarIcon
            label="Elemen"
            icon="✦"
            active={activePanel === 'elemen'}
            onClick={() => togglePanel('elemen')}
          />
          <SidebarIcon
            label="Template"
            icon="⊞"
            active={activePanel === 'template'}
            onClick={() => togglePanel('template')}
          />
          <SidebarIcon
            label="Aset"
            icon="📁"
            active={activePanel === 'aset'}
            onClick={() => togglePanel('aset')}
          />
          <SidebarIcon
            label="Musik"
            icon="♪"
            active={activePanel === 'musik'}
            onClick={() => togglePanel('musik')}
          />
        </aside>

        {/* Slide-in panel — desktop */}
        {activePanel && (
          <SidebarPanelContent panel={activePanel} onClose={() => setActivePanel(null)} />
        )}

        {/* Scene navigator — desktop */}
        <SceneNavigator />

        {/* Canvas workspace */}
        <CanvasWorkspace />

        {/* Right inspector — desktop */}
        <InspectorPanel />
      </div>

      {/* Mobile chrome: strip scene + toolbar bawah */}
      <MobileSceneStrip />
      <MobileToolbar
        activePanel={activePanel}
        onTogglePanel={togglePanel}
        inspectorOpen={showInspectorSheet}
        onToggleInspector={toggleInspectorSheet}
        hasSelectedElement={hasSelectedElement}
      />

      {/* Mobile bottom sheets */}
      {activePanel && (
        <MobileSheet title={PANEL_TITLES[activePanel]} onClose={() => setActivePanel(null)}>
          <div className="p-3">
            <PanelBody panel={activePanel} />
          </div>
        </MobileSheet>
      )}
      {showInspectorSheet && !activePanel && (
        <MobileSheet title="Properti" onClose={() => setShowInspectorSheet(false)}>
          <InspectorBody />
        </MobileSheet>
      )}
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
    if (e.key === 'Enter') {
      e.preventDefault()
      ref.current?.blur()
    }
    if (e.key === 'Escape') {
      if (ref.current) ref.current.textContent = projectName
      ref.current?.blur()
    }
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
      className="text-text-primary focus:bg-surface-hover focus:ring-primary max-w-[110px] truncate rounded-sm px-1 text-sm font-medium outline-none focus:ring-1 sm:max-w-[220px]"
    >
      {projectName}
    </span>
  )
}

// ─── Save status badge ────────────────────────────────────────────────────────

const statusMap: Record<SaveStatus, { label: string; className: string }> = {
  saved: { label: 'Tersimpan', className: 'text-success' },
  saving: { label: 'Menyimpan…', className: 'text-info' },
  unsaved: { label: 'Belum tersimpan', className: 'text-text-muted' },
  error: { label: 'Gagal simpan', className: 'text-error' },
  offline: { label: 'Offline', className: 'text-warning' },
}

function SaveStatusBadge({ status, detail }: { status: SaveStatus; detail?: string | null }) {
  const { label, className } = statusMap[status]
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs ${className}`}
      title={detail ?? label}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      <span className="hidden sm:inline">{label}</span>
    </span>
  )
}

// ─── Scene navigator ──────────────────────────────────────────────────────────

function SceneNavigator() {
  const scenes = useEditorStore((s) => s.document.scenes)
  const selectedSceneId = useEditorStore((s) => s.selectedSceneId)
  const selectScene = useEditorStore((s) => s.selectScene)
  const addScene = useEditorStore((s) => s.addScene)
  const deleteScene = useEditorStore((s) => s.deleteScene)
  const duplicateScene = useEditorStore((s) => s.duplicateScene)

  const sorted = [...scenes].sort((a, b) => a.order - b.order)
  const THUMB_SCALE = 0.18

  return (
    <div className="border-border bg-surface hidden w-44 shrink-0 flex-col border-r lg:flex">
      <div className="border-border flex items-center justify-between border-b px-3 py-2">
        <span className="text-text-muted text-[10px] font-medium uppercase tracking-[0.08em]">
          Scene
        </span>
        <span className="text-text-muted text-xs tabular-nums">{scenes.length}</span>
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
                    ? 'border-primary bg-primary-subtle'
                    : 'border-border/50 bg-background hover:border-border-strong'
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
                  <div
                    style={{
                      transform: `scale(${THUMB_SCALE * (152 / scene.baseWidth)})`,
                      transformOrigin: 'top left',
                    }}
                  >
                    <SceneRenderer scene={scene} scale={1} />
                  </div>
                </div>
                <div className="px-2 py-1">
                  <p
                    className={`truncate text-xs font-medium ${isSelected ? 'text-primary' : 'text-text-secondary'}`}
                  >
                    {scene.name}
                  </p>
                  <p className="text-text-muted text-[10px] tabular-nums">#{index + 1}</p>
                </div>
              </button>
              {/* Context actions on hover */}
              <div className="absolute right-1 top-1 hidden gap-0.5 group-hover:flex">
                <IconAction label="Duplikasi scene" onClick={() => duplicateScene(scene.id)}>
                  <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                    <rect x="3" y="5" width="8" height="8" rx="1.5" />
                    <path d="M6 3V2a1 1 0 011-1h6a1 1 0 011 1v7a1 1 0 01-1 1h-1" />
                  </svg>
                </IconAction>
                {scenes.length > 1 && (
                  <IconAction label="Hapus scene" onClick={() => deleteScene(scene.id)} danger>
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
          className="border-border-strong text-text-muted hover:border-primary hover:text-primary mt-1 rounded-md border border-dashed px-2 py-2 text-xs transition-colors"
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
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={`shadow-xs rounded-sm p-0.5 transition-colors ${
        danger
          ? 'bg-surface-2 text-error hover:bg-error hover:text-text-on-primary'
          : 'bg-surface-2 text-text-secondary hover:bg-surface-hover'
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

  const [activeGuides, setActiveGuides] = useState<{ v: number[]; h: number[] } | null>(null)

  // Snap hanya untuk drag pindah (patch tanpa width/height); resize dibiarkan bebas
  const applySnap = useCallback(
    (elementId: string, patch: { x?: number; y?: number; width?: number; height?: number }) => {
      if (
        !scene ||
        patch.width !== undefined ||
        patch.height !== undefined ||
        patch.x === undefined ||
        patch.y === undefined
      ) {
        return { patch, guides: null }
      }
      const el = scene.elements.find((e) => e.id === elementId)
      if (!el) return { patch, guides: null }
      const others = scene.elements
        .filter((e) => e.id !== elementId)
        .map((e) => ({ x: e.x, y: e.y, width: e.width, height: e.height }))
      const snap = computeSnap(
        { x: patch.x, y: patch.y, width: el.width, height: el.height },
        others,
        { width: scene.baseWidth, height: scene.baseHeight },
        6 / zoom,
      )
      return {
        patch: { x: snap.x, y: snap.y },
        guides:
          snap.guidesV.length || snap.guidesH.length ? { v: snap.guidesV, h: snap.guidesH } : null,
      }
    },
    [scene, zoom],
  )

  const { startDrag, onPointerMove, onPointerUp, isDragging } = useDrag({
    zoom,
    onCommit: useCallback(
      (elementId, patch) => {
        if (selectedSceneId) {
          const snapped = applySnap(elementId, patch)
          commitElementDrag(selectedSceneId, elementId, snapped.patch)
        }
        setActiveGuides(null)
      },
      [selectedSceneId, commitElementDrag, applySnap],
    ),
  })

  const liveUpdate = useCallback(
    (elementId: string, patch: { x?: number; y?: number; width?: number; height?: number }) => {
      if (!selectedSceneId) return
      const snapped = applySnap(elementId, patch)
      setActiveGuides(snapped.guides)
      updateElement(selectedSceneId, elementId, snapped.patch)
    },
    [selectedSceneId, updateElement, applySnap],
  )

  const scrollRef = useRef<HTMLDivElement>(null)
  const projectId = useEditorStore((s) => s.projectId)

  // Auto-fit zoom di layar sempit. Dep projectId: efek jalan ulang setelah
  // initEditorStore selesai (init me-reset zoom ke 1, jadi fit harus setelahnya).
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (window.matchMedia('(min-width: 1024px)').matches) return
    const fit = (el.clientWidth - 32) / 390
    if (fit < 1) setZoom(fit)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  const zoomPct = Math.round(zoom * 100)

  return (
    <main className="bg-canvas bg-spotlight relative min-w-0 flex-1 overflow-hidden">
      <div
        ref={scrollRef}
        className="absolute inset-0 overflow-auto overscroll-contain"
        onClick={() => {
          if (!isDragging()) selectElement(null)
        }}
        onPointerMove={(e) => onPointerMove(e, liveUpdate)}
        onPointerUp={(e) => {
          onPointerUp(e, liveUpdate)
          setActiveGuides(null)
        }}
      >
        {/* m-auto: tetap center saat muat, dan bisa discroll penuh saat overflow */}
        <div className="flex min-h-full min-w-full">
          <div className="m-auto shrink-0 p-4 sm:p-8">
            {scene ? (
              <div
                className="relative rounded-sm shadow-lg"
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
                {/* Garis panduan snap — di atas semua elemen scene */}
                {activeGuides && (
                  <div
                    className="pointer-events-none absolute inset-0 overflow-hidden"
                    style={{ zIndex: 9999 }}
                    aria-hidden="true"
                  >
                    {activeGuides.v.map((x) => (
                      <div
                        key={`v-${x}`}
                        className="absolute inset-y-0 w-px"
                        style={{ left: x * zoom, backgroundColor: 'var(--color-secondary)' }}
                      />
                    ))}
                    {activeGuides.h.map((y) => (
                      <div
                        key={`h-${y}`}
                        className="absolute inset-x-0 h-px"
                        style={{ top: y * zoom, backgroundColor: 'var(--color-secondary)' }}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div
                className="bg-surface flex items-center justify-center rounded-sm shadow-lg"
                style={{ width: 390 * zoom, height: 844 * zoom }}
              >
                <p className="text-text-muted text-sm">Tambah scene pertama</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Zoom toolbar — di luar area scroll supaya selalu terlihat */}
      <div className="bg-surface-2 absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full px-2 py-1 shadow-md">
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => setZoom(zoom - 0.1)}
          disabled={zoom <= 0.25}
          className="text-text-secondary hover:bg-surface-hover flex h-6 w-6 items-center justify-center rounded-full transition-colors disabled:opacity-30"
        >
          −
        </button>
        <span className="text-text-secondary min-w-[36px] text-center text-xs tabular-nums">
          {zoomPct}%
        </span>
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => setZoom(zoom + 0.1)}
          disabled={zoom >= 2}
          className="text-text-secondary hover:bg-surface-hover flex h-6 w-6 items-center justify-center rounded-full transition-colors disabled:opacity-30"
        >
          +
        </button>
        <span className="bg-border mx-1 h-3 w-px" />
        <button
          type="button"
          onClick={() => setZoom(1)}
          className="text-text-secondary hover:text-text-primary text-xs transition-colors"
        >
          Reset
        </button>
      </div>
    </main>
  )
}

// ─── Inspector panel ──────────────────────────────────────────────────────────

function InspectorPanel() {
  const title = useEditorStore((s) => {
    const scene = s.document.scenes.find((sc) => sc.id === s.selectedSceneId)
    const element = scene?.elements.find((el) => el.id === s.selectedElementId)
    return element ? 'Elemen' : scene ? 'Scene' : 'Inspector'
  })

  return (
    <aside className="border-border bg-surface hidden w-72 shrink-0 overflow-y-auto border-l lg:block">
      <div className="border-border border-b px-4 py-3">
        <span className="text-text-muted text-[10px] font-medium uppercase tracking-[0.08em]">
          {title}
        </span>
      </div>

      <InspectorBody />
    </aside>
  )
}

/** Isi inspector — dipakai aside desktop dan bottom sheet mobile. */
function InspectorBody() {
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

  if (element && selectedSceneId) {
    return (
      <ElementInspector
        key={element.id}
        element={element}
        sceneId={selectedSceneId}
        onUpdate={(patch) => updateElement(selectedSceneId, element.id, patch)}
        onUpdateProps={(props) => updateElementProps(selectedSceneId, element.id, props)}
        onDelete={() => deleteElement(selectedSceneId, element.id)}
        onReorderZ={(dir) => reorderElementZ(selectedSceneId, element.id, dir)}
      />
    )
  }

  if (scene && selectedSceneId) {
    return (
      <SceneInspector
        scene={scene}
        onUpdateBackground={(bg) => updateSceneBackground(selectedSceneId, bg)}
      />
    )
  }

  return (
    <div className="p-4">
      <div className="bg-background text-text-muted rounded-md p-3 text-xs">
        Pilih elemen untuk mengedit properti.
      </div>
    </div>
  )
}

// ─── Element inspector ────────────────────────────────────────────────────────

function ElementInspector({
  element,
  onUpdate,
  onUpdateProps,
  onDelete,
  onReorderZ,
}: {
  element: ElementNode
  sceneId: string
  onUpdate: (
    patch: Partial<
      Pick<ElementNode, 'x' | 'y' | 'width' | 'height' | 'rotation' | 'zIndex' | 'locked'>
    >,
  ) => void
  onUpdateProps: (props: Record<string, unknown>) => void
  onDelete: () => void
  onReorderZ: (dir: 'up' | 'down' | 'front' | 'back') => void
}) {
  return (
    <div className="divide-border divide-y">
      {/* Type badge */}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="bg-primary-subtle text-primary rounded-full px-2 py-0.5 text-xs font-medium capitalize">
          {element.type}
        </span>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Hapus elemen"
          className="text-error hover:bg-error-subtle rounded-sm p-1 transition-colors"
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
          <NumInput
            label="W"
            value={element.width}
            onChange={(v) => onUpdate({ width: Math.max(1, v) })}
          />
          <NumInput
            label="H"
            value={element.height}
            onChange={(v) => onUpdate({ height: Math.max(1, v) })}
          />
          <NumInput
            label="Rotasi"
            value={element.rotation}
            onChange={(v) => onUpdate({ rotation: v })}
            step={1}
            min={-360}
            max={360}
          />
          <div className="flex items-center gap-2">
            <label className="text-text-secondary flex cursor-pointer items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={element.locked}
                onChange={(e) => onUpdate({ locked: e.target.checked })}
                className="accent-primary rounded-sm"
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
              className="border-border-strong text-text-secondary hover:border-primary hover:text-primary flex-1 rounded-sm border py-1 text-xs transition-colors"
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
            className="border-border-strong bg-background text-text-primary focus:border-primary focus:ring-primary w-full resize-none rounded-sm border px-2 py-1.5 text-sm outline-none focus:ring-1"
          />
        </InspectorSection>
        <InspectorSection title="Tipografi">
          <div className="grid grid-cols-2 gap-2">
            <NumInput
              label="Ukuran"
              value={p.fontSize ?? 16}
              onChange={(v) => onUpdateProps({ fontSize: v })}
              min={4}
              max={300}
            />
            <NumInput
              label="Berat"
              value={p.fontWeight ?? 400}
              onChange={(v) => onUpdateProps({ fontWeight: v })}
              step={100}
              min={100}
              max={900}
            />
            <NumInput
              label="Tinggi baris"
              value={p.lineHeight ?? 1.5}
              onChange={(v) => onUpdateProps({ lineHeight: v })}
              step={0.1}
            />
          </div>
          <ColorInput
            label="Warna teks"
            value={p.color}
            onChange={(v) => onUpdateProps({ color: v })}
          />
        </InspectorSection>
      </>
    )
  }

  if (element.type === 'image') {
    const p = element.props
    return (
      <InspectorSection title="Gambar">
        <label className="text-text-secondary block text-xs">URL gambar</label>
        <input
          type="url"
          value={p.src ?? ''}
          onChange={(e) => onUpdateProps({ src: e.target.value })}
          placeholder="https://…"
          className="border-border-strong bg-background text-text-primary focus:border-primary mt-1 w-full rounded-sm border px-2 py-1.5 text-xs outline-none"
        />
        <label className="text-text-secondary mt-2 block text-xs">Alt text</label>
        <input
          type="text"
          value={p.alt ?? ''}
          onChange={(e) => onUpdateProps({ alt: e.target.value })}
          className="border-border-strong bg-background text-text-primary focus:border-primary mt-1 w-full rounded-sm border px-2 py-1.5 text-xs outline-none"
        />
      </InspectorSection>
    )
  }

  if (element.type === 'shape') {
    const p = element.props
    return (
      <InspectorSection title="Bentuk">
        <ColorInput
          label="Isi"
          value={p.fill ?? '#000000'}
          onChange={(v) => onUpdateProps({ fill: v })}
        />
        <ColorInput
          label="Garis tepi"
          value={p.stroke ?? ''}
          onChange={(v) => onUpdateProps({ stroke: v || undefined })}
          allowEmpty
        />
        {p.stroke && (
          <NumInput
            label="Tebal garis"
            value={p.strokeWidth ?? 1}
            onChange={(v) => onUpdateProps({ strokeWidth: v })}
            min={0}
            max={100}
          />
        )}
        {p.shape === 'rectangle' && (
          <NumInput
            label="Sudut bulat"
            value={p.borderRadius ?? 0}
            onChange={(v) => onUpdateProps({ borderRadius: v })}
            min={0}
            max={50}
          />
        )}
      </InspectorSection>
    )
  }

  if (element.type === 'button') {
    const p = element.props
    return (
      <InspectorSection title="Tombol">
        <label className="text-text-secondary block text-xs">Label</label>
        <input
          type="text"
          value={p.label}
          onChange={(e) => onUpdateProps({ label: e.target.value })}
          className="border-border-strong bg-background text-text-primary focus:border-primary mt-1 w-full rounded-sm border px-2 py-1.5 text-xs outline-none"
        />
        <label className="text-text-secondary mt-2 block text-xs">URL tujuan</label>
        <input
          type="url"
          value={p.url}
          onChange={(e) => onUpdateProps({ url: e.target.value })}
          placeholder="https://…"
          className="border-border-strong bg-background text-text-primary focus:border-primary mt-1 w-full rounded-sm border px-2 py-1.5 text-xs outline-none"
        />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <ColorInput
            label="Warna tombol"
            value={p.backgroundColor ?? '#6D5EF7'}
            onChange={(v) => onUpdateProps({ backgroundColor: v })}
          />
          <ColorInput
            label="Warna teks"
            value={p.textColor ?? '#FFFFFF'}
            onChange={(v) => onUpdateProps({ textColor: v })}
          />
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
    <div className="divide-border divide-y">
      <InspectorSection title="Latar Belakang">
        <label className="text-text-secondary block text-xs">Tipe</label>
        <select
          value={bg.type}
          onChange={(e) => {
            const type = e.target.value as Scene['background']['type']
            if (type === 'color') onUpdateBackground({ type: 'color', color: '#FFFFFF' })
            else if (type === 'gradient')
              onUpdateBackground({
                type: 'gradient',
                gradient: {
                  direction: 135,
                  stops: [
                    { color: '#6D5EF7', position: 0 },
                    { color: '#FF7AA2', position: 100 },
                  ],
                },
              })
            else onUpdateBackground({ type: 'image', src: '', objectFit: 'cover' })
          }}
          className="border-border-strong bg-background text-text-primary focus:border-primary mt-1 w-full rounded-sm border px-2 py-1.5 text-xs outline-none"
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
              onChange={(v) =>
                onUpdateBackground({ ...bg, gradient: { ...bg.gradient, direction: v } })
              }
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
            <label className="text-text-secondary mt-2 block text-xs">URL gambar</label>
            <input
              type="url"
              value={bg.src ?? ''}
              onChange={(e) => onUpdateBackground({ ...bg, src: e.target.value })}
              placeholder="https://…"
              className="border-border-strong bg-background text-text-primary focus:border-primary mt-1 w-full rounded-sm border px-2 py-1.5 text-xs outline-none"
            />
          </>
        )}
      </InspectorSection>

      <InspectorSection title="Ukuran">
        <NumInput label="Tinggi (px)" value={scene.baseHeight} onChange={() => {}} disabled />
        <p className="text-text-muted mt-1 text-[10px]">Lebar selalu 390px</p>
      </InspectorSection>
    </div>
  )
}

// ─── Inspector helpers ────────────────────────────────────────────────────────

function InspectorSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3">
      <p className="text-text-muted mb-2 text-[10px] font-semibold uppercase tracking-[0.08em]">
        {title}
      </p>
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
  // Teks lokal supaya user bebas mengetik; hanya nilai valid (angka dalam
  // rentang schema) yang di-commit ke dokumen — mencegah autosave 422.
  const [text, setText] = useState(String(value))

  useEffect(() => {
    setText(String(value))
  }, [value])

  function commit(raw: string) {
    let v = Number(raw)
    if (raw.trim() === '' || Number.isNaN(v)) {
      setText(String(value))
      return
    }
    if (min !== undefined) v = Math.max(min, v)
    if (max !== undefined) v = Math.min(max, v)
    setText(String(v))
    if (v !== value) onChange(v)
  }

  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-text-muted text-[10px]">{label}</span>
      <input
        type="number"
        value={text}
        step={step}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(e) => {
          const raw = e.target.value
          setText(raw)
          const v = Number(raw)
          if (
            raw.trim() !== '' &&
            !Number.isNaN(v) &&
            (min === undefined || v >= min) &&
            (max === undefined || v <= max)
          ) {
            onChange(v)
          }
        }}
        onBlur={() => commit(text)}
        className="border-border-strong bg-background text-text-primary focus:border-primary focus:ring-primary w-full rounded-sm border px-2 py-1 text-right text-xs tabular-nums outline-none focus:ring-1 disabled:opacity-50"
      />
    </label>
  )
}

const HEX_COLOR = /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/

function ColorInput({
  label,
  value,
  onChange,
  allowEmpty = false,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  /** Kosong dianggap sah (mis. menghapus garis tepi). */
  allowEmpty?: boolean
}) {
  // Hanya hex valid yang di-commit — nilai setengah jadi ("#ff") tinggal lokal
  const [text, setText] = useState(value)

  useEffect(() => {
    setText(value)
  }, [value])

  return (
    <label className="mt-2 flex items-center justify-between">
      <span className="text-text-secondary text-xs">{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          value={HEX_COLOR.test(value) ? value.slice(0, 7) : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="border-border-strong h-6 w-8 cursor-pointer rounded-sm border p-0"
        />
        <input
          type="text"
          value={text}
          onChange={(e) => {
            const raw = e.target.value
            setText(raw)
            if (HEX_COLOR.test(raw) || (allowEmpty && raw === '')) onChange(raw)
          }}
          onBlur={() => {
            if (!HEX_COLOR.test(text) && !(allowEmpty && text === '')) setText(value)
          }}
          maxLength={9}
          className="border-border-strong bg-background text-text-primary focus:border-primary w-20 rounded-sm border px-1.5 py-0.5 text-xs outline-none"
        />
      </div>
    </label>
  )
}

// ─── Sidebar icon ─────────────────────────────────────────────────────────────

function SidebarIcon({
  label,
  icon,
  active = false,
  onClick,
}: {
  label: string
  icon: string
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={`flex h-10 w-10 flex-col items-center justify-center rounded-md transition-colors ${
        active
          ? 'bg-primary-subtle text-primary'
          : 'text-text-muted hover:bg-surface-hover hover:text-text-primary'
      }`}
    >
      <span className="text-base leading-none">{icon}</span>
      <span className="mt-0.5 text-[9px] leading-none">{label}</span>
    </button>
  )
}

// ─── Sidebar panel content ─────────────────────────────────────────────────────

const PANEL_TITLES: Record<NonNullable<SidebarPanel>, string> = {
  elemen: 'Elemen',
  template: 'Template',
  aset: 'Aset',
  musik: 'Musik',
}

function SidebarPanelContent({
  panel,
  onClose,
}: {
  panel: NonNullable<SidebarPanel>
  onClose: () => void
}) {
  return (
    <aside className="border-border bg-surface hidden w-64 flex-col overflow-hidden border-r lg:flex">
      <div className="border-border flex h-10 shrink-0 items-center justify-between border-b px-3">
        <span className="text-text-secondary text-[11px] font-semibold uppercase tracking-[0.08em]">
          {PANEL_TITLES[panel]}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-text-muted hover:bg-surface-hover hover:text-text-primary rounded-sm p-0.5"
          aria-label="Tutup panel"
        >
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <PanelBody panel={panel} />
      </div>
    </aside>
  )
}

/** Isi panel — dipakai aside desktop dan bottom sheet mobile. */
function PanelBody({ panel }: { panel: NonNullable<SidebarPanel> }) {
  if (panel === 'elemen') return <ElemenPanel />
  if (panel === 'template') return <TemplatePanel />
  if (panel === 'aset') return <AsetPanel />
  return <MusikPanel />
}

// ─── Elemen panel ─────────────────────────────────────────────────────────────

const ELEMENT_TYPES: { type: ElementNode['type']; label: string; icon: string }[] = [
  { type: 'text', label: 'Teks', icon: 'T' },
  { type: 'image', label: 'Gambar', icon: '🖼' },
  { type: 'shape', label: 'Bentuk', icon: '⬟' },
  { type: 'icon', label: 'Ikon', icon: '✦' },
  { type: 'button', label: 'Tombol', icon: '⬜' },
  { type: 'audioControl', label: 'Audio', icon: '♪' },
]

function makeDefaultElement(type: ElementNode['type']): ElementNode {
  const base = {
    id: crypto.randomUUID(),
    x: 60,
    y: 120,
    width: 270,
    height: 60,
    zIndex: 1,
    locked: false,
    rotation: 0,
  }
  switch (type) {
    case 'text':
      return {
        ...base,
        type: 'text',
        props: {
          content: 'Tulis teks...',
          fontSize: 24,
          fontWeight: 400,
          color: '#17171C',
          textAlign: 'center',
          lineHeight: 1.4,
        },
      }
    case 'image':
      return {
        ...base,
        type: 'image',
        width: 200,
        height: 200,
        props: { src: '', alt: 'Gambar', decorative: false, objectFit: 'cover' },
      }
    case 'shape':
      return {
        ...base,
        type: 'shape',
        width: 120,
        height: 120,
        props: { shape: 'rectangle', fill: '#6D5EF7', borderRadius: 12 },
      }
    case 'icon':
      return {
        ...base,
        type: 'icon',
        width: 48,
        height: 48,
        props: { iconName: 'heart', color: '#6D5EF7', size: 32 },
      }
    case 'button':
      return {
        ...base,
        type: 'button',
        height: 48,
        props: {
          label: 'Klik di sini',
          url: '#',
          variant: 'primary' as const,
          backgroundColor: '#6D5EF7',
          textColor: '#FFFFFF',
          borderRadius: 24,
        },
      }
    case 'audioControl':
      return {
        ...base,
        type: 'audioControl',
        width: 160,
        height: 44,
        props: { label: 'Putar Musik', compact: false },
      }
  }
}

function ElemenPanel() {
  const selectedSceneId = useEditorStore((s) => s.selectedSceneId)
  const addElement = useEditorStore((s) => s.addElement)

  function handleAdd(type: ElementNode['type']) {
    if (!selectedSceneId) return
    addElement(selectedSceneId, makeDefaultElement(type))
  }

  return (
    <div className="grid grid-cols-3 gap-2 lg:grid-cols-2">
      {ELEMENT_TYPES.map(({ type, label, icon }) => (
        <button
          key={type}
          type="button"
          onClick={() => handleAdd(type)}
          disabled={!selectedSceneId}
          className="border-border bg-background text-text-secondary hover:border-primary hover:bg-primary-subtle hover:text-primary flex flex-col items-center gap-1.5 rounded-md border p-3 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span className="text-xl leading-none">{icon}</span>
          <span className="text-[11px] font-medium">{label}</span>
        </button>
      ))}
    </div>
  )
}

// ─── Save toast ───────────────────────────────────────────────────────────────

function SaveToast({ kind, text }: { kind: 'success' | 'error'; text: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-16 z-50 flex justify-center px-4"
    >
      <div
        className={`flex items-center gap-2.5 rounded-md border px-4 py-2.5 text-sm shadow-lg ${
          kind === 'success'
            ? 'border-success/40 bg-success-subtle'
            : 'border-error/40 bg-error-subtle'
        }`}
      >
        <span
          aria-hidden="true"
          className={`text-base leading-none ${kind === 'success' ? 'text-success' : 'text-error'}`}
        >
          {kind === 'success' ? '✓' : '✕'}
        </span>
        <span className="text-text-primary">{text}</span>
      </div>
    </div>
  )
}

// ─── Mobile chrome ────────────────────────────────────────────────────────────

/** Strip scene horizontal untuk layar < lg — pengganti SceneNavigator. */
function MobileSceneStrip() {
  const scenes = useEditorStore((s) => s.document.scenes)
  const selectedSceneId = useEditorStore((s) => s.selectedSceneId)
  const selectScene = useEditorStore((s) => s.selectScene)
  const addScene = useEditorStore((s) => s.addScene)
  const deleteScene = useEditorStore((s) => s.deleteScene)
  const duplicateScene = useEditorStore((s) => s.duplicateScene)

  const sorted = [...scenes].sort((a, b) => a.order - b.order)

  return (
    <div className="border-border bg-surface flex shrink-0 items-center gap-2 border-t px-3 py-2 lg:hidden">
      <div className="flex flex-1 items-center gap-1.5 overflow-x-auto">
        {sorted.map((scene, index) => {
          const isSelected = scene.id === selectedSceneId
          return (
            <button
              key={scene.id}
              type="button"
              onClick={() => selectScene(scene.id)}
              aria-label={`Pilih ${scene.name}`}
              aria-pressed={isSelected}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border text-xs font-medium tabular-nums transition-colors ${
                isSelected
                  ? 'border-primary bg-primary-subtle text-primary'
                  : 'border-border bg-background text-text-secondary'
              }`}
            >
              {index + 1}
            </button>
          )
        })}
        <button
          type="button"
          onClick={addScene}
          aria-label="Tambah scene"
          className="border-border-strong text-text-muted hover:border-primary hover:text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-dashed text-base transition-colors"
        >
          +
        </button>
      </div>

      {selectedSceneId && (
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label="Duplikasi scene"
            onClick={() => duplicateScene(selectedSceneId)}
            className="bg-surface-2 text-text-secondary hover:bg-surface-hover rounded-sm p-2 transition-colors"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
              <rect x="3" y="5" width="8" height="8" rx="1.5" />
              <path d="M6 3V2a1 1 0 011-1h6a1 1 0 011 1v7a1 1 0 01-1 1h-1" />
            </svg>
          </button>
          {scenes.length > 1 && (
            <button
              type="button"
              aria-label="Hapus scene"
              onClick={() => deleteScene(selectedSceneId)}
              className="bg-surface-2 text-error hover:bg-error hover:text-text-on-primary rounded-sm p-2 transition-colors"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
                <path d="M6.5 1h3a.5.5 0 010 1h-3a.5.5 0 010-1zM2 3.5A.5.5 0 012.5 3h11a.5.5 0 010 1h-.5v9a1 1 0 01-1 1h-7a1 1 0 01-1-1V4H2.5a.5.5 0 01-.5-.5z" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

const MOBILE_TOOLBAR_ITEMS: { key: NonNullable<SidebarPanel>; icon: string }[] = [
  { key: 'elemen', icon: '✦' },
  { key: 'template', icon: '⊞' },
  { key: 'aset', icon: '📁' },
  { key: 'musik', icon: '♪' },
]

/** Toolbar bawah untuk layar < lg — pengganti rail ikon kiri + akses inspector. */
function MobileToolbar({
  activePanel,
  onTogglePanel,
  inspectorOpen,
  onToggleInspector,
  hasSelectedElement,
}: {
  activePanel: SidebarPanel
  onTogglePanel: (panel: NonNullable<SidebarPanel>) => void
  inspectorOpen: boolean
  onToggleInspector: () => void
  hasSelectedElement: boolean
}) {
  return (
    <nav
      aria-label="Alat editor"
      className="border-border bg-surface flex shrink-0 items-stretch justify-around border-t pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {MOBILE_TOOLBAR_ITEMS.map(({ key, icon }) => (
        <MobileToolbarButton
          key={key}
          label={PANEL_TITLES[key]}
          icon={icon}
          active={activePanel === key}
          onClick={() => onTogglePanel(key)}
        />
      ))}
      <MobileToolbarButton
        label="Properti"
        icon="⚙"
        active={inspectorOpen}
        onClick={onToggleInspector}
        showDot={hasSelectedElement}
      />
    </nav>
  )
}

function MobileToolbarButton({
  label,
  icon,
  active,
  onClick,
  showDot = false,
}: {
  label: string
  icon: string
  active: boolean
  onClick: () => void
  showDot?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors ${
        active ? 'text-primary' : 'text-text-muted'
      }`}
    >
      {showDot && (
        <span
          className="bg-secondary absolute right-1/4 top-1.5 h-1.5 w-1.5 rounded-full"
          aria-hidden="true"
        />
      )}
      <span className="text-base leading-none">{icon}</span>
      <span className="text-[10px] leading-none">{label}</span>
    </button>
  )
}

/** Bottom sheet untuk panel & inspector di layar < lg. */
function MobileSheet({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 lg:hidden">
      <div className="border-border bg-surface flex max-h-[55dvh] flex-col rounded-t-lg border-t shadow-xl">
        <div className="border-border flex h-11 shrink-0 items-center justify-between border-b px-4">
          <span className="text-text-secondary text-[11px] font-semibold uppercase tracking-[0.08em]">
            {title}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup panel"
            className="text-text-muted hover:bg-surface-hover hover:text-text-primary rounded-sm p-1 transition-colors"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">{children}</div>
      </div>
    </div>
  )
}
