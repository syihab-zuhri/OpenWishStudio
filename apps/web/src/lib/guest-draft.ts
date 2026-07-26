const STORAGE_KEY = 'openwish_guest_draft'

export interface GuestDraft {
  localProjectId: string
  idempotencyKey: string
  name: string
  document: unknown
  savedAt: string
}

export function saveGuestDraft(draft: GuestDraft): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
  } catch {
    // storage full or blocked — silently ignore
  }
}

export function loadGuestDraft(): GuestDraft | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as GuestDraft
  } catch {
    return null
  }
}

export function clearGuestDraft(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

export function hasGuestDraft(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null
  } catch {
    return false
  }
}
