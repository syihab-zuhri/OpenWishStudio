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
  const saveRequestNonce = useEditorStore((s) => s.saveRequestNonce)
  const setSaveStatus = useEditorStore((s) => s.setSaveStatus)
  const setDraftRevision = useEditorStore((s) => s.setDraftRevision)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inFlightRef = useRef(false)
  // Satu kali resync per rentetan konflik 409 supaya tidak berputar tanpa henti
  const resyncedRef = useRef(false)
  // Idempotency key draft tamu dipertahankan antar-save supaya impor tidak dobel
  const guestKeyRef = useRef<string | null>(null)

  function scheduleSave() {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      const state = useEditorStore.getState()
      if (state.isGuest) saveLocal(state.document)
      else void save(state.document)
    }, DEBOUNCE_MS)
  }

  useEffect(() => {
    if (saveStatus !== 'unsaved') return
    if (!projectId) return

    scheduleSave()

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
    // document is the trigger; projectId / setSaveStatus are stable refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document, saveStatus])

  // Tombol Simpan manual: simpan segera tanpa menunggu debounce
  useEffect(() => {
    if (saveRequestNonce === 0) return
    if (timerRef.current) clearTimeout(timerRef.current)
    const state = useEditorStore.getState()
    if (!state.projectId) return
    if (state.isGuest) saveLocal(state.document)
    else void save(state.document)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveRequestNonce])

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

  /** Ambil revisi terbaru dari server setelah 409 (tab lain menyimpan duluan). */
  async function resyncRevision(): Promise<boolean> {
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/draft`)
      if (!res.ok) return false
      const json = (await res.json()) as { revision?: number }
      if (typeof json.revision !== 'number') return false
      setDraftRevision(json.revision)
      return true
    } catch {
      return false
    }
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
        resyncedRef.current = false
        // Kalau ada edit selama request berjalan, dokumen terbaru belum
        // tersimpan — jangan klaim "Tersimpan".
        setSaveStatus(useEditorStore.getState().document !== doc ? 'unsaved' : 'saved')
      } else if (res.status === 409) {
        // Revisi server bergeser. Sekali: ambil revisi terbaru lalu antre ulang
        // (last-write-wins); kalau masih konflik juga, tampilkan error.
        if (!resyncedRef.current && (await resyncRevision())) {
          resyncedRef.current = true
          setSaveStatus('unsaved')
        } else {
          setSaveStatus('error')
        }
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
      // Edit yang masuk saat request berjalan bisa kehilangan jadwalnya
      // (timer sebelumnya jatuh ketika inFlight) — pastikan diantre ulang.
      if (useEditorStore.getState().document !== doc) {
        scheduleSave()
      }
    }
  }
}
