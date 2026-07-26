import { requireAuth } from '@/lib/api/auth'
import { ok, serverError, notFound } from '@/lib/api/response'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { user, supabase, error } = await requireAuth()
  if (error) return error

  const { data: project, error: projError } = await supabase
    .from('projects')
    .select('id, draft_document, schema_version')
    .eq('id', id)
    .eq('owner_id', user!.id)
    .is('deleted_at', null)
    .single()

  if (projError || !project) {
    return notFound('Kreasi tidak ditemukan.')
  }

  const serviceClient = await createSupabaseServiceClient()

  const { data: pendingAssets, error: assetsError } = await serviceClient
    .from('assets')
    .select('id, original_name')
    .eq('project_id', id)
    .eq('status', 'pending')
    .is('deleted_at', null)
    .limit(20)

  if (assetsError) {
    console.error('POST /api/v1/projects/[id]/validate-publish:', assetsError.message)
    return serverError()
  }

  const issues: string[] = []

  if (pendingAssets && pendingAssets.length > 0) {
    issues.push(
      ...pendingAssets.map((a) => `Aset "${a.original_name}" masih dalam proses upload.`),
    )
  }

  const doc = project.draft_document as Record<string, unknown> | null
  if (!doc) {
    issues.push('Dokumen draft kosong.')
  } else if (
    !Array.isArray((doc as Record<string, unknown>).scenes) ||
    ((doc as Record<string, unknown>).scenes as unknown[]).length === 0
  ) {
    issues.push('Kreasi harus memiliki minimal satu scene.')
  }

  return ok({ valid: issues.length === 0, issues })
}
