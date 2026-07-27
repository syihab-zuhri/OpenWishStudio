'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { safeMigrateDocument, type ProjectDocument } from '@openwish/project-schema'
import { loadGuestDraft } from '@/lib/guest-draft'
import { DraftPreview } from '../../[id]/preview/_components/DraftPreview'

type State =
  | { phase: 'loading' }
  | { phase: 'empty' }
  | { phase: 'ready'; name: string; document: ProjectDocument }

/** Preview draft mode tamu — membaca draft dari perangkat, tanpa server. */
export default function GuestPreviewPage() {
  const [state, setState] = useState<State>({ phase: 'loading' })

  useEffect(() => {
    const draft = loadGuestDraft()
    if (!draft) {
      setState({ phase: 'empty' })
      return
    }
    const parsed = safeMigrateDocument(draft.document)
    if (!parsed.success) {
      setState({ phase: 'empty' })
      return
    }
    setState({ phase: 'ready', name: draft.name || 'Kreasi Tamu', document: parsed.data })
  }, [])

  if (state.phase === 'loading') {
    return (
      <main className="bg-background flex min-h-screen items-center justify-center">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-[3px] border-t-transparent" />
      </main>
    )
  }

  if (state.phase === 'empty') {
    return (
      <main className="bg-background bg-spotlight flex min-h-screen items-center justify-center px-4">
        <div className="bg-surface w-full max-w-sm rounded-md p-6 text-center shadow-sm">
          <div className="mb-3 text-3xl" aria-hidden="true">
            🎨
          </div>
          <h1 className="text-text-primary mb-2 text-base font-semibold">Belum ada draft</h1>
          <p className="text-text-secondary mb-5 text-sm">
            Mulai berkreasi dulu di editor, lalu buka preview lagi.
          </p>
          <Link
            href={'/editor/guest' as Route}
            className="bg-primary text-text-on-primary hover:bg-primary-hover inline-block rounded-sm px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.06em] transition-colors"
          >
            Buka Editor
          </Link>
        </div>
      </main>
    )
  }

  return (
    <DraftPreview
      projectId="guest"
      projectName={state.name}
      document={state.document}
      backHref={'/editor/guest' as Route}
    />
  )
}
