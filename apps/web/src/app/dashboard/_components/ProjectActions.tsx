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
          onClick={(e) => {
            e.preventDefault()
            setOpen((v) => !v)
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          aria-label="Opsi kreasi"
          className="text-text-muted hover:bg-surface-hover hover:text-text-primary flex h-6 w-6 items-center justify-center rounded-sm transition-colors"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
            <circle cx="8" cy="3" r="1.2" />
            <circle cx="8" cy="8" r="1.2" />
            <circle cx="8" cy="13" r="1.2" />
          </svg>
        </button>
        {open && (
          <div className="bg-surface-2 absolute right-0 top-7 z-10 min-w-[140px] rounded-md py-1 shadow-md">
            <MenuItem
              label="Ganti Nama"
              onClick={() => {
                setOpen(false)
                setDialog('rename')
              }}
            />
            <MenuItem
              label="Duplikasi"
              onClick={() => {
                setOpen(false)
                setDialog('duplicate')
              }}
            />
            <MenuItem
              label="Hapus"
              danger
              onClick={() => {
                setOpen(false)
                setDialog('delete')
              }}
            />
          </div>
        )}
      </div>

      {dialog === 'rename' && (
        <RenameDialog
          project={project}
          onClose={() => setDialog(null)}
          onSuccess={() => {
            setDialog(null)
            router.refresh()
          }}
        />
      )}
      {dialog === 'duplicate' && (
        <DuplicateDialog
          project={project}
          onClose={() => setDialog(null)}
          onSuccess={(id) => {
            setDialog(null)
            router.push(`/editor/${id}`)
          }}
        />
      )}
      {dialog === 'delete' && (
        <DeleteDialog
          project={project}
          onClose={() => setDialog(null)}
          onSuccess={() => {
            setDialog(null)
            router.refresh()
          }}
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
      className={`hover:bg-surface-hover w-full px-3 py-1.5 text-left text-sm transition-colors ${
        danger ? 'text-error' : 'text-text-secondary'
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
    if (!trimmed) {
      setError('Nama tidak boleh kosong.')
      return
    }
    if (trimmed.length > 200) {
      setError('Nama terlalu panjang.')
      return
    }

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
      <label className="text-text-secondary block text-sm font-medium" htmlFor="rename-input">
        Nama kreasi
      </label>
      <input
        id="rename-input"
        type="text"
        value={name}
        onChange={(e) => {
          setName(e.target.value)
          setError('')
        }}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        maxLength={200}
        autoFocus
        className="border-border-strong bg-background text-text-primary focus:border-primary focus:ring-primary mt-1.5 w-full rounded-sm border px-3 py-2 text-sm outline-none focus:ring-1"
      />
      {error && <p className="text-error mt-1 text-xs">{error}</p>}
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
    if (!trimmed) {
      setError('Nama tidak boleh kosong.')
      return
    }

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
      <label className="text-text-secondary block text-sm font-medium" htmlFor="dup-input">
        Nama salinan
      </label>
      <input
        id="dup-input"
        type="text"
        value={name}
        onChange={(e) => {
          setName(e.target.value)
          setError('')
        }}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        maxLength={200}
        autoFocus
        className="border-border-strong bg-background text-text-primary focus:border-primary focus:ring-primary mt-1.5 w-full rounded-sm border px-3 py-2 text-sm outline-none focus:ring-1"
      />
      {error && <p className="text-error mt-1 text-xs">{error}</p>}
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
  const [confirmed, setConfirmed] = useState(false)
  const isPublished = project.status === 'published'

  function submit() {
    if (!confirmed) return
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
      <p className="text-text-secondary text-sm">
        Hapus <strong className="text-text-primary">{project.name}</strong>? Tindakan ini tidak
        dapat dibatalkan.
      </p>

      {isPublished && (
        <div className="border-warning/40 bg-warning-subtle mt-3 rounded-md border px-3 py-2.5 text-xs">
          <p className="text-warning font-semibold uppercase tracking-[0.08em]">
            Kreasi ini sudah dipublikasikan
          </p>
          <p className="text-text-secondary mt-1">
            Menghapusnya juga menonaktifkan tautan yang sudah dibagikan — penerima tidak akan bisa
            membukanya lagi.
          </p>
        </div>
      )}

      <label className="text-text-secondary mt-3 flex cursor-pointer items-start gap-2 text-xs">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="accent-error mt-0.5"
        />
        <span>
          {isPublished
            ? 'Saya mengerti tautan publikasi akan mati, dan tetap ingin menghapus kreasi ini.'
            : 'Saya yakin ingin menghapus kreasi ini secara permanen.'}
        </span>
      </label>

      {error && <p className="text-error mt-2 text-xs">{error}</p>}
      <DialogActions>
        <CancelButton onClick={onClose} />
        <button
          type="button"
          disabled={isPending || !confirmed}
          onClick={submit}
          className="bg-error text-text-on-primary hover:bg-error/85 rounded-sm px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
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
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="absolute inset-0 bg-[#031217]/60" aria-hidden="true" />
      <div className="bg-surface-2 relative w-full max-w-sm rounded-lg p-6 shadow-xl">
        <h2 className="text-text-primary mb-4 text-base font-semibold">{title}</h2>
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
      className="text-text-secondary hover:bg-surface-hover rounded-sm px-4 py-2 text-sm transition-colors"
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
      className="bg-primary text-text-on-primary hover:bg-primary-hover rounded-sm px-4 py-2 text-xs font-semibold uppercase tracking-[0.06em] transition-colors disabled:opacity-50"
    >
      {loading ? 'Memproses…' : label}
    </button>
  )
}
