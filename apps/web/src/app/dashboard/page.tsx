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
    <div className="bg-background min-h-screen">
      {/* Topbar */}
      <header className="bg-surface shadow-xs sticky top-0 z-10">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <span className="font-display text-text-primary text-base uppercase tracking-[0.06em]">
            OpenWish Studio
          </span>
          <div className="flex items-center gap-3">
            <span className="text-text-secondary text-sm">
              {profile?.display_name ?? user.email}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-display text-text-primary text-4xl uppercase tracking-[0.02em]">
            Kreasimu
          </h1>
          <Link
            href="/editor/new"
            className="bg-primary text-text-on-primary hover:bg-primary-hover rounded-sm px-5 py-2 text-xs font-semibold uppercase tracking-[0.06em] transition-colors"
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
    <div className="bg-surface bg-spotlight relative flex flex-col items-center justify-center overflow-hidden rounded-md py-20 text-center shadow-sm">
      <div className="mb-3 text-4xl">🎨</div>
      <h2 className="font-display text-text-primary text-2xl uppercase tracking-[0.03em]">
        Buat kreasi pertama
      </h2>
      <p className="text-text-secondary mt-1 text-sm">Mulai dari template atau kanvas kosong.</p>
      <Link
        href="/editor/new"
        className="bg-primary text-text-on-primary hover:bg-primary-hover mt-5 rounded-sm px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.06em] transition-colors"
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
    draft: { label: 'Draft', color: 'text-text-secondary bg-surface-hover' },
    published: { label: 'Published', color: 'text-success bg-success-subtle' },
    expired: { label: 'Expired', color: 'text-warning bg-warning-subtle' },
  }
  const badge = statusLabel[project.status] ?? statusLabel.draft

  const updatedAt = new Date(project.updated_at).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return (
    <div className="bg-surface group flex flex-col rounded-md shadow-sm transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-md">
      {/* Thumbnail placeholder */}
      <a href={`/editor/${project.id}`} className="block flex-1">
        <div className="bg-canvas flex h-40 items-center justify-center rounded-t-md">
          <span className="text-3xl opacity-30">🎨</span>
        </div>
        {/* Footer */}
        <div className="p-3">
          <p className="text-text-primary truncate text-sm font-medium">{project.name}</p>
          <p className="text-text-muted mt-0.5 text-xs">{updatedAt}</p>
        </div>
      </a>
      {/* Action row */}
      <div className="border-border flex items-center justify-between border-t px-3 py-2">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] ${badge.color}`}
        >
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
        className="text-text-secondary hover:bg-surface-hover hover:text-text-primary rounded-sm px-3 py-1.5 text-sm transition-colors"
      >
        Keluar
      </button>
    </form>
  )
}
