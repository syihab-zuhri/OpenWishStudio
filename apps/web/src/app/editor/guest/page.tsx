'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'
import {
  createDefaultDocument,
  safeMigrateDocument,
  type ProjectDocument,
} from '@openwish/project-schema'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { loadGuestDraft } from '@/lib/guest-draft'
import EditorShell from '../[id]/_components/EditorShell'

interface GuestBoot {
  localProjectId: string
  name: string
  document: ProjectDocument
}

/**
 * Editor mode tamu: bisa dipakai tanpa login, draft tersimpan di perangkat
 * (localStorage) dan diimpor otomatis ke akun saat user masuk.
 */
export default function GuestEditorPage() {
  const router = useRouter()
  const [boot, setBoot] = useState<GuestBoot | null>(null)

  useEffect(() => {
    let cancelled = false
    const supabase = createSupabaseBrowserClient()

    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled) return

      // User yang sudah login tidak butuh mode tamu
      if (user) {
        router.replace('/dashboard')
        return
      }

      const draft = loadGuestDraft()
      if (draft) {
        const parsed = safeMigrateDocument(draft.document)
        if (parsed.success) {
          setBoot({
            localProjectId: draft.localProjectId,
            name: draft.name || 'Kreasi Tamu',
            document: parsed.data,
          })
          return
        }
      }

      const name = 'Kreasi Tamu'
      setBoot({
        localProjectId: `guest-${uuidv4()}`,
        name,
        document: createDefaultDocument(name),
      })
    })

    return () => {
      cancelled = true
    }
  }, [router])

  if (!boot) {
    return (
      <main className="bg-background bg-spotlight flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="border-primary h-8 w-8 animate-spin rounded-full border-[3px] border-t-transparent" />
          <p className="text-text-secondary text-sm">Menyiapkan editor…</p>
        </div>
      </main>
    )
  }

  return (
    <EditorShell
      projectId={boot.localProjectId}
      initialName={boot.name}
      initialDocument={boot.document}
      initialRevision={0}
      mode="guest"
    />
  )
}
