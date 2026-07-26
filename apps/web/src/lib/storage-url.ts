/**
 * URL publik untuk objek di bucket Supabase Storage yang public-read
 * (`assets` dan `music-library`). Tidak perlu signed URL — kerahasiaan aset
 * berasal dari path UUID yang tidak bisa ditebak.
 */
export function storagePublicUrl(bucket: 'assets' | 'music-library', key: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const safeKey = key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
  return `${base}/storage/v1/object/public/${bucket}/${safeKey}`
}
