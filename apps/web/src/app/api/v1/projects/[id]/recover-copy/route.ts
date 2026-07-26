import { type NextRequest } from 'next/server'
import { requireAuth } from '@/lib/api/auth'
import { fetchOwnedProject } from '@/lib/api/projects'
import { created, notFound, serverError, unprocessable } from '@/lib/api/response'
import { byUser, enforceRateLimit } from '@/lib/api/rate-limit'
import { ProjectDocumentSchema } from '@openwish/project-schema'

type Params = Promise<{ id: string }>

const RATE_LIMIT = { name: 'recover-copy', max: 30, windowSeconds: 3600 }

export async function POST(request: NextRequest, { params }: { params: Params }) {
  const { id } = await params
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const limited = await enforceRateLimit(RATE_LIMIT, byUser(user!.id))
  if (limited) return limited

  const { data: source } = await fetchOwnedProject(supabase, user!.id, id)
  if (!source) return notFound()

  let body: { document?: unknown; name?: string }
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const parseResult = ProjectDocumentSchema.safeParse(body.document)
  if (!parseResult.success) {
    return unprocessable('Ada elemen yang tidak valid.')
  }

  const name = body.name?.trim() || `${source.name} (Pemulihan)`
  if (name.length > 120) {
    return unprocessable('Nama kreasi terlalu panjang (maks. 120 karakter).')
  }

  const { data: project, error: dbError } = await supabase
    .from('projects')
    .insert({
      name,
      owner_id: user!.id,
      created_by: user!.id,
      draft_document: JSON.parse(JSON.stringify(parseResult.data)),
      schema_version: parseResult.data.schemaVersion,
    })
    .select('id')
    .single()

  if (dbError || !project) {
    console.error('POST /api/v1/projects/[id]/recover-copy:', dbError?.message)
    return serverError()
  }

  return created({ projectId: project.id })
}
