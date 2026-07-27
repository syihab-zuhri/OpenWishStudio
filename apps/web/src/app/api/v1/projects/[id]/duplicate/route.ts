import { type NextRequest } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { requireAuth } from '@/lib/api/auth'
import { fetchOwnedProject } from '@/lib/api/projects'
import { created, notFound, serverError, unprocessable } from '@/lib/api/response'
import { byUser, enforceRateLimit } from '@/lib/api/rate-limit'
import {
  CURRENT_SCHEMA_VERSION,
  safeMigrateDocument,
  type ProjectDocument,
} from '@openwish/project-schema'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

type Params = Promise<{ id: string }>

const RATE_LIMIT = { name: 'projects-duplicate', max: 30, windowSeconds: 3600 }

function cloneDocumentWithNewIds(doc: ProjectDocument, newTitle: string): ProjectDocument {
  return {
    ...doc,
    project: {
      ...doc.project,
      title: newTitle,
      soundtrack: doc.project.soundtrack
        ? { ...doc.project.soundtrack, assetId: undefined }
        : undefined,
    },
    scenes: doc.scenes.map((scene) => ({
      ...scene,
      id: uuidv4(),
      background:
        scene.background.type === 'image'
          ? { ...scene.background, assetId: undefined }
          : scene.background,
      elements: scene.elements.map((el) =>
        el.type === 'image'
          ? { ...el, id: uuidv4(), props: { ...el.props, assetId: undefined } }
          : { ...el, id: uuidv4() },
      ),
    })),
  }
}

export async function POST(request: NextRequest, { params }: { params: Params }) {
  const { id } = await params
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const limited = await enforceRateLimit(RATE_LIMIT, byUser(user!.id))
  if (limited) return limited

  const { data: source } = await fetchOwnedProject(supabase, user!.id, id)
  if (!source) return notFound()

  let body: { name?: string }
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const name = body.name?.trim() || `${source.name} (Salinan)`
  if (name.length > 120) {
    return unprocessable('Nama kreasi terlalu panjang (maks. 120 karakter).')
  }

  const sourceDoc = safeMigrateDocument(source.draft_document)
  if (!sourceDoc.success) {
    return unprocessable('Dokumen sumber tidak valid. Buka dan simpan ulang terlebih dahulu.')
  }
  const clonedDoc = cloneDocumentWithNewIds(sourceDoc.data, name)

  const service = await createSupabaseServiceClient()
  const { data: project, error: dbError } = await service
    .from('projects')
    .insert({
      name,
      owner_id: user!.id,
      created_by: user!.id,
      draft_document: JSON.parse(JSON.stringify(clonedDoc)),
      schema_version: CURRENT_SCHEMA_VERSION,
    })
    .select('id, name, status, updated_at, created_at')
    .single()

  if (dbError || !project) {
    console.error('POST /api/v1/projects/[id]/duplicate:', dbError?.message)
    return serverError()
  }

  return created({ project })
}
