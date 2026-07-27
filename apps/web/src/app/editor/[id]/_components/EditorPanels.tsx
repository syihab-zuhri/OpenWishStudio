'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import { ProjectDocumentSchema, SceneSchema, type Scene } from '@openwish/project-schema'
import { useEditorStore } from '@/features/editor/store/editorStore'

const MAX_SCENES = 50
const MAX_IMAGE_BYTES = 20 * 1024 * 1024
const MAX_AUDIO_BYTES = 50 * 1024 * 1024

// ─── Shared UI kecil ──────────────────────────────────────────────────────────

function PanelSpinner() {
  return (
    <div className="flex justify-center py-8">
      <div className="border-primary h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" />
    </div>
  )
}

function PanelEmpty({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 pt-10 text-center">
      <span className="text-3xl">{icon}</span>
      <p className="text-text-muted text-[11px]">{text}</p>
    </div>
  )
}

function PanelError({ message }: { message: string }) {
  return (
    <p className="border-error/30 bg-error-subtle text-text-secondary mb-2 rounded-md border px-3 py-2 text-[11px]">
      {message}
    </p>
  )
}

async function fetchJson(input: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(input, init)
  const json = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) throw new Error(json.error ?? 'Terjadi kesalahan jaringan.')
  return json
}

// ─── Panel Template ───────────────────────────────────────────────────────────

interface TemplateListItem {
  id: string
  slug: string
  name: string
  category: string
  thumbnail_url: string | null
}

/** scene_document boleh berupa satu Scene, array Scene, atau ProjectDocument. */
function parseTemplateScenes(doc: unknown): Scene[] | null {
  const asDoc = ProjectDocumentSchema.safeParse(doc)
  if (asDoc.success) return asDoc.data.scenes
  const asScene = SceneSchema.safeParse(doc)
  if (asScene.success) return [asScene.data]
  const asScenes = z.array(SceneSchema).min(1).safeParse(doc)
  if (asScenes.success) return asScenes.data
  return null
}

/** ID scene & elemen di-remap agar unik saat template dipakai berulang. */
function remapSceneIds(scene: Scene): Scene {
  return {
    ...scene,
    id: crypto.randomUUID(),
    elements: scene.elements.map((el) => ({ ...el, id: crypto.randomUUID() })),
  }
}

export function TemplatePanel() {
  const addScenes = useEditorStore((s) => s.addScenes)
  const sceneCount = useEditorStore((s) => s.document.scenes.length)
  const [items, setItems] = useState<TemplateListItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busySlug, setBusySlug] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchJson('/api/v1/templates?limit=50')
      .then((json) => {
        if (!cancelled) setItems((json as { items: TemplateListItem[] }).items)
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setItems([])
          setError(e.message)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function applyTemplate(slug: string) {
    setError(null)
    setBusySlug(slug)
    try {
      const json = (await fetchJson(`/api/v1/templates/${slug}`)) as {
        template?: { scene_document?: unknown }
      }
      const scenes = parseTemplateScenes(json.template?.scene_document)
      if (!scenes) throw new Error('Isi template tidak valid.')
      if (sceneCount + scenes.length > MAX_SCENES) {
        throw new Error(`Batas ${MAX_SCENES} scene per kreasi tercapai.`)
      }
      addScenes(scenes.map(remapSceneIds))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan.')
    } finally {
      setBusySlug(null)
    }
  }

  if (items === null) return <PanelSpinner />

  return (
    <div>
      {error && <PanelError message={error} />}
      {items.length === 0 ? (
        <PanelEmpty icon="⊞" text="Belum ada template yang dipublikasikan." />
      ) : (
        <div className="space-y-2">
          {items.map((tpl) => (
            <div
              key={tpl.id}
              className="border-border bg-background overflow-hidden rounded-md border"
            >
              {tpl.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={tpl.thumbnail_url}
                  alt={tpl.name}
                  loading="lazy"
                  className="bg-surface-2 h-24 w-full object-cover"
                />
              ) : (
                <div className="bg-surface-2 text-text-muted flex h-24 w-full items-center justify-center text-2xl">
                  ⊞
                </div>
              )}
              <div className="flex items-center justify-between gap-2 px-2.5 py-2">
                <div className="min-w-0">
                  <p className="text-text-primary truncate text-xs font-medium">{tpl.name}</p>
                  <p className="text-text-muted text-[10px] capitalize">{tpl.category}</p>
                </div>
                <button
                  type="button"
                  onClick={() => applyTemplate(tpl.slug)}
                  disabled={busySlug !== null}
                  className="bg-primary text-text-on-primary hover:bg-primary-hover shrink-0 rounded-sm px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] transition-colors disabled:opacity-50"
                >
                  {busySlug === tpl.slug ? 'Memuat…' : '+ Tambah'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Panel Aset ───────────────────────────────────────────────────────────────

interface AssetItem {
  id: string
  original_name: string
  mime_type: string
  kind: string
  status: string
  url: string
  created_at: string
}

interface AssetPanelProps {
  kind?: 'image' | 'audio'
  projectId: string
}

/** Ambil aset project yang sudah siap dipakai. */
function useProjectAssets({ kind = 'image', projectId }: AssetPanelProps) {
  const [items, setItems] = useState<AssetItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!projectId) {
      setItems([])
      return
    }
    try {
      const json = (await fetchJson(
        `/api/v1/assets?projectId=${encodeURIComponent(projectId)}&kind=${kind}&limit=50`,
      )) as { items: AssetItem[] }
      setItems(json.items.filter((a) => a.status === 'ready'))
    } catch (e) {
      setItems([])
      setError(e instanceof Error ? e.message : 'Gagal memuat aset.')
    }
  }, [kind, projectId])

  useEffect(() => {
    void load()
  }, [load])

  return { items, setItems, error, setError, load }
}

/** Upload file melalui intent → signed PUT → complete. */
async function uploadProjectAsset(projectId: string, file: File, kind: 'image' | 'audio') {
  const [intent, digest] = await Promise.all([
    fetchJson('/api/v1/assets/upload-intents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        fileName: file.name,
        size: file.size,
        mime: file.type,
        kind,
      }),
    }) as Promise<{ assetId: string; uploadUrl: string }>,
    crypto.subtle.digest('SHA-256', await file.arrayBuffer()),
  ])
  const checksum = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')

  try {
    const putRes = await fetch(intent.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    })
    if (!putRes.ok) throw new Error('Unggahan ke penyimpanan gagal.')

    await fetchJson(`/api/v1/assets/${intent.assetId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checksum }),
    })
  } catch (error) {
    await fetch(`/api/v1/assets/${intent.assetId}`, { method: 'DELETE' }).catch(() => undefined)
    throw error
  }
}

export function AsetPanel() {
  const projectId = useEditorStore((s) => s.projectId)
  const selectedSceneId = useEditorStore((s) => s.selectedSceneId)
  const addElement = useEditorStore((s) => s.addElement)
  const removeAssetReferences = useEditorStore((s) => s.removeAssetReferences)
  const { items, setItems, error, setError, load } = useProjectAssets({
    projectId,
    kind: 'image',
  })
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<AssetItem | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    if (file.size > MAX_IMAGE_BYTES) {
      setError('Ukuran gambar maksimal 20 MB.')
      return
    }
    setUploading(true)
    setError(null)
    try {
      await uploadProjectAsset(projectId, file, 'image')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unggahan gagal.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function deleteAsset(asset: AssetItem) {
    setDeletingId(asset.id)
    setError(null)
    try {
      await fetchJson(`/api/v1/assets/${asset.id}`, { method: 'DELETE' })
      removeAssetReferences(asset.id)
      setItems((current) => current?.filter((item) => item.id !== asset.id) ?? [])
      setConfirmDelete(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menghapus gambar.')
    } finally {
      setDeletingId(null)
    }
  }

  function insertAsset(asset: AssetItem) {
    if (!selectedSceneId) return
    addElement(selectedSceneId, {
      id: crypto.randomUUID(),
      type: 'image',
      x: 45,
      y: 120,
      width: 300,
      height: 300,
      rotation: 0,
      zIndex: 1,
      locked: false,
      props: {
        assetId: asset.id,
        src: asset.url,
        alt: asset.original_name,
        decorative: false,
        objectFit: 'cover',
      },
    })
  }

  return (
    <div>
      {error && <PanelError message={error} />}

      <label
        className={`border-border-strong text-text-secondary hover:border-primary hover:text-primary mb-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed px-3 py-2.5 text-xs font-medium transition-colors ${
          uploading ? 'pointer-events-none opacity-50' : ''
        }`}
      >
        {uploading ? 'Mengunggah…' : '⬆ Unggah Gambar'}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleFile(file)
          }}
        />
      </label>

      {confirmDelete && (
        <div className="border-error/40 bg-error-subtle mb-3 rounded-md border p-3">
          <p className="text-text-primary text-xs font-medium">Hapus gambar ini?</p>
          <p className="text-text-muted mt-1 truncate text-[10px]">{confirmDelete.original_name}</p>
          <p className="text-warning mt-1 text-[10px]">
            File dan semua elemen gambar yang memakai aset ini akan dihapus dari kreasi.
          </p>
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmDelete(null)}
              className="text-text-secondary hover:bg-surface-hover rounded-sm px-2 py-1 text-[10px]"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => void deleteAsset(confirmDelete)}
              disabled={deletingId === confirmDelete.id}
              className="bg-error text-text-on-primary rounded-sm px-2.5 py-1 text-[10px] font-semibold disabled:opacity-50"
            >
              {deletingId === confirmDelete.id ? 'Menghapus…' : 'Ya, Hapus'}
            </button>
          </div>
        </div>
      )}

      {items === null ? (
        <PanelSpinner />
      ) : items.length === 0 ? (
        <PanelEmpty icon="📁" text="Belum ada gambar. Unggah untuk mulai." />
      ) : (
        <>
          {!selectedSceneId && (
            <p className="text-text-muted mb-2 text-[10px]">Pilih scene dulu untuk menyisipkan.</p>
          )}
          <div className="grid grid-cols-3 gap-2 lg:grid-cols-2">
            {items.map((asset) => (
              <div
                key={asset.id}
                className="border-border hover:border-primary group relative aspect-square overflow-hidden rounded-md border transition-colors"
              >
                <button
                  type="button"
                  onClick={() => insertAsset(asset)}
                  disabled={!selectedSceneId || deletingId === asset.id}
                  title={`Sisipkan ${asset.original_name}`}
                  className="h-full w-full disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={asset.url}
                    alt={asset.original_name}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setConfirmDelete(asset)
                  }}
                  aria-label={`Hapus ${asset.original_name}`}
                  className="bg-background/85 text-error hover:bg-error hover:text-text-on-primary absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-sm shadow-sm backdrop-blur-sm lg:h-6 lg:w-6"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Panel Musik ──────────────────────────────────────────────────────────────

interface MusicItem {
  id: string
  title: string
  artist: string | null
  duration_ms: number
  license_code: string
  attribution_text: string | null
  url: string
}

function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function MusikPanel() {
  const projectId = useEditorStore((s) => s.projectId)
  const isGuest = useEditorStore((s) => s.isGuest)
  const soundtrack = useEditorStore((s) => s.document.project.soundtrack)
  const setSoundtrack = useEditorStore((s) => s.setSoundtrack)
  const [items, setItems] = useState<MusicItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const customInputRef = useRef<HTMLInputElement>(null)
  const previewRef = useRef<HTMLAudioElement | null>(null)
  const [volumePct, setVolumePct] = useState(() => Math.round((soundtrack?.volume ?? 1) * 100))
  const customAssets = useProjectAssets({
    projectId: isGuest ? '' : projectId,
    kind: 'audio',
  })

  useEffect(() => {
    let cancelled = false
    fetchJson('/api/v1/music-library?limit=50')
      .then((json) => {
        if (!cancelled) setItems((json as { items: MusicItem[] }).items)
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setItems([])
          setError(e.message)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Hentikan preview saat panel ditutup
  useEffect(() => {
    return () => {
      previewRef.current?.pause()
      previewRef.current = null
    }
  }, [])

  // Sinkron slider bila soundtrack berubah dari luar (mis. undo)
  useEffect(() => {
    setVolumePct(Math.round((soundtrack?.volume ?? 1) * 100))
  }, [soundtrack?.volume])

  function stopPreview() {
    previewRef.current?.pause()
    previewRef.current = null
    setPreviewId(null)
  }

  function togglePreview(item: MusicItem) {
    if (previewId === item.id) {
      stopPreview()
      return
    }
    previewRef.current?.pause()
    const audio = new Audio(item.url)
    audio.onended = () => setPreviewId(null)
    audio.onerror = () => {
      setPreviewId(null)
      setError('File audio tidak dapat diputar. Pastikan file sudah diunggah ke storage.')
    }
    void audio.play().catch(() => {
      setPreviewId(null)
      setError('File audio tidak dapat diputar.')
    })
    previewRef.current = audio
    setPreviewId(item.id)
  }

  function applyTrack(item: MusicItem) {
    stopPreview()
    setError(null)
    setSoundtrack({
      libraryItemId: item.id,
      src: item.url,
      title: item.artist ? `${item.title} — ${item.artist}` : item.title,
      ...(item.attribution_text ? { attribution: item.attribution_text } : {}),
      volume: volumePct / 100,
      loop: soundtrack?.loop ?? true,
    })
  }

  function customAsMusic(asset: AssetItem): MusicItem {
    return {
      id: asset.id,
      title: asset.original_name.replace(/\.[^.]+$/, ''),
      artist: 'Musik Pribadi',
      duration_ms: 0,
      license_code: 'private',
      attribution_text: null,
      url: asset.url,
    }
  }

  function applyCustom(asset: AssetItem) {
    const item = customAsMusic(asset)
    stopPreview()
    setError(null)
    setSoundtrack({
      assetId: asset.id,
      src: asset.url,
      title: item.title,
      volume: volumePct / 100,
      loop: soundtrack?.loop ?? true,
    })
  }

  async function handleCustomFile(file: File) {
    if (file.size > MAX_AUDIO_BYTES) {
      setError('Ukuran audio maksimal 50 MB.')
      return
    }
    setUploading(true)
    setError(null)
    try {
      await uploadProjectAsset(projectId, file, 'audio')
      await customAssets.load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unggahan musik gagal.')
    } finally {
      setUploading(false)
      if (customInputRef.current) customInputRef.current.value = ''
    }
  }

  async function deleteCustom(asset: AssetItem) {
    if (!window.confirm(`Hapus musik pribadi "${asset.original_name}"?`)) return
    setDeletingId(asset.id)
    setError(null)
    try {
      await fetchJson(`/api/v1/assets/${asset.id}`, { method: 'DELETE' })
      customAssets.setItems((current) => current?.filter((item) => item.id !== asset.id) ?? [])
      if (soundtrack?.assetId === asset.id) setSoundtrack(undefined)
      if (previewId === asset.id) stopPreview()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menghapus musik.')
    } finally {
      setDeletingId(null)
    }
  }

  function commitVolume(pct: number) {
    if (!soundtrack) return
    setSoundtrack({ ...soundtrack, volume: pct / 100 })
  }

  return (
    <div>
      {error && <PanelError message={error} />}

      {soundtrack && (
        <div className="border-primary/40 bg-primary-subtle mb-3 space-y-2.5 rounded-md border p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-text-muted text-[10px] font-semibold uppercase tracking-[0.08em]">
                Musik terpasang
              </p>
              <p className="text-text-primary truncate text-xs font-medium">
                {soundtrack.title ?? 'Musik latar'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSoundtrack(undefined)}
              className="text-error hover:bg-error-subtle shrink-0 rounded-sm px-2 py-1 text-[10px] font-medium transition-colors"
            >
              Hapus
            </button>
          </div>

          <label className="block">
            <span className="text-text-secondary flex justify-between text-[10px]">
              Volume <span className="tabular-nums">{volumePct}%</span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={volumePct}
              onChange={(e) => setVolumePct(Number(e.target.value))}
              onPointerUp={() => commitVolume(volumePct)}
              onKeyUp={() => commitVolume(volumePct)}
              className="accent-primary mt-1 w-full"
            />
          </label>

          <label className="text-text-secondary flex cursor-pointer items-center gap-1.5 text-[11px]">
            <input
              type="checkbox"
              checked={soundtrack.loop ?? true}
              onChange={(e) => setSoundtrack({ ...soundtrack, loop: e.target.checked })}
              className="accent-primary rounded-sm"
            />
            Ulangi terus (loop)
          </label>
        </div>
      )}

      <div className="mb-2 flex items-center justify-between">
        <p className="text-text-muted text-[10px] font-semibold uppercase tracking-[0.08em]">
          Musik Pribadi
        </p>
      </div>

      {isGuest ? (
        <div className="border-info/30 bg-info-subtle text-text-secondary mb-4 rounded-md border px-3 py-2 text-[11px]">
          Masuk ke akun untuk mengunggah musik sendiri.
        </div>
      ) : (
        <>
          <label
            className={`border-border-strong text-text-secondary hover:border-primary hover:text-primary mb-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed px-3 py-2.5 text-xs font-medium transition-colors ${
              uploading ? 'pointer-events-none opacity-50' : ''
            }`}
          >
            {uploading ? 'Mengunggah…' : '⬆ Unggah Musik'}
            <input
              ref={customInputRef}
              type="file"
              accept="audio/mpeg,audio/ogg,audio/wav,audio/webm,audio/aac"
              className="sr-only"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleCustomFile(file)
              }}
            />
          </label>

          {customAssets.error && <PanelError message={customAssets.error} />}
          {customAssets.items === null ? (
            <PanelSpinner />
          ) : customAssets.items.length === 0 ? (
            <p className="text-text-muted mb-4 text-center text-[10px]">Belum ada musik pribadi.</p>
          ) : (
            <div className="mb-4 space-y-1.5">
              {customAssets.items.map((asset) => {
                const item = customAsMusic(asset)
                const isActive = soundtrack?.assetId === asset.id
                const isPreviewing = previewId === asset.id
                return (
                  <div
                    key={asset.id}
                    className={`flex items-center gap-2 rounded-md border p-2 transition-colors ${
                      isActive ? 'border-primary bg-primary-subtle' : 'border-border bg-background'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => togglePreview(item)}
                      aria-label={
                        isPreviewing ? `Hentikan ${item.title}` : `Dengarkan ${item.title}`
                      }
                      className="border-border-strong text-text-secondary hover:border-primary hover:text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs"
                    >
                      {isPreviewing ? '⏸' : '▶'}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="text-text-primary truncate text-xs font-medium">{item.title}</p>
                      <p className="text-text-muted text-[10px]">Musik pribadi</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => applyCustom(asset)}
                      disabled={isActive}
                      className="bg-primary text-text-on-primary rounded-sm px-2 py-1.5 text-[10px] font-semibold disabled:opacity-60"
                    >
                      {isActive ? 'Terpasang' : 'Pakai'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteCustom(asset)}
                      disabled={deletingId === asset.id}
                      aria-label={`Hapus ${item.title}`}
                      className="text-error hover:bg-error-subtle rounded-sm px-1.5 py-1 text-sm disabled:opacity-50"
                    >
                      ×
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      <p className="text-text-muted mb-2 text-[10px] font-semibold uppercase tracking-[0.08em]">
        Perpustakaan OpenWish
      </p>

      {items === null ? (
        <PanelSpinner />
      ) : items.length === 0 ? (
        <PanelEmpty icon="♪" text="Perpustakaan musik masih kosong." />
      ) : (
        <div className="space-y-1.5">
          {items.map((item) => {
            const isActive = soundtrack?.libraryItemId === item.id
            const isPreviewing = previewId === item.id
            return (
              <div
                key={item.id}
                className={`flex items-center gap-2 rounded-md border p-2 transition-colors ${
                  isActive ? 'border-primary bg-primary-subtle' : 'border-border bg-background'
                }`}
              >
                <button
                  type="button"
                  onClick={() => togglePreview(item)}
                  aria-label={isPreviewing ? `Hentikan ${item.title}` : `Dengarkan ${item.title}`}
                  className="border-border-strong text-text-secondary hover:border-primary hover:text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs transition-colors"
                >
                  {isPreviewing ? '⏸' : '▶'}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-text-primary truncate text-xs font-medium">{item.title}</p>
                  <p className="text-text-muted truncate text-[10px]">
                    {item.artist ?? 'Tanpa artis'} · {formatDuration(item.duration_ms)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => applyTrack(item)}
                  disabled={isActive}
                  className="bg-primary text-text-on-primary hover:bg-primary-hover shrink-0 rounded-sm px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] transition-colors disabled:opacity-60"
                >
                  {isActive ? 'Terpasang' : 'Pakai'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
