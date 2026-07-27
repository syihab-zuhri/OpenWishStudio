import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { ProjectDocument, Scene, ElementNode, Soundtrack } from '@openwish/project-schema'

// ─── Types ────────────────────────────────────────────────────────────────────

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error' | 'offline'
const MAX_HISTORY = 50

interface HistoryFrame {
  document: ProjectDocument
}

interface EditorState {
  projectId: string
  projectName: string
  document: ProjectDocument
  selectedSceneId: string | null
  selectedElementId: string | null
  zoom: number
  saveStatus: SaveStatus
  past: HistoryFrame[]
  future: HistoryFrame[]
  /** Revisi draft terakhir yang diketahui dari server (baseRevision autosave). */
  draftRevision: number
  /** Mode tamu: draft disimpan di perangkat, bukan ke server. */
  isGuest: boolean
  /** Bertambah setiap tombol Simpan manual ditekan; dipantau useAutosave. */
  saveRequestNonce: number
  /** Status permintaan simpan manual — dipakai toast feedback di topbar. */
  manualSaveState: 'idle' | 'saving' | 'success' | 'error'
  /** Alasan kegagalan simpan terakhir (dari server) — null saat sukses. */
  lastSaveError: string | null
}

interface EditorActions {
  setProjectName: (name: string) => void
  setSaveStatus: (status: SaveStatus) => void
  setDraftRevision: (revision: number) => void
  requestSaveNow: () => void
  setManualSaveState: (state: EditorState['manualSaveState']) => void
  setLastSaveError: (message: string | null) => void
  selectScene: (sceneId: string) => void
  addScene: () => void
  deleteScene: (sceneId: string) => void
  duplicateScene: (sceneId: string) => void
  reorderScene: (sceneId: string, toIndex: number) => void
  updateSceneBackground: (sceneId: string, background: Scene['background']) => void
  addScenes: (scenes: Scene[]) => void
  setSoundtrack: (soundtrack: Soundtrack | undefined) => void
  selectElement: (elementId: string | null) => void
  addElement: (sceneId: string, element: ElementNode) => void
  updateElement: (
    sceneId: string,
    elementId: string,
    patch: Partial<
      Pick<ElementNode, 'x' | 'y' | 'width' | 'height' | 'rotation' | 'zIndex' | 'locked'>
    >,
  ) => void
  commitElementDrag: (
    sceneId: string,
    elementId: string,
    patch: Partial<Pick<ElementNode, 'x' | 'y' | 'width' | 'height'>>,
    before?: Pick<ElementNode, 'x' | 'y' | 'width' | 'height'>,
  ) => void
  updateElementProps: (sceneId: string, elementId: string, props: Record<string, unknown>) => void
  deleteElement: (sceneId: string, elementId: string) => void
  /** Hapus semua elemen gambar yang merujuk aset yang sudah dihapus. */
  removeAssetReferences: (assetId: string) => void
  reorderElementZ: (
    sceneId: string,
    elementId: string,
    direction: 'up' | 'down' | 'front' | 'back',
  ) => void
  /** Urutan ID dari paling depan ke paling belakang. */
  reorderElements: (sceneId: string, orderedIdsFrontToBack: string[]) => void
  setZoom: (zoom: number) => void
  undo: () => void
  redo: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cloneDoc(doc: ProjectDocument): ProjectDocument {
  return JSON.parse(JSON.stringify(doc)) as ProjectDocument
}

function makeDefaultScene(order: number): Scene {
  return {
    id: uuidv4(),
    name: `Scene ${order + 1}`,
    order,
    baseWidth: 390,
    baseHeight: 844,
    background: { type: 'color', color: '#FFFFFF' },
    elements: [],
  }
}

function withPushedHistory(state: EditorState): Pick<EditorState, 'past' | 'future'> {
  const newPast = [...state.past, { document: cloneDoc(state.document) }]
  if (newPast.length > MAX_HISTORY) newPast.shift()
  return { past: newPast, future: [] }
}

function mapScenes(
  doc: ProjectDocument,
  sceneId: string,
  fn: (scene: Scene) => Scene,
): ProjectDocument {
  return {
    ...doc,
    scenes: doc.scenes.map((sc) => (sc.id === sceneId ? fn(sc) : sc)),
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useEditorStore = create<EditorState & EditorActions>()((set, get) => ({
  projectId: '',
  projectName: '',
  document: {
    schemaVersion: 1,
    project: { title: '', locale: 'id-ID' },
    scenes: [],
  },
  selectedSceneId: null,
  selectedElementId: null,
  zoom: 1,
  saveStatus: 'saved',
  past: [],
  future: [],
  draftRevision: 0,
  isGuest: false,
  saveRequestNonce: 0,
  manualSaveState: 'idle',
  lastSaveError: null,

  // ── Project ─────────────────────────────────────────────────────────────────

  setProjectName(name) {
    const normalizedName = name.trim().slice(0, 120) || 'Kreasi Tanpa Judul'
    set((s) => ({
      projectName: normalizedName,
      document: {
        ...s.document,
        project: { ...s.document.project, title: normalizedName },
      },
      saveStatus: 'unsaved' as SaveStatus,
    }))
  },

  setSaveStatus(status) {
    set({ saveStatus: status })
  },

  setDraftRevision(revision) {
    set({ draftRevision: revision })
  },

  requestSaveNow() {
    set((s) => ({ saveRequestNonce: s.saveRequestNonce + 1, manualSaveState: 'saving' }))
  },

  setManualSaveState(state) {
    set({ manualSaveState: state })
  },

  setLastSaveError(message) {
    set({ lastSaveError: message })
  },

  // ── Scene selection ──────────────────────────────────────────────────────────

  selectScene(sceneId) {
    set({ selectedSceneId: sceneId, selectedElementId: null })
  },

  // ── Scene mutations ──────────────────────────────────────────────────────────

  addScene() {
    set((s) => {
      const newScene = makeDefaultScene(s.document.scenes.length)
      return {
        ...withPushedHistory(s),
        document: { ...s.document, scenes: [...s.document.scenes, newScene] },
        selectedSceneId: newScene.id,
        selectedElementId: null,
        saveStatus: 'unsaved' as SaveStatus,
      }
    })
  },

  deleteScene(sceneId) {
    const { document } = get()
    if (document.scenes.length <= 1) return
    set((s) => {
      const idx = s.document.scenes.findIndex((sc) => sc.id === sceneId)
      if (idx === -1) return s
      const newScenes = s.document.scenes
        .filter((sc) => sc.id !== sceneId)
        .map((sc, i) => ({ ...sc, order: i }))
      const newSelectedId =
        s.selectedSceneId === sceneId
          ? (newScenes[Math.max(0, idx - 1)]?.id ?? null)
          : s.selectedSceneId
      return {
        ...withPushedHistory(s),
        document: { ...s.document, scenes: newScenes },
        selectedSceneId: newSelectedId,
        selectedElementId: s.selectedSceneId === sceneId ? null : s.selectedElementId,
        saveStatus: 'unsaved' as SaveStatus,
      }
    })
  },

  duplicateScene(sceneId) {
    set((s) => {
      const src = s.document.scenes.find((sc) => sc.id === sceneId)
      if (!src) return s
      const copy: Scene = {
        ...cloneDoc({ ...s.document, scenes: [src] }).scenes[0],
        id: uuidv4(),
        name: `${src.name} (salinan)`,
        elements: src.elements.map((el) => ({ ...el, id: uuidv4() })),
      }
      const srcIdx = s.document.scenes.findIndex((sc) => sc.id === sceneId)
      const newScenes = [
        ...s.document.scenes.slice(0, srcIdx + 1),
        copy,
        ...s.document.scenes.slice(srcIdx + 1),
      ].map((sc, i) => ({ ...sc, order: i }))
      return {
        ...withPushedHistory(s),
        document: { ...s.document, scenes: newScenes },
        selectedSceneId: copy.id,
        selectedElementId: null,
        saveStatus: 'unsaved' as SaveStatus,
      }
    })
  },

  reorderScene(sceneId, toIndex) {
    set((s) => {
      const fromIdx = s.document.scenes.findIndex((sc) => sc.id === sceneId)
      const boundedIndex = Math.max(0, Math.min(s.document.scenes.length - 1, toIndex))
      if (fromIdx === -1 || fromIdx === boundedIndex) return s
      const newScenes = [...s.document.scenes]
      const [removed] = newScenes.splice(fromIdx, 1)
      newScenes.splice(boundedIndex, 0, removed)
      return {
        ...withPushedHistory(s),
        document: { ...s.document, scenes: newScenes.map((sc, i) => ({ ...sc, order: i })) },
        saveStatus: 'unsaved' as SaveStatus,
      }
    })
  },

  updateSceneBackground(sceneId, background) {
    set((s) => ({
      ...withPushedHistory(s),
      document: mapScenes(s.document, sceneId, (sc) => ({ ...sc, background })),
      saveStatus: 'unsaved' as SaveStatus,
    }))
  },

  addScenes(scenes) {
    if (!scenes.length) return
    set((s) => {
      const start = s.document.scenes.length
      const withOrder = scenes.map((sc, i) => ({ ...sc, order: start + i }))
      return {
        ...withPushedHistory(s),
        document: { ...s.document, scenes: [...s.document.scenes, ...withOrder] },
        selectedSceneId: withOrder[0].id,
        selectedElementId: null,
        saveStatus: 'unsaved' as SaveStatus,
      }
    })
  },

  setSoundtrack(soundtrack) {
    set((s) => ({
      ...withPushedHistory(s),
      document: {
        ...s.document,
        project: { ...s.document.project, soundtrack },
      },
      saveStatus: 'unsaved' as SaveStatus,
    }))
  },

  // ── Element selection ────────────────────────────────────────────────────────

  selectElement(elementId) {
    set({ selectedElementId: elementId })
  },

  // ── Element mutations ─────────────────────────────────────────────────────────

  addElement(sceneId, element) {
    set((s) => ({
      ...withPushedHistory(s),
      document: mapScenes(s.document, sceneId, (sc) => ({
        ...sc,
        elements: [...sc.elements, element],
      })),
      selectedElementId: element.id,
      saveStatus: 'unsaved' as SaveStatus,
    }))
  },

  updateElement(sceneId, elementId, patch) {
    set((s) => ({
      document: mapScenes(s.document, sceneId, (sc) => ({
        ...sc,
        elements: sc.elements.map((el) =>
          el.id === elementId ? ({ ...el, ...patch } as ElementNode) : el,
        ),
      })),
      saveStatus: 'unsaved' as SaveStatus,
    }))
  },

  commitElementDrag(sceneId, elementId, patch, before) {
    set((s) => {
      const beforeDocument = before
        ? mapScenes(s.document, sceneId, (sc) => ({
            ...sc,
            elements: sc.elements.map((el) =>
              el.id === elementId ? ({ ...el, ...before } as ElementNode) : el,
            ),
          }))
        : s.document
      return {
        past: [...s.past, { document: cloneDoc(beforeDocument) }].slice(-MAX_HISTORY),
        future: [],
        document: mapScenes(s.document, sceneId, (sc) => ({
          ...sc,
          elements: sc.elements.map((el) =>
            el.id === elementId ? ({ ...el, ...patch } as ElementNode) : el,
          ),
        })),
        saveStatus: 'unsaved' as SaveStatus,
      }
    })
  },

  updateElementProps(sceneId, elementId, props) {
    set((s) => ({
      document: mapScenes(s.document, sceneId, (sc) => ({
        ...sc,
        elements: sc.elements.map((el) =>
          el.id === elementId ? ({ ...el, props: { ...el.props, ...props } } as ElementNode) : el,
        ),
      })),
      saveStatus: 'unsaved' as SaveStatus,
    }))
  },

  deleteElement(sceneId, elementId) {
    set((s) => ({
      ...withPushedHistory(s),
      document: mapScenes(s.document, sceneId, (sc) => ({
        ...sc,
        elements: sc.elements.filter((el) => el.id !== elementId),
      })),
      selectedElementId: s.selectedElementId === elementId ? null : s.selectedElementId,
      saveStatus: 'unsaved' as SaveStatus,
    }))
  },

  removeAssetReferences(assetId) {
    set((s) => {
      const removedIds = new Set<string>()
      let changed = false
      const scenes = s.document.scenes.map((sc) => {
        const removeBackground = sc.background.type === 'image' && sc.background.assetId === assetId
        if (removeBackground) changed = true
        const elements = sc.elements.filter((el) => {
          const remove = el.type === 'image' && el.props.assetId === assetId
          if (remove) {
            changed = true
            removedIds.add(el.id)
          }
          return !remove
        })
        return {
          ...sc,
          background: removeBackground
            ? ({ type: 'color', color: '#FFFDF8' } as const)
            : sc.background,
          elements,
        }
      })
      const removeSoundtrack = s.document.project.soundtrack?.assetId === assetId
      if (removeSoundtrack) changed = true
      if (!changed) return s
      return {
        ...withPushedHistory(s),
        document: {
          ...s.document,
          project: {
            ...s.document.project,
            soundtrack: removeSoundtrack ? undefined : s.document.project.soundtrack,
          },
          scenes,
        },
        selectedElementId:
          s.selectedElementId && removedIds.has(s.selectedElementId) ? null : s.selectedElementId,
        saveStatus: 'unsaved' as SaveStatus,
      }
    })
  },

  reorderElementZ(sceneId, elementId, direction) {
    set((s) => ({
      ...withPushedHistory(s),
      document: mapScenes(s.document, sceneId, (sc) => {
        // Salin elemen juga: jangan mutasi object dari state lama ketika
        // menormalkan zIndex (history/undo bergantung pada immutability).
        const sorted = sc.elements.map((el) => ({ ...el })).sort((a, b) => a.zIndex - b.zIndex)
        const idx = sorted.findIndex((el) => el.id === elementId)
        if (idx === -1) return sc
        if (direction === 'front') {
          sorted.forEach((el, i) => {
            el.zIndex = i
          })
          sorted[idx].zIndex = sorted.length
        } else if (direction === 'back') {
          sorted.forEach((el, i) => {
            el.zIndex = i + 1
          })
          sorted[idx].zIndex = 0
        } else if (direction === 'up' && idx < sorted.length - 1) {
          const tmp = sorted[idx].zIndex
          sorted[idx].zIndex = sorted[idx + 1].zIndex
          sorted[idx + 1].zIndex = tmp
        } else if (direction === 'down' && idx > 0) {
          const tmp = sorted[idx].zIndex
          sorted[idx].zIndex = sorted[idx - 1].zIndex
          sorted[idx - 1].zIndex = tmp
        }
        return { ...sc, elements: sorted }
      }),
      saveStatus: 'unsaved' as SaveStatus,
    }))
  },

  reorderElements(sceneId, orderedIdsFrontToBack) {
    set((s) => {
      const scene = s.document.scenes.find((item) => item.id === sceneId)
      if (!scene || orderedIdsFrontToBack.length !== scene.elements.length) return s
      if (new Set(orderedIdsFrontToBack).size !== scene.elements.length) return s
      const currentIds = new Set(scene.elements.map((element) => element.id))
      if (orderedIdsFrontToBack.some((id) => !currentIds.has(id))) return s

      return {
        ...withPushedHistory(s),
        document: mapScenes(s.document, sceneId, (sc) => {
          const count = orderedIdsFrontToBack.length
          const zById = new Map(orderedIdsFrontToBack.map((id, i) => [id, count - i]))
          return {
            ...sc,
            elements: sc.elements.map((el) => ({ ...el, zIndex: zById.get(el.id)! })),
          }
        }),
        selectedElementId: s.selectedElementId,
        saveStatus: 'unsaved' as SaveStatus,
      }
    })
  },

  // ── Canvas ──────────────────────────────────────────────────────────────────

  setZoom(zoom) {
    set({ zoom: Math.max(0.25, Math.min(2, zoom)) })
  },

  // ── History ─────────────────────────────────────────────────────────────────

  undo() {
    const { past, document: currentDoc } = get()
    if (!past.length) return
    const newPast = [...past]
    const frame = newPast.pop()!
    set((s) => {
      const sceneExists = frame.document.scenes.some((sc) => sc.id === s.selectedSceneId)
      return {
        past: newPast,
        future: [{ document: cloneDoc(currentDoc) }, ...s.future],
        document: frame.document,
        selectedSceneId: sceneExists ? s.selectedSceneId : (frame.document.scenes[0]?.id ?? null),
        selectedElementId: null,
        saveStatus: 'unsaved' as SaveStatus,
      }
    })
  },

  redo() {
    const { future, document: currentDoc } = get()
    if (!future.length) return
    const [frame, ...restFuture] = future
    set((s) => ({
      future: restFuture,
      past: [...s.past, { document: cloneDoc(currentDoc) }],
      document: frame.document,
      saveStatus: 'unsaved' as SaveStatus,
    }))
  },
}))

// ─── Init helper ──────────────────────────────────────────────────────────────

export function initEditorStore(
  projectId: string,
  projectName: string,
  document: ProjectDocument,
  options?: { revision?: number; isGuest?: boolean },
) {
  useEditorStore.setState({
    projectId,
    projectName,
    document,
    selectedSceneId: document.scenes[0]?.id ?? null,
    selectedElementId: null,
    zoom: 1,
    saveStatus: 'saved',
    past: [],
    future: [],
    draftRevision: options?.revision ?? 0,
    isGuest: options?.isGuest ?? false,
    saveRequestNonce: 0,
    manualSaveState: 'idle',
    lastSaveError: null,
  })
}
