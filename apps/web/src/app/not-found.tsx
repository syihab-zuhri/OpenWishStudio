export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 text-center">
      <p className="text-5xl font-bold text-brand-500">404</p>
      <h1 className="mt-3 text-xl font-semibold text-neutral-900">Halaman tidak ditemukan</h1>
      <p className="mt-2 text-sm text-neutral-500">Kreasi ini tidak ada atau sudah dihapus.</p>
      <a
        href="/dashboard"
        className="mt-6 rounded-full bg-brand-500 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-600"
      >
        Kembali ke Dashboard
      </a>
    </div>
  )
}
