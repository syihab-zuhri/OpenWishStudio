import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ProjectCardMenu } from './_components/ProjectActions'

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login?next=/dashboard')
  }

  const { data: projects, error } = await supabase
    .from('projects')
    .select('id, name, status, updated_at, created_at')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('Failed to load projects:', error.message)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, avatar_url')
    .eq('id', user.id)
    .single()

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Topbar */}
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <span className="text-base font-semibold text-neutral-900">OpenWish Studio</span>
          <div className="flex items-center gap-3">
            <span className="text-sm text-neutral-500">{profile?.display_name ?? user.email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-neutral-900">Kreasimu</h1>
          <Link
            href="/editor/new"
            className="bg-brand-500 hover:bg-brand-600 rounded-full px-5 py-2 text-sm font-medium text-white transition-colors"
          >
            + Buat Baru
          </Link>
        </div>

        {!projects || projects.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-neutral-200 py-20 text-center">
      <div className="mb-3 text-4xl">🎨</div>
      <h2 className="text-base font-semibold text-neutral-900">Buat kreasi pertama</h2>
      <p className="mt-1 text-sm text-neutral-500">Mulai dari template atau kanvas kosong.</p>
      <Link
        href="/editor/new"
        className="bg-brand-500 hover:bg-brand-600 mt-5 rounded-full px-6 py-2.5 text-sm font-medium text-white transition-colors"
      >
        Mulai Berkreasi
      </Link>
    </div>
  )
}

function ProjectCard({
  project,
}: {
  project: {
    id: string
    name: string
    status: string
    updated_at: string
  }
}) {
  const statusLabel: Record<string, { label: string; color: string }> = {
    draft: { label: 'Draft', color: 'text-neutral-500 bg-neutral-100' },
    published: { label: 'Published', color: 'text-success-700 bg-green-50' },
    expired: { label: 'Expired', color: 'text-warning-600 bg-yellow-50' },
  }
  const badge = statusLabel[project.status] ?? statusLabel.draft

  const updatedAt = new Date(project.updated_at).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return (
    <div className="hover:shadow-panel group flex flex-col rounded-lg border border-neutral-200 bg-white transition-shadow">
      {/* Thumbnail placeholder */}
      <a href={`/editor/${project.id}`} className="block flex-1">
        <div className="flex h-40 items-center justify-center rounded-t-lg bg-neutral-50">
          <span className="text-3xl opacity-30">🎨</span>
        </div>
        {/* Footer */}
        <div className="p-3">
          <p className="truncate text-sm font-medium text-neutral-900">{project.name}</p>
          <p className="mt-0.5 text-xs text-neutral-400">{updatedAt}</p>
        </div>
      </a>
      {/* Action row */}
      <div className="flex items-center justify-between border-t border-neutral-100 px-3 py-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.color}`}>
          {badge.label}
        </span>
        <ProjectCardMenu project={project} />
      </div>
    </div>
  )
}

function SignOutButton() {
  return (
    <form action="/api/v1/auth/signout" method="POST">
      <button
        type="submit"
        className="rounded-md px-3 py-1.5 text-sm text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
      >
        Keluar
      </button>
    </form>
  )
}
