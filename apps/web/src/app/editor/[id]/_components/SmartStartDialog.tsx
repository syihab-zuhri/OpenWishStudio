'use client'

import { useState } from 'react'
import {
  createStarterKit,
  type StarterKitInput,
  type StarterKitResult,
  type StarterOccasion,
  type StarterTone,
} from '@/features/editor/utils/starterKits'

interface Props {
  onApply: (kit: StarterKitResult) => void
  onSkip: () => void
}

const OCCASIONS: Array<{ value: StarterOccasion; label: string; detail: string; mark: string }> = [
  { value: 'birthday', label: 'Ulang tahun', detail: 'Ucapan hangat dan ceria', mark: 'BD' },
  { value: 'wedding', label: 'Pernikahan', detail: 'Undangan hari bahagia', mark: 'WD' },
  { value: 'graduation', label: 'Wisuda', detail: 'Rayakan sebuah pencapaian', mark: 'GR' },
  { value: 'anniversary', label: 'Anniversary', detail: 'Kenangan perjalanan bersama', mark: 'AN' },
  {
    value: 'invitation',
    label: 'Undangan lain',
    detail: 'Fleksibel untuk acara apa pun',
    mark: 'IV',
  },
]

const TONES: Array<{ value: StarterTone; label: string; detail: string; colors: string[] }> = [
  {
    value: 'elegant',
    label: 'Elegan',
    detail: 'Hangat, dewasa, editorial',
    colors: ['#173F47', '#B9825A', '#FFF9F1'],
  },
  {
    value: 'cheerful',
    label: 'Ceria',
    detail: 'Berwarna dan penuh energi',
    colors: ['#6D5EF7', '#E86A92', '#F2B84B'],
  },
  {
    value: 'romantic',
    label: 'Romantis',
    detail: 'Lembut dan personal',
    colors: ['#9E3855', '#D78DA0', '#FFF6F7'],
  },
  {
    value: 'minimal',
    label: 'Minimal',
    detail: 'Bersih dan modern',
    colors: ['#182326', '#657276', '#F7F5EF'],
  },
]

export function SmartStartDialog({ onApply, onSkip }: Props) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<StarterKitInput>({
    occasion: 'birthday',
    recipient: '',
    sender: '',
    tone: 'elegant',
    eventAt: '',
    location: '',
  })

  const canContinue = step !== 2 || form.recipient.trim().length > 0

  function finish() {
    onApply(createStarterKit(form))
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="smart-start-title"
      className="fixed inset-0 z-[70] flex items-end justify-center bg-[#031217]/70 p-0 sm:items-center sm:p-5"
    >
      <div className="bg-surface flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-xl shadow-2xl sm:rounded-xl">
        <div className="border-border flex items-start justify-between gap-4 border-b px-5 py-4 sm:px-7 sm:py-5">
          <div>
            <p className="text-primary text-[11px] font-bold uppercase tracking-[0.12em]">
              Smart Start · {step} dari 3
            </p>
            <h2 id="smart-start-title" className="text-text-primary mt-1 text-xl font-semibold">
              Buat fondasi kreasi dalam satu menit
            </h2>
            <p className="text-text-secondary mt-1 text-sm">
              Kami menyiapkan empat scene yang tetap bebas kamu edit.
            </p>
          </div>
          <button
            type="button"
            onClick={onSkip}
            className="text-text-muted hover:bg-surface-hover hover:text-text-primary min-h-11 shrink-0 rounded-sm px-3 text-sm transition-colors"
          >
            Mulai kosong
          </button>
        </div>

        <div className="bg-surface-hover h-1" aria-hidden="true">
          <div
            className="bg-primary h-full transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          {step === 1 && (
            <fieldset>
              <legend className="text-text-primary text-base font-semibold">
                Momen apa yang dibuat?
              </legend>
              <p className="text-text-secondary mt-1 text-sm">
                Pilih struktur cerita yang paling dekat.
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {OCCASIONS.map((item) => {
                  const selected = form.occasion === item.value
                  return (
                    <label
                      key={item.value}
                      className={`focus-within:ring-primary flex min-h-16 cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors focus-within:ring-2 ${
                        selected
                          ? 'border-primary bg-primary-subtle'
                          : 'border-border-strong hover:border-primary/60 bg-background'
                      }`}
                    >
                      <input
                        type="radio"
                        name="occasion"
                        value={item.value}
                        checked={selected}
                        onChange={() =>
                          setForm((current) => ({ ...current, occasion: item.value }))
                        }
                        className="sr-only"
                      />
                      <span className="border-border-strong bg-surface text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold tracking-wider">
                        {item.mark}
                      </span>
                      <span>
                        <span className="text-text-primary block text-sm font-semibold">
                          {item.label}
                        </span>
                        <span className="text-text-muted block text-xs">{item.detail}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </fieldset>
          )}

          {step === 2 && (
            <fieldset className="space-y-4">
              <legend className="text-text-primary text-base font-semibold">
                Untuk siapa kreasi ini?
              </legend>
              <p className="text-text-secondary -mt-3 text-sm">
                Nama ini akan menjadi fokus di scene pembuka.
              </p>
              <label className="block">
                <span className="text-text-secondary text-xs font-semibold">Nama penerima</span>
                <input
                  autoFocus
                  type="text"
                  value={form.recipient}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      recipient: event.target.value.slice(0, 80),
                    }))
                  }
                  placeholder="Contoh: Ibu, Nara, Dimas & Ayu"
                  className="border-border-strong bg-background text-text-primary placeholder:text-text-muted focus:border-primary focus:ring-primary/25 mt-1.5 min-h-11 w-full rounded-md border px-3 text-sm outline-none focus:ring-2"
                />
              </label>
              <label className="block">
                <span className="text-text-secondary text-xs font-semibold">
                  Dari siapa (opsional)
                </span>
                <input
                  type="text"
                  value={form.sender}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, sender: event.target.value.slice(0, 80) }))
                  }
                  placeholder="Namamu atau nama keluarga"
                  className="border-border-strong bg-background text-text-primary placeholder:text-text-muted focus:border-primary focus:ring-primary/25 mt-1.5 min-h-11 w-full rounded-md border px-3 text-sm outline-none focus:ring-2"
                />
              </label>
            </fieldset>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <fieldset>
                <legend className="text-text-primary text-base font-semibold">
                  Pilih suasana visual
                </legend>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {TONES.map((item) => {
                    const selected = form.tone === item.value
                    return (
                      <label
                        key={item.value}
                        className={`focus-within:ring-primary cursor-pointer rounded-md border p-3 focus-within:ring-2 ${
                          selected
                            ? 'border-primary bg-primary-subtle'
                            : 'border-border-strong bg-background'
                        }`}
                      >
                        <input
                          type="radio"
                          name="tone"
                          value={item.value}
                          checked={selected}
                          onChange={() => setForm((current) => ({ ...current, tone: item.value }))}
                          className="sr-only"
                        />
                        <span className="flex gap-1" aria-hidden="true">
                          {item.colors.map((color) => (
                            <span
                              key={color}
                              className="h-5 flex-1 rounded-sm"
                              style={{ background: color }}
                            />
                          ))}
                        </span>
                        <span className="text-text-primary mt-2 block text-sm font-semibold">
                          {item.label}
                        </span>
                        <span className="text-text-muted block text-xs">{item.detail}</span>
                      </label>
                    )
                  })}
                </div>
              </fieldset>

              <div className="border-border grid gap-3 border-t pt-5 sm:grid-cols-2">
                <label className="block">
                  <span className="text-text-secondary text-xs font-semibold">
                    Tanggal acara (opsional)
                  </span>
                  <input
                    type="datetime-local"
                    value={form.eventAt}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, eventAt: event.target.value }))
                    }
                    className="border-border-strong bg-background text-text-primary focus:border-primary mt-1.5 min-h-11 w-full rounded-md border px-3 text-sm outline-none"
                  />
                </label>
                <label className="block">
                  <span className="text-text-secondary text-xs font-semibold">
                    Lokasi (opsional)
                  </span>
                  <input
                    type="text"
                    value={form.location}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        location: event.target.value.slice(0, 300),
                      }))
                    }
                    placeholder="Contoh: Aula Merdeka, Jakarta"
                    className="border-border-strong bg-background text-text-primary placeholder:text-text-muted focus:border-primary mt-1.5 min-h-11 w-full rounded-md border px-3 text-sm outline-none"
                  />
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="border-border flex items-center justify-between border-t px-5 py-4 sm:px-7">
          <button
            type="button"
            onClick={() => setStep((current) => Math.max(1, current - 1))}
            disabled={step === 1}
            className="border-border-strong text-text-secondary hover:bg-surface-hover min-h-11 rounded-sm border px-4 text-sm font-medium disabled:invisible"
          >
            Kembali
          </button>
          <button
            type="button"
            disabled={!canContinue}
            onClick={() => (step === 3 ? finish() : setStep((current) => current + 1))}
            className="bg-primary text-text-on-primary hover:bg-primary-hover min-h-11 rounded-sm px-5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          >
            {step === 3 ? 'Buat 4 scene' : 'Lanjutkan'}
          </button>
        </div>
      </div>
    </div>
  )
}
