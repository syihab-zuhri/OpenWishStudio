import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import type { ProjectDocument } from '@openwish/project-schema'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { PublicViewer } from './_components/PublicViewer'

interface Props {
  params: Promise<{ slug: string }>
}

async function fetchPublishedPage(slug: string): Promise<{
  document: ProjectDocument
  expiresAt: string | null
  title: string
} | null> {
  const supabase = await createSupabaseServerClient()

  const { data: page, error: pageError } = await supabase
    .from('published_pages')
    .select('id, status, expires_at, current_version_id, projects(title)')
    .eq('slug', slug)
    .maybeSingle()

  if (pageError || !page || page.status !== 'published') return null

  if (page.expires_at && new Date(page.expires_at) <= new Date()) return null

  const { data: version, error: verError } = await supabase
    .from('project_versions')
    .select('document_snapshot')
    .eq('id', page.current_version_id)
    .single()

  if (verError || !version) return null

  const title =
    (page.projects as { title?: string } | null)?.title ??
    (version.document_snapshot as ProjectDocument)?.project?.title ??
    'Ucapan'

  return {
    document: version.document_snapshot as ProjectDocument,
    expiresAt: page.expires_at,
    title,
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const data = await fetchPublishedPage(slug)
  if (!data) return { title: 'Halaman Tidak Ditemukan' }
  return { title: data.title, description: `Lihat ucapan: ${data.title}` }
}

export default async function PublicPage({ params }: Props) {
  const { slug } = await params
  const data = await fetchPublishedPage(slug)

  if (!data) notFound()

  return <PublicViewer document={data.document} expiresAt={data.expiresAt} />
}
