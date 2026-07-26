'use client'

import { useEffect, useRef } from 'react'
import type { ProjectDocument } from '@openwish/project-schema'
import { useEditorStore } from '@/features/editor/store/editorStore'

const DEBOUNCE_MS = 1500

export function useAutosave() {
  const projectId = useEditorStore((s) => s.projectId)
  const document = useEditorStore((s) => s.document)
  const saveStatus = useEditorStore((s) => s.saveStatus)
  const setSaveStatus = useEditorStore((s) => s.setSaveStatus)

  const revisionRef = useRef<number>(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inFlightRef = useRef(false)

  useEffect(() => {
    if (saveStatus !== 'unsaved') return
    if (!projectId) return

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      void save(document)
    }, DEBOUNCE_MS)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
    // document is the trigger; projectId / setSaveStatus are stable refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document, saveStatus])

  async function save(doc: ProjectDocument) {
    if (inFlightRef.current) return
    inFlightRef.current = true
    setSaveStatus('saving')

    try {
      const res = await fetch(`/api/v1/projects/${projectId}/draft`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document: doc, baseRevision: revisionRef.current }),
      })

      if (res.ok) {
        const json = (await res.json()) as { data?: { revision?: number } }
        if (typeof json.data?.revision === 'number') {
          revisionRef.current = json.data.revision
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
