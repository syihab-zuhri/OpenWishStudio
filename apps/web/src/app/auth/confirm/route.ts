import { createSupabaseServerClient } from '@/lib/supabase/server'
import { safeNext } from '@/lib/safe-next'
import { type EmailOtpType } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = safeNext(searchParams.get('next'))

  const guestImport = searchParams.get('guestImport') === '1'

  if (token_hash && type) {
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })

    if (!error) {
      if (guestImport) {
        redirect(`/auth/import?next=${encodeURIComponent(next)}` as never)
      }
      redirect(next as never)
    }
  }

  redirect('/auth/login?error=link_invalid')
}
