import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { safeMigrateDocument } from '@openwish/project-schema'
import { DraftPreview } from './_components/DraftPreview'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from('projects')
    .select('name')
    .eq('id', id)
    .is('deleted_at', null)
    .single()
  return { title: data ? `Preview: ${data.name}` : 'Preview' }
}

export default async function PreviewPage({ params }: Props) {
  const { id } = await params

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/auth/login?next=/editor/${id}/preview`)
  }

  const { data: project, error } = await supabase
    .from('projects')
    .select('id, name, draft_document')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error || !project) {
    notFound()
  }

  const document = safeMigrateDocument(project.draft_document)
  if (!document.success) notFound()

  return <DraftPreview projectId={project.id} projectName={project.name} document={document.data} />
}
