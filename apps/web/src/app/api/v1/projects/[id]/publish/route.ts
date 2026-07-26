import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { ProjectDocumentSchema } from '@openwish/project-schema'
import { requireAuth } from '@/lib/api/auth'
import { created, serverError, unprocessable, notFound, conflict } from '@/lib/api/response'
import { byUser, enforceRateLimit } from '@/lib/api/rate-limit'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import { fetchOwnedProject } from '@/lib/api/projects'
import { v4 as uuidv4 } from 'uuid'

// Every publish writes an immutable snapshot row, so this is unbounded growth
// if left open.
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
  const text = JSON.stringify(content)
  const buf = new TextEncoder().encode(text)
  const hash = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
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
  if (!parsed.success) {
    return unprocessable('Parameter tidak valid.')
  }

  const { expiresAt } = parsed.data

  if (expiresAt) {
    const expiry = new Date(expiresAt)
    if (expiry <= new Date()) {
      return unprocessable('Pilih waktu kedaluwarsa di masa depan.')
    }
  }

  const { data: project, error: projError } = await fetchOwnedProject(supabase, user!.id, id)
  if (projError || !project) {
    return notFound('Kreasi tidak ditemukan.')
  }

  const serviceClient = await createSupabaseServiceClient()

  // Check for pending assets in project
  const { data: pendingAssets } = await serviceClient
    .from('assets')
    .select('id, original_name')
    .eq('project_id', id)
    .eq('status', 'pending')
    .is('deleted_at', null)
    .limit(10)

  if (pendingAssets && pendingAssets.length > 0) {
    return conflict(
      'Beberapa aset masih dalam proses upload: ' +
        pendingAssets.map((a) => a.original_name).join(', '),
    )
  }

  // Get existing published page for this project (to retain slug on republish)
  const { data: currentPage } = await serviceClient
    .from('published_pages')
    .select('id, slug, current_version_id')
    .eq('project_id', id)
    .maybeSingle()

  const slug = currentPage?.slug ?? generateSlug()
  const versionId = uuidv4()

  // Get next version number from existing versions
  const { count: versionCount } = await serviceClient
    .from('project_versions')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', id)

  const versionNo = (versionCount ?? 0) + 1

  // Last gate before the document becomes publicly reachable. Drafts can predate
  // the current schema (or have been written by an older, laxer route), so the
  // snapshot is built from the parsed result rather than the raw column.
  const validated = ProjectDocumentSchema.safeParse(project.draft_document)
  if (!validated.success) {
    return unprocessable('Dokumen tidak valid. Buka editor dan simpan ulang sebelum publikasi.')
  }

  const contentHash = await computeContentHash(validated.data)

  // Insert immutable version snapshot
  const { error: versionError } = await serviceClient.from('project_versions').insert({
    id: versionId,
    project_id: id,
    version_no: versionNo,
    document_snapshot: validated.data as never,
    schema_version: project.schema_version ?? 1,
    created_by: user!.id,
    content_hash: contentHash,
  })

  if (versionError) {
    console.error('POST /api/v1/projects/[id]/publish version insert:', versionError.message)
    return serverError()
  }

  const publishedAt = new Date().toISOString()

  if (currentPage) {
    const { error: updateError } = await serviceClient
      .from('published_pages')
      .update({
        current_version_id: versionId,
        status: 'published',
        expires_at: expiresAt ?? null,
        published_at: publishedAt,
      })
      .eq('id', currentPage.id)
      .eq('project_id', id)

    if (updateError) {
      console.error('POST /api/v1/projects/[id]/publish page update:', updateError.message)
      return serverError()
    }
  } else {
    const { error: insertError } = await serviceClient.from('published_pages').insert({
      project_id: id,
      slug,
      current_version_id: versionId,
      status: 'published',
      expires_at: expiresAt ?? null,
      published_at: publishedAt,
      created_by: user!.id,
    })

    if (insertError) {
      console.error('POST /api/v1/projects/[id]/publish page insert:', insertError.message)
      return serverError()
    }
  }

  await serviceClient.from('audit_logs').insert({
    actor_id: user!.id,
    created_by: user!.id,
    action: currentPage ? 'project.republish' : 'project.publish',
    target_type: 'project',
    target_id: id,
    metadata: { slug, versionNo, expiresAt: expiresAt ?? null },
  })

  await serviceClient
    .from('projects')
    .update({ status: 'published' })
    .eq('id', id)
    .eq('owner_id', user!.id)

  const url = `/p/${slug}`
  return created({ slug, url, versionNo, expiresAt: expiresAt ?? null })
}
