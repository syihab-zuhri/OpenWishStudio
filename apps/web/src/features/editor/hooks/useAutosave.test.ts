import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAutosave } from './useAutosave'
import { useEditorStore, initEditorStore } from '@/features/editor/store/editorStore'
import { createDefaultDocument } from '@openwish/project-schema'

// ─── Mock fetch ───────────────────────────────────────────────────────────────

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ok200(revision = 1) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ data: { revision } }),
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
    await act(async () => { vi.advanceTimersByTime(2000) })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('does not call fetch when projectId is empty', async () => {
    initEditorStore('', 'Test', createDefaultDocument('Test'))
    useEditorStore.getState().setSaveStatus('unsaved')
    renderHook(() => useAutosave())
    await act(async () => { vi.advanceTimersByTime(2000) })
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
            resolve({ ok: true, status: 200, json: () => Promise.resolve({ data: { revision: 1 } }) })
        }),
    )
    useEditorStore.getState().setSaveStatus('unsaved')
    renderHook(() => useAutosave())
    // First debounce fires
    await act(async () => { vi.advanceTimersByTime(1500) })
    // Second debounce — hook sees saveStatus='saving' (not 'unsaved'), won't re-register
    await act(async () => { vi.advanceTimersByTime(1500) })
    expect(mockFetch).toHaveBeenCalledTimes(1)
    // Resolve in-flight request
    await act(async () => {
      resolveSave()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(useEditorStore.getState().saveStatus).toBe('saved')
  })
})
