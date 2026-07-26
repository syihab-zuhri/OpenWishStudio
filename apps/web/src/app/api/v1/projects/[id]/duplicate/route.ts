import { type NextRequest } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { requireAuth } from '@/lib/api/auth'
import { fetchOwnedProject } from '@/lib/api/projects'
import { created, notFound, serverError, unprocessable } from '@/lib/api/response'
import { byUser, enforceRateLimit } from '@/lib/api/rate-limit'
import type { ProjectDocument } from '@openwish/project-schema'

type Params = Promise<{ id: string }>

const RATE_LIMIT = { name: 'projects-duplicate', max: 30, windowSeconds: 3600 }

function cloneDocumentWithNewIds(doc: ProjectDocument, newTitle: string): ProjectDocument {
  return {
    ...doc,
    project: { ...doc.project, title: newTitle },
    scenes: doc.scenes.map((scene) => ({
      ...scene,
      id: uuidv4(),
      elements: scene.elements.map((el) => ({ ...el, id: uuidv4() })),
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

  const sourceDoc = source.draft_document as unknown as ProjectDocument
  const clonedDoc = cloneDocumentWithNewIds(sourceDoc, name)

  const { data: project, error: dbError } = await supabase
    .from('projects')
    .insert({
      name,
      owner_id: user!.id,
      created_by: user!.id,
      draft_document: JSON.parse(JSON.stringify(clonedDoc)),
      schema_version: source.schema_version ?? 1,
    })
    .select('id, name, status, updated_at, created_at')
    .single()

  if (dbError || !project) {
    console.error('POST /api/v1/projects/[id]/duplicate:', dbError?.message)
    return serverError()
  }

  return created({ project })
}
