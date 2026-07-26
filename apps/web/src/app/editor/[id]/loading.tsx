export default function EditorLoading() {
  return (
    <div className="flex h-screen flex-col bg-neutral-50">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-4">
        <div className="h-4 w-40 animate-pulse rounded bg-neutral-200" />
        <div className="flex gap-2">
          <div className="h-7 w-16 animate-pulse rounded-md bg-neutral-200" />
          <div className="h-7 w-16 animate-pulse rounded-md bg-neutral-200" />
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-neutral-400">Memuat editor…</p>
      </div>
    </div>
  )
}
