import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server'
import { forbidden, unauthorized } from './response'

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

/**
 * Authentication plus a moderator/admin role check.
 *
 * This lived as a copy-pasted local helper in each admin route. One future
 * route forgetting to copy it would expose moderation to every signed-in user,
 * so it belongs in one place.
 *
 * The role is read with the service client on purpose: `profiles` is only
 * readable under RLS by its owner or a moderator, which would otherwise make
 * the check circular.
 */
export async function requireModerator() {
  const { user, supabase, error } = await requireAuth()
  if (error) return { user: null, supabase, serviceClient: null, error }

  const serviceClient = await createSupabaseServiceClient()

  const { data: profile, error: profileError } = await serviceClient
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .maybeSingle()

  if (profileError) {
    console.error('requireModerator:', profileError.message)
    return {
      user: null,
      supabase,
      serviceClient: null,
      error: forbidden('Akses moderator diperlukan.'),
    }
  }

  if (profile?.role !== 'moderator' && profile?.role !== 'admin') {
    return {
      user: null,
      supabase,
      serviceClient: null,
      error: forbidden('Akses moderator diperlukan.'),
    }
  }

  return { user, supabase, serviceClient, error: null }
}
