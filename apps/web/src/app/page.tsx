export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 p-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-neutral-900">OpenWish Studio</h1>
        <p className="mt-4 text-neutral-500">Buat ucapan interaktif dan bagikan melalui link.</p>
        <a
          href="/editor/new"
          className="mt-8 inline-block rounded-full bg-brand-500 px-8 py-3 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
        >
          Buat Ucapan
        </a>
      </div>
    </main>
  )
}
