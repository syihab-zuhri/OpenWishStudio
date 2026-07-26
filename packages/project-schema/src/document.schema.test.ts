import { describe, it, expect } from 'vitest'
import { v4 as uuidv4 } from 'uuid'
import {
  ProjectDocumentSchema,
  ElementNodeSchema,
  BackgroundSchema,
  CURRENT_SCHEMA_VERSION,
} from './document.schema'
import { createDefaultDocument, createDefaultScene } from './factories'
import { isCurrentVersion, isMigratable } from './migrations'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTextElement(overrides = {}) {
  return {
    id: uuidv4(),
    type: 'text' as const,
    x: 0,
    y: 0,
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
  }
}

// ─── ProjectDocument Validation ───────────────────────────────────────────────

describe('ProjectDocumentSchema', () => {
  it('valid document parses without error', () => {
    const doc = createDefaultDocument('Test Title')
    expect(() => ProjectDocumentSchema.parse(doc)).not.toThrow()
  })

  it('missing scenes field throws ZodError', () => {
    const { scenes: _omitted, ...noScenes } = createDefaultDocument()
    const result = ProjectDocumentSchema.safeParse(noScenes)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('scenes'))).toBe(true)
    }
  })

  it('empty scenes array (min 1) throws ZodError', () => {
    const doc = { ...createDefaultDocument(), scenes: [] }
    const result = ProjectDocumentSchema.safeParse(doc)
    expect(result.success).toBe(false)
  })

  it('schemaVersion is present as integer in all fixtures', () => {
    const doc = ProjectDocumentSchema.parse(createDefaultDocument())
    expect(Number.isInteger(doc.schemaVersion)).toBe(true)
    expect(doc.schemaVersion).toBeGreaterThanOrEqual(1)
  })

  it('missing project.title throws ZodError', () => {
    const doc = createDefaultDocument()
    const broken = { ...doc, project: { ...doc.project, title: '' } }
    const result = ProjectDocumentSchema.safeParse(broken)
    expect(result.success).toBe(false)
  })

  it('scenes exceeding max 50 throws ZodError', () => {
    const doc = createDefaultDocument()
    const tooManyScenes = Array.from({ length: 51 }, (_, i) =>
      createDefaultScene({ name: `Scene ${i + 1}`, order: i }),
    )
    const result = ProjectDocumentSchema.safeParse({ ...doc, scenes: tooManyScenes })
    expect(result.success).toBe(false)
  })
})

// ─── ElementNode Discriminated Union ─────────────────────────────────────────

describe('ElementNodeSchema', () => {
  it('text element parses correctly', () => {
    const el = makeTextElement()
    expect(() => ElementNodeSchema.parse(el)).not.toThrow()
  })

  it('image element parses correctly', () => {
    const el = {
      id: uuidv4(),
      type: 'image' as const,
      x: 0, y: 0, width: 100, height: 100, rotation: 0, zIndex: 0, locked: false,
      props: { alt: '', objectFit: 'cover' as const, decorative: false },
    }
    expect(() => ElementNodeSchema.parse(el)).not.toThrow()
  })

  it('shape element parses correctly', () => {
    const el = {
      id: uuidv4(),
      type: 'shape' as const,
      x: 0, y: 0, width: 50, height: 50, rotation: 0, zIndex: 0, locked: false,
      props: { shape: 'circle' as const },
    }
    expect(() => ElementNodeSchema.parse(el)).not.toThrow()
  })

  it('icon element parses correctly', () => {
    const el = {
      id: uuidv4(),
      type: 'icon' as const,
      x: 0, y: 0, width: 32, height: 32, rotation: 0, zIndex: 0, locked: false,
      props: { iconName: 'heart' },
    }
    expect(() => ElementNodeSchema.parse(el)).not.toThrow()
  })

  it('button element parses correctly', () => {
    const el = {
      id: uuidv4(),
      type: 'button' as const,
      x: 0, y: 0, width: 120, height: 40, rotation: 0, zIndex: 0, locked: false,
      props: { label: 'Click me', url: 'https://example.com', variant: 'primary' as const },
    }
    expect(() => ElementNodeSchema.parse(el)).not.toThrow()
  })

  it('audioControl element parses correctly', () => {
    const el = {
      id: uuidv4(),
      type: 'audioControl' as const,
      x: 0, y: 0, width: 48, height: 48, rotation: 0, zIndex: 0, locked: false,
      props: { compact: false },
    }
    expect(() => ElementNodeSchema.parse(el)).not.toThrow()
  })

  it('unknown type is rejected by discriminated union', () => {
    const el = { ...makeTextElement(), type: 'video' }
    const result = ElementNodeSchema.safeParse(el)
    expect(result.success).toBe(false)
  })

  it('text element with content exceeding 5000 chars throws ZodError', () => {
    const el = makeTextElement({ props: { content: 'x'.repeat(5001), fontSize: 16, color: '#000000' } })
    const result = ElementNodeSchema.safeParse(el)
    expect(result.success).toBe(false)
  })

  it('element with width < 1 throws ZodError', () => {
    const el = makeTextElement({ width: 0 })
    const result = ElementNodeSchema.safeParse(el)
    expect(result.success).toBe(false)
  })

  it('invalid color hex throws ZodError', () => {
    const el = makeTextElement({ props: { content: 'Hi', fontSize: 16, color: 'red' } })
    const result = ElementNodeSchema.safeParse(el)
    expect(result.success).toBe(false)
  })
})

// ─── Background Union ─────────────────────────────────────────────────────────

describe('BackgroundSchema', () => {
  it('color background parses correctly', () => {
    const bg = { type: 'color' as const, color: '#FFFFFF' }
    expect(() => BackgroundSchema.parse(bg)).not.toThrow()
  })

  it('color with 8-digit hex (alpha) parses correctly', () => {
    const bg = { type: 'color' as const, color: '#FFFFFF80' }
    expect(() => BackgroundSchema.parse(bg)).not.toThrow()
  })

  it('gradient background parses correctly', () => {
    const bg = {
      type: 'gradient' as const,
      gradient: {
        direction: 90,
        stops: [
          { color: '#FF0000', position: 0 },
          { color: '#0000FF', position: 100 },
        ],
      },
    }
    expect(() => BackgroundSchema.parse(bg)).not.toThrow()
  })

  it('gradient with fewer than 2 stops throws ZodError', () => {
    const bg = {
      type: 'gradient' as const,
      gradient: {
        direction: 90,
        stops: [{ color: '#FF0000', position: 0 }],
      },
    }
    const result = BackgroundSchema.safeParse(bg)
    expect(result.success).toBe(false)
  })

  it('image background parses correctly', () => {
    const bg = {
      type: 'image' as const,
      src: 'https://example.com/bg.jpg',
      objectFit: 'cover' as const,
    }
    expect(() => BackgroundSchema.parse(bg)).not.toThrow()
  })
})

// ─── Migration Helpers ────────────────────────────────────────────────────────

describe('migration helpers', () => {
  it('isCurrentVersion returns true for current schema version', () => {
    const doc = createDefaultDocument()
    expect(isCurrentVersion(doc)).toBe(true)
  })

  it('isCurrentVersion returns false for older version', () => {
    expect(isCurrentVersion({ schemaVersion: 0 })).toBe(false)
  })

  it('isMigratable returns true for version 1 (current)', () => {
    expect(isMigratable({ schemaVersion: 1 })).toBe(true)
  })

  it('isMigratable returns false for version 0', () => {
    expect(isMigratable({ schemaVersion: 0 })).toBe(false)
  })

  it('CURRENT_SCHEMA_VERSION is a positive integer', () => {
    expect(Number.isInteger(CURRENT_SCHEMA_VERSION)).toBe(true)
    expect(CURRENT_SCHEMA_VERSION).toBeGreaterThanOrEqual(1)
  })
})

// ─── Factory Functions ────────────────────────────────────────────────────────

describe('factory functions', () => {
  it('createDefaultDocument produces a valid ProjectDocument', () => {
    const doc = createDefaultDocument('My Project')
    expect(() => ProjectDocumentSchema.parse(doc)).not.toThrow()
    expect(doc.project.title).toBe('My Project')
    expect(doc.scenes).toHaveLength(1)
  })

  it('createDefaultScene produces a valid Scene', () => {
    const scene = createDefaultScene()
    expect(scene.baseWidth).toBe(390)
    expect(scene.background.type).toBe('color')
    expect(scene.elements).toHaveLength(0)
  })

  it('createDefaultScene accepts overrides', () => {
    const scene = createDefaultScene({ name: 'Custom', baseHeight: 500, order: 2 })
    expect(scene.name).toBe('Custom')
    expect(scene.baseHeight).toBe(500)
    expect(scene.order).toBe(2)
  })
})
