'use client'

import { useEffect, useState } from 'react'
import type { Theme } from '@openwish/project-schema'

interface Props {
  title: string
  url: string
  theme: Theme
}

function safeFilename(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'openwish'
  )
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const anchor = document.createElement('a')
  anchor.href = dataUrl
  anchor.download = filename
  anchor.click()
}

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (context.measureText(candidate).width <= maxWidth || !line) line = candidate
    else {
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  return lines.slice(0, 3)
}

function downloadSocialCover(title: string, url: string, theme: Theme) {
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 630
  const context = canvas.getContext('2d')
  if (!context) return

  context.fillStyle = theme.surface
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = theme.primary
  context.fillRect(0, 0, 28, canvas.height)

  context.globalAlpha = 0.12
  context.fillStyle = theme.secondary
  context.beginPath()
  context.arc(1075, 85, 240, 0, Math.PI * 2)
  context.fill()
  context.globalAlpha = 1

  context.fillStyle = theme.secondary
  context.font = '700 24px Arial, sans-serif'
  context.letterSpacing = '4px'
  context.fillText('SEBUAH KREASI UNTUKMU', 108, 150)

  context.fillStyle = theme.text
  context.font = '700 76px Georgia, serif'
  const lines = wrapText(context, title, 850)
  lines.forEach((line, index) => context.fillText(line, 108, 260 + index * 88))

  context.fillStyle = theme.primary
  context.font = '600 25px Arial, sans-serif'
  context.fillText('Buka cerita lengkapnya', 108, 518)

  context.fillStyle = theme.text
  context.globalAlpha = 0.62
  context.font = '400 20px Arial, sans-serif'
  const shortUrl = url.replace(/^https?:\/\//, '')
  context.fillText(shortUrl.length > 76 ? `${shortUrl.slice(0, 73)}…` : shortUrl, 108, 560)
  context.globalAlpha = 1

  context.fillStyle = theme.text
  context.font = '700 23px Arial, sans-serif'
  context.textAlign = 'right'
  context.fillText('OpenWish Studio', 1090, 570)
  context.textAlign = 'left'

  downloadDataUrl(canvas.toDataURL('image/png'), `${safeFilename(title)}-cover.png`)
}

function ActionIcon({ type }: { type: 'open' | 'share' | 'download' }) {
  if (type === 'open') {
    return (
      <svg
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        className="h-4 w-4"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
          d="M8 5H5.5A1.5 1.5 0 004 6.5v8A1.5 1.5 0 005.5 16h8a1.5 1.5 0 001.5-1.5V12M11 4h5v5M9 11l7-7"
        />
      </svg>
    )
  }
  if (type === 'download') {
    return (
      <svg
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        className="h-4 w-4"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.7"
          d="M10 3v9m0 0l-3.5-3.5M10 12l3.5-3.5M4 15.5h12"
        />
      </svg>
    )
  }
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <circle cx="14.5" cy="4.5" r="2.2" strokeWidth="1.7" />
      <circle cx="5" cy="10" r="2.2" strokeWidth="1.7" />
      <circle cx="14.5" cy="15.5" r="2.2" strokeWidth="1.7" />
      <path strokeWidth="1.7" d="M7 8.9l5.5-3.2M7 11.1l5.5 3.2" />
    </svg>
  )
}

export function ShareCenter({ title, url, theme }: Props) {
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [qrError, setQrError] = useState(false)
  const [nativeShareAvailable, setNativeShareAvailable] = useState(false)

  useEffect(() => {
    setNativeShareAvailable(typeof navigator.share === 'function')
  }, [])

  useEffect(() => {
    let active = true
    import('qrcode')
      .then((module) =>
        module.toDataURL(url, {
          width: 360,
          margin: 2,
          color: { dark: theme.text, light: theme.surface },
          errorCorrectionLevel: 'M',
        }),
      )
      .then((dataUrl) => {
        if (active) setQrDataUrl(dataUrl)
      })
      .catch(() => {
        if (active) setQrError(true)
      })
    return () => {
      active = false
    }
  }, [theme.surface, theme.text, url])

  async function handleNativeShare() {
    try {
      await navigator.share({ title, text: `Lihat kreasi “${title}”`, url })
    } catch {
      // Pengguna dapat membatalkan native share tanpa perlu pesan error.
    }
  }

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`Lihat kreasi “${title}”\n${url}`)}`

  return (
    <section
      aria-labelledby="share-center-title"
      className="border-border bg-background rounded-md border p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id="share-center-title" className="text-text-primary text-sm font-semibold">
            Share Center
          </h3>
          <p className="text-text-muted mt-0.5 text-[11px]">
            Bagikan dengan format yang paling nyaman.
          </p>
        </div>
        <span className="bg-primary-subtle text-primary rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider">
          Siap
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="border-border-strong text-text-secondary hover:border-primary hover:text-primary flex min-h-11 items-center justify-center gap-2 rounded-sm border px-3 text-xs font-semibold transition-colors"
        >
          <ActionIcon type="open" /> Buka tautan
        </a>
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="border-border-strong text-text-secondary hover:border-success hover:text-success flex min-h-11 items-center justify-center gap-2 rounded-sm border px-3 text-xs font-semibold transition-colors"
        >
          <ActionIcon type="share" /> WhatsApp
        </a>
        {nativeShareAvailable && (
          <button
            type="button"
            onClick={handleNativeShare}
            className="border-border-strong text-text-secondary hover:border-primary hover:text-primary flex min-h-11 items-center justify-center gap-2 rounded-sm border px-3 text-xs font-semibold transition-colors"
          >
            <ActionIcon type="share" /> Bagikan
          </button>
        )}
        <button
          type="button"
          onClick={() => downloadSocialCover(title, url, theme)}
          className="border-border-strong text-text-secondary hover:border-primary hover:text-primary flex min-h-11 items-center justify-center gap-2 rounded-sm border px-3 text-xs font-semibold transition-colors"
        >
          <ActionIcon type="download" /> Social cover
        </button>
      </div>

      <div className="border-border mt-4 flex items-center gap-4 border-t pt-4">
        <div className="border-border bg-surface flex h-24 w-24 shrink-0 items-center justify-center rounded-md border p-1.5">
          {qrDataUrl ? (
            // Data URL dibuat lokal dari URL publish; tidak ada permintaan gambar eksternal.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt="QR code tautan publik" className="h-full w-full" />
          ) : qrError ? (
            <span className="text-error px-1 text-center text-[9px]">QR gagal dibuat</span>
          ) : (
            <span
              className="border-primary h-5 w-5 animate-spin rounded-full border-2 border-t-transparent"
              aria-label="Membuat QR code"
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-text-primary text-xs font-semibold">QR untuk cetak atau layar</p>
          <p className="text-text-muted mt-1 text-[10px] leading-relaxed">
            Dibuat lokal dari tautan publish. Tidak dikirim ke layanan QR eksternal.
          </p>
          <button
            type="button"
            disabled={!qrDataUrl}
            onClick={() => downloadDataUrl(qrDataUrl, `${safeFilename(title)}-qr.png`)}
            className="text-primary hover:text-primary-hover mt-2 min-h-9 text-xs font-semibold disabled:opacity-40"
          >
            Unduh QR PNG
          </button>
        </div>
      </div>
    </section>
  )
}
