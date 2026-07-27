import {
  CURRENT_SCHEMA_VERSION,
  DEFAULT_THEME,
  ProjectDocumentSchema,
  type ProjectDocument,
} from './document.schema'

type Migration = (doc: Record<string, unknown>) => Record<string, unknown>

const migrations: Record<number, Migration> = {
  1: (doc) => {
    const project = doc.project && typeof doc.project === 'object' ? doc.project : {}
    const scenes = Array.isArray(doc.scenes) ? doc.scenes : []

    return {
      ...doc,
      schemaVersion: 2,
      project: {
        ...project,
        theme: { ...DEFAULT_THEME },
      },
      scenes: scenes.map((scene) => {
        if (!scene || typeof scene !== 'object') return scene
        const sceneRecord = scene as Record<string, unknown>
        const elements = Array.isArray(sceneRecord.elements) ? sceneRecord.elements : []
        return {
          ...sceneRecord,
          elements: elements.map((element) => {
            if (!element || typeof element !== 'object') return element
            const record = element as Record<string, unknown>
            return {
              visible: true,
              opacity: 1,
              flipX: false,
              flipY: false,
              aspectLocked: false,
              ...record,
            }
          }),
        }
      }),
    }
  },
}

export type SafeMigrationResult =
  { success: true; data: ProjectDocument } | { success: false; error: unknown }

export function migrateDocument(raw: Record<string, unknown>): ProjectDocument {
  let doc = { ...raw }
  const startVersion = typeof doc.schemaVersion === 'number' ? doc.schemaVersion : 0

  if (
    !Number.isInteger(startVersion) ||
    startVersion < 1 ||
    startVersion > CURRENT_SCHEMA_VERSION
  ) {
    throw new Error(`Unsupported schema version ${String(doc.schemaVersion)}`)
  }

  for (let v = startVersion; v < CURRENT_SCHEMA_VERSION; v++) {
    const migrate = migrations[v]
    if (!migrate) {
      throw new Error(`No migration found from schema version ${v}`)
    }
    doc = migrate(doc)
  }

  return ProjectDocumentSchema.parse(doc)
}

export function safeMigrateDocument(raw: unknown): SafeMigrationResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { success: false, error: new Error('Document must be an object') }
  }

  try {
    return { success: true, data: migrateDocument(raw as Record<string, unknown>) }
  } catch (error) {
    return { success: false, error }
  }
}

export function isCurrentVersion(doc: { schemaVersion: number }): boolean {
  return doc.schemaVersion === CURRENT_SCHEMA_VERSION
}

export function isMigratable(doc: { schemaVersion: number }): boolean {
  return doc.schemaVersion >= 1 && doc.schemaVersion <= CURRENT_SCHEMA_VERSION
}
