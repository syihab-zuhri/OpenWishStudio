import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createDefaultDocument } from '@openwish/project-schema'
import { redirect } from 'next/navigation'

export default async function EditorNewPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login?next=/editor/new')
  }

  const emptyDocument = createDefaultDocument('Kreasi Baru')

  const { data: project, error } = await supabase
    .from('projects')
    .insert({
      name: 'Kreasi Baru',
      owner_id: user.id,
      created_by: user.id,
      draft_document: JSON.parse(JSON.stringify(emptyDocument)),
      schema_version: emptyDocument.schemaVersion,
    })
    .select('id')
    .single()

  if (error || !project) {
    console.error('Failed to create project:', error?.message)
    redirect('/dashboard?error=create_failed')
  }

  redirect(`/editor/${project.id}`)
}
