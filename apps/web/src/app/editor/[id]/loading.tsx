export default function EditorLoading() {
  return (
    <div className="bg-background flex h-screen flex-col">
      <div className="bg-surface shadow-xs flex h-12 shrink-0 items-center justify-between px-4">
        <div className="bg-surface-hover h-4 w-40 animate-pulse rounded-sm" />
        <div className="flex gap-2">
          <div className="bg-surface-hover h-7 w-16 animate-pulse rounded-sm" />
          <div className="bg-surface-hover h-7 w-16 animate-pulse rounded-sm" />
        </div>
      </div>
      <div className="bg-canvas bg-spotlight flex flex-1 items-center justify-center">
        <p className="text-text-muted text-sm">Memuat editor…</p>
      </div>
    </div>
  )
}
