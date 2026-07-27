'use client'

import { useEffect, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { ProjectDocument } from '@openwish/project-schema'
import { useEditorStore } from '@/features/editor/store/editorStore'
import { saveGuestDraft, loadGuestDraft, hasGuestDraft } from '@/lib/guest-draft'

const DEBOUNCE_MS = 1500

/** Laporkan hasil ke toast simpan manual — hanya bila ada permintaan aktif. */
function reportManualResult(ok: boolean) {
  const s = useEditorStore.getState()
  if (s.manualSaveState === 'saving') {
    s.setManualSaveState(ok ? 'success' : 'error')
  }
}

export function useAutosave() {
  const projectId = useEditorStore((s) => s.projectId)
  const document = useEditorStore((s) => s.document)
  const saveStatus = useEditorStore((s) => s.saveStatus)
  const saveRequestNonce = useEditorStore((s) => s.saveRequestNonce)
  const setSaveStatus = useEditorStore((s) => s.setSaveStatus)
  const setDraftRevision = useEditorStore((s) => s.setDraftRevision)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inFlightRef = useRef(false)
  // Simpan manual menunggu dokumen terkini — susulkan tanpa debounce
  const chainImmediateRef = useRef(false)
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
    const ok = hasGuestDraft()
    setSaveStatus(ok ? 'saved' : 'error')
    state.setLastSaveError(ok ? null : 'Penyimpanan perangkat penuh atau diblokir browser.')
    reportManualResult(ok)
  }

  /** Catat kegagalan: status, alasan untuk toast/badge, dan laporan manual. */
  function fail(status: 'error' | 'offline', message: string) {
    setSaveStatus(status)
    useEditorStore.getState().setLastSaveError(message)
    reportManualResult(false)
  }

  async function save(doc: ProjectDocument) {
    if (inFlightRef.current) return
    inFlightRef.current = true
    setSaveStatus('saving')

    try {
      const baseRevision = useEditorStore.getState().draftRevision
      const projectName = useEditorStore.getState().projectName
      const res = await fetch(`/api/v1/projects/${projectId}/draft`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document: doc, baseRevision, name: projectName }),
      })

      if (res.ok) {
        const json = (await res.json()) as { revision?: number }
        if (typeof json.revision === 'number') {
          setDraftRevision(json.revision)
        }
        const state = useEditorStore.getState()
        state.setLastSaveError(null)
        const docChanged = state.document !== doc
        // Kalau ada edit selama request berjalan, dokumen terbaru belum
        // tersimpan — jangan klaim "Tersimpan".
        setSaveStatus(docChanged ? 'unsaved' : 'saved')
        if (docChanged) {
          // Simpan manual belum tuntas sampai versi terkini ikut tersimpan
          if (state.manualSaveState === 'saving') chainImmediateRef.current = true
        } else {
          reportManualResult(true)
        }
      } else if (res.status === 409) {
        // Retry otomatis akan menimpa perubahan dari sesi lain. Biarkan
        // pengguna memuat ulang dan menyelesaikan konflik secara sadar.
        chainImmediateRef.current = false
        fail('error', 'Versi di server berubah — muat ulang sebelum menyimpan kembali.')
      } else if (res.status === 401) {
        fail('error', 'Sesi berakhir. Muat ulang halaman lalu masuk kembali.')
      } else if (res.status === 0 || !res.status) {
        fail('offline', 'Tidak ada koneksi internet.')
      } else {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        fail('error', body.error ?? `Gagal menyimpan (HTTP ${res.status}).`)
      }
    } catch (err) {
      const isOffline = err instanceof TypeError && err.message.includes('fetch')
      if (isOffline) fail('offline', 'Tidak ada koneksi internet.')
      else fail('error', 'Terjadi kesalahan tak terduga saat menyimpan.')
    } finally {
      inFlightRef.current = false
      const latest = useEditorStore.getState()
      if (latest.saveStatus === 'error') {
        chainImmediateRef.current = false
      } else if (chainImmediateRef.current) {
        chainImmediateRef.current = false
        void save(latest.document)
      } else if (latest.document !== doc) {
        // Edit yang masuk saat request berjalan bisa kehilangan jadwalnya
        // (timer sebelumnya jatuh ketika inFlight) — pastikan diantre ulang.
        scheduleSave()
      }
    }
  }
}
