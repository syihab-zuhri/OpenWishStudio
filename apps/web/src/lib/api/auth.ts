import { createSupabaseServerClient } from '@/lib/supabase/server'
import { unauthorized } from './response'

export async function requireAuth() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { user: null, supabase, error: unauthorized() }
  }

  return { user, supabase, error: null }
}
