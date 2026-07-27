import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import EditorShell from './_components/EditorShell'
import { safeMigrateDocument } from '@openwish/project-schema'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditorPage({ params }: Props) {
  const { id } = await params

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/auth/login?next=/editor/${id}`)
  }

  const { data: project, error } = await supabase
    .from('projects')
    .select('id, name, status, draft_document, draft_revision, schema_version, updated_at')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error || !project) {
    notFound()
  }

  const document = safeMigrateDocument(project.draft_document)
  if (!document.success) notFound()

  return (
    <EditorShell
      projectId={project.id}
      initialName={project.name}
      initialDocument={document.data}
      initialRevision={project.draft_revision}
    />
  )
}
