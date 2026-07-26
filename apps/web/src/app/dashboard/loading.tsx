export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="h-5 w-32 animate-pulse rounded bg-neutral-200" />
          <div className="h-8 w-20 animate-pulse rounded bg-neutral-200" />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="h-7 w-28 animate-pulse rounded bg-neutral-200" />
          <div className="h-9 w-24 animate-pulse rounded-full bg-neutral-200" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-neutral-200 bg-white">
              <div className="h-40 animate-pulse rounded-t-lg bg-neutral-100" />
              <div className="p-3 space-y-2">
                <div className="h-4 w-3/4 animate-pulse rounded bg-neutral-200" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-neutral-100" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
