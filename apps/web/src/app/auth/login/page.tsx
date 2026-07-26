'use client'

import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useSearchParams } from 'next/navigation'
import { Suspense, useState, useEffect } from 'react'
import { hasGuestDraft } from '@/lib/guest-draft'
import { safeNext } from '@/lib/safe-next'

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const searchParams = useSearchParams()
  const nextPath = safeNext(searchParams.get('next'))

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState<'email' | 'google' | 'github' | null>(null)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guestDraftPending, setGuestDraftPending] = useState(false)

  useEffect(() => {
    setGuestDraftPending(hasGuestDraft())
  }, [])

  const guestSuffix = guestDraftPending ? '&guestImport=1' : ''

  // Email OTP lands on /auth/confirm (verifies token_hash)
  const confirmUrl =
    `${process.env.NEXT_PUBLIC_APP_URL}/auth/confirm?next=${encodeURIComponent(nextPath)}${guestSuffix}`

  // OAuth lands on /auth/callback (exchanges code for session)
  const callbackUrl =
    `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=${encodeURIComponent(nextPath)}${guestSuffix}`

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading('email')

    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: confirmUrl },
    })

    setLoading(null)
    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
  }

  async function handleOAuth(provider: 'google' | 'github') {
    setError(null)
    setLoading(provider)

    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: callbackUrl,
        scopes: provider === 'google' ? 'email profile' : 'user:email',
      },
    })

    if (error) {
      setLoading(null)
      setError(error.message)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-neutral-900">OpenWish Studio</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Masuk untuk menyimpan dan membagikan kreasimu
          </p>
        </div>

        {guestDraftPending && (
          <div className="mb-4 rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800">
            Kreasimu tersimpan. Masuk untuk menyimpannya ke akunmu secara otomatis.
          </div>
        )}

        <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-panel">
          {sent ? (
            <div className="text-center">
              <div className="mb-3 text-3xl">📧</div>
              <h2 className="text-base font-semibold text-neutral-900">Cek emailmu</h2>
              <p className="mt-2 text-sm text-neutral-500">
                Kami mengirim link masuk ke <strong>{email}</strong>. Link berlaku 10 menit.
              </p>
              <button
                type="button"
                onClick={() => { setSent(false); setEmail('') }}
                className="mt-4 text-sm text-brand-500 hover:underline"
              >
                Ganti email
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <OAuthButton
                  provider="google"
                  label="Masuk dengan Google"
                  loading={loading === 'google'}
                  disabled={loading !== null}
                  onClick={() => handleOAuth('google')}
                  icon={<GoogleIcon />}
                />
                <OAuthButton
                  provider="github"
                  label="Masuk dengan GitHub"
                  loading={loading === 'github'}
                  disabled={loading !== null}
                  onClick={() => handleOAuth('github')}
                  icon={<GitHubIcon />}
                />
              </div>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-neutral-200" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-3 text-xs text-neutral-500">atau</span>
                </div>
              </div>

              <form onSubmit={handleEmailSubmit} className="space-y-3">
                <div>
                  <label htmlFor="email" className="mb-1 block text-xs font-medium text-neutral-700">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="kamu@email.com"
                    className="block w-full rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>

                {error && <p className="text-xs text-danger-600">{error}</p>}

                <button
                  type="submit"
                  disabled={loading !== null || !email}
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
                >
                  {loading === 'email' && <Spinner white />}
                  Kirim Link Masuk
                </button>
              </form>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-neutral-500">
          Dengan masuk kamu menyetujui{' '}
          <span className="text-neutral-700">Syarat &amp; Ketentuan</span> kami.
        </p>
      </div>
    </main>
  )
}

function OAuthButton({
  label,
  loading,
  disabled,
  onClick,
  icon,
}: {
  provider: string
  label: string
  loading: boolean
  disabled: boolean
  onClick: () => void
  icon: React.ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center justify-center gap-2 rounded-md border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-50 disabled:opacity-50"
    >
      {loading ? <Spinner /> : icon}
      {label}
    </button>
  )
}

function Spinner({ white }: { white?: boolean }) {
  return (
    <svg
      className={`h-4 w-4 animate-spin ${white ? 'text-white' : 'text-neutral-500'}`}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

function GitHubIcon() {
  return (
    <svg className="h-4 w-4 text-neutral-900" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  )
}
