import {
  CURRENT_SCHEMA_VERSION,
  ProjectDocumentSchema,
  type ProjectDocument,
} from './document.schema'

type Migration = (doc: Record<string, unknown>) => Record<string, unknown>

const migrations: Record<number, Migration> = {
  // Placeholder: v1 is the initial version, no migration needed yet
  // 1: (doc) => ({ ...doc, schemaVersion: 2, ... })
}

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

export function isCurrentVersion(doc: { schemaVersion: number }): boolean {
  return doc.schemaVersion === CURRENT_SCHEMA_VERSION
}

export function isMigratable(doc: { schemaVersion: number }): boolean {
  return doc.schemaVersion >= 1 && doc.schemaVersion <= CURRENT_SCHEMA_VERSION
}
