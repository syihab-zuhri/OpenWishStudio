import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center text-center px-4">
      <div className="text-5xl mb-6" aria-hidden="true">
        🔗
      </div>
      <h1 className="text-xl font-semibold text-white mb-2">Ucapan Tidak Ditemukan</h1>
      <p className="text-sm text-neutral-400 mb-8 max-w-xs">
        Link ini mungkin sudah kedaluwarsa, tidak tersedia, atau belum pernah ada.
      </p>
      <Link
        href="/"
        className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
      >
        Buat Ucapan Sendiri
      </Link>
    </div>
  )
}
