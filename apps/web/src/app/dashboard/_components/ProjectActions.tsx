'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

interface Project {
  id: string
  name: string
  status: string
  updated_at: string
}

interface Props {
  project: Project
}

export function ProjectCardMenu({ project }: Props) {
  const [open, setOpen] = useState(false)
  const [dialog, setDialog] = useState<'rename' | 'duplicate' | 'delete' | null>(null)
  const router = useRouter()

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); setOpen((v) => !v) }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          aria-label="Opsi kreasi"
          className="flex h-6 w-6 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
            <circle cx="8" cy="3" r="1.2" />
            <circle cx="8" cy="8" r="1.2" />
            <circle cx="8" cy="13" r="1.2" />
          </svg>
        </button>
        {open && (
          <div className="absolute right-0 top-7 z-10 min-w-[140px] rounded-md border border-neutral-200 bg-white py-1 shadow-panel">
            <MenuItem label="Ganti Nama" onClick={() => { setOpen(false); setDialog('rename') }} />
            <MenuItem label="Duplikasi" onClick={() => { setOpen(false); setDialog('duplicate') }} />
            <MenuItem label="Hapus" danger onClick={() => { setOpen(false); setDialog('delete') }} />
          </div>
        )}
      </div>

      {dialog === 'rename' && (
        <RenameDialog
          project={project}
          onClose={() => setDialog(null)}
          onSuccess={() => { setDialog(null); router.refresh() }}
        />
      )}
      {dialog === 'duplicate' && (
        <DuplicateDialog
          project={project}
          onClose={() => setDialog(null)}
          onSuccess={(id) => { setDialog(null); router.push(`/editor/${id}`) }}
        />
      )}
      {dialog === 'delete' && (
        <DeleteDialog
          project={project}
          onClose={() => setDialog(null)}
          onSuccess={() => { setDialog(null); router.refresh() }}
        />
      )}
    </>
  )
}

function MenuItem({
  label,
  danger,
  onClick,
}: {
  label: string
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full px-3 py-1.5 text-left text-sm transition-colors hover:bg-neutral-50 ${
        danger ? 'text-danger-600' : 'text-neutral-700'
      }`}
    >
      {label}
    </button>
  )
}

function RenameDialog({
  project,
  onClose,
  onSuccess,
}: {
  project: Project
  onClose: () => void
  onSuccess: () => void
}) {
  const [name, setName] = useState(project.name)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function submit() {
    const trimmed = name.trim()
    if (!trimmed) { setError('Nama tidak boleh kosong.'); return }
    if (trimmed.length > 200) { setError('Nama terlalu panjang.'); return }

    startTransition(async () => {
      const res = await fetch(`/api/v1/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      if (!res.ok) {
        setError('Gagal menyimpan. Coba lagi.')
        return
      }
      onSuccess()
    })
  }

  return (
    <Dialog title="Ganti Nama" onClose={onClose}>
      <label className="block text-sm font-medium text-neutral-700" htmlFor="rename-input">
        Nama kreasi
      </label>
      <input
        id="rename-input"
        type="text"
        value={name}
        onChange={(e) => { setName(e.target.value); setError('') }}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        maxLength={200}
        autoFocus
        className="mt-1.5 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
      />
      {error && <p className="mt-1 text-xs text-danger-600">{error}</p>}
      <DialogActions>
        <CancelButton onClick={onClose} />
        <SubmitButton label="Simpan" loading={isPending} onClick={submit} />
      </DialogActions>
    </Dialog>
  )
}

function DuplicateDialog({
  project,
  onClose,
  onSuccess,
}: {
  project: Project
  onClose: () => void
  onSuccess: (id: string) => void
}) {
  const [name, setName] = useState(`Salinan ${project.name}`)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function submit() {
    const trimmed = name.trim()
    if (!trimmed) { setError('Nama tidak boleh kosong.'); return }

    startTransition(async () => {
      const res = await fetch(`/api/v1/projects/${project.id}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      if (!res.ok) {
        setError('Gagal menduplikasi. Coba lagi.')
        return
      }
      const json = await res.json()
      onSuccess(json.project?.id ?? json.id)
    })
  }

  return (
    <Dialog title="Duplikasi Kreasi" onClose={onClose}>
      <label className="block text-sm font-medium text-neutral-700" htmlFor="dup-input">
        Nama salinan
      </label>
      <input
        id="dup-input"
        type="text"
        value={name}
        onChange={(e) => { setName(e.target.value); setError('') }}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        maxLength={200}
        autoFocus
        className="mt-1.5 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
      />
      {error && <p className="mt-1 text-xs text-danger-600">{error}</p>}
      <DialogActions>
        <CancelButton onClick={onClose} />
        <SubmitButton label="Duplikasi" loading={isPending} onClick={submit} />
      </DialogActions>
    </Dialog>
  )
}

function DeleteDialog({
  project,
  onClose,
  onSuccess,
}: {
  project: Project
  onClose: () => void
  onSuccess: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  function submit() {
    startTransition(async () => {
      const res = await fetch(`/api/v1/projects/${project.id}`, { method: 'DELETE' })
      if (!res.ok) {
        setError('Gagal menghapus. Coba lagi.')
        return
      }
      onSuccess()
    })
  }

  return (
    <Dialog title="Hapus Kreasi" onClose={onClose}>
      <p className="text-sm text-neutral-600">
        Hapus <strong className="text-neutral-900">{project.name}</strong>? Kreasi yang sudah
        dipublish akan langsung tidak tersedia.
      </p>
      {error && <p className="mt-2 text-xs text-danger-600">{error}</p>}
      <DialogActions>
        <CancelButton onClick={onClose} />
        <button
          type="button"
          disabled={isPending}
          onClick={submit}
          className="rounded-md bg-danger-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
        >
          {isPending ? 'Menghapus…' : 'Hapus'}
        </button>
      </DialogActions>
    </Dialog>
  )
}

function Dialog({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" />
      <div className="relative w-full max-w-sm rounded-lg bg-white p-6 shadow-toolbar">
        <h2 className="mb-4 text-base font-semibold text-neutral-900">{title}</h2>
        {children}
      </div>
    </div>
  )
}

function DialogActions({ children }: { children: React.ReactNode }) {
  return <div className="mt-5 flex justify-end gap-2">{children}</div>
}

function CancelButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md px-4 py-2 text-sm text-neutral-600 transition-colors hover:bg-neutral-100"
    >
      Batal
    </button>
  )
}

function SubmitButton({
  label,
  loading,
  onClick,
}: {
  label: string
  loading: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={loading}
      onClick={onClick}
      className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
    >
      {loading ? 'Memproses…' : label}
    </button>
  )
}
