import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { safeMigrateDocument } from '@openwish/project-schema'
import { requireAuth } from '@/lib/api/auth'
import { created, serverError, unprocessable, notFound, conflict } from '@/lib/api/response'
import { byUser, enforceRateLimit } from '@/lib/api/rate-limit'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import { fetchOwnedProject } from '@/lib/api/projects'
import { runPublishPreflight } from '@/features/editor/utils/preflight'

const RATE_LIMIT = { name: 'projects-publish', max: 60, windowSeconds: 3600 }

const PublishSchema = z.object({
  expiresAt: z.string().datetime({ offset: true }).optional(),
})

function generateSlug(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

async function computeContentHash(content: unknown): Promise<string> {
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify(content)),
  )
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const limited = await enforceRateLimit(RATE_LIMIT, byUser(user!.id))
  if (limited) return limited

  let body: unknown
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const parsed = PublishSchema.safeParse(body)
  if (!parsed.success) return unprocessable('Parameter tidak valid.')

  const { expiresAt } = parsed.data
  if (expiresAt && new Date(expiresAt) <= new Date()) {
    return unprocessable('Pilih waktu kedaluwarsa di masa depan.')
  }

  const { data: project, error: projectError } = await fetchOwnedProject(supabase, user!.id, id)
  if (projectError || !project) return notFound('Kreasi tidak ditemukan.')

  const validated = safeMigrateDocument(project.draft_document)
  if (!validated.success) {
    return unprocessable('Dokumen tidak valid. Buka editor dan simpan ulang sebelum publikasi.')
  }
  const blockingIssue = runPublishPreflight(validated.data).find(
    (issue) => issue.severity === 'error',
  )
  if (blockingIssue) {
    return unprocessable(`Pemeriksaan publish gagal: ${blockingIssue.message}`)
  }

  const service = await createSupabaseServiceClient()
  const { data: pendingAssets, error: assetsError } = await service
    .from('assets')
    .select('id, original_name')
    .eq('project_id', id)
    .eq('status', 'pending')
    .is('deleted_at', null)
    .limit(10)

  if (assetsError) {
    console.error('POST /api/v1/projects/[id]/publish asset check:', assetsError.message)
    return serverError()
  }
  if (pendingAssets.length > 0) {
    return conflict(
      `Beberapa aset masih dalam proses upload: ${pendingAssets.map((asset) => asset.original_name).join(', ')}`,
    )
  }

  const contentHash = await computeContentHash(validated.data)
  const { data: publication, error: publishError } = await service
    .rpc('publish_project_atomic', {
      p_project_id: id,
      p_actor_id: user!.id,
      p_document: validated.data as never,
      p_schema_version: validated.data.schemaVersion,
      p_content_hash: contentHash,
      p_expires_at: expiresAt ?? null,
      p_new_slug: generateSlug(),
    })
    .single()

  if (publishError || !publication) {
    if (publishError?.code === '42501') {
      return conflict('Halaman dinonaktifkan moderator dan tidak dapat diterbitkan ulang.')
    }
    if (publishError?.code === '55000') {
      return conflict('Beberapa aset masih dalam proses upload.')
    }
    if (publishError?.code === 'P0002') return notFound('Kreasi tidak ditemukan.')
    if (publishError?.code === '22007') return unprocessable('Waktu kedaluwarsa tidak valid.')
    console.error('POST /api/v1/projects/[id]/publish:', publishError?.message)
    return serverError()
  }

  const slug = publication.published_slug
  return created({
    slug,
    url: `/p/${slug}`,
    versionNo: publication.published_version_no,
    expiresAt: expiresAt ?? null,
  })
}
