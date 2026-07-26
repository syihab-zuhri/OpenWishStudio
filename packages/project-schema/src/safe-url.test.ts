import { describe, it, expect } from 'vitest'
import { v4 as uuidv4 } from 'uuid'
import {
  SafeUrlSchema,
  ImageElementPropsSchema,
  ButtonElementPropsSchema,
  BackgroundSchema,
  TextElementPropsSchema,
} from './document.schema'

// These values are rendered into `href`, `<img src>` and `background-image:
// url(...)` on public pages. `z.string().url()` accepts all of them, which is
// why the scheme is allow-listed explicitly.
const DANGEROUS_URLS = [
  'javascript:alert(document.domain)',
  'JavaScript:alert(1)',
  'data:text/html,<script>alert(1)</script>',
  'vbscript:msgbox(1)',
  'file:///etc/passwd',
  'blob:https://example.com/uuid',
]

describe('SafeUrlSchema', () => {
  it('accepts http and https', () => {
    expect(SafeUrlSchema.safeParse('https://cdn.example.com/a.png').success).toBe(true)
    expect(SafeUrlSchema.safeParse('http://cdn.example.com/a.png').success).toBe(true)
  })

  it.each(DANGEROUS_URLS)('rejects %s', (url) => {
    expect(SafeUrlSchema.safeParse(url).success).toBe(false)
  })

  it('rejects unparseable values and oversized strings', () => {
    expect(SafeUrlSchema.safeParse('not a url').success).toBe(false)
    expect(SafeUrlSchema.safeParse(`https://e.com/${'a'.repeat(2100)}`).success).toBe(false)
  })
})

describe('element props reject dangerous URLs', () => {
  it.each(DANGEROUS_URLS)('image src rejects %s', (url) => {
    expect(ImageElementPropsSchema.safeParse({ src: url }).success).toBe(false)
  })

  it.each(DANGEROUS_URLS)('button url rejects %s', (url) => {
    expect(ButtonElementPropsSchema.safeParse({ label: 'Klik', url }).success).toBe(false)
  })

  it.each(DANGEROUS_URLS)('image background src rejects %s', (url) => {
    expect(BackgroundSchema.safeParse({ type: 'image', src: url }).success).toBe(false)
  })

  it('still accepts a normal https asset', () => {
    expect(
      ImageElementPropsSchema.safeParse({
        assetId: uuidv4(),
        src: 'https://project.supabase.co/storage/v1/object/public/assets/a.png',
      }).success,
    ).toBe(true)
  })
})

describe('fontFamily is constrained to font-name characters', () => {
  const base = { content: 'hi', fontSize: 16, color: '#000000' }

  it('accepts a normal font stack', () => {
    const result = TextElementPropsSchema.safeParse({
      ...base,
      fontFamily: 'Inter, "Helvetica Neue", sans-serif',
    })
    expect(result.success).toBe(true)
  })

  it.each([
    'Inter; background: url(https://evil.example/track)',
    'Inter}</style><script>alert(1)</script>',
    'a'.repeat(200),
  ])('rejects %s', (fontFamily) => {
    expect(TextElementPropsSchema.safeParse({ ...base, fontFamily }).success).toBe(false)
  })
})
