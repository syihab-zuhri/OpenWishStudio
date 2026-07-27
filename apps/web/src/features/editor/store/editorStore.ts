import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import {
  CURRENT_SCHEMA_VERSION,
  DEFAULT_THEME,
  type ProjectDocument,
  type Scene,
  type ElementNode,
  type Soundtrack,
  type Theme,
} from '@openwish/project-schema'

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
  selectedElementIds: string[]
  clipboard: ElementNode[]
  zoom: number
  saveStatus: SaveStatus
  past: HistoryFrame[]
  future: HistoryFrame[]
  historyCoalesceKey: string | null
  historyCoalesceAt: number
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
  selectElement: (elementId: string | null, additive?: boolean) => void
  selectElements: (elementIds: string[]) => void
  addElement: (sceneId: string, element: ElementNode) => void
  updateElement: (
    sceneId: string,
    elementId: string,
    patch: Partial<
      Pick<ElementNode, 'x' | 'y' | 'width' | 'height' | 'rotation' | 'zIndex' | 'locked'>
    >,
  ) => void
  updateElementWithHistory: (
    sceneId: string,
    elementId: string,
    patch: Partial<ElementNode>,
  ) => void
  commitElementDrag: (
    sceneId: string,
    elementId: string,
    patch: Partial<Pick<ElementNode, 'x' | 'y' | 'width' | 'height'>>,
    before?: Pick<ElementNode, 'x' | 'y' | 'width' | 'height'>,
  ) => void
  updateElementProps: (sceneId: string, elementId: string, props: Record<string, unknown>) => void
  deleteElement: (sceneId: string, elementId: string) => void
  deleteSelectedElements: () => void
  duplicateSelectedElements: () => void
  copySelectedElements: () => void
  pasteElements: () => void
  nudgeSelectedElements: (dx: number, dy: number) => void
  alignSelectedElements: (mode: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void
  distributeSelectedElements: (axis: 'horizontal' | 'vertical') => void
  groupSelectedElements: () => void
  ungroupSelectedElements: () => void
  setTheme: (theme: Theme, applyToElements?: boolean) => void
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

function withPushedHistory(
  state: EditorState,
  coalesceKey?: string,
): Pick<EditorState, 'past' | 'future' | 'historyCoalesceKey' | 'historyCoalesceAt'> {
  const now = Date.now()
  if (
    coalesceKey &&
    state.historyCoalesceKey === coalesceKey &&
    now - state.historyCoalesceAt < 700
  ) {
    return {
      past: state.past,
      future: state.future,
      historyCoalesceKey: coalesceKey,
      historyCoalesceAt: now,
    }
  }
  const newPast = [...state.past, { document: cloneDoc(state.document) }]
  if (newPast.length > MAX_HISTORY) newPast.shift()
  return {
    past: newPast,
    future: [],
    historyCoalesceKey: coalesceKey ?? null,
    historyCoalesceAt: coalesceKey ? now : 0,
  }
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
    schemaVersion: CURRENT_SCHEMA_VERSION,
    project: { title: '', locale: 'id-ID', theme: { ...DEFAULT_THEME } },
    scenes: [],
  },
  selectedSceneId: null,
  selectedElementId: null,
  selectedElementIds: [],
  clipboard: [],
  zoom: 1,
  saveStatus: 'saved',
  past: [],
  future: [],
  historyCoalesceKey: null,
  historyCoalesceAt: 0,
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
    set({ selectedSceneId: sceneId, selectedElementId: null, selectedElementIds: [] })
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
        selectedElementIds: [],
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
        selectedElementIds: s.selectedSceneId === sceneId ? [] : s.selectedElementIds,
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
        selectedElementIds: [],
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
        selectedElementIds: [],
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

  setTheme(theme, applyToElements = false) {
    set((s) => ({
      ...withPushedHistory(s),
      document: {
        ...s.document,
        project: { ...s.document.project, theme },
        scenes: applyToElements
          ? s.document.scenes.map((scene) => ({
              ...scene,
              elements: scene.elements.map((element) => {
                if (element.type === 'text') {
                  return {
                    ...element,
                    props: {
                      ...element.props,
                      color: theme.text,
                      fontFamily:
                        (element.props.fontWeight ?? 400) >= 600
                          ? theme.headingFont
                          : theme.bodyFont,
                    },
                  }
                }
                if (element.type === 'shape') {
                  return { ...element, props: { ...element.props, fill: theme.primary } }
                }
                if (element.type === 'icon') {
                  return { ...element, props: { ...element.props, color: theme.secondary } }
                }
                if (element.type === 'button') {
                  return {
                    ...element,
                    props: {
                      ...element.props,
                      backgroundColor: theme.primary,
                      textColor: theme.surface,
                    },
                  }
                }
                if (element.type === 'countdown') {
                  return {
                    ...element,
                    props: { ...element.props, color: theme.text, accentColor: theme.primary },
                  }
                }
                return element
              }),
            }))
          : s.document.scenes,
      },
      saveStatus: 'unsaved' as SaveStatus,
    }))
  },

  // ── Element selection ────────────────────────────────────────────────────────

  selectElement(elementId, additive = false) {
    set((s) => {
      if (!elementId) return { selectedElementId: null, selectedElementIds: [] }
      if (!additive) return { selectedElementId: elementId, selectedElementIds: [elementId] }
      const exists = s.selectedElementIds.includes(elementId)
      const selectedElementIds = exists
        ? s.selectedElementIds.filter((id) => id !== elementId)
        : [...s.selectedElementIds, elementId]
      return {
        selectedElementIds,
        selectedElementId: exists ? (selectedElementIds.at(-1) ?? null) : elementId,
      }
    })
  },

  selectElements(elementIds) {
    const unique = [...new Set(elementIds)]
    set({ selectedElementIds: unique, selectedElementId: unique.at(-1) ?? null })
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
      selectedElementIds: [element.id],
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

  updateElementWithHistory(sceneId, elementId, patch) {
    set((s) => ({
      ...withPushedHistory(s, `element:${sceneId}:${elementId}`),
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
      ...withPushedHistory(s, `props:${sceneId}:${elementId}`),
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
      selectedElementIds: s.selectedElementIds.filter((id) => id !== elementId),
      saveStatus: 'unsaved' as SaveStatus,
    }))
  },

  deleteSelectedElements() {
    set((s) => {
      if (!s.selectedSceneId || !s.selectedElementIds.length) return s
      const selected = new Set(s.selectedElementIds)
      return {
        ...withPushedHistory(s),
        document: mapScenes(s.document, s.selectedSceneId, (scene) => ({
          ...scene,
          elements: scene.elements.filter((element) => !selected.has(element.id)),
        })),
        selectedElementId: null,
        selectedElementIds: [],
        saveStatus: 'unsaved' as SaveStatus,
      }
    })
  },

  duplicateSelectedElements() {
    set((s) => {
      if (!s.selectedSceneId || !s.selectedElementIds.length) return s
      const scene = s.document.scenes.find((item) => item.id === s.selectedSceneId)
      if (!scene) return s
      const selected = new Set(s.selectedElementIds)
      const source = scene.elements.filter((element) => selected.has(element.id))
      if (!source.length) return s
      const maxZ = scene.elements.reduce((max, element) => Math.max(max, element.zIndex), 0)
      const groupIds = new Map<string, string>()
      const copies = source.map((element, index) => {
        const groupId = element.groupId
          ? (groupIds.get(element.groupId) ??
            (() => {
              const id = uuidv4()
              groupIds.set(element.groupId!, id)
              return id
            })())
          : undefined
        return {
          ...cloneDoc({ ...s.document, scenes: [{ ...scene, elements: [element] }] }).scenes[0]
            .elements[0],
          id: uuidv4(),
          layerName: element.layerName ? `${element.layerName} copy` : undefined,
          x: element.x + 12,
          y: element.y + 12,
          zIndex: maxZ + index + 1,
          groupId,
        } as ElementNode
      })
      return {
        ...withPushedHistory(s),
        document: mapScenes(s.document, s.selectedSceneId, (item) => ({
          ...item,
          elements: [...item.elements, ...copies],
        })),
        selectedElementId: copies.at(-1)?.id ?? null,
        selectedElementIds: copies.map((element) => element.id),
        saveStatus: 'unsaved' as SaveStatus,
      }
    })
  },

  copySelectedElements() {
    set((s) => {
      if (!s.selectedSceneId || !s.selectedElementIds.length) return s
      const scene = s.document.scenes.find((item) => item.id === s.selectedSceneId)
      if (!scene) return s
      const selected = new Set(s.selectedElementIds)
      return {
        clipboard: cloneDoc({ ...s.document, scenes: [{ ...scene }] }).scenes[0].elements.filter(
          (element) => selected.has(element.id),
        ),
      }
    })
  },

  pasteElements() {
    set((s) => {
      if (!s.selectedSceneId || !s.clipboard.length) return s
      const scene = s.document.scenes.find((item) => item.id === s.selectedSceneId)
      if (!scene) return s
      const maxZ = scene.elements.reduce((max, element) => Math.max(max, element.zIndex), 0)
      const copies = s.clipboard.map((element, index) => ({
        ...element,
        id: uuidv4(),
        x: element.x + 16,
        y: element.y + 16,
        zIndex: maxZ + index + 1,
        groupId: undefined,
      })) as ElementNode[]
      return {
        ...withPushedHistory(s),
        document: mapScenes(s.document, s.selectedSceneId, (item) => ({
          ...item,
          elements: [...item.elements, ...copies],
        })),
        selectedElementId: copies.at(-1)?.id ?? null,
        selectedElementIds: copies.map((element) => element.id),
        clipboard: copies,
        saveStatus: 'unsaved' as SaveStatus,
      }
    })
  },

  nudgeSelectedElements(dx, dy) {
    set((s) => {
      if (!s.selectedSceneId || !s.selectedElementIds.length) return s
      const selected = new Set(s.selectedElementIds)
      return {
        ...withPushedHistory(s, `nudge:${s.selectedSceneId}:${s.selectedElementIds.join(',')}`),
        document: mapScenes(s.document, s.selectedSceneId, (scene) => ({
          ...scene,
          elements: scene.elements.map((element) =>
            selected.has(element.id)
              ? { ...element, x: element.x + dx, y: element.y + dy }
              : element,
          ),
        })),
        saveStatus: 'unsaved' as SaveStatus,
      }
    })
  },

  alignSelectedElements(mode) {
    set((s) => {
      if (!s.selectedSceneId || !s.selectedElementIds.length) return s
      const scene = s.document.scenes.find((item) => item.id === s.selectedSceneId)
      if (!scene) return s
      const selected = new Set(s.selectedElementIds)
      const elements = scene.elements.filter((element) => selected.has(element.id))
      if (!elements.length) return s
      const left = elements.length === 1 ? 0 : Math.min(...elements.map((element) => element.x))
      const top = elements.length === 1 ? 0 : Math.min(...elements.map((element) => element.y))
      const right =
        elements.length === 1
          ? scene.baseWidth
          : Math.max(...elements.map((element) => element.x + element.width))
      const bottom =
        elements.length === 1
          ? scene.baseHeight
          : Math.max(...elements.map((element) => element.y + element.height))
      return {
        ...withPushedHistory(s),
        document: mapScenes(s.document, s.selectedSceneId, (item) => ({
          ...item,
          elements: item.elements.map((element) => {
            if (!selected.has(element.id)) return element
            if (mode === 'left') return { ...element, x: left }
            if (mode === 'center') return { ...element, x: (left + right - element.width) / 2 }
            if (mode === 'right') return { ...element, x: right - element.width }
            if (mode === 'top') return { ...element, y: top }
            if (mode === 'middle') return { ...element, y: (top + bottom - element.height) / 2 }
            return { ...element, y: bottom - element.height }
          }),
        })),
        saveStatus: 'unsaved' as SaveStatus,
      }
    })
  },

  distributeSelectedElements(axis) {
    set((s) => {
      if (!s.selectedSceneId || s.selectedElementIds.length < 3) return s
      const scene = s.document.scenes.find((item) => item.id === s.selectedSceneId)
      if (!scene) return s
      const selected = new Set(s.selectedElementIds)
      const sorted = scene.elements
        .filter((element) => selected.has(element.id))
        .sort((a, b) => (axis === 'horizontal' ? a.x - b.x : a.y - b.y))
      const first = sorted[0]
      const last = sorted.at(-1)!
      const span =
        axis === 'horizontal' ? last.x + last.width - first.x : last.y + last.height - first.y
      const occupied = sorted.reduce(
        (total, element) => total + (axis === 'horizontal' ? element.width : element.height),
        0,
      )
      const gap = (span - occupied) / (sorted.length - 1)
      const positions = new Map<string, number>()
      let cursor = axis === 'horizontal' ? first.x : first.y
      sorted.forEach((element) => {
        positions.set(element.id, cursor)
        cursor += (axis === 'horizontal' ? element.width : element.height) + gap
      })
      return {
        ...withPushedHistory(s),
        document: mapScenes(s.document, s.selectedSceneId, (item) => ({
          ...item,
          elements: item.elements.map((element) =>
            selected.has(element.id)
              ? axis === 'horizontal'
                ? { ...element, x: positions.get(element.id)! }
                : { ...element, y: positions.get(element.id)! }
              : element,
          ),
        })),
        saveStatus: 'unsaved' as SaveStatus,
      }
    })
  },

  groupSelectedElements() {
    set((s) => {
      if (!s.selectedSceneId || s.selectedElementIds.length < 2) return s
      const selected = new Set(s.selectedElementIds)
      const groupId = uuidv4()
      return {
        ...withPushedHistory(s),
        document: mapScenes(s.document, s.selectedSceneId, (scene) => ({
          ...scene,
          elements: scene.elements.map((element) =>
            selected.has(element.id) ? { ...element, groupId } : element,
          ),
        })),
        saveStatus: 'unsaved' as SaveStatus,
      }
    })
  },

  ungroupSelectedElements() {
    set((s) => {
      if (!s.selectedSceneId || !s.selectedElementIds.length) return s
      const selected = new Set(s.selectedElementIds)
      return {
        ...withPushedHistory(s),
        document: mapScenes(s.document, s.selectedSceneId, (scene) => ({
          ...scene,
          elements: scene.elements.map((element) =>
            selected.has(element.id) ? { ...element, groupId: undefined } : element,
          ),
        })),
        saveStatus: 'unsaved' as SaveStatus,
      }
    })
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
        selectedElementIds: s.selectedElementIds.filter((id) => !removedIds.has(id)),
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
        selectedElementIds: [],
        historyCoalesceKey: null,
        historyCoalesceAt: 0,
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
      selectedElementId: null,
      selectedElementIds: [],
      historyCoalesceKey: null,
      historyCoalesceAt: 0,
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
    selectedElementIds: [],
    clipboard: [],
    zoom: 1,
    saveStatus: 'saved',
    past: [],
    future: [],
    historyCoalesceKey: null,
    historyCoalesceAt: 0,
    draftRevision: options?.revision ?? 0,
    isGuest: options?.isGuest ?? false,
    saveRequestNonce: 0,
    manualSaveState: 'idle',
    lastSaveError: null,
  })
}
