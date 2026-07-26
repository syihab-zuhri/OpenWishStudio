'use client'

import { useEffect, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { ProjectDocument } from '@openwish/project-schema'
import { useEditorStore } from '@/features/editor/store/editorStore'
import { saveGuestDraft, loadGuestDraft, hasGuestDraft } from '@/lib/guest-draft'

const DEBOUNCE_MS = 1500

export function useAutosave() {
  const projectId = useEditorStore((s) => s.projectId)
  const document = useEditorStore((s) => s.document)
  const saveStatus = useEditorStore((s) => s.saveStatus)
  const setSaveStatus = useEditorStore((s) => s.setSaveStatus)
  const setDraftRevision = useEditorStore((s) => s.setDraftRevision)
  const isGuest = useEditorStore((s) => s.isGuest)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inFlightRef = useRef(false)
  // Idempotency key draft tamu dipertahankan antar-save supaya impor tidak dobel
  const guestKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (saveStatus !== 'unsaved') return
    if (!projectId) return

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      if (isGuest) saveLocal(document)
      else void save(document)
    }, DEBOUNCE_MS)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
    // document is the trigger; projectId / setSaveStatus are stable refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document, saveStatus])

  /** Mode tamu: simpan ke perangkat (localStorage), tanpa server. */
  function saveLocal(doc: ProjectDocument) {
    const state = useEditorStore.getState()
    const key = guestKeyRef.current ?? loadGuestDraft()?.idempotencyKey ?? uuidv4()
    guestKeyRef.current = key
    saveGuestDraft({
      localProjectId: state.projectId,
      idempotencyKey: key,
      name: state.projectName || 'Kreasi Tamu',
      document: doc,
      savedAt: new Date().toISOString(),
    })
    // saveGuestDraft menelan error storage — verifikasi hasilnya sebelum klaim tersimpan
    setSaveStatus(hasGuestDraft() ? 'saved' : 'error')
  }

  async function save(doc: ProjectDocument) {
    if (inFlightRef.current) return
    inFlightRef.current = true
    setSaveStatus('saving')

    try {
      const baseRevision = useEditorStore.getState().draftRevision
      const res = await fetch(`/api/v1/projects/${projectId}/draft`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document: doc, baseRevision }),
      })

      if (res.ok) {
        const json = (await res.json()) as { revision?: number }
        if (typeof json.revision === 'number') {
          setDraftRevision(json.revision)
        }
        setSaveStatus('saved')
      } else if (res.status === 409) {
        setSaveStatus('error')
      } else if (res.status === 0 || !res.status) {
        setSaveStatus('offline')
      } else {
        setSaveStatus('error')
      }
    } catch (err) {
      const isOffline = err instanceof TypeError && err.message.includes('fetch')
      setSaveStatus(isOffline ? 'offline' : 'error')
    } finally {
      inFlightRef.current = false
    }
  }
}
