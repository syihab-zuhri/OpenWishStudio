export default function NotFound() {
  return (
    <div className="bg-background bg-spotlight flex min-h-screen flex-col items-center justify-center text-center">
      <p className="font-display text-primary text-8xl tabular-nums">404</p>
      <h1 className="font-display text-text-primary mt-3 text-2xl uppercase tracking-[0.03em]">
        Halaman tidak ditemukan
      </h1>
      <p className="text-text-secondary mt-2 text-sm">Kreasi ini tidak ada atau sudah dihapus.</p>
      <a
        href="/dashboard"
        className="bg-primary text-text-on-primary hover:bg-primary-hover mt-6 rounded-sm px-6 py-2.5 text-sm font-semibold uppercase tracking-[0.06em] transition-colors"
      >
        Kembali ke Dashboard
      </a>
    </div>
  )
}
