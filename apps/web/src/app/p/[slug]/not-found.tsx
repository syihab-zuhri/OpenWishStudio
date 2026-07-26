import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="bg-canvas bg-spotlight flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <div className="mb-6 text-5xl" aria-hidden="true">
        🔗
      </div>
      <h1 className="font-display text-text-primary mb-2 text-3xl uppercase tracking-[0.03em]">
        Ucapan Tidak Ditemukan
      </h1>
      <p className="text-text-muted mb-8 max-w-xs text-sm">
        Link ini mungkin sudah kedaluwarsa, tidak tersedia, atau belum pernah ada.
      </p>
      <Link
        href="/"
        className="bg-primary text-text-on-primary hover:bg-primary-hover rounded-sm px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.06em] transition-colors"
      >
        Buat Ucapan Sendiri
      </Link>
    </div>
  )
}
