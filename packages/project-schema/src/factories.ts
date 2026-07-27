import { v4 as uuidv4 } from 'uuid'
import type { ProjectDocument, Scene } from './document.schema'
import { CURRENT_SCHEMA_VERSION, DEFAULT_THEME } from './document.schema'

export function createDefaultScene(overrides?: Partial<Scene>): Scene {
  return {
    id: uuidv4(),
    name: 'Scene 1',
    order: 0,
    baseWidth: 390,
    baseHeight: 844,
    background: { type: 'color', color: '#FFFFFF' },
    elements: [],
    ...overrides,
  }
}

export function createDefaultDocument(title = 'Ucapan Saya'): ProjectDocument {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    project: {
      title,
      locale: 'id-ID',
      theme: { ...DEFAULT_THEME },
    },
    scenes: [createDefaultScene()],
  }
}
