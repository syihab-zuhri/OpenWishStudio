export const DEFAULT_NEXT_PATH = '/dashboard'

const SAME_ORIGIN_BASE = 'http://safe-next.invalid'

/**
 * Constrains a `?next=` value to a same-origin path.
 *
 * The auth routes feed this straight into `redirect()` / `router.replace()`,
 * so an absolute URL would bounce the user off-site *after* a legitimate
 * sign-in — a credible phishing hop that starts on the real domain.
 *
 * Resolving against a throwaway base and comparing origins rejects absolute
 * URLs (`https://evil.com`), protocol-relative ones (`//evil.com`) and the
 * backslash variants the URL parser normalises to slashes (`/\evil.com`),
 * while normalising away tabs and newlines that could split the header.
 */
export function safeNext(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith('/')) return DEFAULT_NEXT_PATH

  try {
    const url = new URL(raw, SAME_ORIGIN_BASE)
    if (url.origin !== SAME_ORIGIN_BASE) return DEFAULT_NEXT_PATH
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return DEFAULT_NEXT_PATH
  }
}
