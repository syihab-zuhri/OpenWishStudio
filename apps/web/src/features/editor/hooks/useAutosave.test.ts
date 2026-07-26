import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAutosave } from './useAutosave'
import { useEditorStore, initEditorStore } from '@/features/editor/store/editorStore'
import { createDefaultDocument } from '@openwish/project-schema'
import { loadGuestDraft, clearGuestDraft } from '@/lib/guest-draft'

// ─── Mock fetch ───────────────────────────────────────────────────────────────

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Bentuk respons nyata PATCH /draft: { revision, savedAt } di level atas
function ok200(revision = 1) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ revision, savedAt: '2026-01-01T00:00:00Z' }),
  })
}

function response(status: number) {
  return Promise.resolve({ ok: false, status, json: () => Promise.resolve({}) })
}

function networkError() {
  return Promise.reject(new TypeError('Failed to fetch'))
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers()
  mockFetch.mockReset()
  clearGuestDraft()
  const doc = createDefaultDocument('Test')
  initEditorStore('proj-1', 'Test', doc)
  useEditorStore.getState().setSaveStatus('saved')
})

afterEach(() => {
  vi.useRealTimers()
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useAutosave', () => {
  it('does not call fetch when saveStatus is "saved"', async () => {
    renderHook(() => useAutosave())
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('does not call fetch when projectId is empty', async () => {
    initEditorStore('', 'Test', createDefaultDocument('Test'))
    useEditorStore.getState().setSaveStatus('unsaved')
    renderHook(() => useAutosave())
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('calls PATCH after debounce when saveStatus is "unsaved"', async () => {
    mockFetch.mockImplementation(() => ok200(2))
    useEditorStore.getState().setSaveStatus('unsaved')
    renderHook(() => useAutosave())
    await act(async () => {
      vi.advanceTimersByTime(1500)
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(mockFetch).toHaveBeenCalledOnce()
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/proj-1/draft')
    expect(opts.method).toBe('PATCH')
  })

  it('sets saveStatus to "saved" on 200 response', async () => {
    mockFetch.mockImplementation(() => ok200(3))
    useEditorStore.getState().setSaveStatus('unsaved')
    renderHook(() => useAutosave())
    await act(async () => {
      vi.advanceTimersByTime(1500)
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(useEditorStore.getState().saveStatus).toBe('saved')
  })

  it('sets saveStatus to "error" on 409 response', async () => {
    mockFetch.mockImplementation(() => response(409))
    useEditorStore.getState().setSaveStatus('unsaved')
    renderHook(() => useAutosave())
    await act(async () => {
      vi.advanceTimersByTime(1500)
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(useEditorStore.getState().saveStatus).toBe('error')
  })

  it('sets saveStatus to "offline" on network TypeError', async () => {
    mockFetch.mockImplementation(() => networkError())
    useEditorStore.getState().setSaveStatus('unsaved')
    renderHook(() => useAutosave())
    await act(async () => {
      vi.advanceTimersByTime(1500)
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(useEditorStore.getState().saveStatus).toBe('offline')
  })

  it('does not fire two concurrent saves (inFlightRef guard)', async () => {
    let resolveSave!: () => void
    mockFetch.mockImplementation(
      () =>
        new Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>((resolve) => {
          resolveSave = () =>
            resolve({ ok: true, status: 200, json: () => Promise.resolve({ revision: 1 }) })
        }),
    )
    useEditorStore.getState().setSaveStatus('unsaved')
    renderHook(() => useAutosave())
    // First debounce fires
    await act(async () => {
      vi.advanceTimersByTime(1500)
    })
    // Second debounce — hook sees saveStatus='saving' (not 'unsaved'), won't re-register
    await act(async () => {
      vi.advanceTimersByTime(1500)
    })
    expect(mockFetch).toHaveBeenCalledTimes(1)
    // Resolve in-flight request
    await act(async () => {
      resolveSave()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(useEditorStore.getState().saveStatus).toBe('saved')
  })

  it('sends baseRevision from the store and updates it after a save', async () => {
    mockFetch.mockImplementation(() => ok200(6))
    initEditorStore('proj-1', 'Test', createDefaultDocument('Test'), { revision: 5 })
    useEditorStore.getState().setSaveStatus('unsaved')
    renderHook(() => useAutosave())
    await act(async () => {
      vi.advanceTimersByTime(1500)
      await Promise.resolve()
      await Promise.resolve()
    })
    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(opts.body as string) as { baseRevision: number }
    expect(body.baseRevision).toBe(5)
    expect(useEditorStore.getState().draftRevision).toBe(6)
  })

  it('saves guest drafts to localStorage without calling fetch', async () => {
    initEditorStore('guest-abc', 'Kreasi Tamu', createDefaultDocument('Kreasi Tamu'), {
      isGuest: true,
    })
    useEditorStore.getState().setSaveStatus('unsaved')
    renderHook(() => useAutosave())
    await act(async () => {
      vi.advanceTimersByTime(1500)
    })
    expect(mockFetch).not.toHaveBeenCalled()
    const draft = loadGuestDraft()
    expect(draft?.localProjectId).toBe('guest-abc')
    expect(draft?.idempotencyKey).toBeTruthy()
    expect(useEditorStore.getState().saveStatus).toBe('saved')
  })

  it('keeps the same guest idempotencyKey across saves', async () => {
    initEditorStore('guest-abc', 'Kreasi Tamu', createDefaultDocument('Kreasi Tamu'), {
      isGuest: true,
    })
    useEditorStore.getState().setSaveStatus('unsaved')
    renderHook(() => useAutosave())
    await act(async () => {
      vi.advanceTimersByTime(1500)
    })
    const firstKey = loadGuestDraft()?.idempotencyKey
    await act(async () => {
      useEditorStore.getState().setSaveStatus('unsaved')
    })
    await act(async () => {
      vi.advanceTimersByTime(1500)
    })
    expect(loadGuestDraft()?.idempotencyKey).toBe(firstKey)
  })
})
