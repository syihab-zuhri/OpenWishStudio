import { describe, it, expect, beforeEach } from 'vitest'
import { useEditorStore, initEditorStore } from './editorStore'
import { createDefaultDocument } from '@openwish/project-schema'
import { v4 as uuidv4 } from 'uuid'
import type { ElementNode, Scene } from '@openwish/project-schema'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTextElement(overrides = {}): ElementNode {
  return {
    id: uuidv4(),
    type: 'text',
    x: 10,
    y: 20,
    width: 200,
    height: 50,
    rotation: 0,
    zIndex: 0,
    locked: false,
    props: {
      content: 'Hello',
      fontSize: 16,
      color: '#000000',
    },
    ...overrides,
  } as ElementNode
}

function getState() {
  return useEditorStore.getState()
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  const doc = createDefaultDocument('Test')
  initEditorStore('project-1', 'Test', doc)
})

// ─── addScene ─────────────────────────────────────────────────────────────────

describe('addScene', () => {
  it('increases scene count and selects new scene', () => {
    const before = getState().document.scenes.length
    getState().addScene()
    const after = getState()
    expect(after.document.scenes.length).toBe(before + 1)
    expect(after.selectedSceneId).toBe(after.document.scenes.at(-1)!.id)
  })

  it('pushes to past history', () => {
    const pastBefore = getState().past.length
    getState().addScene()
    expect(getState().past.length).toBe(pastBefore + 1)
  })

  it('sets saveStatus to unsaved', () => {
    getState().addScene()
    expect(getState().saveStatus).toBe('unsaved')
  })
})

// ─── deleteScene ──────────────────────────────────────────────────────────────

describe('deleteScene', () => {
  it('does nothing when only one scene exists', () => {
    const sceneId = getState().document.scenes[0].id
    getState().deleteScene(sceneId)
    expect(getState().document.scenes.length).toBe(1)
  })

  it('removes scene when more than one exists', () => {
    getState().addScene()
    const scenes = getState().document.scenes
    expect(scenes.length).toBe(2)
    getState().deleteScene(scenes[0].id)
    expect(getState().document.scenes.length).toBe(1)
  })

  it('adjusts selectedSceneId when active scene is deleted', () => {
    getState().addScene()
    const [first, second] = getState().document.scenes
    getState().selectScene(second.id)
    getState().deleteScene(second.id)
    expect(getState().selectedSceneId).toBe(first.id)
  })

  it('normalizes scene order values after deletion', () => {
    getState().addScene()
    getState().addScene()
    const [, second] = getState().document.scenes
    getState().deleteScene(second.id)
    getState().document.scenes.forEach((sc, i) => {
      expect(sc.order).toBe(i)
    })
  })
})

// ─── reorderScene ─────────────────────────────────────────────────────────────

describe('reorderScene', () => {
  it('moves a scene to the correct index and reassigns order values', () => {
    getState().addScene()
    getState().addScene()
    const [, , c] = getState().document.scenes
    getState().reorderScene(c.id, 0) // bring last scene to front
    const reordered = getState().document.scenes
    expect(reordered[0].id).toBe(c.id)
    reordered.forEach((sc, i) => {
      expect(sc.order).toBe(i)
    })
  })
})

// ─── addElement ───────────────────────────────────────────────────────────────

describe('addElement', () => {
  it('sets selectedElementId to the new element ID', () => {
    const sceneId = getState().document.scenes[0].id
    const el = makeTextElement()
    getState().addElement(sceneId, el)
    expect(getState().selectedElementId).toBe(el.id)
  })

  it('appends element to correct scene', () => {
    const sceneId = getState().document.scenes[0].id
    const el = makeTextElement()
    getState().addElement(sceneId, el)
    const scene = getState().document.scenes.find((sc) => sc.id === sceneId)!
    expect(scene.elements.some((e) => e.id === el.id)).toBe(true)
  })
})

describe('addElements', () => {
  it('adds a group in one history frame and selects all inserted elements', () => {
    const sceneId = getState().document.scenes[0].id
    const first = makeTextElement()
    const second = makeTextElement({ id: uuidv4(), zIndex: 1 })
    const pastBefore = getState().past.length

    getState().addElements(sceneId, [first, second])

    expect(getState().document.scenes[0].elements).toHaveLength(2)
    expect(getState().selectedElementIds).toEqual([first.id, second.id])
    expect(getState().past.length).toBe(pastBefore + 1)
    getState().undo()
    expect(getState().document.scenes[0].elements).toHaveLength(0)
  })
})

describe('applyStarterKit', () => {
  it('replaces the blank document and can be undone', () => {
    const firstScene = makeScene(0)
    const secondScene = makeScene(1)
    getState().applyStarterKit({
      title: 'Untuk Nara',
      theme: {
        primary: '#173F47',
        secondary: '#B9825A',
        accent: '#E7C9A9',
        text: '#153238',
        surface: '#FFF9F1',
        headingFont: 'Georgia, serif',
        bodyFont: 'Inter, sans-serif',
      },
      scenes: [firstScene, secondScene],
    })

    expect(getState().projectName).toBe('Untuk Nara')
    expect(getState().document.scenes).toHaveLength(2)
    expect(getState().selectedSceneId).toBe(firstScene.id)
    getState().undo()
    expect(getState().document.scenes).toHaveLength(1)
  })
})

// ─── updateElement vs commitElementDrag ───────────────────────────────────────

describe('updateElement', () => {
  it('does NOT push to past (live drag preview)', () => {
    const sceneId = getState().document.scenes[0].id
    const el = makeTextElement()
    getState().addElement(sceneId, el)
    const pastLen = getState().past.length
    getState().updateElement(sceneId, el.id, { x: 50 })
    expect(getState().past.length).toBe(pastLen)
  })

  it('updates element x/y in document', () => {
    const sceneId = getState().document.scenes[0].id
    const el = makeTextElement()
    getState().addElement(sceneId, el)
    getState().updateElement(sceneId, el.id, { x: 99, y: 77 })
    const updated = getState().document.scenes[0].elements.find((e) => e.id === el.id)!
    expect(updated.x).toBe(99)
    expect(updated.y).toBe(77)
  })
})

describe('commitElementDrag', () => {
  it('pushes one frame to past', () => {
    const sceneId = getState().document.scenes[0].id
    const el = makeTextElement()
    getState().addElement(sceneId, el)
    const pastLen = getState().past.length
    getState().commitElementDrag(sceneId, el.id, { x: 100, y: 200 })
    expect(getState().past.length).toBe(pastLen + 1)
  })

  it('undo restores geometry from before the live drag', () => {
    const sceneId = getState().document.scenes[0].id
    const el = makeTextElement()
    getState().addElement(sceneId, el)
    getState().updateElement(sceneId, el.id, { x: 80, y: 90 })
    getState().commitElementDrag(
      sceneId,
      el.id,
      { x: 100, y: 110 },
      { x: 10, y: 20, width: 200, height: 50 },
    )

    getState().undo()
    const restored = getState().document.scenes[0].elements.find((element) => element.id === el.id)!
    expect(restored.x).toBe(10)
    expect(restored.y).toBe(20)
  })
})

// ─── undo / redo ──────────────────────────────────────────────────────────────

describe('undo', () => {
  it('restores previous document state', () => {
    const docBefore = getState().document
    getState().addScene()
    getState().undo()
    expect(getState().document.scenes.length).toBe(docBefore.scenes.length)
  })

  it('moves current doc to future stack', () => {
    getState().addScene()
    expect(getState().future.length).toBe(0)
    getState().undo()
    expect(getState().future.length).toBe(1)
  })
})

describe('redo', () => {
  it('reapplies undone state', () => {
    getState().addScene()
    const afterAdd = getState().document.scenes.length
    getState().undo()
    getState().redo()
    expect(getState().document.scenes.length).toBe(afterAdd)
  })
})

// ─── History limit ────────────────────────────────────────────────────────────

describe('history limit', () => {
  it('caps past at 50 frames', () => {
    for (let i = 0; i < 60; i++) {
      getState().addScene()
    }
    expect(getState().past.length).toBeLessThanOrEqual(50)
  })
})

// ─── setZoom ──────────────────────────────────────────────────────────────────

describe('setZoom', () => {
  it('clamps to [0.25, 2]', () => {
    getState().setZoom(0)
    expect(getState().zoom).toBe(0.25)
    getState().setZoom(10)
    expect(getState().zoom).toBe(2)
  })

  it('accepts value within range', () => {
    getState().setZoom(1.5)
    expect(getState().zoom).toBe(1.5)
  })
})

// ─── addScenes (template insert) ──────────────────────────────────────────────

function makeScene(order: number): Scene {
  return {
    id: uuidv4(),
    name: `Template ${order}`,
    order,
    baseWidth: 390,
    baseHeight: 844,
    background: { type: 'color', color: '#FFEEDD' },
    elements: [],
  }
}

describe('addScenes', () => {
  it('appends scenes with sequential order and selects the first new scene', () => {
    const before = getState().document.scenes.length
    const incoming = [makeScene(0), makeScene(1)]
    getState().addScenes(incoming)
    const after = getState()
    expect(after.document.scenes.length).toBe(before + 2)
    after.document.scenes.forEach((sc, i) => {
      expect(sc.order).toBe(i)
    })
    expect(after.selectedSceneId).toBe(incoming[0].id)
  })

  it('pushes history and can be undone', () => {
    const before = getState().document.scenes.length
    getState().addScenes([makeScene(0)])
    getState().undo()
    expect(getState().document.scenes.length).toBe(before)
  })

  it('does nothing for an empty array', () => {
    const pastLen = getState().past.length
    getState().addScenes([])
    expect(getState().past.length).toBe(pastLen)
  })
})

// ─── setSoundtrack ────────────────────────────────────────────────────────────

describe('setSoundtrack', () => {
  const track = {
    libraryItemId: uuidv4(),
    src: 'https://example.com/track.mp3',
    title: 'Lagu Uji',
    volume: 0.8,
    loop: true,
  }

  it('stores soundtrack on the project and marks unsaved', () => {
    getState().setSoundtrack(track)
    expect(getState().document.project.soundtrack).toEqual(track)
    expect(getState().saveStatus).toBe('unsaved')
  })

  it('clears soundtrack when undefined and can be undone', () => {
    getState().setSoundtrack(track)
    getState().setSoundtrack(undefined)
    expect(getState().document.project.soundtrack).toBeUndefined()
    getState().undo()
    expect(getState().document.project.soundtrack).toEqual(track)
  })
})

describe('asset reference cleanup', () => {
  it('removes image elements, image backgrounds, and soundtrack in one undoable change', () => {
    const assetId = uuidv4()
    const sceneId = getState().document.scenes[0].id
    const image = {
      id: uuidv4(),
      type: 'image' as const,
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      rotation: 0,
      zIndex: 1,
      locked: false,
      props: { assetId, alt: '', objectFit: 'cover' as const, decorative: true },
    }
    getState().addElement(sceneId, image)
    getState().updateSceneBackground(sceneId, {
      type: 'image',
      assetId,
      objectFit: 'cover',
    })
    getState().setSoundtrack({ assetId, volume: 1, loop: true })

    getState().removeAssetReferences(assetId)
    const state = getState()
    expect(state.document.scenes[0].elements).toHaveLength(0)
    expect(state.document.scenes[0].background.type).toBe('color')
    expect(state.document.project.soundtrack).toBeUndefined()

    state.undo()
    expect(getState().document.project.soundtrack?.assetId).toBe(assetId)
  })
})

describe('reorderElements', () => {
  it('rejects duplicate or incomplete id lists without writing history', () => {
    const sceneId = getState().document.scenes[0].id
    const first = makeTextElement()
    const second = makeTextElement({ zIndex: 1 })
    getState().addElement(sceneId, first)
    getState().addElement(sceneId, second)
    const pastLength = getState().past.length

    getState().reorderElements(sceneId, [first.id, first.id])
    expect(getState().past.length).toBe(pastLength)
    expect(getState().document.scenes[0].elements.find((el) => el.id === second.id)?.zIndex).toBe(1)
  })
})

describe('editor 2.0 selection tools', () => {
  it('supports additive selection and duplicate', () => {
    const sceneId = getState().document.scenes[0].id
    const first = makeTextElement()
    const second = makeTextElement({ x: 240, zIndex: 1 })
    getState().addElement(sceneId, first)
    getState().addElement(sceneId, second)

    getState().selectElement(first.id)
    getState().selectElement(second.id, true)
    expect(getState().selectedElementIds).toEqual([first.id, second.id])

    getState().duplicateSelectedElements()
    expect(getState().document.scenes[0].elements).toHaveLength(4)
    expect(getState().selectedElementIds).toHaveLength(2)
  })

  it('aligns multiple selected elements and can undo the operation', () => {
    const sceneId = getState().document.scenes[0].id
    const first = makeTextElement({ x: 20 })
    const second = makeTextElement({ x: 240, zIndex: 1 })
    getState().addElement(sceneId, first)
    getState().addElement(sceneId, second)
    getState().selectElements([first.id, second.id])

    getState().alignSelectedElements('left')
    const aligned = getState().document.scenes[0].elements
    expect(aligned.find((element) => element.id === first.id)?.x).toBe(20)
    expect(aligned.find((element) => element.id === second.id)?.x).toBe(20)

    getState().undo()
    expect(
      getState().document.scenes[0].elements.find((element) => element.id === second.id)?.x,
    ).toBe(240)
  })

  it('groups and ungroups selected elements', () => {
    const sceneId = getState().document.scenes[0].id
    const first = makeTextElement()
    const second = makeTextElement({ zIndex: 1 })
    getState().addElement(sceneId, first)
    getState().addElement(sceneId, second)
    getState().selectElements([first.id, second.id])

    getState().groupSelectedElements()
    const grouped = getState().document.scenes[0].elements
    const groupId = grouped.find((element) => element.id === first.id)?.groupId
    expect(groupId).toBeTruthy()
    expect(grouped.find((element) => element.id === second.id)?.groupId).toBe(groupId)

    getState().ungroupSelectedElements()
    expect(getState().document.scenes[0].elements.every((element) => !element.groupId)).toBe(true)
  })

  it('coalesces repeated property changes into one history frame', () => {
    const sceneId = getState().document.scenes[0].id
    const element = makeTextElement()
    getState().addElement(sceneId, element)
    const before = getState().past.length

    getState().updateElementProps(sceneId, element.id, { fontSize: 20 })
    getState().updateElementProps(sceneId, element.id, { fontSize: 24 })

    expect(getState().past.length).toBe(before + 1)
    getState().undo()
    expect(
      (
        getState().document.scenes[0].elements.find((item) => item.id === element.id) as Extract<
          ElementNode,
          { type: 'text' }
        >
      ).props.fontSize,
    ).toBe(16)
  })
})
