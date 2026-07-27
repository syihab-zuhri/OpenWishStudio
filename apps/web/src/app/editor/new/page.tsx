import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server'
import { createDefaultDocument } from '@openwish/project-schema'
import { redirect } from 'next/navigation'

async function createProjectAction() {
  'use server'

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login?next=/editor/new')

  const document = createDefaultDocument('Kreasi Baru')
  const service = await createSupabaseServiceClient()
  const { data: project, error } = await service
    .from('projects')
    .insert({
      name: 'Kreasi Baru',
      owner_id: user.id,
      created_by: user.id,
      draft_document: JSON.parse(JSON.stringify(document)),
      schema_version: document.schemaVersion,
    })
    .select('id')
    .single()

  if (error || !project) {
    console.error('Failed to create project:', error?.message)
    redirect('/dashboard?error=create_failed')
  }

  redirect(`/editor/${project.id}`)
}

export default async function EditorNewPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login?next=/editor/new')

  return (
    <main className="bg-background flex min-h-screen items-center justify-center px-4">
      <section className="bg-surface w-full max-w-md rounded-md p-8 text-center shadow-sm">
        <h1 className="font-display text-text-primary text-3xl uppercase tracking-[0.03em]">
          Kreasi Baru
        </h1>
        <p className="text-text-secondary mt-2 text-sm">
          Proyek baru dibuat hanya setelah Anda menekan tombol berikut.
        </p>
        <form action={createProjectAction} className="mt-6">
          <button
            type="submit"
            className="bg-primary text-text-on-primary hover:bg-primary-hover w-full rounded-sm px-5 py-3 text-xs font-semibold uppercase tracking-[0.08em] transition-colors"
          >
            Buat dan buka editor
          </button>
        </form>
      </section>
    </main>
  )
}
