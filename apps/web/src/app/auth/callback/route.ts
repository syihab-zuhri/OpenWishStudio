import { createSupabaseServerClient } from '@/lib/supabase/server'
import { safeNext } from '@/lib/safe-next'
import { redirect } from 'next/navigation'
import { type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeNext(searchParams.get('next'))
  const guestImport = searchParams.get('guestImport') === '1'

  if (code) {
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      if (guestImport) {
        redirect(`/auth/import?next=${encodeURIComponent(next)}` as never)
      }
      redirect(next as never)
    }
  }

  redirect('/auth/login?error=oauth_failed')
}
