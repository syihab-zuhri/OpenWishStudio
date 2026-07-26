export default function DashboardLoading() {
  return (
    <div className="bg-background min-h-screen">
      <header className="bg-surface shadow-xs sticky top-0 z-10">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="bg-surface-hover h-5 w-32 animate-pulse rounded-sm" />
          <div className="bg-surface-hover h-8 w-20 animate-pulse rounded-sm" />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="bg-surface-hover h-9 w-40 animate-pulse rounded-sm" />
          <div className="bg-surface-hover h-9 w-24 animate-pulse rounded-sm" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-surface rounded-md shadow-sm">
              <div className="bg-surface-hover h-40 animate-pulse rounded-t-md" />
              <div className="space-y-2 p-3">
                <div className="bg-surface-hover h-4 w-3/4 animate-pulse rounded-sm" />
                <div className="bg-surface-hover/60 h-3 w-1/2 animate-pulse rounded-sm" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
