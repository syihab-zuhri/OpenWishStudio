import { createSupabaseServerClient } from '@/lib/supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>

export async function fetchOwnedProject(supabase: SupabaseClient, userId: string, projectId: string) {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, status, draft_document, draft_revision, schema_version, updated_at, created_at, deleted_at')
    .eq('id', projectId)
    .eq('owner_id', userId)
    .is('deleted_at', null)
    .single()

  return { data, error }
}
