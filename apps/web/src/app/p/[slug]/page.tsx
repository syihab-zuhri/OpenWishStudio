import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { safeMigrateDocument, type ProjectDocument } from '@openwish/project-schema'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { PublicViewer } from './_components/PublicViewer'
import { cache } from 'react'

interface Props {
  params: Promise<{ slug: string }>
}

const fetchPublishedPage = cache(
  async (
    slug: string,
  ): Promise<{
    document: ProjectDocument
    expiresAt: string | null
    title: string
  } | null> => {
    const supabase = await createSupabaseServerClient()

    const { data: page, error: pageError } = await supabase
      .from('published_pages')
      .select('id, status, expires_at, current_version_id')
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

    // Render boundary: a snapshot that no longer satisfies the schema is treated
    // as missing rather than handed to the renderer as an unchecked cast.
    const parsed = safeMigrateDocument(version.document_snapshot)
    if (!parsed.success) return null

    return {
      document: parsed.data,
      expiresAt: page.expires_at,
      title: parsed.data.project.title || 'Ucapan',
    }
  },
)

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

  return <PublicViewer document={data.document} />
}
