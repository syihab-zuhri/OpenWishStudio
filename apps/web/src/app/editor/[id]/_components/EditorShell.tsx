'use client'

import { useEffect, useCallback, useRef, useState } from 'react'
import {
  DEFAULT_THEME,
  type ProjectDocument,
  type ElementNode,
  type Scene,
  type Theme,
} from '@openwish/project-schema'
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
import dynamic from 'next/dynamic'

const TemplatePanel = dynamic(() => import('./EditorPanels').then((module) => module.TemplatePanel))
const AsetPanel = dynamic(() => import('./EditorPanels').then((module) => module.AsetPanel))
const MusikPanel = dynamic(() => import('./EditorPanels').then((module) => module.MusikPanel))

type SidebarPanel = 'elemen' | 'template' | 'aset' | 'musik' | 'layer' | null

interface Props {
  projectId: string
  initialName: string
  initialDocument: ProjectDocument
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
    initEditorStore(projectId, initialName, initialDocument, {
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
  const selectedElementId = useEditorStore((s) => s.selectedElementId)
  const [showPublish, setShowPublish] = useState(false)
  const [activePanel, setActivePanel] = useState<SidebarPanel>(null)
  const [showInspectorSheet, setShowInspectorSheet] = useState(false)

  useAutosave()

  // Keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (
        target?.isContentEditable ||
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT'
      ) {
        return
      }

      const state = useEditorStore.getState()
      const mac = navigator.platform.startsWith('Mac')
      const ctrl = mac ? e.metaKey : e.ctrlKey
      const key = e.key.toLowerCase()
      if (ctrl && key === 'z' && !e.shiftKey) {
        e.preventDefault()
        state.undo()
      }
      if (ctrl && ((key === 'z' && e.shiftKey) || key === 'y')) {
        e.preventDefault()
        state.redo()
      }
      if (ctrl && key === 'c') state.copySelectedElements()
      if (ctrl && key === 'v') {
        e.preventDefault()
        state.pasteElements()
      }
      if (ctrl && key === 'd') {
        e.preventDefault()
        state.duplicateSelectedElements()
      }
      if (ctrl && key === 'g') {
        e.preventDefault()
        if (e.shiftKey) state.ungroupSelectedElements()
        else state.groupSelectedElements()
      }
      if (key === 'delete' || key === 'backspace') {
        e.preventDefault()
        state.deleteSelectedElements()
      }
      if (key === 'escape') state.selectElements([])
      const step = e.shiftKey ? 10 : 1
      if (key === 'arrowleft') {
        e.preventDefault()
        state.nudgeSelectedElements(-step, 0)
      }
      if (key === 'arrowright') {
        e.preventDefault()
        state.nudgeSelectedElements(step, 0)
      }
      if (key === 'arrowup') {
        e.preventDefault()
        state.nudgeSelectedElements(0, -step)
      }
      if (key === 'arrowdown') {
        e.preventDefault()
        state.nudgeSelectedElements(0, step)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undo, redo])

  // Saat elemen dipilih lewat kanvas atau panel Layer pada mobile, properti
  // langsung terbuka. Desktop tetap memakai inspector kanan yang selalu ada.
  useEffect(() => {
    if (!selectedElementId) return
    if (window.matchMedia('(min-width: 1024px)').matches) return
    setActivePanel(null)
    setShowInspectorSheet(true)
  }, [selectedElementId])

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

      {showPublish && (
        <PublishDialog
          projectId={projectId}
          document={useEditorStore.getState().document}
          onClose={() => setShowPublish(false)}
        />
      )}

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
          <SidebarIcon
            label="Layer"
            icon="☷"
            active={activePanel === 'layer'}
            onClick={() => togglePanel('layer')}
          />
        </aside>

        {/* Slide-in panel — desktop */}
        {activePanel && (
          <SidebarPanelContent panel={activePanel} onClose={() => setActivePanel(null)} />
        )}

        {/* Scene navigator — desktop */}
        <SceneNavigator />

        {/* Canvas workspace */}
        <CanvasWorkspace
          onElementSelect={() => {
            if (!window.matchMedia('(min-width: 1024px)').matches) {
              setActivePanel(null)
              setShowInspectorSheet(true)
            }
          }}
        />

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
  const reorderScene = useEditorStore((s) => s.reorderScene)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  const sorted = [...scenes].sort((a, b) => a.order - b.order)
  const THUMB_SCALE = 0.18

  function finishDrop(index: number) {
    if (draggedId) reorderScene(draggedId, index)
    setDraggedId(null)
    setDropIndex(null)
  }

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
            <div
              key={scene.id}
              className={`group relative ${dropIndex === index ? 'border-primary border-t-2 pt-1' : ''}`}
              draggable
              onDragStart={(e) => {
                setDraggedId(scene.id)
                e.dataTransfer.effectAllowed = 'move'
                e.dataTransfer.setData('text/plain', scene.id)
              }}
              onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                setDropIndex(index)
              }}
              onDrop={(e) => {
                e.preventDefault()
                finishDrop(index)
              }}
              onDragEnd={() => {
                setDraggedId(null)
                setDropIndex(null)
              }}
            >
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
                  <p className="text-text-muted flex items-center justify-between text-[10px] tabular-nums">
                    <span>#{index + 1}</span>
                    <span aria-hidden="true">⠿</span>
                  </p>
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

function CanvasWorkspace({ onElementSelect }: { onElementSelect: () => void }) {
  const scene = useEditorStore((s) => {
    const id = s.selectedSceneId
    return s.document.scenes.find((sc) => sc.id === id) ?? s.document.scenes[0]
  })
  const zoom = useEditorStore((s) => s.zoom)
  const setZoom = useEditorStore((s) => s.setZoom)
  const selectedElementId = useEditorStore((s) => s.selectedElementId)
  const selectedElementIds = useEditorStore((s) => s.selectedElementIds)
  const selectElement = useEditorStore((s) => s.selectElement)
  const selectElements = useEditorStore((s) => s.selectElements)
  const selectedSceneId = useEditorStore((s) => s.selectedSceneId)
  const updateElement = useEditorStore((s) => s.updateElement)
  const updateElementProps = useEditorStore((s) => s.updateElementProps)
  const commitElementDrag = useEditorStore((s) => s.commitElementDrag)
  const theme = useEditorStore((s) => s.document.project.theme)

  const [activeGuides, setActiveGuides] = useState<{ v: number[]; h: number[] } | null>(null)
  const [editingElementId, setEditingElementId] = useState<string | null>(null)
  const [marquee, setMarquee] = useState<{
    startX: number
    startY: number
    currentX: number
    currentY: number
  } | null>(null)
  const sceneFrameRef = useRef<HTMLDivElement>(null)
  const justMarqueedRef = useRef(false)

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
      (elementId, patch, before) => {
        if (selectedSceneId) {
          const snapped = applySnap(elementId, patch)
          commitElementDrag(selectedSceneId, elementId, snapped.patch, before)
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

  function pointerInScene(event: React.PointerEvent) {
    const rect = sceneFrameRef.current?.getBoundingClientRect()
    if (!rect || !scene) return null
    return {
      x: Math.max(0, Math.min(scene.baseWidth, (event.clientX - rect.left) / zoom)),
      y: Math.max(0, Math.min(scene.baseHeight, (event.clientY - rect.top) / zoom)),
    }
  }

  function finishMarquee() {
    if (!marquee || !scene) return
    const left = Math.min(marquee.startX, marquee.currentX)
    const top = Math.min(marquee.startY, marquee.currentY)
    const right = Math.max(marquee.startX, marquee.currentX)
    const bottom = Math.max(marquee.startY, marquee.currentY)
    const moved = right - left > 3 || bottom - top > 3
    if (moved) {
      selectElements(
        scene.elements
          .filter(
            (element) =>
              element.visible !== false &&
              element.x < right &&
              element.x + element.width > left &&
              element.y < bottom &&
              element.y + element.height > top,
          )
          .map((element) => element.id),
      )
      justMarqueedRef.current = true
    }
    setMarquee(null)
  }

  return (
    <main className="bg-canvas bg-spotlight relative min-w-0 flex-1 overflow-hidden">
      <div
        ref={scrollRef}
        className="absolute inset-0 overflow-auto overscroll-contain"
        onClick={() => {
          if (justMarqueedRef.current) {
            justMarqueedRef.current = false
            return
          }
          if (!isDragging()) {
            selectElements([])
            setEditingElementId(null)
          }
        }}
        onPointerMove={(e) => {
          onPointerMove(e, liveUpdate)
          if (marquee) {
            const point = pointerInScene(e)
            if (point)
              setMarquee((current) =>
                current ? { ...current, currentX: point.x, currentY: point.y } : null,
              )
          }
        }}
        onPointerUp={(e) => {
          onPointerUp(e, liveUpdate)
          finishMarquee()
          setActiveGuides(null)
        }}
      >
        {/* m-auto: tetap center saat muat, dan bisa discroll penuh saat overflow */}
        <div className="flex min-h-full min-w-full">
          <div className="m-auto shrink-0 p-4 sm:p-8">
            {scene ? (
              <div
                ref={sceneFrameRef}
                className="relative rounded-sm shadow-lg"
                style={{
                  width: scene.baseWidth * zoom,
                  height: scene.baseHeight * zoom,
                }}
                onPointerDown={(event) => {
                  const target = event.target as HTMLElement
                  if (target.closest('[data-editor-element]')) return
                  const point = pointerInScene(event)
                  if (!point) return
                  setMarquee({
                    startX: point.x,
                    startY: point.y,
                    currentX: point.x,
                    currentY: point.y,
                  })
                }}
              >
                <SceneRenderer
                  scene={scene}
                  scale={zoom}
                  selectedElementId={selectedElementId}
                  selectedElementIds={selectedElementIds}
                  editingElementId={editingElementId}
                  theme={theme}
                  interactive
                  onElementClick={(id, event) => {
                    const clicked = scene.elements.find((element) => element.id === id)
                    if (clicked?.groupId && !event.shiftKey) {
                      selectElements(
                        scene.elements
                          .filter((element) => element.groupId === clicked.groupId)
                          .map((element) => element.id),
                      )
                    } else {
                      selectElement(id, event.shiftKey)
                    }
                    onElementSelect()
                  }}
                  onElementDoubleClick={(id) => {
                    const clicked = scene.elements.find((element) => element.id === id)
                    if (clicked?.type === 'text') setEditingElementId(id)
                  }}
                  onTextCommit={(id, content) => {
                    if (selectedSceneId) updateElementProps(selectedSceneId, id, { content })
                    setEditingElementId(null)
                  }}
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
                      aspectLocked: el.aspectLocked,
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
                      aspectLocked: el.aspectLocked,
                    })
                  }}
                />
                {marquee && (
                  <div
                    className="border-primary bg-primary/10 pointer-events-none absolute z-[10000] border"
                    style={{
                      left: Math.min(marquee.startX, marquee.currentX) * zoom,
                      top: Math.min(marquee.startY, marquee.currentY) * zoom,
                      width: Math.abs(marquee.currentX - marquee.startX) * zoom,
                      height: Math.abs(marquee.currentY - marquee.startY) * zoom,
                    }}
                    aria-hidden="true"
                  />
                )}
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
      <SelectionToolbar />
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

function SelectionToolbar() {
  const count = useEditorStore((s) => s.selectedElementIds.length)
  const duplicate = useEditorStore((s) => s.duplicateSelectedElements)
  const remove = useEditorStore((s) => s.deleteSelectedElements)
  const align = useEditorStore((s) => s.alignSelectedElements)
  const distribute = useEditorStore((s) => s.distributeSelectedElements)
  const group = useEditorStore((s) => s.groupSelectedElements)
  const ungroup = useEditorStore((s) => s.ungroupSelectedElements)

  if (count === 0) return null

  const tools: { label: string; short: string; action: () => void; disabled?: boolean }[] = [
    { label: 'Rata kiri', short: 'L', action: () => align('left') },
    { label: 'Rata tengah horizontal', short: 'HC', action: () => align('center') },
    { label: 'Rata kanan', short: 'R', action: () => align('right') },
    { label: 'Rata atas', short: 'T', action: () => align('top') },
    { label: 'Rata tengah vertikal', short: 'VC', action: () => align('middle') },
    { label: 'Rata bawah', short: 'B', action: () => align('bottom') },
    {
      label: 'Sebar horizontal',
      short: 'DH',
      action: () => distribute('horizontal'),
      disabled: count < 3,
    },
    {
      label: 'Sebar vertikal',
      short: 'DV',
      action: () => distribute('vertical'),
      disabled: count < 3,
    },
  ]

  return (
    <div className="bg-surface-2 border-border absolute left-1/2 top-3 z-20 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-1 overflow-x-auto rounded-md border p-1 shadow-md">
      <span className="text-text-muted whitespace-nowrap px-2 text-[10px] tabular-nums">
        {count} dipilih
      </span>
      {tools.map((tool) => (
        <button
          key={tool.label}
          type="button"
          title={tool.label}
          aria-label={tool.label}
          disabled={tool.disabled}
          onClick={tool.action}
          className="border-border text-text-secondary hover:border-primary hover:text-primary min-w-7 rounded-sm border px-1.5 py-1 text-[9px] font-semibold disabled:opacity-30"
        >
          {tool.short}
        </button>
      ))}
      <span className="bg-border h-5 w-px shrink-0" />
      {count > 1 && (
        <button
          type="button"
          onClick={group}
          className="text-text-secondary hover:bg-surface-hover rounded-sm px-2 py-1 text-[10px]"
        >
          Grup
        </button>
      )}
      <button
        type="button"
        onClick={ungroup}
        className="text-text-secondary hover:bg-surface-hover rounded-sm px-2 py-1 text-[10px]"
      >
        Lepas
      </button>
      <button
        type="button"
        onClick={duplicate}
        className="text-text-secondary hover:bg-surface-hover rounded-sm px-2 py-1 text-[10px]"
      >
        Duplikat
      </button>
      <button
        type="button"
        onClick={remove}
        className="text-error hover:bg-error-subtle rounded-sm px-2 py-1 text-[10px]"
      >
        Hapus
      </button>
    </div>
  )
}

function InspectorPanel() {
  const title = useEditorStore((s) => {
    const scene = s.document.scenes.find((sc) => sc.id === s.selectedSceneId)
    const element = scene?.elements.find((el) => el.id === s.selectedElementId)
    return s.selectedElementIds.length > 1
      ? `${s.selectedElementIds.length} Elemen`
      : element
        ? 'Elemen'
        : scene
          ? 'Scene'
          : 'Inspector'
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
  const selectedElementIds = useEditorStore((s) => s.selectedElementIds)
  const selectedSceneId = useEditorStore((s) => s.selectedSceneId)
  const scene = useEditorStore((s) => {
    const id = s.selectedSceneId
    return s.document.scenes.find((sc) => sc.id === id)
  })
  const element = scene?.elements.find((el) => el.id === selectedElementId)
  const updateElement = useEditorStore((s) => s.updateElementWithHistory)
  const updateElementProps = useEditorStore((s) => s.updateElementProps)
  const deleteElement = useEditorStore((s) => s.deleteElement)
  const reorderElementZ = useEditorStore((s) => s.reorderElementZ)
  const updateSceneBackground = useEditorStore((s) => s.updateSceneBackground)
  const theme = useEditorStore((s) => s.document.project.theme ?? DEFAULT_THEME)
  const setTheme = useEditorStore((s) => s.setTheme)

  if (scene && selectedElementIds.length > 1) {
    return <MultiSelectionInspector count={selectedElementIds.length} />
  }

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
        theme={theme}
        onUpdateTheme={setTheme}
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

function MultiSelectionInspector({ count }: { count: number }) {
  const align = useEditorStore((s) => s.alignSelectedElements)
  const distribute = useEditorStore((s) => s.distributeSelectedElements)
  const group = useEditorStore((s) => s.groupSelectedElements)
  const ungroup = useEditorStore((s) => s.ungroupSelectedElements)
  const duplicate = useEditorStore((s) => s.duplicateSelectedElements)
  const remove = useEditorStore((s) => s.deleteSelectedElements)

  return (
    <div className="divide-border divide-y">
      <InspectorSection title="Pilihan">
        <p className="text-text-secondary text-xs">{count} elemen dipilih.</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={group}
            className="border-border-strong text-text-secondary rounded-sm border py-1.5 text-xs"
          >
            Grup
          </button>
          <button
            type="button"
            onClick={ungroup}
            className="border-border-strong text-text-secondary rounded-sm border py-1.5 text-xs"
          >
            Lepas grup
          </button>
          <button
            type="button"
            onClick={duplicate}
            className="border-border-strong text-text-secondary rounded-sm border py-1.5 text-xs"
          >
            Duplikat
          </button>
          <button
            type="button"
            onClick={remove}
            className="border-error/30 text-error rounded-sm border py-1.5 text-xs"
          >
            Hapus
          </button>
        </div>
      </InspectorSection>
      <InspectorSection title="Perataan">
        <div className="grid grid-cols-3 gap-1.5">
          {(
            [
              ['left', 'Kiri'],
              ['center', 'Tengah H'],
              ['right', 'Kanan'],
              ['top', 'Atas'],
              ['middle', 'Tengah V'],
              ['bottom', 'Bawah'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => align(value)}
              className="border-border-strong text-text-secondary hover:border-primary hover:text-primary rounded-sm border py-1.5 text-[10px]"
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={count < 3}
            onClick={() => distribute('horizontal')}
            className="border-border-strong text-text-secondary rounded-sm border py-1.5 text-[10px] disabled:opacity-30"
          >
            Sebar horizontal
          </button>
          <button
            type="button"
            disabled={count < 3}
            onClick={() => distribute('vertical')}
            className="border-border-strong text-text-secondary rounded-sm border py-1.5 text-[10px] disabled:opacity-30"
          >
            Sebar vertikal
          </button>
        </div>
      </InspectorSection>
    </div>
  )
}

function ElementInspector({
  element,
  onUpdate,
  onUpdateProps,
  onDelete,
  onReorderZ,
}: {
  element: ElementNode
  sceneId: string
  onUpdate: (patch: Partial<ElementNode>) => void
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

      <InspectorSection title="Identitas & Tampilan">
        <label className="text-text-secondary block text-xs">Nama layer</label>
        <input
          type="text"
          value={element.layerName ?? ''}
          onChange={(e) => onUpdate({ layerName: e.target.value || undefined })}
          placeholder={elementLayerName(element)}
          maxLength={120}
          className="border-border-strong bg-background text-text-primary focus:border-primary mt-1 w-full rounded-sm border px-2 py-1.5 text-xs outline-none"
        />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <CheckInput
            label="Tampilkan"
            checked={element.visible !== false}
            onChange={(value) => onUpdate({ visible: value })}
          />
          <CheckInput
            label="Kunci rasio"
            checked={element.aspectLocked ?? false}
            onChange={(value) => onUpdate({ aspectLocked: value })}
          />
          <CheckInput
            label="Balik X"
            checked={element.flipX ?? false}
            onChange={(value) => onUpdate({ flipX: value })}
          />
          <CheckInput
            label="Balik Y"
            checked={element.flipY ?? false}
            onChange={(value) => onUpdate({ flipY: value })}
          />
        </div>
        <RangeInput
          label="Opasitas"
          value={element.opacity ?? 1}
          onChange={(value) => onUpdate({ opacity: value })}
          min={0}
          max={1}
          step={0.05}
        />
      </InspectorSection>

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

      <InspectorSection title="Efek">
        <CheckInput
          label="Bayangan"
          checked={Boolean(element.shadow)}
          onChange={(enabled) =>
            onUpdate({
              shadow: enabled ? { x: 0, y: 8, blur: 24, spread: 0, color: '#00000033' } : undefined,
            })
          }
        />
        {element.shadow && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <NumInput
              label="X"
              value={element.shadow.x}
              min={-200}
              max={200}
              onChange={(x) => onUpdate({ shadow: { ...element.shadow!, x } })}
            />
            <NumInput
              label="Y"
              value={element.shadow.y}
              min={-200}
              max={200}
              onChange={(y) => onUpdate({ shadow: { ...element.shadow!, y } })}
            />
            <NumInput
              label="Blur"
              value={element.shadow.blur}
              min={0}
              max={200}
              onChange={(blur) => onUpdate({ shadow: { ...element.shadow!, blur } })}
            />
            <NumInput
              label="Sebar"
              value={element.shadow.spread}
              min={-100}
              max={100}
              onChange={(spread) => onUpdate({ shadow: { ...element.shadow!, spread } })}
            />
          </div>
        )}
        {element.shadow && (
          <ColorInput
            label="Warna bayangan"
            value={element.shadow.color}
            onChange={(color) => onUpdate({ shadow: { ...element.shadow!, color } })}
          />
        )}
        <label className="text-text-secondary mt-3 block text-xs">Animasi masuk</label>
        <select
          value={element.animation?.type ?? 'none'}
          onChange={(e) =>
            onUpdate({
              animation: {
                type: e.target.value as NonNullable<ElementNode['animation']>['type'],
                duration: element.animation?.duration ?? 400,
                delay: element.animation?.delay ?? 0,
              },
            })
          }
          className="border-border-strong bg-background text-text-primary focus:border-primary mt-1 w-full rounded-sm border px-2 py-1.5 text-xs outline-none"
        >
          <option value="none">Tanpa animasi</option>
          <option value="fade">Fade</option>
          <option value="rise">Rise</option>
          <option value="slide-left">Slide kiri</option>
          <option value="slide-right">Slide kanan</option>
          <option value="scale">Scale</option>
        </select>
        {element.animation && element.animation.type !== 'none' && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <NumInput
              label="Durasi (ms)"
              value={element.animation.duration}
              min={100}
              max={2000}
              step={50}
              onChange={(duration) => onUpdate({ animation: { ...element.animation!, duration } })}
            />
            <NumInput
              label="Delay (ms)"
              value={element.animation.delay}
              min={0}
              max={10000}
              step={50}
              onChange={(delay) => onUpdate({ animation: { ...element.animation!, delay } })}
            />
          </div>
        )}
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
          <label className="text-text-secondary block text-xs">Font</label>
          <select
            value={p.fontFamily ?? 'Inter, sans-serif'}
            onChange={(e) => onUpdateProps({ fontFamily: e.target.value })}
            className="border-border-strong bg-background text-text-primary focus:border-primary mb-2 mt-1 w-full rounded-sm border px-2 py-1.5 text-xs outline-none"
          >
            <option value="Inter, sans-serif">Inter</option>
            <option value="Georgia, serif">Georgia</option>
            <option value="Arial, sans-serif">Arial</option>
            <option value="Times New Roman, serif">Times New Roman</option>
            <option value="Courier New, monospace">Courier New</option>
          </select>
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
            <NumInput
              label="Jarak huruf"
              value={p.letterSpacing ?? 0}
              onChange={(v) => onUpdateProps({ letterSpacing: v })}
              step={0.1}
              min={-20}
              max={100}
            />
            <NumInput
              label="Padding"
              value={p.padding ?? 0}
              min={0}
              max={200}
              onChange={(v) => onUpdateProps({ padding: v })}
            />
            <NumInput
              label="Sudut"
              value={p.borderRadius ?? 0}
              min={0}
              max={200}
              onChange={(v) => onUpdateProps({ borderRadius: v })}
            />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <SelectInput
              label="Rata teks"
              value={p.textAlign ?? 'left'}
              options={[
                ['left', 'Kiri'],
                ['center', 'Tengah'],
                ['right', 'Kanan'],
              ]}
              onChange={(value) => onUpdateProps({ textAlign: value })}
            />
            <SelectInput
              label="Rata vertikal"
              value={p.verticalAlign ?? 'top'}
              options={[
                ['top', 'Atas'],
                ['middle', 'Tengah'],
                ['bottom', 'Bawah'],
              ]}
              onChange={(value) => onUpdateProps({ verticalAlign: value })}
            />
            <SelectInput
              label="Gaya"
              value={p.fontStyle ?? 'normal'}
              options={[
                ['normal', 'Normal'],
                ['italic', 'Miring'],
              ]}
              onChange={(value) => onUpdateProps({ fontStyle: value })}
            />
            <SelectInput
              label="Dekorasi"
              value={p.textDecoration ?? 'none'}
              options={[
                ['none', 'Tidak ada'],
                ['underline', 'Garis bawah'],
                ['line-through', 'Coret'],
              ]}
              onChange={(value) => onUpdateProps({ textDecoration: value })}
            />
          </div>
          <ColorInput
            label="Warna teks"
            value={p.color}
            onChange={(v) => onUpdateProps({ color: v })}
          />
          <ColorInput
            label="Warna latar"
            value={p.backgroundColor ?? '#FFFFFF'}
            onChange={(v) => onUpdateProps({ backgroundColor: v })}
          />
          <CheckInput
            label="Bayangan teks"
            checked={Boolean(p.textShadow)}
            onChange={(enabled) =>
              onUpdateProps({
                textShadow: enabled ? { x: 0, y: 2, blur: 4, color: '#00000055' } : undefined,
              })
            }
          />
          {p.textShadow && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <NumInput
                label="Shadow X"
                value={p.textShadow.x}
                min={-100}
                max={100}
                onChange={(x) => onUpdateProps({ textShadow: { ...p.textShadow!, x } })}
              />
              <NumInput
                label="Shadow Y"
                value={p.textShadow.y}
                min={-100}
                max={100}
                onChange={(y) => onUpdateProps({ textShadow: { ...p.textShadow!, y } })}
              />
              <NumInput
                label="Shadow blur"
                value={p.textShadow.blur}
                min={0}
                max={100}
                onChange={(blur) => onUpdateProps({ textShadow: { ...p.textShadow!, blur } })}
              />
            </div>
          )}
          {p.textShadow && (
            <ColorInput
              label="Warna shadow"
              value={p.textShadow.color}
              onChange={(color) => onUpdateProps({ textShadow: { ...p.textShadow!, color } })}
            />
          )}
        </InspectorSection>
      </>
    )
  }

  if (element.type === 'image') {
    const p = element.props
    return (
      <InspectorSection title="Gambar">
        <UrlInput
          label="URL gambar"
          value={p.src ?? ''}
          onCommit={(v) => onUpdateProps({ src: v })}
        />
        <label className="text-text-secondary mt-2 block text-xs">Alt text</label>
        <input
          type="text"
          value={p.alt ?? ''}
          onChange={(e) => onUpdateProps({ alt: e.target.value })}
          className="border-border-strong bg-background text-text-primary focus:border-primary mt-1 w-full rounded-sm border px-2 py-1.5 text-xs outline-none"
        />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <SelectInput
            label="Mode isi"
            value={p.objectFit}
            options={[
              ['cover', 'Crop'],
              ['contain', 'Muat'],
              ['fill', 'Regangkan'],
            ]}
            onChange={(value) => onUpdateProps({ objectFit: value })}
          />
          <NumInput
            label="Sudut"
            value={p.borderRadius ?? 0}
            min={0}
            max={200}
            onChange={(v) => onUpdateProps({ borderRadius: v })}
          />
        </div>
        <CheckInput
          label="Gambar dekoratif"
          checked={p.decorative}
          onChange={(decorative) => onUpdateProps({ decorative })}
        />
        {p.objectFit === 'cover' && (
          <div className="border-border mt-2 rounded-sm border p-2">
            <p className="text-text-muted mb-1 text-[10px] font-medium uppercase tracking-[0.06em]">
              Fokus crop
            </p>
            <RangeInput
              label="Horizontal"
              value={p.objectPositionX ?? 50}
              min={0}
              max={100}
              step={1}
              onChange={(objectPositionX) => onUpdateProps({ objectPositionX })}
            />
            <RangeInput
              label="Vertikal"
              value={p.objectPositionY ?? 50}
              min={0}
              max={100}
              step={1}
              onChange={(objectPositionY) => onUpdateProps({ objectPositionY })}
            />
          </div>
        )}
        <div className="mt-2 grid grid-cols-2 gap-2">
          <NumInput
            label="Tebal border"
            value={p.borderWidth ?? 0}
            min={0}
            max={50}
            onChange={(borderWidth) => onUpdateProps({ borderWidth })}
          />
          <NumInput
            label="Terang"
            value={p.brightness ?? 1}
            min={0}
            max={2}
            step={0.05}
            onChange={(brightness) => onUpdateProps({ brightness })}
          />
          <NumInput
            label="Kontras"
            value={p.contrast ?? 1}
            min={0}
            max={2}
            step={0.05}
            onChange={(contrast) => onUpdateProps({ contrast })}
          />
          <NumInput
            label="Saturasi"
            value={p.saturation ?? 1}
            min={0}
            max={2}
            step={0.05}
            onChange={(saturation) => onUpdateProps({ saturation })}
          />
        </div>
        <ColorInput
          label="Warna border"
          value={p.borderColor ?? '#000000'}
          onChange={(borderColor) => onUpdateProps({ borderColor })}
        />
      </InspectorSection>
    )
  }

  if (element.type === 'shape') {
    const p = element.props
    return (
      <InspectorSection title="Bentuk">
        <SelectInput
          label="Jenis"
          value={p.shape}
          options={[
            ['rectangle', 'Kotak'],
            ['circle', 'Lingkaran'],
            ['triangle', 'Segitiga'],
            ['star', 'Bintang'],
            ['heart', 'Hati'],
          ]}
          onChange={(shape) => onUpdateProps({ shape })}
        />
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

  if (element.type === 'icon') {
    const p = element.props
    return (
      <InspectorSection title="Ikon">
        <SelectInput
          label="Ikon"
          value={p.iconName}
          options={[
            'heart',
            'star',
            'check',
            'arrow',
            'gift',
            'cake',
            'confetti',
            'flower',
            'image',
            'map-pin',
            'calendar',
          ].map((name) => [name, name] as [string, string])}
          onChange={(iconName) => onUpdateProps({ iconName })}
        />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <NumInput
            label="Ukuran"
            value={p.size ?? 32}
            min={8}
            max={512}
            onChange={(size) => onUpdateProps({ size })}
          />
          <NumInput
            label="Tebal garis"
            value={p.strokeWidth ?? 2}
            min={0.5}
            max={4}
            step={0.25}
            onChange={(strokeWidth) => onUpdateProps({ strokeWidth })}
          />
          <NumInput
            label="Sudut latar"
            value={p.borderRadius ?? 0}
            min={0}
            max={200}
            onChange={(borderRadius) => onUpdateProps({ borderRadius })}
          />
        </div>
        <ColorInput
          label="Warna ikon"
          value={p.color ?? '#6D5EF7'}
          onChange={(color) => onUpdateProps({ color })}
        />
        <ColorInput
          label="Warna latar"
          value={p.backgroundColor ?? '#FFFFFF'}
          onChange={(backgroundColor) => onUpdateProps({ backgroundColor })}
        />
        <TextInput
          label="Label aksesibilitas"
          value={p.accessibleLabel ?? ''}
          onChange={(accessibleLabel) =>
            onUpdateProps({ accessibleLabel: accessibleLabel || undefined })
          }
        />
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
        <UrlInput
          className="mt-2"
          label="URL tujuan"
          value={p.url ?? ''}
          onCommit={(v) => onUpdateProps({ url: v })}
        />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <SelectInput
            label="Varian"
            value={p.variant}
            options={[
              ['primary', 'Primary'],
              ['secondary', 'Secondary'],
              ['ghost', 'Ghost'],
            ]}
            onChange={(variant) => onUpdateProps({ variant })}
          />
          <SelectInput
            label="Posisi ikon"
            value={p.iconPosition ?? 'left'}
            options={[
              ['left', 'Kiri'],
              ['right', 'Kanan'],
            ]}
            onChange={(iconPosition) => onUpdateProps({ iconPosition })}
          />
          <NumInput
            label="Sudut"
            value={p.borderRadius ?? 24}
            min={0}
            max={50}
            onChange={(borderRadius) => onUpdateProps({ borderRadius })}
          />
          <NumInput
            label="Tebal border"
            value={p.borderWidth ?? 0}
            min={0}
            max={20}
            onChange={(borderWidth) => onUpdateProps({ borderWidth })}
          />
          <NumInput
            label="Ukuran font"
            value={p.fontSize ?? 14}
            min={8}
            max={100}
            onChange={(fontSize) => onUpdateProps({ fontSize })}
          />
          <NumInput
            label="Berat font"
            value={p.fontWeight ?? 600}
            min={100}
            max={900}
            step={100}
            onChange={(fontWeight) => onUpdateProps({ fontWeight })}
          />
        </div>
        <SelectInput
          className="mt-2"
          label="Ikon"
          value={p.iconName ?? ''}
          options={[
            ['', 'Tanpa ikon'],
            ['heart', 'Hati'],
            ['star', 'Bintang'],
            ['gift', 'Hadiah'],
            ['calendar', 'Kalender'],
            ['arrow', 'Panah'],
          ]}
          onChange={(iconName) => onUpdateProps({ iconName: iconName || undefined })}
        />
        <SelectInput
          className="mt-2"
          label="Font"
          value={p.fontFamily ?? 'Inter, sans-serif'}
          options={[
            ['Inter, sans-serif', 'Inter'],
            ['Georgia, serif', 'Georgia'],
            ['Arial, sans-serif', 'Arial'],
            ['Courier New, monospace', 'Courier New'],
          ]}
          onChange={(fontFamily) => onUpdateProps({ fontFamily })}
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
        <ColorInput
          label="Warna border"
          value={p.borderColor ?? '#6D5EF7'}
          onChange={(borderColor) => onUpdateProps({ borderColor })}
        />
      </InspectorSection>
    )
  }

  if (element.type === 'audioControl') {
    const p = element.props
    return (
      <InspectorSection title="Audio">
        <TextInput
          label="Label"
          value={p.label ?? ''}
          onChange={(label) => onUpdateProps({ label })}
        />
        <CheckInput
          label="Mode ringkas"
          checked={p.compact}
          onChange={(compact) => onUpdateProps({ compact })}
        />
        <ColorInput
          label="Warna ikon & teks"
          value={p.color ?? '#6D5EF7'}
          onChange={(color) => onUpdateProps({ color })}
        />
        <ColorInput
          label="Warna latar"
          value={p.backgroundColor ?? '#FFFFFF'}
          onChange={(backgroundColor) => onUpdateProps({ backgroundColor })}
        />
      </InspectorSection>
    )
  }

  if (element.type === 'countdown') {
    const p = element.props
    return (
      <InspectorSection title="Hitung Mundur">
        <DateTimeInput
          label="Target"
          value={p.target}
          onChange={(target) => onUpdateProps({ target })}
        />
        <TextInput label="Judul" value={p.label} onChange={(label) => onUpdateProps({ label })} />
        <TextInput
          label="Teks setelah selesai"
          value={p.expiredLabel}
          onChange={(expiredLabel) => onUpdateProps({ expiredLabel })}
        />
        <CheckInput
          label="Tampilkan label waktu"
          checked={p.showLabels}
          onChange={(showLabels) => onUpdateProps({ showLabels })}
        />
        <ColorInput
          label="Warna teks"
          value={p.color ?? '#17171C'}
          onChange={(color) => onUpdateProps({ color })}
        />
        <ColorInput
          label="Warna aksen"
          value={p.accentColor ?? '#6D5EF7'}
          onChange={(accentColor) => onUpdateProps({ accentColor })}
        />
      </InspectorSection>
    )
  }

  if (element.type === 'location') {
    const p = element.props
    return (
      <InspectorSection title="Lokasi">
        <TextInput
          label="Nama tempat"
          value={p.name}
          onChange={(name) => onUpdateProps({ name })}
        />
        <TextInput
          label="Alamat"
          value={p.address}
          onChange={(address) => onUpdateProps({ address })}
          multiline
        />
        <UrlInput
          className="mt-2"
          label="URL petunjuk arah"
          value={p.directionsUrl ?? ''}
          onCommit={(directionsUrl) => onUpdateProps({ directionsUrl })}
        />
        <UrlInput
          className="mt-2"
          label="URL embed peta"
          value={p.mapEmbedUrl ?? ''}
          onCommit={(mapEmbedUrl) => onUpdateProps({ mapEmbedUrl })}
        />
        <TextInput
          label="Label tombol"
          value={p.buttonLabel}
          onChange={(buttonLabel) => onUpdateProps({ buttonLabel })}
        />
        <CheckInput
          label="Tampilkan area peta"
          checked={p.showMap}
          onChange={(showMap) => onUpdateProps({ showMap })}
        />
      </InspectorSection>
    )
  }

  if (element.type === 'saveDate') {
    const p = element.props
    return (
      <InspectorSection title="Simpan Tanggal">
        <TextInput
          label="Judul acara"
          value={p.title}
          onChange={(title) => onUpdateProps({ title })}
        />
        <DateTimeInput
          label="Mulai"
          value={p.startAt}
          onChange={(startAt) => onUpdateProps({ startAt })}
        />
        <DateTimeInput
          label="Selesai"
          value={p.endAt ?? ''}
          onChange={(endAt) => onUpdateProps({ endAt: endAt || undefined })}
          allowEmpty
        />
        <TextInput
          label="Lokasi"
          value={p.location ?? ''}
          onChange={(location) => onUpdateProps({ location: location || undefined })}
        />
        <TextInput
          label="Deskripsi"
          value={p.description ?? ''}
          onChange={(description) => onUpdateProps({ description: description || undefined })}
          multiline
        />
        <TextInput
          label="Label tombol"
          value={p.buttonLabel}
          onChange={(buttonLabel) => onUpdateProps({ buttonLabel })}
        />
      </InspectorSection>
    )
  }

  return null
}

// ─── Scene inspector ──────────────────────────────────────────────────────────

function SceneInspector({
  scene,
  theme,
  onUpdateTheme,
  onUpdateBackground,
}: {
  scene: Scene
  theme: Theme
  onUpdateTheme: (theme: Theme, applyToElements?: boolean) => void
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
          <UrlInput
            className="mt-2"
            label="URL gambar"
            value={bg.src ?? ''}
            onCommit={(v) => onUpdateBackground({ ...bg, src: v })}
          />
        )}
      </InspectorSection>

      <InspectorSection title="Tema Kreasi">
        <ColorInput
          label="Primer"
          value={theme.primary}
          onChange={(primary) => onUpdateTheme({ ...theme, primary })}
        />
        <ColorInput
          label="Sekunder"
          value={theme.secondary}
          onChange={(secondary) => onUpdateTheme({ ...theme, secondary })}
        />
        <ColorInput
          label="Aksen"
          value={theme.accent}
          onChange={(accent) => onUpdateTheme({ ...theme, accent })}
        />
        <ColorInput
          label="Teks"
          value={theme.text}
          onChange={(text) => onUpdateTheme({ ...theme, text })}
        />
        <ColorInput
          label="Permukaan"
          value={theme.surface}
          onChange={(surface) => onUpdateTheme({ ...theme, surface })}
        />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <SelectInput
            label="Font judul"
            value={theme.headingFont}
            options={[
              ['Georgia, serif', 'Georgia'],
              ['Inter, sans-serif', 'Inter'],
              ['Times New Roman, serif', 'Times'],
              ['Arial, sans-serif', 'Arial'],
            ]}
            onChange={(headingFont) => onUpdateTheme({ ...theme, headingFont })}
          />
          <SelectInput
            label="Font isi"
            value={theme.bodyFont}
            options={[
              ['Inter, sans-serif', 'Inter'],
              ['Arial, sans-serif', 'Arial'],
              ['Georgia, serif', 'Georgia'],
              ['Courier New, monospace', 'Courier'],
            ]}
            onChange={(bodyFont) => onUpdateTheme({ ...theme, bodyFont })}
          />
        </div>
        <button
          type="button"
          onClick={() => onUpdateTheme(theme, true)}
          className="border-primary text-primary hover:bg-primary-subtle mt-3 w-full rounded-sm border py-1.5 text-xs font-medium transition-colors"
        >
          Terapkan tema ke semua elemen
        </button>
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

function CheckInput({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="text-text-secondary mt-2 flex cursor-pointer items-center gap-2 text-xs">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="accent-primary h-3.5 w-3.5 rounded-sm"
      />
      {label}
    </label>
  )
}

function RangeInput({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}) {
  return (
    <label className="mt-2 block">
      <span className="text-text-secondary flex items-center justify-between text-xs">
        <span>{label}</span>
        <span className="text-text-muted tabular-nums">{Math.round(value * 100) / 100}</span>
      </span>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
        className="accent-primary mt-1 w-full"
      />
    </label>
  )
}

function SelectInput({
  label,
  value,
  options,
  onChange,
  className = '',
}: {
  label: string
  value: string
  options: readonly (readonly [string, string])[]
  onChange: (value: string) => void
  className?: string
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-text-muted text-[10px]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="border-border-strong bg-background text-text-primary focus:border-primary mt-0.5 w-full rounded-sm border px-2 py-1 text-xs outline-none"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  )
}

function TextInput({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  multiline?: boolean
}) {
  const classes =
    'border-border-strong bg-background text-text-primary focus:border-primary mt-1 w-full rounded-sm border px-2 py-1.5 text-xs outline-none'
  return (
    <label className="text-text-secondary mt-2 block text-xs">
      {label}
      {multiline ? (
        <textarea
          value={value}
          rows={3}
          onChange={(event) => onChange(event.target.value)}
          className={`${classes} resize-y`}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={classes}
        />
      )}
    </label>
  )
}

function toDateTimeLocal(value: string): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function DateTimeInput({
  label,
  value,
  onChange,
  allowEmpty = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  allowEmpty?: boolean
}) {
  return (
    <label className="text-text-secondary mt-2 block text-xs">
      {label}
      <input
        type="datetime-local"
        value={toDateTimeLocal(value)}
        onChange={(event) => {
          if (event.target.value === '' && allowEmpty) onChange('')
          else if (event.target.value) onChange(new Date(event.target.value).toISOString())
        }}
        className="border-border-strong bg-background text-text-primary focus:border-primary mt-1 w-full rounded-sm border px-2 py-1.5 text-xs outline-none"
      />
    </label>
  )
}

function isValidHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value)
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}

/** Input URL: hanya http(s) valid (atau kosong) yang di-commit — mencegah 422. */
function UrlInput({
  label,
  value,
  onCommit,
  className = '',
}: {
  label: string
  value: string
  onCommit: (v: string | undefined) => void
  className?: string
}) {
  const [text, setText] = useState(value)

  useEffect(() => {
    setText(value)
  }, [value])

  const valid = text === '' || isValidHttpUrl(text)

  return (
    <div className={className}>
      <label className="text-text-secondary block text-xs">{label}</label>
      <input
        type="url"
        value={text}
        onChange={(e) => {
          const raw = e.target.value
          setText(raw)
          if (raw === '') onCommit(undefined)
          else if (isValidHttpUrl(raw)) onCommit(raw)
        }}
        placeholder="https://…"
        className="border-border-strong bg-background text-text-primary focus:border-primary mt-1 w-full rounded-sm border px-2 py-1.5 text-xs outline-none"
      />
      {!valid && (
        <p className="text-warning mt-1 text-[10px]">URL harus diawali http:// atau https://</p>
      )}
    </div>
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
  layer: 'Layer',
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
  if (panel === 'musik') return <MusikPanel />
  return <LayerPanel />
}

// ─── Layer panel ──────────────────────────────────────────────────────────────

const ELEMENT_TYPE_LABELS: Record<ElementNode['type'], string> = {
  text: 'Teks',
  image: 'Gambar',
  shape: 'Bentuk',
  icon: 'Ikon',
  button: 'Tombol',
  audioControl: 'Audio',
  countdown: 'Hitung Mundur',
  location: 'Lokasi',
  saveDate: 'Simpan Tanggal',
}

function elementLayerName(element: ElementNode): string {
  if (element.layerName) return element.layerName
  if (element.type === 'text') return element.props.content.trim().split('\n')[0] || 'Teks kosong'
  if (element.type === 'image') return element.props.alt || 'Gambar'
  if (element.type === 'button') return element.props.label || 'Tombol'
  if (element.type === 'icon') return element.props.iconName
  if (element.type === 'shape') return element.props.shape
  if (element.type === 'audioControl') return element.props.label ?? 'Kontrol audio'
  if (element.type === 'countdown') return element.props.label
  if (element.type === 'location') return element.props.name
  return element.props.title
}

/** Daftar layer dari depan ke belakang dengan drag-and-drop dan kontrol presisi. */
function LayerPanel() {
  const scene = useEditorStore((s) => s.document.scenes.find((sc) => sc.id === s.selectedSceneId))
  const selectedElementId = useEditorStore((s) => s.selectedElementId)
  const selectedElementIds = useEditorStore((s) => s.selectedElementIds)
  const selectElement = useEditorStore((s) => s.selectElement)
  const updateElement = useEditorStore((s) => s.updateElementWithHistory)
  const deleteElement = useEditorStore((s) => s.deleteElement)
  const reorderElementZ = useEditorStore((s) => s.reorderElementZ)
  const reorderElements = useEditorStore((s) => s.reorderElements)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  if (!scene) {
    return <p className="text-text-muted py-8 text-center text-xs">Pilih scene terlebih dahulu.</p>
  }

  const sceneId = scene.id
  const layers = [...scene.elements].sort((a, b) => b.zIndex - a.zIndex)

  function finishDrop(index: number) {
    if (!draggedId) return
    const from = layers.findIndex((el) => el.id === draggedId)
    if (from === -1 || from === index) {
      setDraggedId(null)
      setDropIndex(null)
      return
    }
    const ids = layers.map((el) => el.id)
    const [moved] = ids.splice(from, 1)
    ids.splice(index, 0, moved)
    reorderElements(sceneId, ids)
    setDraggedId(null)
    setDropIndex(null)
  }

  if (layers.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <span className="text-2xl" aria-hidden="true">
          ☷
        </span>
        <p className="text-text-muted text-[11px]">Belum ada elemen pada scene ini.</p>
      </div>
    )
  }

  return (
    <div>
      <p className="text-text-muted mb-2 text-[10px]">
        Urutan teratas tampil paling depan. Geser item atau gunakan tombol panah.
      </p>
      <div className="space-y-1.5">
        {layers.map((element, index) => {
          const selected =
            element.id === selectedElementId || selectedElementIds.includes(element.id)
          return (
            <div
              key={element.id}
              draggable
              onDragStart={(e) => {
                setDraggedId(element.id)
                e.dataTransfer.effectAllowed = 'move'
                e.dataTransfer.setData('text/plain', element.id)
              }}
              onDragOver={(e) => {
                e.preventDefault()
                setDropIndex(index)
              }}
              onDrop={(e) => {
                e.preventDefault()
                finishDrop(index)
              }}
              onDragEnd={() => {
                setDraggedId(null)
                setDropIndex(null)
              }}
              className={`rounded-md border p-2 transition-colors ${
                dropIndex === index && draggedId
                  ? 'border-secondary bg-warning-subtle'
                  : selected
                    ? 'border-primary bg-primary-subtle'
                    : 'border-border bg-background'
              }`}
            >
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(event) => selectElement(element.id, event.shiftKey)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="text-text-primary block truncate text-xs font-medium">
                    {elementLayerName(element)}
                  </span>
                  <span className="text-text-muted block text-[9px] uppercase tracking-[0.08em]">
                    {ELEMENT_TYPE_LABELS[element.type]} · z{element.zIndex}
                  </span>
                </button>
                <span
                  className="text-text-muted cursor-grab text-sm"
                  title="Geser layer"
                  aria-hidden="true"
                >
                  ⠿
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => reorderElementZ(sceneId, element.id, 'front')}
                  className="border-border text-text-secondary hover:text-primary flex-1 rounded-sm border py-1 text-[10px]"
                  title="Paling depan"
                >
                  ⤒
                </button>
                <button
                  type="button"
                  onClick={() => reorderElementZ(sceneId, element.id, 'up')}
                  disabled={index === 0}
                  className="border-border text-text-secondary hover:text-primary flex-1 rounded-sm border py-1 text-[10px] disabled:opacity-30"
                  title="Naik satu layer"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => reorderElementZ(sceneId, element.id, 'down')}
                  disabled={index === layers.length - 1}
                  className="border-border text-text-secondary hover:text-primary flex-1 rounded-sm border py-1 text-[10px] disabled:opacity-30"
                  title="Turun satu layer"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => reorderElementZ(sceneId, element.id, 'back')}
                  className="border-border text-text-secondary hover:text-primary flex-1 rounded-sm border py-1 text-[10px]"
                  title="Paling belakang"
                >
                  ⤓
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updateElement(sceneId, element.id, { visible: element.visible === false })
                  }
                  className={`border-border flex-1 rounded-sm border py-1 text-[10px] ${element.visible === false ? 'text-text-muted' : 'text-info'}`}
                  title={element.visible === false ? 'Tampilkan elemen' : 'Sembunyikan elemen'}
                  aria-label={element.visible === false ? 'Tampilkan elemen' : 'Sembunyikan elemen'}
                >
                  {element.visible === false ? 'H' : 'V'}
                </button>
                <button
                  type="button"
                  onClick={() => updateElement(sceneId, element.id, { locked: !element.locked })}
                  className={`border-border flex-1 rounded-sm border py-1 text-[10px] ${
                    element.locked ? 'text-warning' : 'text-text-secondary'
                  }`}
                  title={element.locked ? 'Buka kunci' : 'Kunci elemen'}
                >
                  {element.locked ? '🔒' : '🔓'}
                </button>
                <button
                  type="button"
                  onClick={() => deleteElement(sceneId, element.id)}
                  className="border-error/30 text-error hover:bg-error-subtle flex-1 rounded-sm border py-1 text-[10px]"
                  title="Hapus elemen"
                >
                  ×
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Elemen panel ─────────────────────────────────────────────────────────────

const ELEMENT_TYPES: { type: ElementNode['type']; label: string; icon: string }[] = [
  { type: 'countdown', label: 'Hitung Mundur', icon: 'TMR' },
  { type: 'location', label: 'Lokasi', icon: 'MAP' },
  { type: 'saveDate', label: 'Simpan Tanggal', icon: 'CAL' },
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
    visible: true,
    opacity: 1,
    flipX: false,
    flipY: false,
    aspectLocked: false,
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
    case 'countdown': {
      const target = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      return {
        ...base,
        type: 'countdown',
        height: 110,
        props: {
          target,
          label: 'Menuju hari spesial',
          expiredLabel: 'Acara telah dimulai',
          showLabels: true,
          color: '#17171C',
          accentColor: '#6D5EF7',
        },
      }
    }
    case 'location':
      return {
        ...base,
        type: 'location',
        height: 190,
        props: {
          name: 'Lokasi acara',
          address: 'Tambahkan alamat lengkap',
          buttonLabel: 'Buka Petunjuk Arah',
          showMap: true,
        },
      }
    case 'saveDate': {
      const startAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      const endAt = new Date(startAt.getTime() + 2 * 60 * 60 * 1000)
      return {
        ...base,
        type: 'saveDate',
        height: 100,
        props: {
          title: 'Acara spesial',
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          buttonLabel: 'Simpan ke Kalender',
        },
      }
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
  const reorderScene = useEditorStore((s) => s.reorderScene)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const sorted = [...scenes].sort((a, b) => a.order - b.order)

  function clearLongPress() {
    if (longPressRef.current) clearTimeout(longPressRef.current)
    longPressRef.current = null
  }

  function finishTouchDrop() {
    if (draggingId && overIndex !== null) reorderScene(draggingId, overIndex)
    setDraggingId(null)
    setOverIndex(null)
    clearLongPress()
  }

  return (
    <div className="border-border bg-surface flex shrink-0 items-center gap-2 border-t px-3 py-2 lg:hidden">
      <div className="flex flex-1 items-center gap-1.5 overflow-x-auto">
        {sorted.map((scene, index) => {
          const isSelected = scene.id === selectedSceneId
          return (
            <button
              key={scene.id}
              type="button"
              onClick={() => {
                if (!draggingId) selectScene(scene.id)
              }}
              onPointerDown={(e) => {
                if (e.pointerType === 'mouse') return
                clearLongPress()
                longPressRef.current = setTimeout(() => {
                  setDraggingId(scene.id)
                  setOverIndex(index)
                }, 350)
              }}
              onPointerEnter={() => {
                if (draggingId) setOverIndex(index)
              }}
              onPointerUp={finishTouchDrop}
              onPointerCancel={() => {
                clearLongPress()
                setDraggingId(null)
                setOverIndex(null)
              }}
              aria-label={`Pilih ${scene.name}; tahan lalu geser untuk mengurutkan`}
              aria-pressed={isSelected}
              className={`flex h-10 w-10 shrink-0 touch-none items-center justify-center rounded-md border text-xs font-medium tabular-nums transition-colors ${
                overIndex === index && draggingId
                  ? 'border-secondary bg-warning-subtle text-warning scale-110'
                  : isSelected
                    ? 'border-primary bg-primary-subtle text-primary'
                    : 'border-border bg-background text-text-secondary'
              }`}
            >
              {draggingId === scene.id ? '⠿' : index + 1}
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
          <button
            type="button"
            aria-label="Geser scene ke kiri"
            disabled={sorted.findIndex((sc) => sc.id === selectedSceneId) <= 0}
            onClick={() => {
              const index = sorted.findIndex((sc) => sc.id === selectedSceneId)
              if (selectedSceneId && index > 0) reorderScene(selectedSceneId, index - 1)
            }}
            className="bg-surface-2 text-text-secondary hover:bg-surface-hover rounded-sm p-2 transition-colors disabled:opacity-30"
          >
            ←
          </button>
          <button
            type="button"
            aria-label="Geser scene ke kanan"
            disabled={sorted.findIndex((sc) => sc.id === selectedSceneId) >= sorted.length - 1}
            onClick={() => {
              const index = sorted.findIndex((sc) => sc.id === selectedSceneId)
              if (selectedSceneId && index < sorted.length - 1)
                reorderScene(selectedSceneId, index + 1)
            }}
            className="bg-surface-2 text-text-secondary hover:bg-surface-hover rounded-sm p-2 transition-colors disabled:opacity-30"
          >
            →
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
  { key: 'layer', icon: '☷' },
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
      {hasSelectedElement && (
        <MobileToolbarButton
          label="Properti"
          icon="⚙"
          active={inspectorOpen}
          onClick={onToggleInspector}
          showDot
        />
      )}
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
