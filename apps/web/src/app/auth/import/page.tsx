'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { loadGuestDraft, clearGuestDraft } from '@/lib/guest-draft'
import { safeNext } from '@/lib/safe-next'

export default function ImportPage() {
  return (
    <Suspense>
      <ImportFlow />
    </Suspense>
  )
}

type Phase = 'importing' | 'done' | 'failed' | 'nothing'

function ImportFlow() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = safeNext(searchParams.get('next'))

  const [phase, setPhase] = useState<Phase>('importing')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [draftJson, setDraftJson] = useState<string | null>(null)

  useEffect(() => {
    const draft = loadGuestDraft()
    if (!draft) {
      setPhase('nothing')
      router.replace(next as never)
      return
    }

    setDraftJson(JSON.stringify(draft.document, null, 2))

    fetch('/api/v1/auth/guest-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        document: draft.document,
        localProjectId: draft.localProjectId,
        idempotencyKey: draft.idempotencyKey,
      }),
    })
      .then(async (res) => {
        const json = await res.json()
        if (res.ok) {
          clearGuestDraft()
          const projectId: string = json.data?.projectId
          router.replace(`/editor/${projectId}` as never)
        } else {
          setErrorMsg(json.error ?? 'Impor gagal.')
          setPhase('failed')
        }
      })
      .catch(() => {
        setErrorMsg('Terjadi kesalahan jaringan.')
        setPhase('failed')
      })
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleDownload() {
    if (!draftJson) return
    const blob = new Blob([draftJson], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'kreasi-backup.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleSkip() {
    clearGuestDraft()
    router.replace(next as never)
  }

  if (phase === 'importing' || phase === 'nothing') {
    return (
      <main className="bg-background bg-spotlight flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="border-primary h-8 w-8 animate-spin rounded-full border-[3px] border-t-transparent" />
          <p className="text-text-secondary text-sm">Mengimpor kreasimu…</p>
        </div>
      </main>
    )
  }

  return (
    <main className="bg-background flex min-h-screen items-center justify-center px-4">
      <div className="bg-surface w-full max-w-sm rounded-md p-6 text-center shadow-sm">
        <div className="mb-3 text-3xl" aria-hidden="true">
          ⚠️
        </div>
        <h1 className="text-text-primary mb-2 text-base font-semibold">Gagal mengimpor kreasi</h1>
        <p className="text-text-secondary mb-5 text-sm">
          {errorMsg ?? 'Kreasi tidak dapat diimpor secara otomatis.'} Unduh salinan pemulihan agar
          tidak kehilangan hasil kerjamu.
        </p>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleDownload}
            className="bg-primary text-text-on-primary hover:bg-primary-hover w-full rounded-sm py-2.5 text-xs font-semibold uppercase tracking-[0.06em] transition-colors"
          >
            Unduh Salinan Pemulihan
          </button>
          <button
            type="button"
            onClick={handleSkip}
            className="border-border-strong text-text-secondary hover:bg-surface-hover w-full rounded-sm border py-2.5 text-sm transition-colors"
          >
            Lewati
          </button>
        </div>
      </div>
    </main>
  )
}
