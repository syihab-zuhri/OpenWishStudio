import { describe, it, expect } from 'vitest'
import { safeNext, DEFAULT_NEXT_PATH } from './safe-next'

describe('safeNext', () => {
  it('keeps a plain relative path', () => {
    expect(safeNext('/editor/abc')).toBe('/editor/abc')
  })

  it('preserves query strings and hashes', () => {
    expect(safeNext('/dashboard?tab=drafts&sort=recent')).toBe(
      '/dashboard?tab=drafts&sort=recent',
    )
    expect(safeNext('/p/slug#scene-2')).toBe('/p/slug#scene-2')
  })

  it('falls back when the value is missing', () => {
    expect(safeNext(null)).toBe(DEFAULT_NEXT_PATH)
    expect(safeNext(undefined)).toBe(DEFAULT_NEXT_PATH)
    expect(safeNext('')).toBe(DEFAULT_NEXT_PATH)
  })

  it('rejects absolute URLs', () => {
    expect(safeNext('https://evil.example/login')).toBe(DEFAULT_NEXT_PATH)
    expect(safeNext('http://evil.example')).toBe(DEFAULT_NEXT_PATH)
  })

  it('rejects protocol-relative URLs', () => {
    expect(safeNext('//evil.example')).toBe(DEFAULT_NEXT_PATH)
    expect(safeNext('//evil.example/path')).toBe(DEFAULT_NEXT_PATH)
  })

  it('rejects backslash variants the URL parser normalises to slashes', () => {
    expect(safeNext('/\\evil.example')).toBe(DEFAULT_NEXT_PATH)
    expect(safeNext('/\\/evil.example')).toBe(DEFAULT_NEXT_PATH)
  })

  it('rejects non-http schemes', () => {
    expect(safeNext('javascript:alert(1)')).toBe(DEFAULT_NEXT_PATH)
    expect(safeNext('data:text/html,<script>alert(1)</script>')).toBe(DEFAULT_NEXT_PATH)
  })

  it('normalises away characters that could split a header', () => {
    expect(safeNext('/dashboard\r\nSet-Cookie: a=b')).not.toContain('\n')
    expect(safeNext('/dashboard\r\nSet-Cookie: a=b')).not.toContain('\r')
  })
})
